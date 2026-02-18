const { EmbedBuilder } = require("discord.js");
const { tickets, settings, ticketLogs } = require("../utils/database");

module.exports = {
  name: "messageUpdate",
  async execute(oldMsg, newMsg) {
    if (!newMsg.guild || newMsg.author?.bot) return;
    if (oldMsg.content === newMsg.content) return;

    const ticket = tickets.get(newMsg.channel.id);
    if (!ticket) return;

    const s = settings.get(newMsg.guild.id);
    if (!s.log_edits || !s.log_channel) return;

    const logCh = newMsg.guild.channels.cache.get(s.log_channel);
    if (!logCh) return;

    ticketLogs.add(newMsg.guild.id, newMsg.channel.id, "edit", {
      author_id:   newMsg.author.id,
      old_content: oldMsg.content?.substring(0, 500),
      new_content: newMsg.content?.substring(0, 500),
      message_id:  newMsg.id,
    });

    await logCh.send({
      embeds: [new EmbedBuilder()
        .setTitle("✏️ Mensaje Editado en Ticket")
        .setColor(0xFEE75C)
        .addFields(
          { name: "🎫 Ticket",   value: `#${ticket.ticket_id} (<#${ticket.channel_id}>)`, inline: true },
          { name: "👤 Autor",    value: `<@${newMsg.author.id}>`,                          inline: true },
          { name: "📝 Antes",    value: (oldMsg.content || "*(vacío)*").substring(0, 400) },
          { name: "📝 Después",  value: (newMsg.content || "*(vacío)*").substring(0, 400) },
        )
        .setTimestamp()],
    }).catch(() => {});
  },
};
