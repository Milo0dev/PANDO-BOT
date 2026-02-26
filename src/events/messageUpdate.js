const { EmbedBuilder } = require("discord.js");
const { tickets, settings, ticketLogs, modlogSettings } = require("../utils/database");

module.exports = {
  name: "messageUpdate",
  async execute(oldMsg, newMsg, client) {
    // ── MEDIDA DE SEGURIDAD 1: Filtrar bots
    if (!newMsg.guild || newMsg.author?.bot) return;
    
    // ── MEDIDA DE SEGURIDAD 2: Verificar contenido antes de procesar
    // A veces Discord emite eventos de update solo por cargar un link o un embed sin cambio real de texto
    if (oldMsg.content === newMsg.content) return;
    
    // Verificar que al menos uno de los contenidos exista
    if (!oldMsg.content && !newMsg.content) return;

    const guild = newMsg.guild;

    // ── 1. Log en tickets (sistema original)
    const ticket = await tickets.get(newMsg.channel.id);
    if (ticket) {
      const s = await settings.get(guild.id);
      if (s && s.log_edits && s.log_channel) {
        const logCh = guild.channels.cache.get(s.log_channel);
        if (logCh) {
          await ticketLogs.add(guild.id, newMsg.channel.id, "edit", {
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
      if (ml && ml.enabled && ml.log_msg_edit && ml.channel === s.log_channel && ticket) return;

      // Evitar enviar si el canal de logs es el mismo que el del ticket
      if (ticket && s.log_channel === (await tickets.get(newMsg.channel.id))?.log_channel) return;

      const before = (oldMsg.content || "*(vacío)*").substring(0, 500);
      const after  = (newMsg.content || "*(vacío)*").substring(0, 500);

      await logCh.send({
        embeds: [new EmbedBuilder()
          .setColor(0xFEE75C) // Amarillo/Naranja para edición
          .setTitle("✏️ Mensaje Editado")
          .addFields(
            { name: "👤 Autor",     value: `${newMsg.author.tag} <@${newMsg.author.id}>`, inline: true },
            { name: "📌 Canal",     value: `<#${newMsg.channel.id}>`, inline: true },
            { name: "🔗 Ir al msg", value: `[Click aquí](${newMsg.url})`, inline: true },
            { name: "📝 Antes",     value: before, inline: false },
            { name: "📝 Después",   value: after,  inline: false },
          )
          .setFooter({ text: `ID mensaje: ${newMsg.id} • ID canal: ${newMsg.channel.id}` })
          .setTimestamp()],
      }).catch(() => {});
    } catch (err) {
      console.error("[LOG_EDIT GLOBAL]", err.message);
    }
  },
};
