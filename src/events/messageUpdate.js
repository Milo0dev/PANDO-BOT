const { EmbedBuilder } = require("discord.js");
const { settings } = require("../utils/database");

module.exports = {
  name: "messageUpdate",
  async execute(oldMessage, newMessage, client) {
    // ── Filtrar bots y mensajes fuera de un servidor
    if (!newMessage.guild || newMessage.author?.bot) return;

    // ── Evitar registrar si el contenido es el mismo (ej. si solo se incrustó un enlace)
    if (oldMessage.content === newMessage.content) return;

    const guild = newMessage.guild;

    // ── Obtener configuración del servidor
    const s = await settings.get(guild.id);

    // ── Verificar que log_channel existe y log_edits está habilitado
    if (!s || !s.log_channel || !s.log_edits) return;

    // ── Obtener el canal de logs del servidor
    const logCh = guild.channels.cache.get(s.log_channel);
    if (!logCh) return;

    // ── Crear Embed de log
    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle("✏️ Mensaje Editado")
      .addFields(
        {
          name: "👤 Autor",
          value: `${newMessage.author.tag} (<@${newMessage.author.id}>)`,
          inline: true,
        },
        {
          name: "📍 Canal",
          value: `<#${newMessage.channel.id}>`,
          inline: true,
        },
        {
          name: "🔗 Enlace",
          value: `[Ir al mensaje](${newMessage.url})`,
          inline: true,
        },
        {
          name: "📝 Antes",
          value: (oldMessage.content || "*(vacío)*").substring(0, 1000),
          inline: false,
        },
        {
          name: "📝 Después",
          value: (newMessage.content || "*(vacío)*").substring(0, 1000),
          inline: false,
        },
      )
      .setFooter({ text: `ID mensaje: ${newMessage.id}` })
      .setTimestamp();

    // ── Enviar embed al canal de logs
    await logCh.send({ embeds: [embed] }).catch(() => {});
  },
};
