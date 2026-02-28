const { EmbedBuilder } = require("discord.js");
const { settings } = require("../utils/database");

module.exports = {
  name: "messageDelete",
  async execute(message, client) {
    // ── Filtrar bots y mensajes fuera de un servidor
    if (!message.guild || message.author?.bot) return;

    const guild = message.guild;

    // ── Obtener configuración del servidor
    const s = await settings.get(guild.id);

    // ── Verificar que log_channel existe y log_deletes está habilitado
    if (!s || !s.log_channel || !s.log_deletes) return;

    // ── Obtener el canal de logs del servidor
    const logCh = guild.channels.cache.get(s.log_channel);
    if (!logCh) return;

    // ── Crear Embed de log
    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle("🗑️ Mensaje Eliminado")
      .addFields(
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
          value: (message.content || "*(sin texto)*").substring(0, 1000),
          inline: false,
        },
      )
      .setFooter({ text: `ID mensaje: ${message.id}` })
      .setTimestamp();

    // ── Enviar embed al canal de logs
    await logCh.send({ embeds: [embed] }).catch(() => {});
  },
};
