const { MessageFlags } = require("discord.js");
const TH = require("../../handlers/ticketHandler");
const { settings, blacklist, tickets, cooldowns } = require("../../utils/database");
const E = require("../../utils/embeds");
const config = require("../../../config");

module.exports = {
  customId: "ticket_category_select",
  async execute(interaction, client) {
    try {
      // Obtener la categoría seleccionada
      const catId = interaction.values[0];
      const category = config.categories.find(c => c.id === catId);
      
      // Verificar que la categoría existe
      if (!category) {
        return interaction.reply({ 
          embeds: [
            E.errorEmbed("Categoría no encontrada o no disponible en este momento. Por favor, selecciona otra categoría.")
          ], 
          flags: MessageFlags.Ephemeral 
        });
      }

      // Verificar configuración del servidor
      const s = await settings.get(interaction.guild.id);
      
      // Verificar modo mantenimiento
      if (s.maintenance_mode) {
        return interaction.reply({ 
          embeds: [E.maintenanceEmbed(s.maintenance_reason)], 
          flags: MessageFlags.Ephemeral 
        });
      }

      // Verificar blacklist
      const banned = await blacklist.check(interaction.user.id, interaction.guild.id);
      if (banned) {
        return interaction.reply({ 
          embeds: [
            E.errorEmbed(`No puedes crear tickets en este momento.\n**Razón:** ${banned.reason || "Sin razón especificada"}`)
          ], 
          flags: MessageFlags.Ephemeral 
        });
      }

      // Verificar límite de tickets
      const open = await tickets.getByUser(interaction.user.id, interaction.guild.id);
      const maxTickets = s.max_tickets || 3;
      if (open.length >= maxTickets) {
        const ticketList = open.map(t => `• <#${t.channel_id}> (${t.category || "General"})`).join("\n");
        
        return interaction.reply({ 
          embeds: [
            E.errorEmbed(
              `Ya tienes **${open.length}/${maxTickets}** tickets abiertos.\n\n` +
              `**Tus tickets activos:**\n${ticketList}\n\n` +
              `Por favor, cierra alguno de tus tickets existentes antes de abrir uno nuevo.`
            )
          ], 
          flags: MessageFlags.Ephemeral 
        });
      }
      
      // Verificar cooldown
      if (s.cooldown_minutes > 0) {
        const remaining = await cooldowns.check(interaction.user.id, interaction.guild.id, s.cooldown_minutes);
        if (remaining) {
          return interaction.reply({ 
            embeds: [
              E.errorEmbed(
                `Por favor, espera **${remaining} minuto(s)** antes de abrir otro ticket.\n\n` +
                `Este límite de tiempo ayuda a nuestro equipo a gestionar mejor las solicitudes.`
              )
            ], 
            flags: MessageFlags.Ephemeral 
          });
        }
      }

      // Verificar días en el servidor si está configurado
      if (s.min_days > 0) {
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (member) {
          const days = (Date.now() - member.joinedTimestamp) / 86400000;
          if (days < s.min_days) {
            return interaction.reply({ 
              embeds: [
                E.errorEmbed(
                  `Debes ser miembro del servidor durante al menos **${s.min_days} día(s)** para poder abrir un ticket.\n\n` +
                  `Tiempo actual en el servidor: **${Math.floor(days)} día(s)**`
                )
              ], 
              flags: MessageFlags.Ephemeral 
            });
          }
        }
      }

      // Construir y mostrar el modal con las preguntas de la categoría
      const modal = TH.buildModal(category);
      return interaction.showModal(modal);
      
    } catch (error) {
      console.error("[TICKET CATEGORY SELECT ERROR]", error);
      return interaction.reply({ 
        embeds: [
          E.errorEmbed("Ha ocurrido un error al procesar tu selección. Por favor, inténtalo de nuevo más tarde.")
        ], 
        flags: MessageFlags.Ephemeral 
      });
    }
  }
};
