const { tickets, staffRatings } = require("../../utils/database");
const { EmbedBuilder } = require("discord.js");

module.exports = {
  customId: "ticket_rating_*",
  async execute(interaction, client) {
    await interaction.deferReply({ flags: 64 });
    
    // El ID viene con el formato: ticket_rating_TICKETID_CHANNELID_STAFFID
    const parts = interaction.customId.split("_");
    const ticketId = parts[2];
    const channelId = parts[3];
    const staffId = parts[4];
    const ratingValue = parseInt(interaction.values[0]);
    
    // 1. Obtener el ticket para saber de qué servidor viene (ya que estamos en un DM)
    const ticket = await tickets.get(channelId);
    if (!ticket) {
      return interaction.editReply({ content: "❌ No se pudo procesar la calificación (Ticket no encontrado)." });
    }

    // 2. Guardar el rating en la base de datos del Ticket
    await tickets.update(channelId, { rating: ratingValue });

    // 3. 🔗 CONEXIÓN AL RANKING: Guardar el rating en las estadísticas del Staff
    await staffRatings.add(ticket.guild_id, staffId, ratingValue, ticketId, interaction.user.id);
    
    // 4. Actualizar el mensaje de DM para quitar el menú desplegable y que no voten dos veces
    await interaction.message.edit({ components: [] }).catch(() => {});
    
    // 5. Mensaje de agradecimiento
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xF1C40F)
          .setTitle("💖 ¡Gracias por tu calificación!")
          .setDescription(`Has calificado la atención con **${ratingValue} estrellas**.\n\n¡Tu voto se ha registrado en el ranking oficial y ayudará a nuestro equipo a seguir mejorando!`)
          .setTimestamp()
      ]
    });
  }
};
