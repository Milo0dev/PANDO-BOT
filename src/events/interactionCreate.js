const {
  ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, StringSelectMenuBuilder,
  ButtonBuilder, ButtonStyle, EmbedBuilder,
  PermissionFlagsBits, MessageFlags, ChannelType,
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

// Comandos que requieren permisos de administrador
const ADMIN_COMMANDS = [
  "setup", "stats", "blacklist", "tag", "autoresponse", 
  "maintenance", "closeall", "lockdown"
];

const COMMAND_ALIASES = {
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
  "rank": "rank",
  "ping": "ping",
};

// Función para resolver comandos (incluye aliases)
function resolveCommand(commandName, client) {
  let cmd = client.commands.get(commandName);
  if (cmd) return cmd;
  
  const alias = COMMAND_ALIASES[commandName.toLowerCase()];
  if (alias) {
    cmd = client.commands.get(alias);
    if (cmd) return cmd;
  }
  
  const parts = commandName.split(" ");
  if (parts.length > 1) {
    cmd = client.commands.get(parts[0]);
    if (cmd) return cmd;
  }
  
  return null;
}

// Función para verificar si el usuario es administrador
// Validación: Permission native Administrator O admin_role de la base de datos
async function checkAdmin(interaction) {
  const guild = interaction.guild;
  const member = interaction.member;
  
  // 1. Verificar permiso nativo Administrator de Discord
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }
  
  // 2. Verificar admin_role desde la base de datos (settings)
  const s = await settings.get(guild.id);
  if (s.admin_role && s.admin_role !== null) {
    if (member.roles.cache.has(s.admin_role)) {
      return true;
    }
  }
  
  // No tiene permisos
  return false;
}

module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    try {
      if (interaction.isChatInputCommand()) {
        const cmd = resolveCommand(interaction.commandName, client);
        if (cmd) {
          // Verificar si es un comando de administrador
          if (ADMIN_COMMANDS.includes(interaction.commandName)) {
            const hasAdmin = await checkAdmin(interaction);
            if (!hasAdmin) {
              return interaction.reply({
                embeds: [new EmbedBuilder()
                  .setColor(E.Colors.ERROR)
                  .setTitle("❌ Sin Permisos")
                  .setDescription("No tienes permisos para usar este comando.")
                  .setFooter({ text: "Necesitas permiso de Administrator o el rol de admin configurado" })],
                ephemeral: true
              });
            }
          }
          
          await cmd.execute(interaction, client);
        }
        return;
      }

      if (interaction.isAutocomplete()) {
        const cmd = resolveCommand(interaction.commandName, client);
        if (cmd?.autocomplete) await cmd.autocomplete(interaction);
        return;
      }

      if (interaction.isStringSelectMenu()) {
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

        if (interaction.customId.startsWith("ticket_rating_")) {
          const parts     = interaction.customId.split("_");
          const staffId   = parts[parts.length - 1];
          const channelId = parts[parts.length - 2];
          const ticketId  = parts[parts.length - 3];
          const rating    = parseInt(parts[parts.length - 1]);

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

        if (interaction.customId === "ticket_move_select") {
          return TH.moveTicket(interaction, interaction.values[0]);
        }
      }

      if (interaction.isModalSubmit()) {
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

        if (interaction.customId === "ticket_close_modal") {
          const s = await settings.get(interaction.guild.id);
          if (!checkStaff(interaction.member, s)) {
            return interaction.reply({ embeds: [E.errorEmbed("Solo el **staff** puede cerrar tickets.")], flags: MessageFlags.Ephemeral });
          }
          const reason = interaction.fields.getTextInputValue("close_reason");
          return TH.closeTicket(interaction, reason || null);
        }

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

        if (interaction.customId === "ticket_rename_modal") {
          const name = interaction.fields.getTextInputValue("new_name").toLowerCase().replace(/[^a-z0-9-]/g, "-").substring(0, 32);
          await interaction.channel.setName(name);
          return interaction.reply({ embeds: [E.successEmbed("Canal renombrado a **" + name + "**")], flags: MessageFlags.Ephemeral });
        }

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

        if (interaction.customId.startsWith("embed_create_") || interaction.customId.startsWith("embed_edit_")) {
          return handleEmbedModal(interaction);
        }

        if (interaction.customId === "verify_code_modal" || interaction.customId === "verify_question_modal") {
          return handleVerif(interaction);
        }
      }

      if (interaction.isButton()) {
        const { customId } = interaction;
        if (interaction.customId.startsWith('music_')) {
          await handleMusicButtons(interaction);
          return;
        }
        
        if (customId === "giveaway_join") {
          const giveaway = require("../commands/giveaway");
          await giveaway.handleGiveawayJoin(interaction, client);
          return;
        }

        const verifIds = ["verify_start", "verify_help", "verify_enter_code", "verify_resend_code"];
        if (verifIds.includes(customId)) {
          return handleVerif(interaction);
        }

        if (customId.startsWith("help_")) return;

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

        const s = await settings.get(interaction.guild.id);
        const staffOnlyButtons = ["ticket_close", "ticket_claim", "ticket_reopen", "ticket_transcript"];
        if (staffOnlyButtons.includes(customId) && !checkStaff(interaction.member, s)) {
          return interaction.reply({
            embeds: [E.errorEmbed("❌ Solo el **staff** puede usar estos botones.")],
            flags: MessageFlags.Ephemeral,
          });
        }

        // ── Botón para crear ticket SIMPLE (desde panel de /setup-tickets)
        if (customId === "ticket_open_simple") {
          const s = await settings.get(interaction.guild.id);

          // Verificar mantenimiento
          if (s.maintenance_mode) {
            return interaction.reply({
              embeds: [E.maintenanceEmbed(s.maintenance_reason)],
              flags: MessageFlags.Ephemeral,
            });
          }

          // Verificar blacklist
          const bannedSimple = await blacklist.check(interaction.user.id, interaction.guild.id);
          if (bannedSimple) {
            return interaction.reply({
              embeds: [E.errorEmbed("Estás en la lista negra.\n**Razón:** " + (bannedSimple.reason || "Sin razón"))],
              flags: MessageFlags.Ephemeral,
            });
          }

          // Verificar si el usuario ya tiene un ticket simple abierto
          const existingSimpleTicket = interaction.guild.channels.cache.find(
            ch => ch.topic && ch.topic.includes(`uid:${interaction.user.id}`) && ch.topic.includes("simple-ticket")
          );
          if (existingSimpleTicket) {
            return interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor(E.Colors.WARNING)
                  .setDescription(
                    `⚠️ Ya tienes un ticket abierto: ${existingSimpleTicket}\n\n` +
                    "Cierra tu ticket actual antes de abrir uno nuevo."
                  ),
              ],
              flags: MessageFlags.Ephemeral,
            });
          }

          await interaction.deferReply({ flags: MessageFlags.Ephemeral });

          try {
            // Sanitizar nombre de usuario para el nombre del canal
            const safeName = interaction.user.username
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "")
              .substring(0, 20) || "usuario";
            const channelName = `ticket-${safeName}`;

            // Construir permisos del canal
            const permOverwrites = [
              {
                id: interaction.guild.id, // @everyone — sin acceso
                deny: [PermissionFlagsBits.ViewChannel],
              },
              {
                id: interaction.user.id, // Creador del ticket
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.EmbedLinks,
                ],
              },
              {
                id: interaction.client.user.id, // Bot
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ManageChannels,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.ManageMessages,
                ],
              },
            ];

            // Añadir rol de soporte si está configurado
            if (s.support_role) {
              permOverwrites.push({
                id: s.support_role,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.ManageMessages,
                ],
              });
            }

            // Buscar categoría "tickets" si existe en el servidor
            const ticketCategory = interaction.guild.channels.cache.find(
              ch => ch.type === ChannelType.GuildCategory &&
                    ch.name.toLowerCase().includes("ticket")
            );

            // Crear el canal privado
            const ticketChannel = await interaction.guild.channels.create({
              name: channelName,
              type: ChannelType.GuildText,
              topic: `Ticket de ${interaction.user.tag} | uid:${interaction.user.id} | simple-ticket`,
              parent: ticketCategory?.id || null,
              permissionOverwrites: permOverwrites,
            });

            // Embed de bienvenida dentro del ticket
            const welcomeEmbed = new EmbedBuilder()
              .setTitle("🎫 Ticket Abierto")
              .setDescription(
                `¡Hola <@${interaction.user.id}>! 👋\n\n` +
                "Tu ticket ha sido creado correctamente. Por favor, **describe tu problema** con el mayor detalle posible y nuestro equipo te atenderá lo antes posible.\n\n" +
                (s.support_role ? `📢 El equipo de soporte <@&${s.support_role}> ha sido notificado.` : "")
              )
              .setColor(0x57F287)
              .addFields(
                { name: "👤 Usuario",  value: `<@${interaction.user.id}>`,                    inline: true },
                { name: "📅 Abierto",  value: `<t:${Math.floor(Date.now() / 1000)}:R>`,       inline: true },
              )
              .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
              .setFooter({ text: "Usa el botón de abajo para cerrar el ticket cuando se resuelva tu problema." })
              .setTimestamp();

            // Botón rojo "🔒 Cerrar Ticket"
            const closeRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("ticket_close_simple")
                .setLabel("Cerrar Ticket")
                .setEmoji("🔒")
                .setStyle(ButtonStyle.Danger)
            );

            // Ping al rol de soporte (mensaje separado para que notifique)
            if (s.support_role) {
              await ticketChannel.send({ content: `<@&${s.support_role}>` });
            }

            // Mensaje de bienvenida con el botón de cierre
            await ticketChannel.send({
              content: `> 👋 <@${interaction.user.id}>, describe tu problema aquí y el staff te atenderá pronto.`,
              embeds: [welcomeEmbed],
              components: [closeRow],
            });

            return interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setColor(E.Colors.SUCCESS)
                  .setDescription(`✅ Tu ticket ha sido creado: ${ticketChannel}\n\nHaz clic en el enlace para ir a tu ticket.`)
                  .setTimestamp(),
              ],
            });
          } catch (err) {
            console.error("[TICKET OPEN SIMPLE ERROR]", err);
            return interaction.editReply({
              embeds: [E.errorEmbed("Error al crear el ticket. Verifica que el bot tenga los permisos necesarios (Gestionar Canales).")],
            });
          }
        }

        // ── Botón para cerrar ticket SIMPLE
        if (customId === "ticket_close_simple") {
          const s = await settings.get(interaction.guild.id);
          const channelTopic = interaction.channel.topic || "";

          // Verificar que es un canal de ticket simple
          if (!channelTopic.includes("simple-ticket")) {
            return interaction.reply({
              embeds: [E.errorEmbed("Este botón solo funciona en canales de ticket simple.")],
              flags: MessageFlags.Ephemeral,
            });
          }

          // Extraer el ID del dueño del ticket desde el topic
          const ownerMatch = channelTopic.match(/uid:(\d+)/);
          const ownerId    = ownerMatch ? ownerMatch[1] : null;

          // Verificar permisos: staff O dueño del ticket
          const isStaffSimple = checkStaff(interaction.member, s);
          const isOwnerSimple = ownerId && interaction.user.id === ownerId;

          if (!isStaffSimple && !isOwnerSimple) {
            return interaction.reply({
              embeds: [E.errorEmbed("❌ Solo el **staff** o el creador del ticket puede cerrarlo.")],
              flags: MessageFlags.Ephemeral,
            });
          }

          // Mensaje de cierre
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(E.Colors.ERROR)
                .setTitle("🔒 Cerrando Ticket...")
                .setDescription(
                  `Este ticket ha sido cerrado por <@${interaction.user.id}>.\n\n` +
                  "⏳ El canal será eliminado en **5 segundos**..."
                )
                .setTimestamp(),
            ],
          });

          // Eliminar el canal tras 5 segundos
          setTimeout(() => {
            interaction.channel
              .delete(`Ticket simple cerrado por ${interaction.user.tag}`)
              .catch(err => console.error("[TICKET CLOSE SIMPLE ERROR]", err));
          }, 5000);

          return;
        }

        // ── Botón para crear ticket desde el panel (público)
        if (customId === "create_ticket") {
          if (s.maintenance_mode) {
            return interaction.reply({ embeds: [E.maintenanceEmbed(s.maintenance_reason)], flags: MessageFlags.Ephemeral });
          }
          const banned = await blacklist.check(interaction.user.id, interaction.guild.id);
          if (banned) {
            return interaction.reply({ embeds: [E.errorEmbed("Estás en la lista negra.\n**Razón:** " + (banned.reason || "Sin razón"))], flags: MessageFlags.Ephemeral });
          }
          const open = await tickets.getByUser(interaction.user.id, interaction.guild.id);
          if (open.length >= (s.max_tickets || 3)) {
            return interaction.reply({ embeds: [E.errorEmbed("Ya tienes **" + open.length + "/" + (s.max_tickets || 3) + "** tickets abiertos.")], flags: MessageFlags.Ephemeral });
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
          return interaction.reply({ embeds: [embed], components: [selectMenu], flags: MessageFlags.Ephemeral });
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
  if (s.support_role && s.support_role !== null && member.roles.cache.has(s.support_role)) return true;
  if (s.admin_role && s.admin_role !== null && member.roles.cache.has(s.admin_role)) return true;
  return false;
}
