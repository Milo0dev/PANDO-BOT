const { forceUpdateDashboard } = require("../../handlers/dashboardHandler");

module.exports = {
  customId: "refresh_dashboard",
  execute: async function (interaction) {
    // deferReply para dar tiempo al proceso
    await interaction.deferReply({ flags: 64 });

    // Forzar actualización del dashboard
    await forceUpdateDashboard(interaction.guild.id);

    // Confirmar al usuario
    await interaction.editReply("✅ El panel se actualizó con éxito.");
  },
};
