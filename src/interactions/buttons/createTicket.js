const { 
  EmbedBuilder, 
  StringSelectMenuBuilder, 
  ActionRowBuilder,
  AttachmentBuilder
} = require("discord.js");
const { settings, blacklist, tickets } = require("../../utils/database");
const E = require("../../utils/embeds");
const config = require("../../../config");

module.exports = {
  customId: "create_ticket",
  async execute(interaction, client) {
    try {
      // Verificar configuración del servidor
      const s = await settings.get(interaction.guild.id);
      
      // Verificar modo mantenimiento
      if (s.maintenance_mode) {
        return interaction.reply({ 
          embeds: [E.maintenanceEmbed(s.maintenance_reason)], 
          flags: 64 
        });
      }
      
      // Verificar blacklist
      const banned = await blacklist.check(interaction.user.id, interaction.guild.id);
      if (banned) {
        return interaction.reply({ 
          embeds: [
            new EmbedBuilder()
              .setColor(E.Colors.ERROR)
              .setTitle("❌ Acceso Denegado")
              .setDescription(`No puedes crear tickets en este momento.\n**Razón:** ${banned.reason || "Sin razón especificada"}`)
              .setFooter({ text: "Si crees que esto es un error, contacta a un administrador" })
          ], 
          flags: 64 
        });
      }
      
      // Verificar límite de tickets
      const open = await tickets.getByUser(interaction.user.id, interaction.guild.id);
      const maxTickets = s.max_tickets || 3;
      if (open.length >= maxTickets) {
        // Crear una lista visual de los tickets abiertos
        const ticketList = open.map(t => `• <#${t.channel_id}> (${t.category || "General"})`).join("\n");
        
        return interaction.reply({ 
          embeds: [
            new EmbedBuilder()
              .setColor(E.Colors.WARNING)
              .setTitle("⚠️ Límite de Tickets Alcanzado")
              .setDescription(
                `Ya tienes **${open.length}/${maxTickets}** tickets abiertos.\n\n` +
                `**Tus tickets activos:**\n${ticketList}\n\n` +
                `Por favor, cierra alguno de tus tickets existentes antes de abrir uno nuevo.`
              )
              .setFooter({ text: "Sistema Premium de Tickets" })
              .setTimestamp()
          ], 
          flags: 64 
        });
      }
      
      // Preparar las opciones de categorías
      const categoryOptions = config.categories.map(c => ({
        label: c.label,
        description: c.description?.substring(0, 100) || "Selecciona esta categoría",
        value: c.id,
        emoji: c.emoji,
      }));
      
      // Crear un banner personalizado para la selección de categoría
      // NOTA: Puedes descomentar estas líneas y usar tu propio banner
      // const banner = new AttachmentBuilder("https://i.imgur.com/YourCategoryBanner.png", { name: "category_banner.png" });
      
      // Crear el menú de selección
      const selectMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("ticket_category_select")
          .setPlaceholder("✨ Selecciona el tipo de ticket...")
          .addOptions(categoryOptions)
      );
      
      // Crear el embed de selección de categoría
      const embed = new EmbedBuilder()
        .setTitle("🌟 Crear Nuevo Ticket")
        .setDescription(
          "Por favor, selecciona la categoría que mejor se adapte a tu consulta para que podamos ayudarte de manera más eficiente.\n\n" +
          "Cada categoría está diseñada para atender diferentes tipos de solicitudes y te conectará con el equipo especializado correspondiente."
        )
        .setColor(E.Colors.PRIMARY)
        // .setImage("attachment://category_banner.png") // Descomentar si usas un banner personalizado
        .setFooter({ 
          text: `${interaction.guild.name} • Sistema Premium de Tickets`, 
          iconURL: interaction.guild.iconURL({ dynamic: true }) 
        })
        .setTimestamp();
      
      // Responder con el menú de selección
      return interaction.reply({ 
        embeds: [embed], 
        components: [selectMenu], 
        // files: banner ? [banner] : undefined, // Descomentar si usas un banner personalizado
        flags: 64 
      });
    } catch (error) {
      console.error("[CREATE TICKET ERROR]", error);
      return interaction.reply({ 
        embeds: [E.errorEmbed("Ha ocurrido un error al procesar tu solicitud. Por favor, inténtalo de nuevo más tarde.")], 
        flags: 64 
      });
    }
  }
};
