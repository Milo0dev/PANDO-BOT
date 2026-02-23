const {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType,
  ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags,
} = require("discord.js");
const { suggestSettings, suggestions } = require("../utils/database");
const E = require("../utils/embeds");

// ── Colores por estado
const STATUS_COLOR  = { pending: 0x5865F2, approved: 0x57F287, rejected: 0xED4245, considering: 0xFEE75C };
const STATUS_LABEL  = { pending: "⏳ Pendiente", approved: "✅ Aprobada", rejected: "❌ Rechazada", considering: "🤔 En consideración" };
const STATUS_EMOJI  = { pending: "⏳", approved: "✅", rejected: "❌", considering: "🤔" };

// ── Construir el embed de una sugerencia
function buildSuggestEmbed(sug, guild, anonymous = false) {
  const up   = sug.upvotes.length;
  const down = sug.downvotes.length;
  const total = up + down;
  const pct  = total > 0 ? Math.round((up / total) * 100) : 0;
  const barLen = 12;
  const filled = Math.round((pct / 100) * barLen);
  const bar    = "🟢".repeat(filled) + "⚫".repeat(barLen - filled);

  const embed = new EmbedBuilder()
    .setColor(STATUS_COLOR[sug.status] || 0x5865F2)
    .setTitle(`${STATUS_EMOJI[sug.status]} Sugerencia #${sug.num}`)
    .setDescription(`> ${sug.text}`)
    .addFields(
      { name: "👤 Autor",    value: anonymous || !sug.user_id ? "Anónimo" : `<@${sug.user_id}>`, inline: true },
      { name: "📋 Estado",   value: STATUS_LABEL[sug.status] || sug.status, inline: true },
      { name: "📅 Enviada",  value: `<t:${Math.floor(new Date(sug.created_at).getTime() / 1000)}:R>`, inline: true },
      { name: `👍 ${up}  •  👎 ${down}  •  ${pct}% aprobación`, value: bar, inline: false },
    )
    .setTimestamp();

  if (sug.staff_comment && sug.status !== "pending") {
    embed.addFields({ name: `💬 Comentario del staff`, value: sug.staff_comment, inline: false });
  }
  if (sug.reviewed_by && sug.status !== "pending") {
    embed.setFooter({ text: `Revisada por ${sug.reviewed_by}` });
  }

  return embed;
}

// ── Construir botones de votación
function buildVoteButtons(sugId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`suggest_upvote_${sugId}`)
      .setLabel("👍 A favor")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`suggest_downvote_${sugId}`)
      .setLabel("👎 En contra")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("suggest")
    .setDescription("💡 Sistema de sugerencias del servidor")

    // ── Subcomandos públicos
    .addSubcommand(s => s
      .setName("enviar")
      .setDescription("Enviar una sugerencia para el servidor")
      .addStringOption(o => o.setName("texto").setDescription("Tu sugerencia").setRequired(true).setMaxLength(1000)))
    .addSubcommand(s => s
      .setName("ver")
      .setDescription("Ver una sugerencia por número")
      .addIntegerOption(o => o.setName("numero").setDescription("Número de la sugerencia").setRequired(true).setMinValue(1)))

    // ── Subcomandos de staff
    .addSubcommand(s => s
      .setName("aprobar")
      .setDescription("✅ Aprobar una sugerencia (Staff) 🔐")
      .addIntegerOption(o => o.setName("numero").setDescription("Número de la sugerencia").setRequired(true))
      .addStringOption(o => o.setName("comentario").setDescription("Comentario opcional").setRequired(false).setMaxLength(500)))
    .addSubcommand(s => s
      .setName("rechazar")
      .setDescription("❌ Rechazar una sugerencia (Staff) 🔐")
      .addIntegerOption(o => o.setName("numero").setDescription("Número de la sugerencia").setRequired(true))
      .addStringOption(o => o.setName("razon").setDescription("Razón del rechazo").setRequired(false).setMaxLength(500)))
    .addSubcommand(s => s
      .setName("considerar")
      .setDescription("🤔 Marcar sugerencia como en consideración (Staff) 🔐")
      .addIntegerOption(o => o.setName("numero").setDescription("Número de la sugerencia").setRequired(true))
      .addStringOption(o => o.setName("comentario").setDescription("Comentario").setRequired(false).setMaxLength(500)))
    .addSubcommand(s => s
      .setName("stats")
      .setDescription("📊 Ver estadísticas de sugerencias"))

    // ── Configuración (solo admin)
    .addSubcommandGroup(g => g
      .setName("config")
      .setDescription("Configurar el sistema de sugerencias")
      .addSubcommand(s => s
        .setName("setup")
        .setDescription("Configuración inicial")
        .addChannelOption(o => o.setName("canal").setDescription("Canal donde se publican las sugerencias").addChannelTypes(ChannelType.GuildText).setRequired(true)))
      .addSubcommand(s => s
        .setName("activar")
        .setDescription("Activar o desactivar el sistema")
        .addBooleanOption(o => o.setName("estado").setDescription("Activar / desactivar").setRequired(true)))
      .addSubcommand(s => s
        .setName("canales")
        .setDescription("Configurar canales de aprobadas y rechazadas")
        .addChannelOption(o => o.setName("aprobadas").setDescription("Canal de sugerencias aprobadas").addChannelTypes(ChannelType.GuildText).setRequired(false))
        .addChannelOption(o => o.setName("rechazadas").setDescription("Canal de sugerencias rechazadas").addChannelTypes(ChannelType.GuildText).setRequired(false)))
      .addSubcommand(s => s
        .setName("opciones")
        .setDescription("Opciones del sistema")
        .addBooleanOption(o => o.setName("dm").setDescription("Notificar al usuario por DM cuando se revisa su sugerencia").setRequired(false))
        .addBooleanOption(o => o.setName("anonimo").setDescription("Mostrar sugerencias como anónimas").setRequired(false))
        .addIntegerOption(o => o.setName("cooldown").setDescription("Minutos entre sugerencias por usuario").setRequired(false).setMinValue(0).setMaxValue(1440)))
      .addSubcommand(s => s
        .setName("info")
        .setDescription("Ver la configuración actual"))),

  buildSuggestEmbed,
  buildVoteButtons,

  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup(false);
    const sub   = interaction.options.getSubcommand();
    const gid   = interaction.guild.id;
    const ss    = await suggestSettings.get(gid);
    const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
    const ok    = msg => interaction.reply({ embeds: [E.successEmbed(msg)], flags: MessageFlags.Ephemeral });
    const er    = msg => interaction.reply({ embeds: [E.errorEmbed(msg)],   flags: MessageFlags.Ephemeral });

    // ─────────────────── CONFIG ───────────────────
    if (group === "config") {
      if (!isAdmin) return er("Necesitas permiso de **Administrador**.");

      if (sub === "setup") {
        const canal = interaction.options.getChannel("canal");
        await suggestSettings.update(gid, { enabled: true, channel: canal.id });
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(E.Colors.SUCCESS)
            .setTitle("✅ Sistema de Sugerencias Activado")
            .setDescription(`Las sugerencias se publicarán en ${canal}.\nLos usuarios pueden sugerir con \`/suggest enviar\`.`)
            .setTimestamp()],
          flags: MessageFlags.Ephemeral,
        });
      }
      if (sub === "activar") {
        const estado = interaction.options.getBoolean("estado");
        if (estado && !ss?.channel) return er("Configura primero el canal con `/suggest config setup`.");
        await suggestSettings.update(gid, { enabled: estado });
        return ok(`Sistema de sugerencias **${estado ? "✅ activado" : "❌ desactivado"}**.`);
      }
      if (sub === "canales") {
        const aprobadas = interaction.options.getChannel("aprobadas");
        const rechazadas = interaction.options.getChannel("rechazadas");
        const upd = {};
        if (aprobadas)  upd.approved_channel = aprobadas.id;
        if (rechazadas) upd.rejected_channel = rechazadas.id;
        await suggestSettings.update(gid, upd);
        const parts = [];
        if (aprobadas)  parts.push(`Aprobadas → ${aprobadas}`);
        if (rechazadas) parts.push(`Rechazadas → ${rechazadas}`);
        return ok(parts.join("\n") || "Sin cambios.");
      }
      if (sub === "opciones") {
        const dm       = interaction.options.getBoolean("dm");
        const anon     = interaction.options.getBoolean("anonimo");
        const cooldown = interaction.options.getInteger("cooldown");
        const upd = {};
        if (dm       !== null) upd.dm_on_result      = dm;
        if (anon     !== null) upd.anonymous          = anon;
        if (cooldown !== null) upd.cooldown_minutes   = cooldown;
        await suggestSettings.update(gid, upd);
        return ok("Opciones actualizadas.");
      }
      if (sub === "info") {
        const ssNow = await suggestSettings.get(gid);
        const yn    = v => v ? "✅ Sí" : "❌ No";
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("💡 Configuración de Sugerencias")
            .addFields(
              { name: "⚙️ Estado",      value: ssNow?.enabled ? "✅ Activo" : "❌ Inactivo",   inline: true },
              { name: "📢 Canal",       value: ssNow?.channel ? `<#${ssNow.channel}>` : "No configurado", inline: true },
              { name: "📩 DM al revisar", value: yn(ssNow?.dm_on_result), inline: true },
              { name: "🕵️ Anónimo",    value: yn(ssNow?.anonymous),     inline: true },
              { name: "⏱️ Cooldown",    value: `${ssNow?.cooldown_minutes || 0}min`, inline: true },
              { name: "✅ Canal aprobadas",  value: ssNow?.approved_channel ? `<#${ssNow.approved_channel}>` : "No configurado", inline: true },
              { name: "❌ Canal rechazadas", value: ssNow?.rejected_channel ? `<#${ssNow.rejected_channel}>` : "No configurado", inline: true },
            ).setTimestamp()],
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    // ─────────────────── ENVIAR ───────────────────
    if (sub === "enviar") {
      if (!ss?.enabled)  return er("El sistema de sugerencias no está activado.");
      if (!ss?.channel)  return er("No hay canal configurado para sugerencias.");

      const texto = interaction.options.getString("texto");
      const ch    = interaction.guild.channels.cache.get(ss.channel);
      if (!ch) return er("El canal de sugerencias ya no existe. Avisa a un administrador.");

      // Placeholder msg para obtener ID
      const placeholder = await ch.send({ content: "⏳ Cargando sugerencia..." });

      const sug = await suggestions.create(gid, interaction.user.id, texto, placeholder.id, ch.id);
      const embed = buildSuggestEmbed(sug, interaction.guild, ss.anonymous);
      const row   = buildVoteButtons(sug.id);

      await placeholder.edit({ content: null, embeds: [embed], components: [row] });

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(E.Colors.SUCCESS)
          .setTitle("✅ Sugerencia Enviada")
          .setDescription(`Tu sugerencia **#${sug.num}** fue publicada en ${ch}.\n\n> ${texto.substring(0, 200)}`)
          .setTimestamp()],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ─────────────────── VER ───────────────────
    if (sub === "ver") {
      const num = interaction.options.getInteger("numero");
      const sug = await suggestions.getByNum(gid, num);
      if (!sug) return er(`No existe la sugerencia #${num}.`);
      return interaction.reply({ embeds: [buildSuggestEmbed(sug, interaction.guild, ss?.anonymous)], flags: MessageFlags.Ephemeral });
    }

    // ─────────────────── STAFF: APROBAR / RECHAZAR / CONSIDERAR ───────────────────
    if (["aprobar", "rechazar", "considerar"].includes(sub)) {
      if (!isStaff) return er("Necesitas permiso de **Gestionar Mensajes** para revisar sugerencias.");

      const num       = interaction.options.getInteger("numero");
      const comentario = interaction.options.getString("comentario") || interaction.options.getString("razon") || null;
      const sug       = await suggestions.getByNum(gid, num);
      if (!sug) return er(`No existe la sugerencia #${num}.`);
      if (sug.status !== "pending" && sub !== "considerar") {
        return er(`Esta sugerencia ya fue revisada (${STATUS_LABEL[sug.status]}).`);
      }

      const statusMap  = { aprobar: "approved", rechazar: "rejected", considerar: "considering" };
      const newStatus  = statusMap[sub];
      const updated    = await suggestions.setStatus(sug.id, newStatus, interaction.user.tag, comentario);

      // Actualizar el mensaje original en el canal de sugerencias
      const sugCh = interaction.guild.channels.cache.get(ss?.channel);
      if (sugCh && updated.message_id) {
        const msg = await sugCh.messages.fetch(updated.message_id).catch(() => null);
        if (msg) {
          const newEmbed = buildSuggestEmbed(updated, interaction.guild, ss?.anonymous);
          // Deshabilitar botones si está aprobada o rechazada
          const disableVotes = newStatus !== "considering";
          await msg.edit({
            embeds: [newEmbed],
            components: disableVotes ? [] : [buildVoteButtons(sug.id)],
          }).catch(() => {});
        }
      }

      // Mover al canal correspondiente si está configurado
      const targetChId = newStatus === "approved" ? ss?.approved_channel : newStatus === "rejected" ? ss?.rejected_channel : null;
      if (targetChId) {
        const targetCh = interaction.guild.channels.cache.get(targetChId);
        if (targetCh) {
          await targetCh.send({ embeds: [buildSuggestEmbed(updated, interaction.guild, ss?.anonymous)] }).catch(() => {});
        }
      }

      // DM al autor
      if (ss?.dm_on_result && updated.user_id) {
        const author = await interaction.client.users.fetch(updated.user_id).catch(() => null);
        if (author) {
          const dmColor = newStatus === "approved" ? 0x57F287 : newStatus === "rejected" ? 0xED4245 : 0xFEE75C;
          await author.send({
            embeds: [new EmbedBuilder()
              .setColor(dmColor)
              .setTitle(`${STATUS_EMOJI[newStatus]} Tu sugerencia fue ${STATUS_LABEL[newStatus].split(" ")[1]}`)
              .setDescription(`Tu sugerencia **#${sug.num}** en **${interaction.guild.name}** fue revisada.`)
              .addFields(
                { name: "📝 Tu sugerencia", value: sug.text.substring(0, 500), inline: false },
                ...(comentario ? [{ name: "💬 Comentario del staff", value: comentario, inline: false }] : []),
              )
              .setTimestamp()],
          }).catch(() => {});
        }
      }

      return interaction.reply({
        embeds: [E.successEmbed(`Sugerencia **#${num}** marcada como **${STATUS_LABEL[newStatus]}**.`)],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ─────────────────── STATS ───────────────────
    if (sub === "stats") {
      const stat = await suggestions.getStats(gid);
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("📊 Estadísticas de Sugerencias")
          .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
          .addFields(
            { name: "📋 Total",             value: `\`${stat.total}\``,    inline: true },
            { name: "⏳ Pendientes",         value: `\`${stat.pending}\``,  inline: true },
            { name: "✅ Aprobadas",          value: `\`${stat.approved}\``, inline: true },
            { name: "❌ Rechazadas",         value: `\`${stat.rejected}\``, inline: true },
          ).setTimestamp()],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

// Exportar helpers para uso en interactionCreate
module.exports.buildSuggestEmbed = buildSuggestEmbed;
module.exports.buildVoteButtons  = buildVoteButtons;
