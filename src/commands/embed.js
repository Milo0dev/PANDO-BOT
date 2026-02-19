const {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, MessageFlags,
} = require("discord.js");
const E = require("../utils/embeds");

// ── Validar color HEX
function parseColor(hex) {
  if (!hex) return null;
  const clean = hex.replace("#", "").trim();
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return null;
  return parseInt(clean, 16);
}

// ── Formatear timestamp ISO a Unix
function parseTimestamp(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 1000);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("✨ Constructor de embeds personalizados")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)

    // ── Crear embed completo
    .addSubcommand(s => s
      .setName("crear")
      .setDescription("Crear y enviar un embed con formulario interactivo")
      .addChannelOption(o => o.setName("canal").setDescription("Canal donde enviar el embed").addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addStringOption(o => o.setName("color").setDescription("Color HEX sin # (ej: 5865F2)").setRequired(false).setMaxLength(6))
      .addStringOption(o => o.setName("imagen").setDescription("URL de imagen grande").setRequired(false))
      .addStringOption(o => o.setName("thumbnail").setDescription("URL de miniatura (arriba a la derecha)").setRequired(false))
      .addStringOption(o => o.setName("footer").setDescription("Texto del pie").setRequired(false).setMaxLength(200))
      .addStringOption(o => o.setName("autor").setDescription("Texto del autor (arriba del todo)").setRequired(false).setMaxLength(200))
      .addStringOption(o => o.setName("autor_icono").setDescription("URL del icono del autor").setRequired(false))
      .addBooleanOption(o => o.setName("timestamp").setDescription("Mostrar fecha y hora actual en el footer").setRequired(false))
      .addStringOption(o => o.setName("mencionar").setDescription("Mencionar a alguien o un rol junto al embed (ej: @Todos)").setRequired(false)))

    // ── Editar un embed existente del bot
    .addSubcommand(s => s
      .setName("editar")
      .setDescription("Editar un embed existente enviado por el bot")
      .addStringOption(o => o.setName("mensaje_id").setDescription("ID del mensaje a editar").setRequired(true))
      .addChannelOption(o => o.setName("canal").setDescription("Canal donde está el mensaje").addChannelTypes(ChannelType.GuildText).setRequired(false)))

    // ── Enviar embed simple rápido
    .addSubcommand(s => s
      .setName("rapido")
      .setDescription("Enviar un embed rápido con título y descripción")
      .addChannelOption(o => o.setName("canal").setDescription("Canal destino").addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addStringOption(o => o.setName("titulo").setDescription("Título").setRequired(true).setMaxLength(200))
      .addStringOption(o => o.setName("descripcion").setDescription("Descripción").setRequired(true).setMaxLength(2000))
      .addStringOption(o => o.setName("color").setDescription("Color HEX sin #").setRequired(false).setMaxLength(6))
      .addStringOption(o => o.setName("mencionar").setDescription("Mención al enviar").setRequired(false)))

    // ── Embed de anuncio preformateado
    .addSubcommand(s => s
      .setName("anuncio")
      .setDescription("Plantilla de anuncio profesional")
      .addChannelOption(o => o.setName("canal").setDescription("Canal destino").addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addStringOption(o => o.setName("titulo").setDescription("Título del anuncio").setRequired(true).setMaxLength(200))
      .addStringOption(o => o.setName("texto").setDescription("Contenido del anuncio").setRequired(true).setMaxLength(2000))
      .addStringOption(o => o.setName("mencionar").setDescription("Mención — ej: @everyone, @Miembros").setRequired(false))
      .addStringOption(o => o.setName("imagen").setDescription("URL de imagen del anuncio").setRequired(false))
      .addStringOption(o => o.setName("color").setDescription("Color HEX sin # (default: amarillo)").setRequired(false))),

  async execute(interaction) {
    const sub   = interaction.options.getSubcommand();
    const er    = msg => interaction.reply({ embeds: [E.errorEmbed(msg)], flags: MessageFlags.Ephemeral });

    // ─────────────────────────────────────────────
    //   /embed crear  — abre modal para título y descripción
    // ─────────────────────────────────────────────
    if (sub === "crear") {
      const colorRaw  = interaction.options.getString("color");
      const imagen    = interaction.options.getString("imagen");
      const thumb     = interaction.options.getString("thumbnail");
      const footer    = interaction.options.getString("footer");
      const autor     = interaction.options.getString("autor");
      const autorIcon = interaction.options.getString("autor_icono");
      const ts        = interaction.options.getBoolean("timestamp");
      const mencionar = interaction.options.getString("mencionar");
      const canal     = interaction.options.getChannel("canal");

      if (colorRaw && !parseColor(colorRaw))
        return er("Color inválido. Usa formato HEX de 6 caracteres sin `#` (ej: `5865F2`).");
      if (imagen && !imagen.startsWith("http"))
        return er("La URL de imagen debe empezar con `https://`.");
      if (thumb && !thumb.startsWith("http"))
        return er("La URL de thumbnail debe empezar con `https://`.");

      // Guardar los options en el customId del modal
      const payload = JSON.stringify({
        canal:     canal.id,
        color:     colorRaw || null,
        imagen:    imagen   || null,
        thumb:     thumb    || null,
        footer:    footer   || null,
        autor:     autor    || null,
        autorIcon: autorIcon || null,
        ts:        ts ?? false,
        mencionar: mencionar || null,
      });

      // Usar un ID corto para el modal (max 100 chars)
      const modalId = "embed_create_" + Date.now().toString(36);

      // Guardar el payload en memoria temporal
      if (!interaction.client._embedPayloads) interaction.client._embedPayloads = new Map();
      interaction.client._embedPayloads.set(modalId, payload);

      const modal = new ModalBuilder()
        .setCustomId(modalId)
        .setTitle("✨ Crear Embed");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("embed_titulo")
            .setLabel("Título (vacío = sin título)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(200)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("embed_descripcion")
            .setLabel("Descripción")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(2000)
            .setPlaceholder("Escribe el contenido del embed aquí...")
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("embed_campos")
            .setLabel("Campos extra (opcional) — formato: Nombre|Valor|inline")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(1000)
            .setPlaceholder("Nombre del campo|Valor del campo|true\nOtro campo|Otro valor|false")
        ),
      );

      return interaction.showModal(modal);
    }

    // ─────────────────────────────────────────────
    //   /embed editar
    // ─────────────────────────────────────────────
    if (sub === "editar") {
      const msgId = interaction.options.getString("mensaje_id");
      const canal = interaction.options.getChannel("canal") || interaction.channel;

      const msg = await canal.messages.fetch(msgId).catch(() => null);
      if (!msg) return er("No se encontró el mensaje. Verifica el ID y el canal.");
      if (msg.author.id !== interaction.client.user.id) return er("Solo puedo editar mensajes enviados por mí.");
      if (!msg.embeds.length) return er("Ese mensaje no tiene embeds.");

      const old = msg.embeds[0];

      const modal = new ModalBuilder()
        .setCustomId("embed_edit_" + msgId + "_" + canal.id)
        .setTitle("✏️ Editar Embed");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("embed_titulo")
            .setLabel("Título")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(200)
            .setValue(old.title || "")
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("embed_descripcion")
            .setLabel("Descripción")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(2000)
            .setValue(old.description || "")
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("embed_color")
            .setLabel("Color HEX sin # (ej: 5865F2)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(6)
            .setValue(old.hexColor ? old.hexColor.replace("#", "") : "")
        ),
      );

      return interaction.showModal(modal);
    }

    // ─────────────────────────────────────────────
    //   /embed rapido
    // ─────────────────────────────────────────────
    if (sub === "rapido") {
      const canal     = interaction.options.getChannel("canal");
      const titulo    = interaction.options.getString("titulo");
      const desc      = interaction.options.getString("descripcion");
      const colorRaw  = interaction.options.getString("color");
      const mencionar = interaction.options.getString("mencionar");

      const color = colorRaw ? (parseColor(colorRaw) ?? E.Colors.PRIMARY) : E.Colors.PRIMARY;

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(titulo)
        .setDescription(desc)
        .setFooter({ text: `Enviado por ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      await canal.send({ content: mencionar || null, embeds: [embed] });

      return interaction.reply({
        embeds: [E.successEmbed(`Embed enviado en ${canal}.`)],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ─────────────────────────────────────────────
    //   /embed anuncio
    // ─────────────────────────────────────────────
    if (sub === "anuncio") {
      const canal     = interaction.options.getChannel("canal");
      const titulo    = interaction.options.getString("titulo");
      const texto     = interaction.options.getString("texto");
      const mencionar = interaction.options.getString("mencionar");
      const imagen    = interaction.options.getString("imagen");
      const colorRaw  = interaction.options.getString("color");

      if (imagen && !imagen.startsWith("http"))
        return er("La URL de imagen debe empezar con `https://`.");

      const color = colorRaw ? (parseColor(colorRaw) ?? 0xFEE75C) : 0xFEE75C;

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle("📢 " + titulo)
        .setDescription(texto)
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .setFooter({
          text: `${interaction.guild.name} · Anuncio`,
          iconURL: interaction.guild.iconURL({ dynamic: true }),
        })
        .setTimestamp();

      if (imagen) embed.setImage(imagen);

      await canal.send({ content: mencionar || null, embeds: [embed] });

      return interaction.reply({
        embeds: [E.successEmbed(`Anuncio enviado en ${canal}.`)],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

// ── Handler de modals de embed (llamado desde interactionCreate)
async function handleEmbedModal(interaction) {
  const { customId } = interaction;

  // ── Modal de CREAR
  if (customId.startsWith("embed_create_")) {
    const payloadStr = interaction.client._embedPayloads?.get(customId);
    if (!payloadStr) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xED4245).setDescription("❌ El formulario ha expirado. Ejecuta `/embed crear` de nuevo.")],
        flags: MessageFlags.Ephemeral,
      });
    }
    interaction.client._embedPayloads.delete(customId);

    const opts       = JSON.parse(payloadStr);
    const titulo     = interaction.fields.getTextInputValue("embed_titulo").trim();
    const desc       = interaction.fields.getTextInputValue("embed_descripcion").trim();
    const camposRaw  = interaction.fields.getTextInputValue("embed_campos").trim();
    const canal      = interaction.guild.channels.cache.get(opts.canal);

    if (!canal) return interaction.reply({ embeds: [E.errorEmbed("El canal ya no existe.")], flags: MessageFlags.Ephemeral });

    const color = opts.color ? (parseColor(opts.color) ?? 0x5865F2) : 0x5865F2;

    const embed = new EmbedBuilder().setColor(color);
    if (titulo) embed.setTitle(titulo);
    if (desc)   embed.setDescription(desc);
    if (opts.imagen) embed.setImage(opts.imagen);
    if (opts.thumb)  embed.setThumbnail(opts.thumb);
    if (opts.ts)     embed.setTimestamp();
    if (opts.footer) embed.setFooter({ text: opts.footer, iconURL: interaction.guild.iconURL({ dynamic: true }) });
    if (opts.autor)  embed.setAuthor({ name: opts.autor, iconURL: opts.autorIcon || undefined });

    // Parsear campos extra: "Nombre|Valor|inline\n..."
    if (camposRaw) {
      const campos = camposRaw.split("\n").map(l => l.trim()).filter(Boolean);
      for (const campo of campos.slice(0, 10)) {
        const parts = campo.split("|");
        if (parts.length >= 2) {
          embed.addFields({
            name:   parts[0].trim().substring(0, 100) || "Campo",
            value:  parts[1].trim().substring(0, 500) || "\u200b",
            inline: parts[2]?.trim().toLowerCase() === "true",
          });
        }
      }
    }

    await canal.send({ content: opts.mencionar || null, embeds: [embed] });
    return interaction.reply({ embeds: [E.successEmbed(`Embed enviado en <#${canal.id}>.`)], flags: MessageFlags.Ephemeral });
  }

  // ── Modal de EDITAR
  if (customId.startsWith("embed_edit_")) {
    const parts   = customId.split("_");
    const msgId   = parts[2];
    const chId    = parts[3];
    const canal   = interaction.guild.channels.cache.get(chId);
    const msg     = canal ? await canal.messages.fetch(msgId).catch(() => null) : null;

    if (!msg) return interaction.reply({ embeds: [E.errorEmbed("No encontré el mensaje.")], flags: MessageFlags.Ephemeral });

    const titulo  = interaction.fields.getTextInputValue("embed_titulo").trim();
    const desc    = interaction.fields.getTextInputValue("embed_descripcion").trim();
    const colorRaw = interaction.fields.getTextInputValue("embed_color").trim();

    const old   = msg.embeds[0];
    const color = colorRaw ? (parseColor(colorRaw) ?? (old.color || 0x5865F2)) : (old.color || 0x5865F2);

    const newEmbed = EmbedBuilder.from(old)
      .setColor(color);

    if (titulo !== undefined) newEmbed.setTitle(titulo || null);
    if (desc)                 newEmbed.setDescription(desc);

    await msg.edit({ embeds: [newEmbed] });
    return interaction.reply({ embeds: [E.successEmbed("Embed editado correctamente.")], flags: MessageFlags.Ephemeral });
  }
}

module.exports.handleEmbedModal = handleEmbedModal;
