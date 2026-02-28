const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { blacklist, staffStats, staffRatings, tags, tickets, settings, autoResponses } = require("../utils/database");
const { updateDashboard } = require("../handlers/dashboardHandler");
const E = require("../utils/embeds");

// ────── /stats ──────────────────────────────────────────────────────
module.exports.stats = {
  data: new SlashCommandBuilder().setName("stats").setDescription("📊 Estadísticas del sistema de tickets")
    .addSubcommand(s => s.setName("server").setDescription("Estadísticas globales del servidor"))
    .addSubcommand(s => s.setName("staff").setDescription("Stats de un miembro del staff")
      .addUserOption(o => o.setName("usuario").setDescription("Staff a consultar").setRequired(false)))
    .addSubcommand(s => s.setName("leaderboard").setDescription("🏆 Ranking del staff por tickets cerrados"))
    .addSubcommand(s => s.setName("ratings").setDescription("⭐ Leaderboard de staff ordenado por calificaciones de usuarios")
      .addStringOption(o => o.setName("periodo").setDescription("Período a mostrar").setRequired(false)
        .addChoices(
          { name: "Todo el tiempo",  value: "all"   },
          { name: "Último mes",      value: "month" },
          { name: "Última semana",   value: "week"  },
        )))
    .addSubcommand(s => s.setName("staffrating").setDescription("⭐ Ver calificaciones detalladas de un miembro del staff")
      .addUserOption(o => o.setName("usuario").setDescription("Miembro del staff").setRequired(true))),

  async execute(interaction) {
    const sub   = interaction.options.getSubcommand();
    const guild = interaction.guild;

    // ── /stats server
    if (sub === "server") {
      const stats = await tickets.getStats(guild.id);
      return interaction.reply({ embeds: [E.statsEmbed(stats, guild.name)] });
    }

    // ── /stats staff
    if (sub === "staff") {
      const user  = interaction.options.getUser("usuario") || interaction.user;
      const s     = await staffStats.get(guild.id, user.id);
      const rData = await staffRatings.getStaffStats(guild.id, user.id);
      if (!s && !rData.total) return interaction.reply({ embeds: [E.infoEmbed("📊 Sin datos", `<@${user.id}> no tiene estadísticas aún.`)], flags: 64 });

      const avgText = rData.avg ? `${"⭐".repeat(Math.floor(rData.avg))}${rData.avg - Math.floor(rData.avg) >= 0.5 ? "✨" : ""} **${rData.avg}/5** (${rData.total} calificaciones)` : "Sin calificaciones aún";

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle(`📊 Stats — ${user.username}`)
          .setColor(E.Colors.PRIMARY)
          .setThumbnail(user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: "🔒 Tickets cerrados",     value: `\`${s?.tickets_closed || 0}\``,   inline: true },
            { name: "👋 Tickets reclamados",   value: `\`${s?.tickets_claimed || 0}\``,  inline: true },
            { name: "📌 Tickets asignados",    value: `\`${s?.tickets_assigned || 0}\``, inline: true },
            { name: "⭐ Calificación promedio", value: avgText,                            inline: false },
          ).setTimestamp()],
      });
    }

    // ── /stats leaderboard (por tickets cerrados)
    if (sub === "leaderboard") {
      const lb = await staffStats.getLeaderboard(guild.id);
      return interaction.reply({ embeds: [E.leaderboardEmbed(lb, guild)] });
    }

    // ── /stats ratings (leaderboard por calificaciones)
    if (sub === "ratings") {
      await interaction.deferReply();
      const periodo = interaction.options.getString("periodo") || "all";
      const lb      = await staffRatings.getLeaderboard(guild.id, 1);

      const periodoLabel = { all: "Todo el tiempo", month: "Último mes", week: "Última semana" };

      if (!lb.length) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(E.Colors.GOLD)
            .setTitle("⭐ Leaderboard de Calificaciones")
            .setDescription("Aún no hay calificaciones registradas.\n\nLas calificaciones aparecen cuando los usuarios califican tickets cerrados.")
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .setTimestamp()],
        });
      }

      // Enriquecer con datos de usuario de Discord
      const enriched = await Promise.all(lb.map(async (entry, i) => {
        try {
          const member = await guild.members.fetch(entry.staff_id).catch(() => null);
          return { ...entry, username: member?.user?.username || `Usuario ${entry.staff_id.slice(-4)}`, avatar: member?.user?.displayAvatarURL({ dynamic: true }) };
        } catch { return { ...entry, username: `Staff ${entry.staff_id.slice(-4)}` }; }
      }));

      return interaction.editReply({ embeds: [E.staffRatingLeaderboard(enriched, guild, periodoLabel[periodo])] });
    }

    // ── /stats staffrating (perfil detallado de calificaciones)
    if (sub === "staffrating") {
      const user  = interaction.options.getUser("usuario");
      const stats = await staffRatings.getStaffStats(guild.id, user.id);
      return interaction.reply({ embeds: [E.staffRatingProfile(user, stats, guild.name)] });
    }
  },
};

// ────── /blacklist ──────────────────────────────────────────────────
module.exports.blacklist = {
  data: new SlashCommandBuilder().setName("blacklist").setDescription("🚫 Gestionar lista negra")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName("add").setDescription("Bloquear usuario").addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true)).addStringOption(o => o.setName("razon").setDescription("Razón").setRequired(false)))
    .addSubcommand(s => s.setName("remove").setDescription("Desbloquear usuario").addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true)))
    .addSubcommand(s => s.setName("list").setDescription("Ver lista negra"))
    .addSubcommand(s => s.setName("check").setDescription("Verificar usuario").addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true))),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === "add") {
      const user  = interaction.options.getUser("usuario");
      const razon = interaction.options.getString("razon") || "Sin razón";
      if (user.id === interaction.user.id) return interaction.reply({ embeds: [E.errorEmbed("No puedes bloquearte a ti mismo.")], flags: 64 });
      await blacklist.add(user.id, interaction.guild.id, razon, interaction.user.id);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(E.Colors.ERROR).setTitle("🚫 Usuario bloqueado").addFields({ name: "👤 Usuario", value: `${user.tag}`, inline: true }, { name: "📋 Razón", value: razon, inline: true }, { name: "🛡️ Por", value: `<@${interaction.user.id}>`, inline: true }).setTimestamp()] });
    }
    if (sub === "remove") {
      const user   = interaction.options.getUser("usuario");
      const result = await blacklist.remove(user.id, interaction.guild.id);
      return interaction.reply({ embeds: [result.changes ? E.successEmbed(`<@${user.id}> removido de la lista negra.`) : E.errorEmbed("Este usuario no está en la lista negra.")] });
    }
    if (sub === "list") {
      const bl = await blacklist.getAll(interaction.guild.id);
      if (!bl.length) return interaction.reply({ embeds: [E.infoEmbed("🚫 Lista Negra", "No hay usuarios bloqueados.")], flags: 64 });
      const list = bl.slice(0, 20).map((b, i) => `**${i+1}.** <@${b.user_id}> — ${b.reason || "Sin razón"}`).join("\n");
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🚫 Lista Negra (${bl.length})`).setColor(E.Colors.ERROR).setDescription(list).setTimestamp()], flags: 64 });
    }
    if (sub === "check") {
      const user  = interaction.options.getUser("usuario");
      const entry = await blacklist.check(user.id, interaction.guild.id);
      if (!entry) return interaction.reply({ embeds: [E.successEmbed(`<@${user.id}> **no** está en la lista negra.`)], flags: 64 });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(E.Colors.ERROR).setTitle("🚫 En lista negra").addFields({ name: "📋 Razón", value: entry.reason || "Sin razón", inline: true }, { name: "🛡️ Por", value: `<@${entry.added_by}>`, inline: true }).setTimestamp()], flags: 64 });
    }
  },
};

// ────── /autoresponse ───────────────────────────────────────────────
module.exports.autoresponse = {
  data: new SlashCommandBuilder().setName("autoresponse").setDescription("🤖 Gestionar auto-respuestas en tickets")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName("add").setDescription("Crear auto-respuesta").addStringOption(o => o.setName("trigger").setDescription("Palabra/frase que activa la respuesta").setRequired(true).setMaxLength(50)).addStringOption(o => o.setName("respuesta").setDescription("Respuesta automática").setRequired(true).setMaxLength(1000)))
    .addSubcommand(s => s.setName("delete").setDescription("Eliminar auto-respuesta").addStringOption(o => o.setName("trigger").setDescription("Trigger a eliminar").setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName("toggle").setDescription("Activar/desactivar auto-respuesta").addStringOption(o => o.setName("trigger").setDescription("Trigger").setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName("list").setDescription("Ver todas las auto-respuestas")),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === "add") {
      const trigger   = interaction.options.getString("trigger");
      const respuesta = interaction.options.getString("respuesta");
      try {
        await autoResponses.create(interaction.guild.id, trigger, respuesta, interaction.user.id);
        return interaction.reply({ embeds: [E.successEmbed(`Auto-respuesta para **"${trigger}"** creada.\nSe activará cuando un usuario mencione esa palabra en un ticket.`)], flags: 64 });
      } catch { return interaction.reply({ embeds: [E.errorEmbed(`Ya existe una auto-respuesta para **"${trigger}"**.`)], flags: 64 }); }
    }
    if (sub === "delete") {
      const trigger = interaction.options.getString("trigger");
      await autoResponses.delete(interaction.guild.id, trigger);
      return interaction.reply({ embeds: [E.successEmbed(`Auto-respuesta **"${trigger}"** eliminada.`)], flags: 64 });
    }
    if (sub === "toggle") {
      const trigger = interaction.options.getString("trigger");
      const r = await autoResponses.toggle(interaction.guild.id, trigger);
      if (!r) return interaction.reply({ embeds: [E.errorEmbed("Auto-respuesta no encontrada.")], flags: 64 });
      return interaction.reply({ embeds: [E.successEmbed(`Auto-respuesta **"${trigger}"**: ${r.enabled ? "✅ Activada" : "❌ Desactivada"}`)], flags: 64 });
    }
    if (sub === "list") {
      const all = await autoResponses.getAll(interaction.guild.id);
      if (!all.length) return interaction.reply({ embeds: [E.infoEmbed("🤖 Auto-respuestas", "No hay auto-respuestas. Usa `/autoresponse add` para crear una.")], flags: 64 });
      const list = all.slice(0, 20).map((a, i) => `**${i+1}.** ${a.enabled ? "✅" : "❌"} \`${a.trigger}\` — ${a.uses} activaciones`).join("\n");
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🤖 Auto-respuestas (${all.length})`).setColor(E.Colors.PRIMARY).setDescription(list).setTimestamp()] });
    }
  },
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const all = (await autoResponses.getAll(interaction.guild.id)).filter(a => a.trigger.toLowerCase().includes(focused)).slice(0, 25);
    return interaction.respond(all.map(a => ({ name: a.trigger, value: a.trigger })));
  },
};

// ────── /maintenance ────────────────────────────────────────────────
module.exports.maintenance = {
  data: new SlashCommandBuilder().setName("maintenance").setDescription("🔧 Modo mantenimiento del sistema de tickets")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName("on").setDescription("Activar mantenimiento").addStringOption(o => o.setName("razon").setDescription("Razón del mantenimiento").setRequired(false)))
    .addSubcommand(s => s.setName("off").setDescription("Desactivar mantenimiento")),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === "on") {
      const razon = interaction.options.getString("razon") || "Mantenimiento programado";
      await settings.update(interaction.guild.id, { maintenance_mode: true, maintenance_reason: razon });
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(E.Colors.WARNING).setTitle("🔧 Mantenimiento Activado").setDescription(`El sistema de tickets está en **mantenimiento**.\n**Razón:** ${razon}\n\nLos usuarios no podrán abrir nuevos tickets hasta que lo desactives.`).setTimestamp()],
      });
    }
    if (sub === "off") {
      await settings.update(interaction.guild.id, { maintenance_mode: false, maintenance_reason: null });
      return interaction.reply({ embeds: [E.successEmbed("Sistema de tickets **reactivado**. Los usuarios pueden abrir tickets nuevamente.")] });
    }
  },
};

// ────── /closeall ───────────────────────────────────────────────────
module.exports.closeAll = {
  data: new SlashCommandBuilder().setName("closeall").setDescription("🔒 Cerrar todos los tickets abiertos")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName("razon").setDescription("Razón del cierre masivo").setRequired(false)),
  async execute(interaction) {
    const razon = interaction.options.getString("razon") || "Cierre masivo por administrador";
    await interaction.deferReply({ flags: 64 });
    const open = await tickets.getAllOpen(interaction.guild.id);
    let closed = 0;
    for (const t of open) {
      try {
        const ch = interaction.guild.channels.cache.get(t.channel_id);
        if (ch) {
          await tickets.close(t.channel_id, interaction.user.id, razon);
          await ch.send({ embeds: [new EmbedBuilder().setColor(E.Colors.ERROR).setDescription(`🔒 Cerrado masivamente por <@${interaction.user.id}>\n**Razón:** ${razon}`).setTimestamp()] }).catch(() => {});
          setTimeout(() => ch.delete().catch(() => {}), 5000);
          closed++;
        }
      } catch {}
    }
    await updateDashboard(interaction.guild);
    return interaction.editReply({ embeds: [E.successEmbed(`Se cerraron **${closed}** tickets correctamente.`)] });
  },
};

// ────── /lockdown ────────────────────────────────────────────────────
module.exports.lockdown = {
  data: new SlashCommandBuilder()
    .setName("lockdown")
    .setDescription("🔒 Bloquear o desbloquear canales para los usuarios")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(s => s
      .setName("lock")
      .setDescription("🔒 Bloquear un canal (usuarios no pueden escribir)")
      .addChannelOption(o => o.setName("canal").setDescription("Canal a bloquear (vacío = canal actual)").setRequired(false))
      .addStringOption(o => o.setName("razon").setDescription("Razón del bloqueo").setRequired(false))
    )
    .addSubcommand(s => s
      .setName("unlock")
      .setDescription("🔓 Desbloquear un canal (usuarios pueden volver a escribir)")
      .addChannelOption(o => o.setName("canal").setDescription("Canal a desbloquear (vacío = canal actual)").setRequired(false))
      .addStringOption(o => o.setName("razon").setDescription("Razón del desbloqueo").setRequired(false))
    )
    .addSubcommand(s => s
      .setName("all")
      .setDescription("🌐 Bloquear o desbloquear TODOS los canales del servidor")
      .addStringOption(o => o.setName("accion").setDescription("lock o unlock").setRequired(true)
        .addChoices({ name: "🔒 Bloquear todo", value: "lock" }, { name: "🔓 Desbloquear todo", value: "unlock" }))
      .addStringOption(o => o.setName("razon").setDescription("Razón").setRequired(false))
    ),

  async execute(interaction) {
    const sub   = interaction.options.getSubcommand();
    const razon = interaction.options.getString("razon") || "Sin razón especificada";
    const guild = interaction.guild;
    const everyoneRole = guild.roles.everyone;

    // ── lock / unlock de un canal
    if (sub === "lock" || sub === "unlock") {
      const canal  = interaction.options.getChannel("canal") || interaction.channel;
      const locking = sub === "lock";

      await interaction.deferReply({ flags: 64 });

      try {
        // Aplicar el permiso: deny SendMessages para lock, null (heredar) para unlock
        await canal.permissionOverwrites.edit(everyoneRole, {
          SendMessages: locking ? false : null,
          AddReactions: locking ? false : null,
        });

        // Mensaje en el canal afectado
        await canal.send({
          embeds: [new EmbedBuilder()
            .setColor(locking ? E.Colors.ERROR : E.Colors.SUCCESS)
            .setTitle(locking ? "🔒 Canal Bloqueado" : "🔓 Canal Desbloqueado")
            .setDescription(
              locking
                ? `Este canal ha sido **bloqueado** temporalmente.\nLos usuarios no pueden enviar mensajes.\n\n**Razón:** ${razon}`
                : `Este canal ha sido **desbloqueado**.\nLos usuarios pueden volver a escribir.\n\n**Razón:** ${razon}`
            )
            .addFields({ name: "🛡️ Por", value: `<@${interaction.user.id}>`, inline: true })
            .setTimestamp()],
        }).catch(() => {});

        return interaction.editReply({
          embeds: [E.successEmbed(
            locking
              ? `Canal ${canal} bloqueado correctamente.\nLos usuarios pueden ver pero no escribir.`
              : `Canal ${canal} desbloqueado correctamente.`
          )],
        });
      } catch (err) {
        return interaction.editReply({ embeds: [E.errorEmbed(`No se pudo ${locking ? "bloquear" : "desbloquear"} el canal. Verifica mis permisos.`)] });
      }
    }

    // ── lock / unlock de TODOS los canales
    if (sub === "all") {
      const accion  = interaction.options.getString("accion");
      const locking = accion === "lock";

      await interaction.deferReply({ flags: 64 });

      const textChannels = guild.channels.cache.filter(c =>
        c.type === 0 && // GuildText
        c.permissionsFor(interaction.client.user)?.has("ManageChannels")
      );

      let count = 0;
      for (const [, canal] of textChannels) {
        try {
          await canal.permissionOverwrites.edit(everyoneRole, {
            SendMessages: locking ? false : null,
            AddReactions: locking ? false : null,
          });

          // Solo enviar mensaje en canales donde el bot pueda escribir
          if (canal.permissionsFor(interaction.client.user)?.has("SendMessages")) {
            await canal.send({
              embeds: [new EmbedBuilder()
                .setColor(locking ? E.Colors.ERROR : E.Colors.SUCCESS)
                .setTitle(locking ? "🔒 Servidor Bloqueado" : "🔓 Servidor Desbloqueado")
                .setDescription(
                  locking
                    ? `El servidor ha sido puesto en **modo bloqueo**.\n**Razón:** ${razon}`
                    : `El servidor ha sido **desbloqueado**.\n**Razón:** ${razon}`
                )
                .addFields({ name: "🛡️ Por", value: `<@${interaction.user.id}>`, inline: true })
                .setTimestamp()],
            }).catch(() => {});
          }
          count++;
        } catch {}
      }

      return interaction.editReply({
        embeds: [E.successEmbed(
          locking
            ? `🔒 **${count} canales** bloqueados correctamente.\nLos usuarios pueden ver pero no escribir en ningún canal.`
            : `🔓 **${count} canales** desbloqueados correctamente.`
        )],
      });
    }
  },
};
