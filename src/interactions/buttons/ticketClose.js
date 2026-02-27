const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
const { tickets } = require("../../utils/database");
const E = require("../../utils/embeds");

module.exports = {
  customId: "ticket_close",
  async execute(interaction, client) {
    const ticket = await tickets.get(interaction.channel.id);
    
    if (!ticket) {
      return interaction.reply({ 
        embeds: [E.errorEmbed("No es un canal de ticket.")], 
        ephemeral: true 
      });
    }
    
    if (ticket.status === "closed") {
      return interaction.reply({ 
        embeds: [E.errorEmbed("Ya está cerrado.")], 
        ephemeral: true 
      });
    }

    const modal = new ModalBuilder()
      .setCustomId("ticket_close_modal")
      .setTitle("Cerrar Ticket");
    
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("close_reason")
          .setLabel("Razón de cierre (opcional)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(200)
      )
    );
    
    return interaction.showModal(modal);
  }
};
