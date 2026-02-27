const TH = require("../../handlers/ticketHandler");
const { settings } = require("../../utils/database");
const { checkStaff } = require("../../utils/commandUtils");
const E = require("../../utils/embeds");

module.exports = {
  customId: "ticket_close_modal",
  async execute(interaction, client) {
    const s = await settings.get(interaction.guild.id);
    
    if (!checkStaff(interaction.member, s)) {
      return interaction.reply({ 
        embeds: [E.errorEmbed("Solo el **staff** puede cerrar tickets.")], 
        ephemeral: true 
      });
    }
    
    const reason = interaction.fields.getTextInputValue("close_reason");
    return TH.closeTicket(interaction, reason || null);
  }
};
