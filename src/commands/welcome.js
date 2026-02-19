const {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ChannelType,
} = require("discord.js");
const { welcomeSettings } = require("../utils/database");
const E = require("../utils/embeds");

// ── Variables disponibles como ayuda
const VARS = "`{mention}` `{user}` `{tag}` `{server}` `{count}` `{id}`";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("🎉 Configurar el sistema de bienvenidas y despedidas")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // ── BIENVENIDA
    .addSubcommandGroup(g => g
      .setName("bienvenida")
      .setDescription("Configurar mensajes de bienvenida")
      .addSubcommand(s => s.setName("activar").setDescription("Activar o desactivar bienvenidas")
        .addBooleanOption(o => o.setName("estado").setDescription("Activar / desactivar").setRequired(true)))
      .addSubcommand(s => s.setName("canal").setDescription("Canal donde se envían las bienvenidas")
        .addChannelOption(o => o.setName("canal").setDescription("Canal").addChannelTypes(ChannelType.GuildText).setRequired(true)))
      .addSubcommand(s => s.setName("mensaje").setDescription(`Mensaje de bienvenida. Variables: ${VARS}`)
        .addStringOption(o => o.setName("texto").setDescription("Mensaje (usa las variables disponibles)").setRequired(true).setMaxLength(1000)))
      .addSubcommand(s => s.setName("titulo").setDescription("Título del embed de bienvenida")
        .addStringOption(o => o.setName("texto").setDescription("Título").setRequired(true).setMaxLength(100)))
      .addSubcommand(s => s.setName("color").setDescription("Color del embed en hexadecimal (ej: 5865F2)")
        .addStringOption(o => o.setName("hex").setDescription("Color HEX sin el #").setRequired(true).setMaxLength(6)))
      .addSubcommand(s => s.setName("footer").setDescription("Texto del footer del embed")
        .addStringOption(o => o.setName("texto").setDescription("Footer").setRequired(true).setMaxLength(200)))
      .addSubcommand(s => s.setName("banner").setDescription("URL de imagen de banner en el embed")
        .addStringOption(o => o.setName("url").setDescription("URL de imagen (https://...)").setRequired(false)))
      .addSubcommand(s => s.setName("avatar").setDescription("Mostrar/ocultar avatar del nuevo miembro")
        .addBooleanOption(o => o.setName("mostrar").setDescription("Mostrar avatar").setRequired(true)))
      .addSubcommand(s => s.setName("dm").setDescription("Enviar DM de bienvenida al nuevo miembro")
        .addBooleanOption(o => o.setName("estado").setDescription("Activar / desactivar").setRequired(true))
        .addStringOption(o => o.setName("mensaje").setDescription(`Mensaje del DM. Variables: ${VARS}`).setRequired(false).setMaxLength(1000)))
      .addSubcommand(s => s.setName("autorole").setDescription("Rol que se asigna automáticamente al entrar")
        .addRoleOption(o => o.setName("rol").setDescription("Rol (vacío = desactivar)").setRequired(false)))
      .addSubcommand(s => s.setName("test").setDescription("Enviar un mensaje de bienvenida de prueba"))
    )

    // ── DESPEDIDA
    .addSubcommandGroup(g => g
      .setName("despedida")
      .setDescription("Configurar mensajes de despedida")
      .addSubcommand(s => s.setName("activar").setDescription("Activar o desactivar despedidas")
        .addBooleanOption(o => o.setName("estado").setDescription("Activar / desactivar").setRequired(true)))
      .addSubcommand(s => s.setName("canal").setDescription("Canal donde se envían las despedidas")
        .addChannelOption(o => o.setName("canal").setDescription("Canal").addChannelTypes(ChannelType.GuildText).setRequired(true)))
      .addSubcommand(s => s.setName("mensaje").setDescription(`Mensaje de despedida. Variables: ${VARS}`)
        .addStringOption(o => o.setName("texto").setDescription("Mensaje").setRequired(true).setMaxLength(1000)))
      .addSubcommand(s => s.setName("titulo").setDescription("Título del embed de despedida")
        .addStringOption(o => o.setName("texto").setDescription("Título").setRequired(true).setMaxLength(100)))
      .addSubcommand(s => s.setName("color").setDescription("Color del embed en hexadecimal (ej: ED4245)")
        .addStringOption(o => o.setName("hex").setDescription("Color HEX sin el #").setRequired(true).setMaxLength(6)))
      .addSubcommand(s => s.setName("footer").setDescription("Texto del footer del embed de despedida")
        .addStringOption(o => o.setName("texto").setDescription("Footer").setRequired(true).setMaxLength(200)))
      .addSubcommand(s => s.setName("avatar").setDescription("Mostrar/ocultar avatar del miembro que salió")
        .addBooleanOption(o => o.setName("mostrar").setDescription("Mostrar avatar").setRequired(true)))
      .addSubcommand(s => s.setName("test").setDescription("Enviar un mensaje de despedida de prueba"))
    )

    // ── INFO
    .addSubcommand(s => s.setName("info").setDescription("Ver la configuración actual de bienvenidas y despedidas")),

  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup(false);
    const sub   = interaction.options.getSubcommand();
    const gid   = interaction.guild.id;
    const ws    = welcomeSettings.get(gid);

    const ok = msg => interaction.reply({ embeds: [E.successEmbed(msg)], ephemeral: true });
    const er = msg => interaction.reply({ embeds: [E.errorEmbed(msg)], ephemeral: true });

    // ──────────────────────────────────────────────
    //   /welcome info
    // ──────────────────────────────────────────────
    if (!group && sub === "info") {
      const yn = v => v ? "✅ Sí" : "❌ No";
      const ch = id => id ? `<#${id}>` : "❌ No configurado";
      const rl = id => id ? `<@&${id}>` : "❌ Ninguno";

      const embed = new EmbedBuilder()
        .setTitle("🎉 Configuración de Bienvenidas y Despedidas")
        .setColor(0x5865F2)
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .addFields(
          { name: "━━━ 👋 Bienvenida ━━━", value: "\u200b", inline: false },
          { name: "Estado",       value: yn(ws.welcome_enabled),       inline: true },
          { name: "Canal",        value: ch(ws.welcome_channel),       inline: true },
          { name: "DM",           value: yn(ws.welcome_dm),            inline: true },
          { name: "Título",       value: ws.welcome_title || "Default", inline: true },
          { name: "Color",        value: `#${ws.welcome_color}`,       inline: true },
          { name: "Avatar",       value: yn(ws.welcome_thumbnail),     inline: true },
          { name: "Auto-rol",     value: rl(ws.welcome_autorole),      inline: true },
          { name: "Banner",       value: ws.welcome_banner ? "✅ Configurado" : "❌ No", inline: true },
          { name: "Mensaje",      value: `\`\`\`${(ws.welcome_message || "").substring(0, 100)}\`\`\``, inline: false },
          { name: "━━━ 👋 Despedida ━━━", value: "\u200b", inline: false },
          { name: "Estado",       value: yn(ws.goodbye_enabled),       inline: true },
          { name: "Canal",        value: ch(ws.goodbye_channel),       inline: true },
          { name: "Título",       value: ws.goodbye_title || "Default", inline: true },
          { name: "Color",        value: `#${ws.goodbye_color}`,       inline: true },
          { name: "Avatar",       value: yn(ws.goodbye_thumbnail),     inline: true },
          { name: "\u200b",       value: "\u200b",                     inline: true },
          { name: "Mensaje",      value: `\`\`\`${(ws.goodbye_message || "").substring(0, 100)}\`\`\``, inline: false },
        )
        .setFooter({ text: "Usa /welcome bienvenida o /welcome despedida para configurar" })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ──────────────────────────────────────────────
    //   BIENVENIDA subcomandos
    // ──────────────────────────────────────────────
    if (group === "bienvenida") {
      if (sub === "activar") {
        const estado = interaction.options.getBoolean("estado");
        welcomeSettings.update(gid, { welcome_enabled: estado });
        return ok(`Bienvenidas **${estado ? "✅ activadas" : "❌ desactivadas"}**.`);
      }
      if (sub === "canal") {
        welcomeSettings.update(gid, { welcome_channel: interaction.options.getChannel("canal").id });
        return ok(`Canal de bienvenida: ${interaction.options.getChannel("canal")}`);
      }
      if (sub === "mensaje") {
        welcomeSettings.update(gid, { welcome_message: interaction.options.getString("texto") });
        return ok(`Mensaje de bienvenida actualizado.\n**Variables disponibles:** ${VARS}`);
      }
      if (sub === "titulo") {
        welcomeSettings.update(gid, { welcome_title: interaction.options.getString("texto") });
        return ok(`Título actualizado: **${interaction.options.getString("texto")}**`);
      }
      if (sub === "color") {
        const hex = interaction.options.getString("hex").replace("#", "");
        if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return er("Color inválido. Usa formato HEX de 6 caracteres (ej: `5865F2`).");
        welcomeSettings.update(gid, { welcome_color: hex });
        return ok(`Color actualizado: **#${hex}**`);
      }
      if (sub === "footer") {
        welcomeSettings.update(gid, { welcome_footer: interaction.options.getString("texto") });
        return ok("Footer de bienvenida actualizado.");
      }
      if (sub === "banner") {
        const url = interaction.options.getString("url");
        if (url && !url.startsWith("http")) return er("La URL debe empezar con `https://`");
        welcomeSettings.update(gid, { welcome_banner: url || null });
        return ok(url ? `Banner configurado.` : "Banner eliminado.");
      }
      if (sub === "avatar") {
        welcomeSettings.update(gid, { welcome_thumbnail: interaction.options.getBoolean("mostrar") });
        return ok(`Avatar del miembro en bienvenidas: **${interaction.options.getBoolean("mostrar") ? "✅ visible" : "❌ oculto"}**`);
      }
      if (sub === "dm") {
        const estado = interaction.options.getBoolean("estado");
        const msg    = interaction.options.getString("mensaje");
        const update = { welcome_dm: estado };
        if (msg) update.welcome_dm_message = msg;
        welcomeSettings.update(gid, update);
        return ok(`DM de bienvenida: **${estado ? "✅ activado" : "❌ desactivado"}**${msg ? "\nMensaje de DM actualizado." : ""}`);
      }
      if (sub === "autorole") {
        const rol = interaction.options.getRole("rol");
        welcomeSettings.update(gid, { welcome_autorole: rol ? rol.id : null });
        return ok(rol ? `Auto-rol configurado: ${rol}` : "Auto-rol **desactivado**.");
      }
      if (sub === "test") {
        await interaction.deferReply({ ephemeral: true });
        const wsCurrent = welcomeSettings.get(gid);
        if (!wsCurrent.welcome_channel) return interaction.editReply({ embeds: [E.errorEmbed("Configura primero el canal con `/welcome bienvenida canal`")] });
        const ch = interaction.guild.channels.cache.get(wsCurrent.welcome_channel);
        if (!ch) return interaction.editReply({ embeds: [E.errorEmbed("Canal no encontrado.")] });

        // Simular member con el usuario actual
        const fakeMember = interaction.member;
        const color = parseInt(wsCurrent.welcome_color || "5865F2", 16);
        const embed = new EmbedBuilder()
          .setColor(color)
          .setTitle(fill(wsCurrent.welcome_title || "👋 ¡Bienvenido/a!", fakeMember, interaction.guild))
          .setDescription(fill(wsCurrent.welcome_message || "Bienvenido {mention}!", fakeMember, interaction.guild))
          .setTimestamp();
        if (wsCurrent.welcome_thumbnail !== false) embed.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }));
        if (wsCurrent.welcome_banner) embed.setImage(wsCurrent.welcome_banner);
        if (wsCurrent.welcome_footer) embed.setFooter({ text: fill(wsCurrent.welcome_footer, fakeMember, interaction.guild), iconURL: interaction.guild.iconURL({ dynamic: true }) });
        embed.addFields(
          { name: "👤 Usuario",       value: interaction.user.tag,                                               inline: true },
          { name: "📅 Cuenta creada", value: `<t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>`,   inline: true },
          { name: "👥 Miembro #",     value: `\`${interaction.guild.memberCount}\``,                             inline: true },
        );
        await ch.send({ content: `<@${interaction.user.id}> *(esto es un test)*`, embeds: [embed] });
        return interaction.editReply({ embeds: [E.successEmbed(`Test enviado a ${ch}.`)] });
      }
    }

    // ──────────────────────────────────────────────
    //   DESPEDIDA subcomandos
    // ──────────────────────────────────────────────
    if (group === "despedida") {
      if (sub === "activar") {
        const estado = interaction.options.getBoolean("estado");
        welcomeSettings.update(gid, { goodbye_enabled: estado });
        return ok(`Despedidas **${estado ? "✅ activadas" : "❌ desactivadas"}**.`);
      }
      if (sub === "canal") {
        welcomeSettings.update(gid, { goodbye_channel: interaction.options.getChannel("canal").id });
        return ok(`Canal de despedida: ${interaction.options.getChannel("canal")}`);
      }
      if (sub === "mensaje") {
        welcomeSettings.update(gid, { goodbye_message: interaction.options.getString("texto") });
        return ok(`Mensaje de despedida actualizado.\n**Variables disponibles:** ${VARS}`);
      }
      if (sub === "titulo") {
        welcomeSettings.update(gid, { goodbye_title: interaction.options.getString("texto") });
        return ok(`Título actualizado: **${interaction.options.getString("texto")}**`);
      }
      if (sub === "color") {
        const hex = interaction.options.getString("hex").replace("#", "");
        if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return er("Color inválido. Usa formato HEX de 6 caracteres (ej: `ED4245`).");
        welcomeSettings.update(gid, { goodbye_color: hex });
        return ok(`Color actualizado: **#${hex}**`);
      }
      if (sub === "footer") {
        welcomeSettings.update(gid, { goodbye_footer: interaction.options.getString("texto") });
        return ok("Footer de despedida actualizado.");
      }
      if (sub === "avatar") {
        welcomeSettings.update(gid, { goodbye_thumbnail: interaction.options.getBoolean("mostrar") });
        return ok(`Avatar en despedidas: **${interaction.options.getBoolean("mostrar") ? "✅ visible" : "❌ oculto"}**`);
      }
      if (sub === "test") {
        await interaction.deferReply({ ephemeral: true });
        const wsCurrent = welcomeSettings.get(gid);
        if (!wsCurrent.goodbye_channel) return interaction.editReply({ embeds: [E.errorEmbed("Configura primero el canal con `/welcome despedida canal`")] });
        const ch = interaction.guild.channels.cache.get(wsCurrent.goodbye_channel);
        if (!ch) return interaction.editReply({ embeds: [E.errorEmbed("Canal no encontrado.")] });

        const fakeMember = interaction.member;
        const color = parseInt(wsCurrent.goodbye_color || "ED4245", 16);
        const embed = new EmbedBuilder()
          .setColor(color)
          .setTitle(fill(wsCurrent.goodbye_title || "👋 Hasta luego", fakeMember, interaction.guild))
          .setDescription(fill(wsCurrent.goodbye_message || "**{user}** ha salido del servidor.", fakeMember, interaction.guild))
          .setTimestamp();
        if (wsCurrent.goodbye_thumbnail !== false) embed.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }));
        if (wsCurrent.goodbye_footer) embed.setFooter({ text: fill(wsCurrent.goodbye_footer, fakeMember, interaction.guild), iconURL: interaction.guild.iconURL({ dynamic: true }) });
        embed.addFields(
          { name: "👤 Usuario",   value: interaction.user.tag,    inline: true },
          { name: "🆔 ID",        value: `\`${interaction.user.id}\``, inline: true },
          { name: "👥 Quedamos",  value: `\`${interaction.guild.memberCount}\` miembros`, inline: true },
          { name: "🏷️ Tenía roles", value: "*(test)*", inline: false },
        );
        await ch.send({ embeds: [embed] });
        return interaction.editReply({ embeds: [E.successEmbed(`Test de despedida enviado a ${ch}.`)] });
      }
    }
  },
};

function fill(text, member, guild) {
  if (!text) return "";
  const user = member.user || member;
  return text
    .replace(/{mention}/g, `<@${member.id}>`)
    .replace(/{user}/g,    user.username)
    .replace(/{tag}/g,     user.tag || user.username)
    .replace(/{server}/g,  guild.name)
    .replace(/{count}/g,   String(guild.memberCount))
    .replace(/{id}/g,      member.id);
}
