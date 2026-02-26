const { EmbedBuilder } = require("discord.js");
const { tickets, settings, ticketLogs, modlogSettings } = require("../utils/database");

module.exports = {
  name: "messageDelete",
  async execute(message, client) {
    // ── MEDIDA DE SEGURIDAD 1: Filtrar bots
    if (!message.guild || message.author?.bot) return;

    const guild = message.guild;

    // ── 1. Log en tickets (sistema original)
    const ticket = await tickets.get(message.channel.id);
    if (ticket) {
      const s = await settings.get(guild.id);
      if (s && s.log_deletes && s.log_channel) {
        const logCh = guild.channels.cache.get(s.log_channel);
        if (logCh) {
          await ticketLogs.add(guild.id, message.channel.id, "delete", {
            author_id: message.author?.id, content: message.content?.substring(0, 500), message_id: message.id,
          });
          await logCh.send({
            embeds: [new EmbedBuilder().setTitle("🗑️ Mensaje Eliminado en Ticket").setColor(0xED4245)
              .addFields(
                { name: "🎫 Ticket",    value: `#${ticket.ticket_id} (<#${ticket.channel_id}>)`, inline: true },
                { name: "👤 Autor",     value: message.author ? `<@${message.author.id}>` : "Desconocido", inline: true },
                { name: "📝 Contenido", value: (message.content || "*(adjunto)*").substring(0, 800) },
              ).setTimestamp()],
          }).catch(() => {});
        }
      }
    }

    // ── 2. Log GLOBAL de moderación (usando log_channel de settings)
    try {
      const s = await settings.get(guild.id);
      
      // Verificar que log_channel existe en la base de datos
      if (!s || !s.log_channel) return;
      
      // Obtener el canal de logs
      const logCh = guild.channels.cache.get(s.log_channel);
      if (!logCh) return;
      
      // Evitar doble log si ya se envió en el log de tickets
      const ml = await modlogSettings.get(guild.id);
      if (ml && ml.enabled && ml.log_msg_delete && ml.channel === s.log_channel && ticket) return;

      // Evitar enviar si el canal de logs es el mismo que el del ticket
      if (ticket && s.log_channel === (await tickets.get(message.channel.id))?.log_channel) return;

      // MEDIDA DE SEGURIDAD 2: Verificar contenido antes de enviar
      const content = message.content || null;
      const attachments = message.attachments?.size > 0
        ? message.attachments.map(a => `[${a.name}](${a.url})`).join(", ")
        : null;

      // Si no hay contenido ni adjuntos, no tiene sentido enviar el log
      if (!content && !attachments) return;

      const fields = [
        { name: "👤 Autor",   value: message.author ? `${message.author.tag} <@${message.author.id}>` : "Desconocido", inline: true },
        { name: "📌 Canal",   value: `<#${message.channel.id}>`, inline: true },
      ];
      if (content)     fields.push({ name: "📝 Contenido",   value: content.substring(0, 1000),  inline: false });
      if (attachments) fields.push({ name: "📎 Adjuntos",     value: attachments.substring(0, 500), inline: false });

      await logCh.send({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245) // Rojo para borrado
          .setTitle("🗑️ Mensaje Eliminado")
          .addFields(fields)
          .setFooter({ text: `ID mensaje: ${message.id} • ID canal: ${message.channel.id}` })
          .setTimestamp()],
      }).catch(() => {});
    } catch (err) {
      console.error("[LOG_DELETE GLOBAL]", err.message);
    }
  },
};
