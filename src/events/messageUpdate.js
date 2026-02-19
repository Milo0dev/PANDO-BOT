const { EmbedBuilder } = require("discord.js");
const { tickets, settings, ticketLogs, modlogSettings } = require("../utils/database");

module.exports = {
  name: "messageUpdate",
  async execute(oldMsg, newMsg, client) {
    if (!newMsg.guild || newMsg.author?.bot) return;
    if (oldMsg.content === newMsg.content)   return;

    const guild = newMsg.guild;

    // ── 1. Log en tickets (sistema original)
    const ticket = tickets.get(newMsg.channel.id);
    if (ticket) {
      const s = settings.get(guild.id);
      if (s.log_edits && s.log_channel) {
        const logCh = guild.channels.cache.get(s.log_channel);
        if (logCh) {
          ticketLogs.add(guild.id, newMsg.channel.id, "edit", {
            author_id: newMsg.author.id, old_content: oldMsg.content?.substring(0, 500), new_content: newMsg.content?.substring(0, 500), message_id: newMsg.id,
          });
          await logCh.send({
            embeds: [new EmbedBuilder().setTitle("✏️ Mensaje Editado en Ticket").setColor(0xFEE75C)
              .addFields(
                { name: "🎫 Ticket",   value: `#${ticket.ticket_id} (<#${ticket.channel_id}>)`, inline: true },
                { name: "👤 Autor",    value: `<@${newMsg.author.id}>`, inline: true },
                { name: "📝 Antes",    value: (oldMsg.content || "*(vacío)*").substring(0, 400) },
                { name: "📝 Después",  value: (newMsg.content || "*(vacío)*").substring(0, 400) },
              ).setTimestamp()],
          }).catch(() => {});
        }
      }
    }

    // ── 2. Log de moderación global
    const ml = modlogSettings.get(guild.id);
    if (!ml.enabled || !ml.log_msg_edit || !ml.channel) return;
    if (ml.channel === settings.get(guild.id).log_channel && ticket) return;

    const ch = guild.channels.cache.get(ml.channel);
    if (!ch) return;

    const before = (oldMsg.content || "*(vacío)*").substring(0, 500);
    const after  = (newMsg.content || "*(vacío)*").substring(0, 500);

    await ch.send({
      embeds: [new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle("✏️ Mensaje Editado")
        .addFields(
          { name: "👤 Autor",     value: `${newMsg.author.tag} <@${newMsg.author.id}>`, inline: true },
          { name: "📌 Canal",     value: `<#${newMsg.channel.id}>`, inline: true },
          { name: "🔗 Ir al msg", value: `[Click aquí](${newMsg.url})`, inline: true },
          { name: "📝 Antes",     value: before, inline: false },
          { name: "📝 Después",   value: after,  inline: false },
        )
        .setFooter({ text: `ID mensaje: ${newMsg.id}` })
        .setTimestamp()],
    }).catch(() => {});
  },
};
