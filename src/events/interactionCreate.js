const {
  ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, StringSelectMenuBuilder,
  ButtonBuilder, ButtonStyle, EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const TH = require("../handlers/ticketHandler");
const { handleVerif } = require("../handlers/verifHandler");
const { tickets, settings, notes, tags, blacklist, autoResponses } = require("../utils/database");
const E = require("../utils/embeds");
const { generateTranscript } = require("../utils/transcript");
const config = require("../../config");

module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    try {
      // ── SLASH COMMANDS
      if (interaction.isChatInputCommand()) {
        const cmd = client.commands.get(interaction.commandName);
        if (cmd) await cmd.execute(interaction, client);
        return;
      }

      // ── AUTOCOMPLETE
      if (interaction.isAutocomplete()) {
        const cmd = client.commands.get(interaction.commandName);
        if (cmd?.autocomplete) await cmd.autocomplete(interaction);
        return;
      }

      // ── SELECT MENU
      if (interaction.isStringSelectMenu()) {
        // ── Selección de categoría de ticket
        if (interaction.customId === "ticket_category_select") {
          const catId    = interaction.values[0];
          const category = config.categories.find(c => c.id === catId);
          if (!category) return interaction.reply({ embeds: [E.errorEmbed("Categoría no encontrada.")], ephemeral: true });

          // Pre-verificaciones
          const s      = settings.get(interaction.guild.id);
          if (s.maintenance_mode) return interaction.reply({ embeds: [E.maintenanceEmbed(s.maintenance_reason)], ephemeral: true });

          const banned = blacklist.check(interaction.user.id, interaction.guild.id);
          if (banned) return interaction.reply({ embeds: [E.errorEmbed(`Estás en la lista negra.\n**Razón:** ${banned.reason || "Sin razón"}`)], ephemeral: true });

          const open = tickets.getByUser(interaction.user.id, interaction.guild.id);
          if (open.length >= (s.max_tickets || 3)) {
            return interaction.reply({ embeds: [E.errorEmbed(`Ya tienes **${open.length}/${s.max_tickets || 3}** tickets abiertos.`)], ephemeral: true });
          }

          return interaction.showModal(TH.buildModal(category));
        }

        // ── Rating de ticket (viene por DM, buscar por channel_id en customId)
        if (interaction.customId.startsWith("ticket_rating_")) {
          const parts     = interaction.customId.split("_");
          const channelId = parts[parts.length - 1];
          const rating    = parseInt(interaction.values[0]);

          tickets.setRating(channelId, rating);

          const stars = "⭐".repeat(rating);
          const embed = new EmbedBuilder()
            .setColor(E.Colors.GOLD)
            .setTitle("⭐ ¡Gracias por tu calificación!")
            .setDescription(`Calificaste la atención con **${stars} (${rating}/5)**.\n\nTu opinión es muy valiosa para nosotros.`)
            .setTimestamp();

          const disabled = new ActionRowBuilder().addComponents(
            StringSelectMenuBuilder.from(interaction.component).setDisabled(true)
          );
          return interaction.update({ embeds: [embed], components: [disabled] });
        }

        // ── Selector de mover categoría
        if (interaction.customId === "ticket_move_select") {
          return TH.moveTicket(interaction, interaction.values[0]);
        }
      }

      // ── MODALS
      if (interaction.isModalSubmit()) {
        // ── Formulario de ticket
        if (interaction.customId.startsWith("ticket_modal_")) {
          const catId    = interaction.customId.replace("ticket_modal_", "");
          const category = config.categories.find(c => c.id === catId);
          const answers  = [];
          (category?.questions || []).slice(0, 5).forEach((_, i) => {
            const v = interaction.fields.getTextInputValue(`answer_${i}`);
            if (v) answers.push(v);
          });
          return TH.createTicket(interaction, catId, answers);
        }

        // ── Modal de cierre
        if (interaction.customId === "ticket_close_modal") {
          const s = settings.get(interaction.guild.id);
          if (!checkStaff(interaction.member, s)) {
            return interaction.reply({ embeds: [E.errorEmbed("Solo el **staff** puede cerrar tickets.")], ephemeral: true });
          }
          const reason = interaction.fields.getTextInputValue("close_reason");
          return TH.closeTicket(interaction, reason || null);
        }

        // ── Modal de nota
        if (interaction.customId === "ticket_note_modal") {
          const content = interaction.fields.getTextInputValue("note_content");
          const ticket  = tickets.get(interaction.channel?.id);
          if (!ticket) return interaction.reply({ embeds: [E.errorEmbed("No es un canal de ticket.")], ephemeral: true });
          notes.add(ticket.ticket_id, interaction.user.id, content);
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(E.Colors.WARNING).setTitle("📝 Nota interna añadida").setDescription(content).setFooter({ text: `Por ${interaction.user.tag}` }).setTimestamp()],
            ephemeral: true,
          });
        }

        // ── Modal de rename
        if (interaction.customId === "ticket_rename_modal") {
          const name = interaction.fields.getTextInputValue("new_name").toLowerCase().replace(/[^a-z0-9-]/g, "-").substring(0, 32);
          await interaction.channel.setName(name);
          return interaction.reply({ embeds: [E.successEmbed(`Canal renombrado a **${name}**`)], ephemeral: true });
        }

        // ── Modal de auto-respuesta
        if (interaction.customId === "autoresponse_create_modal") {
          const trigger  = interaction.fields.getTextInputValue("trigger");
          const response = interaction.fields.getTextInputValue("response");
          try {
            autoResponses.create(interaction.guild.id, trigger, response, interaction.user.id);
            return interaction.reply({ embeds: [E.successEmbed(`Auto-respuesta para **"${trigger}"** creada.`)], ephemeral: true });
          } catch {
            return interaction.reply({ embeds: [E.errorEmbed(`Ya existe una auto-respuesta para **"${trigger}"**.`)], ephemeral: true });
          }
        }
      }

      // ── VERIFICACIÓN (botones y modals)
      const verifIds = ["verify_start", "verify_help", "verify_enter_code", "verify_resend_code", "verify_code_modal", "verify_question_modal"];
      if (
        (interaction.isButton() && verifIds.includes(interaction.customId)) ||
        (interaction.isModalSubmit() && ["verify_code_modal", "verify_question_modal"].includes(interaction.customId))
      ) {
        return handleVerif(interaction);
      }

      // ── BUTTONS
      if (interaction.isButton()) {
        const { customId } = interaction;
        const s = settings.get(interaction.guild.id);

        // ── Verificación de staff para todos los botones del ticket
        const staffOnlyButtons = ["ticket_close", "ticket_claim", "ticket_reopen", "ticket_transcript"];
        if (staffOnlyButtons.includes(customId) && !checkStaff(interaction.member, s)) {
          return interaction.reply({
            embeds: [E.errorEmbed("❌ Solo el **staff** puede usar estos botones.")],
            ephemeral: true,
          });
        }

        if (customId === "ticket_close") {
          const ticket = tickets.get(interaction.channel.id);
          if (!ticket) return interaction.reply({ embeds: [E.errorEmbed("No es un canal de ticket.")], ephemeral: true });
          if (ticket.status === "closed") return interaction.reply({ embeds: [E.errorEmbed("Ya está cerrado.")], ephemeral: true });

          const modal = new ModalBuilder().setCustomId("ticket_close_modal").setTitle("Cerrar Ticket");
          modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("close_reason").setLabel("Razón de cierre (opcional)").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(200)
          ));
          return interaction.showModal(modal);
        }

        if (customId === "ticket_claim")      return TH.claimTicket(interaction);
        if (customId === "ticket_reopen")     return TH.reopenTicket(interaction);

        if (customId === "ticket_transcript") {
          const ticket = tickets.get(interaction.channel.id);
          if (!ticket) return interaction.reply({ embeds: [E.errorEmbed("No es un canal de ticket.")], ephemeral: true });
          await interaction.deferReply({ ephemeral: true });
          try {
            const { attachment } = await generateTranscript(interaction.channel, ticket, interaction.guild);
            return interaction.editReply({ embeds: [E.successEmbed("Transcripción generada.")], files: [attachment] });
          } catch { return interaction.editReply({ embeds: [E.errorEmbed("Error al generar la transcripción.")] }); }
        }
      }

    } catch (err) {
      console.error("[INTERACTION ERROR]", err);
      const payload = { embeds: [E.errorEmbed("Ocurrió un error inesperado.")], ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
      else await interaction.reply(payload).catch(() => {});
    }
  },
};

function checkStaff(member, s) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (s.support_role && member.roles.cache.has(s.support_role)) return true;
  if (s.admin_role   && member.roles.cache.has(s.admin_role))   return true;
  return false;
}
