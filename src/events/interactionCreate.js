const {
  ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, StringSelectMenuBuilder,
  ButtonBuilder, ButtonStyle, EmbedBuilder,
  PermissionFlagsBits, MessageFlags,
} = require("discord.js");

const TH = require("../handlers/ticketHandler");
const { handleVerif } = require("../handlers/verifHandler");
const { buildPollEmbed, buildPollButtons } = require("../handlers/pollHandler");
const { handleEmbedModal } = require("../commands/embed");
const { tickets, settings, notes, tags, blacklist, autoResponses, staffRatings, polls, suggestions, suggestSettings } = require("../utils/database");
const E = require("../utils/embeds");
const { generateTranscript } = require("../utils/transcript");
const config = require("../../config");
const handleMusicButtons = require('../handlers/musicButtonHandler');

// ══════════════════════════════════════════════════════════════
//   ALIASES DE COMANDOS
// ══════════════════════════════════════════════════════════════
const COMMAND_ALIASES = {
  // Alias en español
  "ayuda": "help",
  "soporte": "help",
  "ayudaplay": "help",
  "estadisticas": "stats",
  "ranking": "rank",
  "rankingtop": "rank",
  "verificar": "verify",
  "bienvenida": "welcome",
  "verificacion": "verify",
  "configurar": "setup",
  "panel": "setup",
  // Comandos en inglés comunes
  "rank": "rank",
  "ping": "ping",
};

function resolveCommand(commandName, client) {
  // 1. Buscar comando exacto
  let cmd = client.commands.get(commandName);
  if (cmd) return cmd;
  
  // 2. Buscar por alias
  const alias = COMMAND_ALIASES[commandName.toLowerCase()];
  if (alias) {
    cmd = client.commands.get(alias);
    if (cmd) return cmd;
  }
  
  // 3. Buscar subcomandos (ej: "stats server" → "stats")
  const parts = commandName.split(" ");
  if (parts.length > 1) {
    cmd = client.commands.get(parts[0]);
    if (cmd) return cmd;
  }
  
  return null;
}

module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    try {

      // ══════════════════════════════════════════════════════════════
      //   SLASH COMMANDS (con soporte para aliases)
      // ══════════════════════════════════════════════════════════════
      if (interaction.isChatInputCommand()) {
        const cmd = resolveCommand(interaction.commandName, client);
        if (cmd) {
          // Manejar subcomandos con aliases
          const fullName = interaction.commandName;
          const parts = fullName.split(" ");
          
          // Si es un subcomando, ejecutarlo normalmente
          await cmd.execute(interaction, client);
        }
        return;
      }

      // ══════════════════════════════════════════════════════════════
      //   AUTOCOMPLETE
      // ══════════════════════════════════════════════════════════════
      if (interaction.isAutocomplete()) {
        const cmd = resolveCommand(interaction.commandName, client);
        if (cmd?.autocomplete) await cmd.autocomplete(interaction);
        return;
      }

      // ══════════════════════════════════════════════════════════════
      //   SELECT MENUS
      // ══════════════════════════════════════════════════════════════
      if (interaction.isStringSelectMenu()) {

        // ── Selección de categoría de ticket
        if (interaction.customId === "ticket_category_select") {
          const catId    = interaction.values[0];
          const category = config.categories.find(c => c.id === catId);
          if (!category) return interaction.reply({ embeds: [E.errorEmbed("Categoría no encontrada.")], flags: MessageFlags.Ephemeral });

          const s      = await settings.get(interaction.guild.id);
          if (s.maintenance_mode) return interaction.reply({ embeds: [E.maintenanceEmbed(s.maintenance_reason)], flags: MessageFlags.Ephemeral });

          const banned = await blacklist.check(interaction.user.id, interaction.guild.id);
          if (banned) return interaction.reply({ embeds: [E.errorEmbed("Estás en la lista negra.\n**Razón:** " + (banned.reason || "Sin razón"))], flags: MessageFlags.Ephemeral });

          const open = await tickets.getByUser(interaction.user.id, interaction.guild.id);
          if (open.length >= (s.max_tickets || 3)) {
            return interaction.reply({ embeds: [E.errorEmbed("Ya tienes **" + open.length + "/" + (s.max_tickets || 3) + "** tickets abiertos.")], flags: MessageFlags.Ephemeral });
          }

          return interaction.showModal(TH.buildModal(category));
        }

        // ── Rating de ticket (viene por DM)
        if (interaction.customId.startsWith("ticket_rating_")) {
          const parts     = interaction.customId.split("_");
          const staffId   = parts[parts.length - 1];
          const channelId = parts[parts.length - 2];
          const ticketId  = parts[parts.length - 3];
          const rating    = parseInt(interaction.values[0]);

          await tickets.setRating(channelId, rating);
          await staffRatings.add(interaction.guildId || "dm", staffId, rating, ticketId, interaction.user.id);

          const starsMap = ["","⭐","⭐⭐","⭐⭐⭐","⭐⭐⭐⭐","⭐⭐⭐⭐⭐"];
          const labelMap = ["","Muy malo 😞","Malo 😐","Regular 🙂","Bueno 😊","Excelente 🤩"];
          const colorMap = [0, 0xED4245, 0xFEE75C, 0xFEE75C, 0x57F287, 0xFFD700];

          const embed = new EmbedBuilder()
            .setColor(colorMap[rating] || E.Colors.GOLD)
            .setTitle("⭐ ¡Gracias por tu calificación!")
            .setDescription("Calificaste la atención con **" + starsMap[rating] + " " + rating + "/5** — **" + labelMap[rating] + "**\n\nTu opinión ayuda a mejorar la calidad del soporte. ¡Gracias! 💙")
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

      // ══════════════════════════════════════════════════════════════
      //   MODALS
      // ══════════════════════════════════════════════════════════════
      if (interaction.isModalSubmit()) {

        // ── Formulario de ticket
        if (interaction.customId.startsWith("ticket_modal_")) {
          const catId    = interaction.customId.replace("ticket_modal_", "");
          const category = config.categories.find(c => c.id === catId);
          const answers  = [];
          (category?.questions || []).slice(0, 5).forEach((_, i) => {
            const v = interaction.fields.getTextInputValue("answer_" + i);
            if (v) answers.push(v);
          });
          return TH.createTicket(interaction, catId, answers);
        }

        // ── Modal de cierre de ticket
        if (interaction.customId === "ticket_close_modal") {
          const s = await settings.get(interaction.guild.id);
          if (!checkStaff(interaction.member, s)) {
            return interaction.reply({ embeds: [E.errorEmbed("Solo el **staff** puede cerrar tickets.")], flags: MessageFlags.Ephemeral });
          }
          const reason = interaction.fields.getTextInputValue("close_reason");
          return TH.closeTicket(interaction, reason || null);
        }

        // ── Modal de nota de ticket
        if (interaction.customId === "ticket_note_modal") {
          const content = interaction.fields.getTextInputValue("note_content");
          const ticket  = await tickets.get(interaction.channel.id);
          if (!ticket) return interaction.reply({ embeds: [E.errorEmbed("No es un canal de ticket.")], flags: MessageFlags.Ephemeral });
          await notes.add(ticket.ticket_id, interaction.user.id, content);
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(E.Colors.WARNING)
              .setTitle("📝 Nota interna añadida")
              .setDescription(content)
              .setFooter({ text: "Por " + interaction.user.tag })
              .setTimestamp()],
            flags: MessageFlags.Ephemeral,
          });
        }

        // ── Modal de rename de ticket
        if (interaction.customId === "ticket_rename_modal") {
          const name = interaction.fields.getTextInputValue("new_name").toLowerCase().replace(/[^a-z0-9-]/g, "-").substring(0, 32);
          await interaction.channel.setName(name);
          return interaction.reply({ embeds: [E.successEmbed("Canal renombrado a **" + name + "**")], flags: MessageFlags.Ephemeral });
        }

        // ── Modal de auto-respuesta
        if (interaction.customId === "autoresponse_create_modal") {
          const trigger  = interaction.fields.getTextInputValue("trigger");
          const response = interaction.fields.getTextInputValue("response");
          try {
            await autoResponses.create(interaction.guild.id, trigger, response, interaction.user.id);
            return interaction.reply({ embeds: [E.successEmbed("Auto-respuesta para **\"" + trigger + "\"** creada.")], flags: MessageFlags.Ephemeral });
          } catch {
            return interaction.reply({ embeds: [E.errorEmbed("Ya existe una auto-respuesta para **\"" + trigger + "\"**.")], flags: MessageFlags.Ephemeral });
          }
        }

        // ── Modals de EMBED (crear / editar)
        if (interaction.customId.startsWith("embed_create_") || interaction.customId.startsWith("embed_edit_")) {
          return handleEmbedModal(interaction);
        }

        // ── Modals de VERIFICACIÓN
        if (interaction.customId === "verify_code_modal" || interaction.customId === "verify_question_modal") {
          return handleVerif(interaction);
        }
      }

      // ══════════════════════════════════════════════════════════════
      //   BOTONES
      // ══════════════════════════════════════════════════════════════
      if (interaction.isButton()) {
        const { customId } = interaction;
        if (interaction.customId.startsWith('music_')) {
          await handleMusicButtons(interaction);
          return;
        }
        
        // Botones de Giveaway
        if (customId === "giveaway_join") {
          const giveaway = require("../commands/giveaway");
          await giveaway.handleGiveawayJoin(interaction, client);
          return;
        }

        // ── Verificación
        const verifIds = ["verify_start", "verify_help", "verify_enter_code", "verify_resend_code"];
        if (verifIds.includes(customId)) {
          return handleVerif(interaction);
        }

        // ── Help navigation (tiene su propio collector)
        if (customId.startsWith("help_")) return;

        // ── Botones de ENCUESTA
        if (customId.startsWith("poll_vote_")) {
          const parts  = customId.split("_");
          const pollId = parts[2];
          const optId  = parseInt(parts[3]);
          const poll   = await polls.getByMessage(pollId);

          if (!poll)      return interaction.reply({ embeds: [E.errorEmbed("Esta encuesta ya no existe.")], flags: MessageFlags.Ephemeral });
          if (poll.ended) return interaction.reply({ embeds: [E.errorEmbed("Esta encuesta ya ha finalizado.")], flags: MessageFlags.Ephemeral });
          if (new Date(poll.ends_at) <= new Date()) {
            await polls.end(pollId);
            return interaction.reply({ embeds: [E.errorEmbed("Esta encuesta ha expirado.")], flags: MessageFlags.Ephemeral });
          }

          const updated = await polls.vote(pollId, interaction.user.id, [optId]);
          if (!updated) return interaction.reply({ embeds: [E.errorEmbed("Error al registrar el voto.")], flags: MessageFlags.Ephemeral });

          await interaction.update({ embeds: [buildPollEmbed(updated)], components: buildPollButtons(updated) });
          return;
        }

        // ── Botones de SUGERENCIAS
        if (customId.startsWith("suggest_upvote_") || customId.startsWith("suggest_downvote_")) {
          const type  = customId.startsWith("suggest_upvote_") ? "up" : "down";
          const sugId = customId.replace("suggest_upvote_", "").replace("suggest_downvote_", "");
          const sug   = await suggestions.getById(sugId);

          if (!sug)                   return interaction.reply({ embeds: [E.errorEmbed("Esta sugerencia ya no existe.")], flags: MessageFlags.Ephemeral });
          if (sug.status !== "pending") return interaction.reply({ embeds: [E.errorEmbed("Esta sugerencia ya fue revisada y no acepta más votos.")], flags: MessageFlags.Ephemeral });

          const updated  = await suggestions.vote(sugId, interaction.user.id, type);
          if (!updated)  return interaction.reply({ embeds: [E.errorEmbed("Error al registrar el voto.")], flags: MessageFlags.Ephemeral });

          const ss       = await suggestSettings.get(interaction.guild.id);
          const sugMod   = require("../commands/suggest");
          const newEmbed = sugMod.buildSuggestEmbed(updated, interaction.guild, ss.anonymous);
          const newRow   = sugMod.buildVoteButtons(sugId);

          await interaction.update({ embeds: [newEmbed], components: [newRow] });
          return;
        }

        // ── Botones de TICKET (requieren staff)
        const s = await settings.get(interaction.guild.id);
        const staffOnlyButtons = ["ticket_close", "ticket_claim", "ticket_reopen", "ticket_transcript"];
        if (staffOnlyButtons.includes(customId) && !checkStaff(interaction.member, s)) {
          return interaction.reply({
            embeds: [E.errorEmbed("❌ Solo el **staff** puede usar estos botones.")],
            flags: MessageFlags.Ephemeral,
          });
        }

        if (customId === "ticket_close") {
          const ticket = await tickets.get(interaction.channel.id);
          if (!ticket) return interaction.reply({ embeds: [E.errorEmbed("No es un canal de ticket.")], flags: MessageFlags.Ephemeral });
          if (ticket.status === "closed") return interaction.reply({ embeds: [E.errorEmbed("Ya está cerrado.")], flags: MessageFlags.Ephemeral });

          const modal = new ModalBuilder().setCustomId("ticket_close_modal").setTitle("Cerrar Ticket");
          modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("close_reason")
              .setLabel("Razón de cierre (opcional)")
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setMaxLength(200)
          ));
          return interaction.showModal(modal);
        }

        if (customId === "ticket_claim")  return TH.claimTicket(interaction);
        if (customId === "ticket_reopen") return TH.reopenTicket(interaction);

        if (customId === "ticket_transcript") {
          const ticket = await tickets.get(interaction.channel.id);
          if (!ticket) return interaction.reply({ embeds: [E.errorEmbed("No es un canal de ticket.")], flags: MessageFlags.Ephemeral });
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          try {
            const { attachment } = await generateTranscript(interaction.channel, ticket, interaction.guild);
            return interaction.editReply({ embeds: [E.successEmbed("Transcripción generada.")], files: [attachment] });
          } catch {
            return interaction.editReply({ embeds: [E.errorEmbed("Error al generar la transcripción.")] });
          }
        }
      }

    } catch (err) {
      console.error("[INTERACTION ERROR]", err);
      const payload = { embeds: [E.errorEmbed("Ocurrió un error inesperado.")], flags: MessageFlags.Ephemeral };
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
