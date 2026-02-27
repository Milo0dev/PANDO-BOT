const { 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder,
  EmbedBuilder
} = require("discord.js");
const { tickets, settings } = require("../../utils/database");
const { checkStaff } = require("../../utils/commandUtils");
const E = require("../../utils/embeds");

module.exports = {
  customId: "ticket_close",
  async execute(interaction, client) {
    try {
      // Verificar que es un canal de ticket
      const ticket = await tickets.get(interaction.channel.id);
      
      if (!ticket) {
        return interaction.reply({ 
          embeds: [E.errorEmbed("Este canal no es un ticket válido.")], 
          ephemeral: true 
        });
      }
      
      // Verificar que el ticket no está ya cerrado
      if (ticket.status === "closed") {
        return interaction.reply({ 
          embeds: [E.errorEmbed("Este ticket ya ha sido cerrado.")], 
          ephemeral: true 
        });
      }

      // Verificar permisos (solo staff o creador del ticket puede cerrar)
      const s = await settings.get(interaction.guild.id);
      const isStaff = checkStaff(interaction.member, s);
      const isCreator = interaction.user.id === ticket.user_id;
      
      if (!isStaff && !isCreator) {
        return interaction.reply({ 
          embeds: [
            new EmbedBuilder()
              .setColor(E.Colors.ERROR)
              .setTitle("❌ Permiso Denegado")
              .setDescription("Solo el creador del ticket o miembros del staff pueden cerrar este ticket.")
              .setFooter({ text: "Sistema Premium de Tickets" })
          ], 
          ephemeral: true 
        });
      }

      // Crear un modal premium para el cierre del ticket
      const modal = new ModalBuilder()
        .setCustomId("ticket_close_modal")
        .setTitle("🔒 Cerrar Ticket #" + ticket.ticket_id);
      
      // Añadir campo para la razón de cierre
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("close_reason")
            .setLabel("Razón de cierre")
            .setPlaceholder("Ej: Problema resuelto, Solicitud completada...")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(500)
        )
      );
      
      // Si es staff, añadir campo para notas internas (opcional)
      if (isStaff) {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("internal_notes")
              .setLabel("Notas internas (solo visible para staff)")
              .setPlaceholder("Notas adicionales sobre este caso...")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(false)
              .setMaxLength(500)
          )
        );
      }
      
      // Mostrar el modal
      return interaction.showModal(modal);
      
    } catch (error) {
      console.error("[TICKET CLOSE ERROR]", error);
      return interaction.reply({ 
        embeds: [E.errorEmbed("Ha ocurrido un error al procesar tu solicitud. Por favor, inténtalo de nuevo más tarde.")], 
        ephemeral: true 
      });
    }
  }
};
