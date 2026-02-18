const { EmbedBuilder } = require("discord.js");
const { tickets, settings, ticketLogs } = require("../utils/database");

module.exports = {
  name: "messageDelete",
  async execute(message) {
    if (!message.guild || message.author?.bot) return;

    const ticket = tickets.get(message.channel.id);
    if (!ticket) return;

    const s = settings.get(message.guild.id);
    if (!s.log_deletes || !s.log_channel) return;

    const logCh = message.guild.channels.cache.get(s.log_channel);
    if (!logCh) return;

    ticketLogs.add(message.guild.id, message.channel.id, "delete", {
      author_id:  message.author?.id,
      content:    message.content?.substring(0, 500),
      message_id: message.id,
    });

    await logCh.send({
      embeds: [new EmbedBuilder()
        .setTitle("🗑️ Mensaje Eliminado en Ticket")
        .setColor(0xED4245)
        .addFields(
          { name: "🎫 Ticket",   value: `#${ticket.ticket_id} (<#${ticket.channel_id}>)`, inline: true },
          { name: "👤 Autor",    value: message.author ? `<@${message.author.id}>` : "Desconocido", inline: true },
          { name: "📝 Contenido",value: (message.content || "*(sin texto / solo adjunto)*").substring(0, 800) },
        )
        .setTimestamp()],
    }).catch(() => {});
  },
};
