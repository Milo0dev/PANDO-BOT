const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("🏓 Ver latencia y estadísticas del bot"),

  async execute(interaction) {
    const ping = interaction.client.ws.ping;
    const uptime = interaction.client.uptime;
    
    // Calcular uptime
    const dias = Math.floor(uptime / (1000 * 60 * 60 * 24));
    const horas = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutos = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    const segundos = Math.floor((uptime % (1000 * 60)) / 1000);
    
    const uptimeStr = dias > 0 
      ? `${dias}d ${horas}h ${minutos}m`
      : horas > 0 
        ? `${horas}h ${minutos}m ${segundos}s`
        : `${minutos}m ${segundos}s`;

    // Color según el ping
    let pingColor = 0x57F287; // Verde - bueno
    let pingEmoji = "🟢";
    if (ping > 100) { pingColor = 0xFEE75C; pingEmoji = "🟡"; } // Amarillo - regular
    if (ping > 200) { pingColor = 0xED4245; pingEmoji = "🔴"; } // Rojo - malo

    const embed = new EmbedBuilder()
      .setTitle("🏓 PONG!")
      .setColor(pingColor)
      .addFields(
        { name: "📡 Latencia del Bot", value: `\`${ping}ms\` ${pingEmoji}`, inline: true },
        { name: "⏱️ Uptime", value: `\`${uptimeStr}\``, inline: true },
        { name: "🏢 Servidores", value: `\`${interaction.client.guilds.cache.size}\``, inline: true },
        { name: "👥 Usuarios", value: `\`${interaction.client.users.cache.size}\``, inline: true },
        { name: "📺 Canales", value: `\`${interaction.client.channels.cache.size}\``, inline: true },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
