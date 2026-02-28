const { EmbedBuilder } = require("discord.js");
const { forceUpdateDashboard } = require("../../handlers/dashboardHandler");

module.exports = {
  customId: "refresh_dashboard",
  execute: async function (interaction) {
    // deferReply para dar tiempo al proceso
    await interaction.deferReply({ flags: 64 });

    // Forzar actualización del dashboard
    await forceUpdateDashboard(interaction.guild.id);

    // Confirmar al usuario con Embed de éxito
    const successEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setDescription("✅ ¡Panel actualizado! Las estadísticas se han refrescado con éxito.");

    await interaction.editReply({ embeds: [successEmbed] });
  },
};
