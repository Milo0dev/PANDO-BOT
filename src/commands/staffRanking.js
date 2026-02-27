const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { staffRatings, staffStats } = require("../utils/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("staff-ranking")
    .setDescription("🏆 Muestra el top del staff basado en calificaciones de tickets y tickets atendidos"),
  async execute(interaction) {
    await interaction.deferReply();
    const guildId = interaction.guild.id;

    // Obtener el top de calificaciones (mínimo 1 calificación)
    const topRatings = await staffRatings.getLeaderboard(guildId, 1);

    if (topRatings.length === 0) {
      return interaction.editReply({ 
        embeds: [new EmbedBuilder().setColor(0xED4245).setDescription("❌ Aún no hay suficientes calificaciones para mostrar el ranking.")] 
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("🏆 Ranking de Staff - Soporte Técnico")
      .setColor(0xF1C40F)
      .setDescription("Esta tabla muestra a los miembros del equipo con las mejores calificaciones otorgadas por los usuarios y la cantidad de tickets que han atendido.")
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setTimestamp();

    let rankingText = "";
    const medallas = ["🥇", "🥈", "🥉", "🏅", "🏅"];

    for (let i = 0; i < topRatings.length; i++) {
      const staff = topRatings[i];
      // Obtener stats de tickets reclamados de este staff
      const stats = await staffStats.get(guildId, staff.staff_id);
      const ticketsReclamados = stats ? stats.tickets_claimed : 0;
      const medalla = medallas[i] || `**#${i + 1}**`;

      // Crear estrellas visuales
      const numEstrellas = Math.round(staff.avg);
      const estrellasText = "⭐".repeat(numEstrellas) + "☆".repeat(5 - numEstrellas);

      rankingText += `${medalla} <@${staff.staff_id}>\n`;
      rankingText += `> **Calificación:** ${estrellasText} (${staff.avg}/5) en ${staff.total} reseñas\n`;
      rankingText += `> **Atendidos:** \`${ticketsReclamados} tickets\`\n\n`;
    }

    embed.addFields({ name: "Tabla de Clasificación Top 15", value: rankingText });

    await interaction.editReply({ embeds: [embed] });
  }
};
