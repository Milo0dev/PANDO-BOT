const TH = require("../../handlers/ticketHandler");
module.exports = {
  customId: "ticket_reopen",
  async execute(interaction, client) {
    await TH.reopenTicket(interaction);
  }
};
