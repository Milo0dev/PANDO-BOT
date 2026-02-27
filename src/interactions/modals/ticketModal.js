const TH = require("../../handlers/ticketHandler");
const config = require("../../../config");

module.exports = {
  customId: "ticket_modal_*", // El * indica que es un wildcard para cualquier ID que empiece con "ticket_modal_"
  async execute(interaction, client) {
    const catId = interaction.customId.replace("ticket_modal_", "");
    const category = config.categories.find(c => c.id === catId);
    
    const answers = [];
    (category?.questions || []).slice(0, 5).forEach((_, i) => {
      const v = interaction.fields.getTextInputValue("answer_" + i);
      if (v) answers.push(v);
    });
    
    return TH.createTicket(interaction, catId, answers);
  }
};
