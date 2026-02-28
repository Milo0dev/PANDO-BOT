const { EmbedBuilder } = require("discord.js");
const TH = require("../../handlers/ticketHandler");
const { settings, tickets } = require("../../utils/database");
const { checkStaff } = require("../../utils/commandUtils");
const E = require("../../utils/embeds");

module.exports = {
  customId: "ticket_close_modal",
  async execute(interaction, client) {
    try {
      // Verificar que es un canal de ticket
      const ticket = await tickets.get(interaction.channel.id);
      if (!ticket) {
        return interaction.reply({ 
          embeds: [E.errorEmbed("Este canal no es un ticket válido.")], 
          flags: 64 
        });
      }
      
      // Verificar que el ticket no está ya cerrado
      if (ticket.status === "closed") {
        return interaction.reply({ 
          embeds: [E.errorEmbed("Este ticket ya ha sido cerrado.")], 
          flags: 64 
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
          flags: 64 
        });
      }

      // Obtener la razón del cierre
      const reason = interaction.fields.getTextInputValue("close_reason");
      
      // Obtener notas internas si existen (solo para staff)
      let internalNotes = null;
      try {
        if (isStaff) {
          internalNotes = interaction.fields.getTextInputValue("internal_notes");
        }
      } catch (e) {
        // Campo opcional, ignorar si no existe
      }
      
      // Guardar notas internas si existen
      if (internalNotes) {
        await tickets.update(interaction.channel.id, { internal_notes: internalNotes });
      }
      
      // Mostrar mensaje de cierre en el canal usando channel.send en lugar de interaction.reply
      // Esto evita conflictos con la interacción cuando se llama a closeTicket
      await interaction.channel.send({ 
        embeds: [
          new EmbedBuilder()
            .setColor(E.Colors.WARNING)
            .setTitle("🔒 Cerrando Ticket")
            .setDescription(
              `Este ticket será cerrado en **5 segundos**...\n\n` +
              `**Razón:** ${reason || "No se proporcionó una razón"}\n\n` +
              `Se enviará una transcripción completa al usuario por mensaje directo.`
            )
            .setFooter({ text: "Sistema Premium de Tickets" })
            .setTimestamp()
        ]
      });
      
      // Responder a la interacción de forma efímera para confirmar que se recibió
      await interaction.reply({ 
        embeds: [
          new EmbedBuilder()
            .setColor(E.Colors.SUCCESS)
            .setTitle("✅ Procesando cierre")
            .setDescription("El ticket se cerrará en 5 segundos.")
        ], 
        flags: 64 
      });
      
      // Esperar 5 segundos antes de cerrar el ticket
      setTimeout(async () => {
        try {
          // Pasar la interacción y la razón a closeTicket
          await TH.closeTicket(interaction, reason || null);
        } catch (closeError) {
          console.error("[TICKET CLOSE DELAYED ERROR]", closeError);
          // Si falla el cierre automático, intentar notificar en el canal
          try {
            await interaction.channel.send({ 
              embeds: [E.errorEmbed("Error al cerrar el ticket. Por favor, inténtalo de nuevo o contacta a un administrador.")] 
            });
          } catch (e) {
            // Ignorar si el canal ya fue eliminado
          }
        }
      }, 5000);
      
    } catch (error) {
      console.error("[TICKET CLOSE MODAL ERROR]", error);
      return interaction.reply({ 
        embeds: [E.errorEmbed("Ha ocurrido un error al procesar tu solicitud. Por favor, inténtalo de nuevo más tarde.")], 
        flags: 64 
      });
    }
  }
};
