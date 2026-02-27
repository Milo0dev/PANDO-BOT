const { EmbedBuilder } = require("discord.js");
const { tickets, settings } = require("../utils/database");

module.exports = {
  name: "messageUpdate",
  async execute(oldMsg, newMsg, client) {
    // ── Filtrar bots y mensajes fuera de un servidor
    if (!newMsg.guild || newMsg.author?.bot) return;

    // ── Ignorar updates sin cambio real de texto (e.g. Discord cargando un embed de link)
    if (oldMsg.content === newMsg.content) return;

    // ── Ignorar si ambos contenidos están vacíos
    if (!oldMsg.content && !newMsg.content) return;

    const guild = newMsg.guild;

    // ── Obtener configuración del servidor UNA sola vez
    const s = await settings.get(guild.id);

    // ── 1. Log en canal de ticket (prioridad — no genera log global)
    const ticket = await tickets.get(newMsg.channel.id);
    if (ticket) {
      // Solo loguear si log_edits está activo y hay canal configurado
      if (s && s.log_edits && s.log_channel) {
        const logCh = guild.channels.cache.get(s.log_channel);
        if (logCh) {
          await logCh.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFEE75C)
                .setTitle("✏️ Mensaje Editado en Ticket")
                .addFields(
                  {
                    name:   "🎫 Ticket",
                    value:  `#${ticket.ticket_id} (<#${ticket.channel_id}>)`,
                    inline: true,
                  },
                  {
                    name:   "👤 Autor",
                    value:  `${newMsg.author.tag} (<@${newMsg.author.id}>)`,
                    inline: true,
                  },
                  {
                    name:   "📍 Canal",
                    value:  `<#${newMsg.channel.id}>`,
                    inline: true,
                  },
                  {
                    name:   "📝 Antes",
                    value:  (oldMsg.content || "*(vacío)*").substring(0, 400),
                    inline: false,
                  },
                  {
                    name:   "📝 Después",
                    value:  (newMsg.content || "*(vacío)*").substring(0, 400),
                    inline: false,
                  },
                )
                .setFooter({ text: `ID mensaje: ${newMsg.id}` })
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

      // Verificar que log_edits está habilitado en los settings
      if (!s.log_edits) return;

      // Obtener el canal de logs del servidor
      const logCh = guild.channels.cache.get(s.log_channel);
      if (!logCh) return;

      // Construir contenido Antes / Después
      const before = (oldMsg.content || "*(vacío)*").substring(0, 500);
      const after  = (newMsg.content || "*(vacío)*").substring(0, 500);

      await logCh.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle("✏️ Mensaje Editado")
            .addFields(
              {
                name:   "👤 Autor",
                value:  `${newMsg.author.tag} (<@${newMsg.author.id}>)`,
                inline: true,
              },
              {
                name:   "📍 Canal",
                value:  `<#${newMsg.channel.id}>`,
                inline: true,
              },
              {
                name:   "🔗 Ir al mensaje",
                value:  `[Click aquí](${newMsg.url})`,
                inline: true,
              },
              {
                name:   "📝 Antes",
                value:  before,
                inline: false,
              },
              {
                name:   "📝 Después",
                value:  after,
                inline: false,
              },
            )
            .setFooter({ text: `ID mensaje: ${newMsg.id} • ID canal: ${newMsg.channel.id}` })
            .setTimestamp(),
        ],
      }).catch(() => {});

    } catch (err) {
      console.error("[LOG_EDIT GLOBAL]", err.message);
    }
  },
};
