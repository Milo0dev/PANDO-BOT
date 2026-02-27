const { tickets } = require("../../utils/database");
const { EmbedBuilder } = require("discord.js");
module.exports = {
  customId: "ticket_rating_*",
  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    const parts = interaction.customId.split("_");
    const channelId = parts[3];
    const ratingValue = interaction.values[0];
    
    await tickets.update(channelId, { rating: parseInt(ratingValue) });
    await interaction.message.edit({ components: [] }).catch(() => {});
    
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0xF1C40F).setTitle("💖 ¡Gracias por tu calificación!").setDescription(`Has calificado la atención con **${ratingValue} estrellas**. ¡Esto nos ayuda muchísimo a mejorar!`).setTimestamp()]
    });
  }
};
