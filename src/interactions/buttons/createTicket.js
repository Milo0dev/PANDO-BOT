const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require("discord.js");
const { settings, blacklist, tickets } = require("../../utils/database");
const E = require("../../utils/embeds");
const config = require("../../../config");

module.exports = {
  customId: "create_ticket",
  async execute(interaction, client) {
    const s = await settings.get(interaction.guild.id);
    
    if (s.maintenance_mode) {
      return interaction.reply({ 
        embeds: [E.maintenanceEmbed(s.maintenance_reason)], 
        ephemeral: true 
      });
    }
    
    const banned = await blacklist.check(interaction.user.id, interaction.guild.id);
    if (banned) {
      return interaction.reply({ 
        embeds: [E.errorEmbed("Estás en la lista negra.\n**Razón:** " + (banned.reason || "Sin razón"))], 
        ephemeral: true 
      });
    }
    
    const open = await tickets.getByUser(interaction.user.id, interaction.guild.id);
    if (open.length >= (s.max_tickets || 3)) {
      return interaction.reply({ 
        embeds: [E.errorEmbed("Ya tienes **" + open.length + "/" + (s.max_tickets || 3) + "** tickets abiertos.")], 
        ephemeral: true 
      });
    }
    
    const categoryOptions = config.categories.map(c => ({
      label: c.label,
      description: c.description?.substring(0, 100),
      value: c.id,
      emoji: c.emoji,
    }));
    
    const selectMenu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ticket_category_select")
        .setPlaceholder("📋 Selecciona el tipo de ticket...")
        .addOptions(categoryOptions)
    );
    
    const embed = new EmbedBuilder()
      .setTitle("🎫 Abrir un Ticket")
      .setDescription("Selecciona una categoría para tu ticket:")
      .setColor(E.Colors.PRIMARY)
      .setTimestamp();
    
    return interaction.reply({ 
      embeds: [embed], 
      components: [selectMenu], 
      ephemeral: true 
    });
  }
};
