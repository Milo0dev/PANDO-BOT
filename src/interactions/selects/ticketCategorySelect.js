const { MessageFlags } = require("discord.js");
const TH = require("../../handlers/ticketHandler");
const { settings, blacklist, tickets } = require("../../utils/database");
const E = require("../../utils/embeds");
const config = require("../../../config");

module.exports = {
  customId: "ticket_category_select",
  async execute(interaction, client) {
    const catId = interaction.values[0];
    const category = config.categories.find(c => c.id === catId);
    
    if (!category) {
      return interaction.reply({ 
        embeds: [E.errorEmbed("Categoría no encontrada.")], 
        flags: MessageFlags.Ephemeral 
      });
    }

    const s = await settings.get(interaction.guild.id);
    if (s.maintenance_mode) {
      return interaction.reply({ 
        embeds: [E.maintenanceEmbed(s.maintenance_reason)], 
        flags: MessageFlags.Ephemeral 
      });
    }

    const banned = await blacklist.check(interaction.user.id, interaction.guild.id);
    if (banned) {
      return interaction.reply({ 
        embeds: [E.errorEmbed("Estás en la lista negra.\n**Razón:** " + (banned.reason || "Sin razón"))], 
        flags: MessageFlags.Ephemeral 
      });
    }

    const open = await tickets.getByUser(interaction.user.id, interaction.guild.id);
    if (open.length >= (s.max_tickets || 3)) {
      return interaction.reply({ 
        embeds: [E.errorEmbed("Ya tienes **" + open.length + "/" + (s.max_tickets || 3) + "** tickets abiertos.")], 
        flags: MessageFlags.Ephemeral 
      });
    }

    return interaction.showModal(TH.buildModal(category));
  }
};
