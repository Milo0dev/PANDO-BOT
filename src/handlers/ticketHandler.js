const {
  ChannelType, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  EmbedBuilder,
} = require("discord.js");

const { tickets, settings, blacklist, staffStats, cooldowns } = require("../utils/database");
const { generateTranscript }  = require("../utils/transcript");
const { updateDashboard }     = require("./dashboardHandler");
const E = require("../utils/embeds");
const config = require("../../config");

// ─────────────────────────────────────────────────────
//   PANEL
// ─────────────────────────────────────────────────────
async function sendPanel(channel, guild) {
  const p = config.panel;
  const embed = new EmbedBuilder()
    .setTitle(p.title)
    .setDescription(p.description)
    .setColor(p.color)
    .setFooter({ text: p.footer, iconURL: guild.iconURL({ dynamic: true }) })
    .setTimestamp();

  const openCount = tickets.getAllOpen(guild.id).length;
  if (openCount > 0) embed.addFields({ name: "🎫 Tickets activos", value: `\`${openCount}\``, inline: true });

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_category_select")
    .setPlaceholder("📋 Selecciona el tipo de ticket...")
    .addOptions(config.categories.map(c => ({
      label: c.label, description: c.description, value: c.id, emoji: c.emoji,
    })));

  return channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
}

// ─────────────────────────────────────────────────────
//   MODAL DE PREGUNTAS
// ─────────────────────────────────────────────────────
function buildModal(category) {
  const modal = new ModalBuilder()
    .setCustomId(`ticket_modal_${category.id}`)
    .setTitle(`${category.emoji} ${category.label}`.substring(0, 45));

  const questions = (category.questions || ["¿En qué podemos ayudarte?"]).slice(0, 5);
  questions.forEach((q, i) => {
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(`answer_${i}`)
        .setLabel(q.substring(0, 45))
        .setStyle(i === 0 ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(500)
    ));
  });
  return modal;
}

// ─────────────────────────────────────────────────────
//   CREAR TICKET
// ─────────────────────────────────────────────────────
async function createTicket(interaction, categoryId, answers = []) {
  const guild    = interaction.guild;
  const user     = interaction.user;
  const s        = settings.get(guild.id);
  const category = config.categories.find(c => c.id === categoryId);
  if (!category) return replyError(interaction, "Categoría no encontrada.");

  // Mantenimiento
  if (s.maintenance_mode) {
    return interaction.reply({ embeds: [E.maintenanceEmbed(s.maintenance_reason)], ephemeral: true });
  }

  // Blacklist
  const banned = blacklist.check(user.id, guild.id);
  if (banned) return replyError(interaction, `Estás en la lista negra.\n**Razón:** ${banned.reason || "Sin razón"}`);

  // Cooldown
  if (s.cooldown_minutes > 0) {
    const remaining = cooldowns.check(user.id, guild.id, s.cooldown_minutes);
    if (remaining) return replyError(interaction, `Debes esperar **${remaining} minuto(s)** antes de abrir otro ticket.`);
  }

  // Rol mínimo requerido
  if (s.verify_role) {
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (member && !member.roles.cache.has(s.verify_role)) {
      return replyError(interaction, `Necesitas el rol <@&${s.verify_role}> para abrir tickets.`);
    }
  }

  // Días mínimos en el servidor
  if (s.min_days > 0) {
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (member) {
      const days = (Date.now() - member.joinedTimestamp) / 86400000;
      if (days < s.min_days) {
        return replyError(interaction, `Debes llevar al menos **${s.min_days} días** en el servidor para abrir tickets.`);
      }
    }
  }

  // Límite por usuario
  const openTickets = tickets.getByUser(user.id, guild.id);
  if (openTickets.length >= (s.max_tickets || 3)) {
    return replyError(interaction, `Ya tienes **${openTickets.length}/${s.max_tickets}** tickets abiertos: ${openTickets.map(t => `<#${t.channel_id}>`).join(", ")}`);
  }

  // Límite global
  if (s.global_ticket_limit > 0) {
    const totalOpen = tickets.getAllOpen(guild.id).length;
    if (totalOpen >= s.global_ticket_limit) {
      return replyError(interaction, `El servidor ha alcanzado el límite global de **${s.global_ticket_limit}** tickets abiertos. Por favor espera a que se libere espacio.`);
    }
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const ticketNumber = settings.incrementCounter(guild.id);
    const ticketId     = String(ticketNumber).padStart(4, "0");
    const channelName  = `${process.env.TICKET_PREFIX || "ticket"}-${ticketId}`;

    const perms = [
      { id: guild.id,                  deny:  [PermissionFlagsBits.ViewChannel] },
      { id: user.id,                   allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
      { id: interaction.client.user.id,allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] },
    ];

    if (s.support_role) perms.push({ id: s.support_role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ManageMessages] });
    if (s.admin_role && s.admin_role !== s.support_role) perms.push({ id: s.admin_role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] });

    category.pingRoles?.forEach(r => {
      if (!perms.find(p => p.id === r)) perms.push({ id: r, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
    });

    const chOpts = {
      name: channelName,
      type: ChannelType.GuildText,
      topic: `Ticket de ${user.tag} | ${category.label} | #${ticketId}`,
      permissionOverwrites: perms,
    };
    if (category.categoryId) chOpts.parent = category.categoryId;

    const channel = await guild.channels.create(chOpts);

    const ticket = tickets.create({
      ticket_id:   ticketId,
      channel_id:  channel.id,
      guild_id:    guild.id,
      user_id:     user.id,
      category:    category.label,
      category_id: category.id,
      priority:    category.priority || "normal",
      subject:     answers[0]?.substring(0, 100) || null,
      answers:     answers.length ? JSON.stringify(answers) : null,
    });

    cooldowns.set(user.id, guild.id);

    // Pings de roles
    const pings = [];
    if (s.support_role) pings.push(`<@&${s.support_role}>`);
    category.pingRoles?.forEach(r => { if (!pings.includes(`<@&${r}>`)) pings.push(`<@&${r}>`); });

    await channel.send({
      content: pings.join(" ") || undefined,
      embeds:  [E.ticketOpen(ticket, user, category, answers)],
      components: [buildTicketButtons()],
    });

    await channel.send({ content: `> 👋 <@${user.id}>, tu ticket **#${ticketId}** fue creado. Describe tu situación con detalle.` });

    // DM de confirmación
    if (s.dm_on_open) {
      await user.send({ embeds: [E.infoEmbed("🎫 Ticket Creado", `Tu ticket **#${ticketId}** ha sido creado en **${guild.name}**.\nCanal: <#${channel.id}>\n\nTe avisaremos cuando el staff responda.`)] }).catch(() => {});
    }

    // Log y dashboard
    await sendLog(guild, s, "open", user, ticket, { "📁 Canal": `<#${channel.id}>` });
    await updateDashboard(guild);

    await interaction.editReply({ embeds: [E.successEmbed(`Ticket creado: <#${channel.id}> | **#${ticketId}**`)] });
  } catch (err) {
    console.error("[CREATE TICKET]", err);
    await interaction.editReply({ embeds: [E.errorEmbed("Error al crear el ticket. Verifica mis permisos.")] });
  }
}

// ─────────────────────────────────────────────────────
//   CERRAR TICKET
// ─────────────────────────────────────────────────────
async function closeTicket(interaction, reason = null) {
  const channel = interaction.channel;
  const ticket  = tickets.get(channel.id);
  if (!ticket) return replyError(interaction, "Este no es un canal de ticket.");
  if (ticket.status === "closed") return replyError(interaction, "Este ticket ya está cerrado.");

  const guild = interaction.guild;
  const s     = settings.get(guild.id);
  const user  = await interaction.client.users.fetch(ticket.user_id).catch(() => null);

  await interaction.deferReply();

  tickets.close(channel.id, interaction.user.id, reason);
  staffStats.incrementClosed(guild.id, interaction.user.id);

  const closed = tickets.get(channel.id);

  await disableButtons(channel);

  // Transcripción
  let transcriptMsg = null;
  try {
    const { attachment } = await generateTranscript(channel, closed, guild);
    if (s.transcript_channel) {
      const tCh = guild.channels.cache.get(s.transcript_channel);
      if (tCh) {
        transcriptMsg = await tCh.send({ embeds: [transcriptEmbed(closed)], files: [attachment] });
        tickets.update(channel.id, { transcript_url: transcriptMsg.url });
      }
    }
  } catch (e) { console.error("[TRANSCRIPT]", e.message); }

  // DM al usuario
  if (s.dm_on_close && user) {
    const dmEmbed = E.infoEmbed("🔒 Ticket Cerrado",
      `Tu ticket **#${ticket.ticket_id}** en **${guild.name}** fue cerrado.\n\n**Razón:** ${reason || "Sin razón"}\n**Duración:** ${E.duration(ticket.created_at)}${transcriptMsg ? `\n\n[📄 Ver transcripción](${transcriptMsg.url})` : ""}`
    );
    await user.send({ embeds: [dmEmbed] }).catch(() => {});
  }

  await interaction.editReply({ embeds: [E.ticketClosed(closed, interaction.user.id, reason)] });

  // Rating por DM
  if (config.ratings.enabled && user) {
    await sendRating(user, ticket, channel);
  }

  await sendLog(guild, s, "close", interaction.user, closed, {
    "📋 Razón":   reason || "Sin razón",
    "⏱️ Duración": E.duration(ticket.created_at),
    "👤 Usuario":  `<@${ticket.user_id}>`,
  });

  await updateDashboard(guild);
  setTimeout(() => channel.delete().catch(() => {}), 10000);
}

// ─────────────────────────────────────────────────────
//   REABRIR TICKET
// ─────────────────────────────────────────────────────
async function reopenTicket(interaction) {
  const channel = interaction.channel;
  const ticket  = tickets.get(channel.id);
  if (!ticket) return replyError(interaction, "Este no es un canal de ticket.");
  if (ticket.status === "open") return replyError(interaction, "Este ticket ya está abierto.");

  const guild = interaction.guild;
  const s     = settings.get(guild.id);
  const user  = await interaction.client.users.fetch(ticket.user_id).catch(() => null);

  // Restaurar permisos del usuario
  await channel.permissionOverwrites.edit(ticket.user_id, {
    ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
  }).catch(() => {});

  tickets.reopen(channel.id, interaction.user.id);
  const reopened = tickets.get(channel.id);

  // Re-habilitar botones
  await channel.send({
    embeds:     [E.ticketReopened(reopened, interaction.user.id)],
    components: [buildTicketButtons()],
  });

  if (user) {
    await user.send({ embeds: [E.infoEmbed("🔓 Ticket Reabierto", `Tu ticket **#${ticket.ticket_id}** en **${guild.name}** ha sido reabierto por <@${interaction.user.id}>.`)] }).catch(() => {});
  }

  await sendLog(guild, s, "reopen", interaction.user, reopened, { "🔄 Reaperturas": reopened.reopen_count });
  await updateDashboard(guild);
  return interaction.reply({ embeds: [E.successEmbed("Ticket reabierto correctamente.")], ephemeral: true });
}

// ─────────────────────────────────────────────────────
//   RECLAMAR / LIBERAR
// ─────────────────────────────────────────────────────
async function claimTicket(interaction) {
  const ticket = tickets.get(interaction.channel.id);
  if (!ticket) return replyError(interaction, "Este no es un canal de ticket.");
  if (ticket.claimed_by) return replyError(interaction, `Ya reclamado por <@${ticket.claimed_by}>.`);

  tickets.update(interaction.channel.id, { claimed_by: interaction.user.id });
  staffStats.incrementClaimed(interaction.guild.id, interaction.user.id);
  await interaction.channel.setTopic(`${interaction.channel.topic || ""} | Staff: ${interaction.user.tag}`).catch(() => {});

  // ── DM al usuario avisando que el staff ya está atendiendo
  let dmEnviado = false;
  try {
    const user = await interaction.client.users.fetch(ticket.user_id);
    const dmEmbed = new EmbedBuilder()
      .setColor(E.Colors.SUCCESS)
      .setTitle("👋 ¡El staff ya está atendiendo tu ticket!")
      .setDescription(
        `Tu ticket **#${ticket.ticket_id}** en **${interaction.guild.name}** ya tiene a alguien atendiéndolo.\n\n` +
        `**👤 Staff asignado:** ${interaction.user.tag}\n` +
        `**📁 Categoría:** ${ticket.category}\n\n` +
        `Ve al servidor y responde en el canal de tu ticket para continuar.`
      )
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `${interaction.guild.name} • Sistema de Tickets` })
      .setTimestamp();

    await user.send({ embeds: [dmEmbed] });
    dmEnviado = true;
  } catch {
    // Usuario con DMs desactivados — se ignora silenciosamente
  }

  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(E.Colors.PRIMARY)
      .setDescription(
        `👋 <@${interaction.user.id}> ha reclamado este ticket.\n` +
        (dmEnviado ? "📩 Se notificó al usuario por DM." : "📩 No se pudo notificar al usuario (DMs desactivados).")
      )
      .setTimestamp()],
  });
}

async function unclaimTicket(interaction) {
  const ticket = tickets.get(interaction.channel.id);
  if (!ticket) return replyError(interaction, "Este no es un canal de ticket.");
  if (!ticket.claimed_by) return replyError(interaction, "Este ticket no está reclamado.");

  tickets.update(interaction.channel.id, { claimed_by: null });
  return interaction.reply({ embeds: [new EmbedBuilder().setColor(E.Colors.WARNING).setDescription("↩️ Ticket liberado. Cualquier staff puede reclamarlo.").setTimestamp()] });
}

// ─────────────────────────────────────────────────────
//   ASIGNAR STAFF
// ─────────────────────────────────────────────────────
async function assignTicket(interaction, staffUser) {
  const ticket = tickets.get(interaction.channel.id);
  if (!ticket) return replyError(interaction, "Este no es un canal de ticket.");

  const guild = interaction.guild;
  const s     = settings.get(guild.id);

  // Dar acceso al canal si no lo tiene
  await interaction.channel.permissionOverwrites.edit(staffUser, {
    ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true,
  }).catch(() => {});

  tickets.update(interaction.channel.id, { assigned_to: staffUser.id });
  staffStats.incrementAssigned(guild.id, staffUser.id);

  await sendLog(guild, s, "assign", interaction.user, ticket, { "📌 Asignado a": `<@${staffUser.id}>` });

  return interaction.reply({
    embeds: [new EmbedBuilder().setColor(E.Colors.INFO)
      .setDescription(`📌 Ticket asignado a <@${staffUser.id}>.\nRecibirá acceso y notificación.`).setTimestamp()],
  });
}

// ─────────────────────────────────────────────────────
//   AÑADIR / QUITAR USUARIO
// ─────────────────────────────────────────────────────
async function addUser(interaction, user) {
  const ticket = tickets.get(interaction.channel.id);
  if (!ticket) return replyError(interaction, "Este no es un canal de ticket.");
  await interaction.channel.permissionOverwrites.edit(user, {
    ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true,
  });
  return interaction.reply({ embeds: [E.successEmbed(`<@${user.id}> añadido al ticket.`)] });
}

async function removeUser(interaction, user) {
  const ticket = tickets.get(interaction.channel.id);
  if (!ticket) return replyError(interaction, "Este no es un canal de ticket.");
  if (user.id === ticket.user_id) return replyError(interaction, "No puedes quitar al creador del ticket.");
  await interaction.channel.permissionOverwrites.delete(user).catch(() => {});
  return interaction.reply({ embeds: [E.successEmbed(`<@${user.id}> quitado del ticket.`)] });
}

// ─────────────────────────────────────────────────────
//   MOVER CATEGORÍA
// ─────────────────────────────────────────────────────
async function moveTicket(interaction, newCategoryId) {
  const ticket      = tickets.get(interaction.channel.id);
  if (!ticket) return replyError(interaction, "Este no es un canal de ticket.");
  const newCategory = config.categories.find(c => c.id === newCategoryId);
  if (!newCategory) return replyError(interaction, "Categoría no encontrada.");

  const oldCategory = ticket.category;
  tickets.update(interaction.channel.id, { category: newCategory.label, category_id: newCategory.id, priority: newCategory.priority || "normal" });

  const guild = interaction.guild;
  const s     = settings.get(guild.id);

  if (newCategory.categoryId) {
    await interaction.channel.setParent(newCategory.categoryId, { lockPermissions: false }).catch(() => {});
  }

  await sendLog(guild, s, "move", interaction.user, tickets.get(interaction.channel.id), {
    "📂 Anterior": oldCategory, "📂 Nueva": newCategory.label,
  });

  return interaction.reply({
    embeds: [new EmbedBuilder().setColor(E.Colors.INFO)
      .setDescription(`📂 Ticket movido de **${oldCategory}** → **${newCategory.label}**`).setTimestamp()],
  });
}

// ─────────────────────────────────────────────────────
//   RATING (por DM al usuario)
// ─────────────────────────────────────────────────────
async function sendRating(user, ticket, channel) {
  try {
    const embed = E.ratingEmbed(user, ticket.ticket_id);
    const options = [1,2,3,4,5].map(n => ({
      label: "⭐".repeat(n),
      value: String(n),
      description: ["Muy malo","Malo","Regular","Bueno","Excelente"][n-1],
    }));
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`ticket_rating_${ticket.ticket_id}_${channel.id}`)
        .setPlaceholder("Selecciona tu calificación...")
        .addOptions(options)
    );
    await user.send({ embeds: [embed], components: [row] });
  } catch { /* DMs desactivados */ }
}

// ─────────────────────────────────────────────────────
//   HELPERS
// ─────────────────────────────────────────────────────
function buildTicketButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket_close").setLabel("Cerrar").setEmoji("🔒").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("ticket_claim").setLabel("Reclamar").setEmoji("👋").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ticket_transcript").setLabel("Transcripción").setEmoji("📄").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ticket_reopen").setLabel("Reabrir").setEmoji("🔓").setStyle(ButtonStyle.Success),
  );
}

async function disableButtons(channel) {
  try {
    const msgs = await channel.messages.fetch({ limit: 15 });
    for (const msg of msgs.values()) {
      if (msg.author.id === channel.client.user.id && msg.components.length > 0) {
        const rows = msg.components.map(row => {
          const r = ActionRowBuilder.from(row);
          r.components = r.components.map(c => ButtonBuilder.from(c).setDisabled(true));
          return r;
        });
        await msg.edit({ components: rows }).catch(() => {});
      }
    }
  } catch {}
}

function transcriptEmbed(ticket) {
  const { EmbedBuilder } = require("discord.js");
  return new EmbedBuilder()
    .setTitle("📄 Transcripción de Ticket")
    .setColor(E.Colors.INFO)
    .addFields(
      { name: "🎫 Ticket",   value: `#${ticket.ticket_id}`, inline: true },
      { name: "👤 Usuario",  value: `<@${ticket.user_id}>`, inline: true },
      { name: "📁 Categoría",value: ticket.category,        inline: true },
      { name: "⏱️ Duración", value: E.duration(ticket.created_at), inline: true },
      { name: "💬 Mensajes", value: `${ticket.message_count}`,     inline: true },
      { name: "⭐ Rating",   value: ticket.rating ? `${ticket.rating}/5` : "Sin calificar", inline: true },
    ).setTimestamp();
}

async function sendLog(guild, s, action, user, ticket, details = {}) {
  if (!s.log_channel) return;
  const ch = guild.channels.cache.get(s.log_channel);
  if (!ch) return;
  await ch.send({ embeds: [E.ticketLog(ticket, user, action, details)] }).catch(() => {});
}

function replyError(interaction, msg) {
  const payload = { embeds: [E.errorEmbed(msg)], ephemeral: true };
  return interaction.replied || interaction.deferred
    ? interaction.followUp(payload)
    : interaction.reply(payload);
}

module.exports = {
  sendPanel, buildModal, createTicket, closeTicket, reopenTicket,
  claimTicket, unclaimTicket, assignTicket,
  addUser, removeUser, moveTicket,
  buildTicketButtons, sendLog, replyError,
};
