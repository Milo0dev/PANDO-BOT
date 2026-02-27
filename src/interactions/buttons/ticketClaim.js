const TH = require("../../handlers/ticketHandler");
module.exports = {
  customId: "ticket_claim",
  async execute(interaction, client) {
    await TH.claimTicket(interaction);
  }
};
