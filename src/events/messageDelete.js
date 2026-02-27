const { EmbedBuilder } = require("discord.js");
const { tickets, settings } = require("../utils/database");

module.exports = {
  name: "messageDelete",
  async execute(message, client) {
    // ── Filtrar bots y mensajes fuera de un servidor
    if (!message.guild || message.author?.bot) return;

    const guild = message.guild;

    // ── Obtener configuración del servidor UNA sola vez
    const s = await settings.get(guild.id);

    // ── 1. Log en canal de ticket (prioridad — no genera log global)
    const ticket = await tickets.get(message.channel.id);
    if (ticket) {
      // Solo loguear si log_deletes está activo y hay canal configurado
      if (s && s.log_deletes && s.log_channel) {
        const logCh = guild.channels.cache.get(s.log_channel);
        if (logCh) {
          await logCh.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("🗑️ Mensaje Eliminado en Ticket")
                .addFields(
                  {
                    name: "🎫 Ticket",
                    value: `#${ticket.ticket_id} (<#${ticket.channel_id}>)`,
                    inline: true,
                  },
                  {
                    name: "👤 Autor",
                    value: message.author
                      ? `${message.author.tag} (<@${message.author.id}>)`
                      : "Desconocido",
                    inline: true,
                  },
                  {
                    name: "📍 Canal",
                    value: `<#${message.channel.id}>`,
                    inline: true,
                  },
                  {
                    name: "📝 Contenido",
                    value: (message.content || "*(sin texto — posible adjunto)*").substring(0, 800),
                    inline: false,
                  },
                )
                .setFooter({ text: `ID mensaje: ${message.id}` })
                .setTimestamp(),
            ],
          }).catch(() => {});
        }
      }
      // Mensaje de ticket → no continuar al log global
      return;
    }

    // ── 2. Log GLOBAL de moderación
    try {
      // Verificar que log_channel existe en la base de datos
      if (!s || !s.log_channel) return;

      // Verificar que log_deletes está habilitado en los settings
      if (!s.log_deletes) return;

      // Obtener el canal de logs del servidor
      const logCh = guild.channels.cache.get(s.log_channel);
      if (!logCh) return;

      // Verificar que hay contenido o adjuntos que loguear
      const content     = message.content || null;
      const attachments = message.attachments?.size > 0
        ? message.attachments.map(a => `[${a.name}](${a.url})`).join(", ")
        : null;

      if (!content && !attachments) return;

      // Construir campos del embed
      const fields = [
        {
          name:   "👤 Autor",
          value:  message.author
            ? `${message.author.tag} (<@${message.author.id}>)`
            : "Desconocido",
          inline: true,
        },
        {
          name:   "📍 Canal",
          value:  `<#${message.channel.id}>`,
          inline: true,
        },
      ];

      if (content)     fields.push({ name: "📝 Contenido", value: content.substring(0, 1000),     inline: false });
      if (attachments) fields.push({ name: "📎 Adjuntos",  value: attachments.substring(0, 500),  inline: false });

      await logCh.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("🗑️ Mensaje Eliminado")
            .addFields(fields)
            .setFooter({ text: `ID mensaje: ${message.id} • ID canal: ${message.channel.id}` })
            .setTimestamp(),
        ],
      }).catch(() => {});

    } catch (err) {
      console.error("[LOG_DELETE GLOBAL]", err.message);
    }
  },
};
