const {
  ChannelType, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  EmbedBuilder,
} = require("discord.js");

const { tickets, settings, blacklist, staffStats, staffRatings, cooldowns } = require("../utils/database");
const { generateTranscript }  = require("../utils/transcript");
const { updateDashboard }     = require("./dashboardHandler");
const E = require("../utils/embeds");
const { categories } = require("../../config");

// ─────────────────────────────────────────────────────
//   PANEL
// ─────────────────────────────────────────────────────
async function sendPanel(channel, guild) {
  const embed = new EmbedBuilder()
    .setAuthor({ 
      name: "Centro de Soporte y Ayuda", 
      iconURL: "https://cdn.discordapp.com/attachments/123456789/987654321/support_icon.png" 
    })
    .setTitle("🎫 Sistema de Tickets de Soporte")
    .setDescription("¡Bienvenido al sistema de tickets de soporte! 🎫\n\n" +
      "**📋 ¿Qué hacer?**\n" +
      "Selecciona una categoría en el menú desplegable abajo para crear tu ticket.\n\n" +
      "**⚠️ Reglas básicas:**\n" +
      "• No etiquetas al staff sin motivo válido.\n" +
      "• Detalla tu problema con claridad y paciencia.\n" +
      "• Nuestro equipo te atenderá lo antes posible.\n\n" +
      "**🕐 Horario de atención:**\n" +
      "Estamos disponibles **24/7** para asistirte.\n\n" +
      "¡Gracias por confiar en nosotros!")
    .setColor("#5865F2")
    .setFooter({ 
      text: "Sistema protegido por Pando Bot • Selecciona una categoría abajo", 
      iconURL: guild.iconURL({ dynamic: true }) 
    })
    .setTimestamp();
    // .setThumbnail('URL_AQUI') // 👈 Descomenta y pon tu URL de logo
    // .setImage('URL_BANNER_AQUI') // 👈 Descomenta y pon tu URL de banner

  const openCount = await tickets.getAllOpen(guild.id);
  if (openCount.length > 0) embed.addFields({ name: "🎫 Tickets activos", value: `\`${openCount.length}\``, inline: true });

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_category_select")
    .setPlaceholder("Categorías de soporte disponibles...")
    .addOptions(categories.map(c => ({
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
  const s        = await settings.get(guild.id);
  const category = categories.find(c => c.id === categoryId);
  if (!category) return replyError(interaction, "Categoría no encontrada.");

  // ═══════════════════════════════════════════════════════
  //   GUARDIANES DE CREACIÓN - 4 VALIDACIONES ESTRICTAS
  // ═══════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────
  //   1️⃣ DÍAS EN SERVIDOR (min_days)
  // ─────────────────────────────────────────────────────
  if (s.min_days > 0) {
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (member) {
      const days = (Date.now() - member.joinedTimestamp) / 86400000;
      if (days < s.min_days) {
        return replyError(interaction, `Debes llevar al menos **${s.min_days} día(s)** en el servidor para abrir un ticket.`);
      }
    }
  }

  // ─────────────────────────────────────────────────────
  //   2️⃣ LÍMITE GLOBAL (global_ticket_limit)
  // ─────────────────────────────────────────────────────
  if (s.global_ticket_limit > 0) {
    const totalOpen = await tickets.getAllOpen(guild.id);
    if (totalOpen.length >= s.global_ticket_limit) {
      return replyError(interaction, `El servidor ha alcanzado el límite global de **${s.global_ticket_limit}** tickets abiertos. Por favor, espera a que se libere espacio.`);
    }
  }

  // ─────────────────────────────────────────────────────
  //   3️⃣ MÁXIMO POR USUARIO (max_tickets)
  // ─────────────────────────────────────────────────────
  const openTickets = await tickets.getByUser(user.id, guild.id);
  const maxPerUser = s.max_tickets || 3;
  if (openTickets.length >= maxPerUser) {
    return replyError(interaction, `Ya tienes **${openTickets.length}/${maxPerUser}** tickets abiertos: ${openTickets.map(t => `<#${t.channel_id}>`).join(", ")}`);
  }

  // ─────────────────────────────────────────────────────
  //   4️⃣ TIEMPO DE ESPERA (cooldown_minutes)
  // ─────────────────────────────────────────────────────
  if (s.cooldown_minutes > 0) {
    const remaining = await cooldowns.check(user.id, guild.id, s.cooldown_minutes);
    if (remaining) {
      return replyError(interaction, `Debes esperar **${remaining} minuto(s)** antes de abrir otro ticket.`);
    }
  }

  // ═══════════════════════════════════════════════════════
  //   OTRAS VALIDACIONES (Mantenimiento, Blacklist, etc.)
  // ═══════════════════════════════════════════════════════

  // Mantenimiento
  if (s.maintenance_mode) {
    return interaction.reply({ embeds: [E.maintenanceEmbed(s.maintenance_reason)], ephemeral: true });
  }

  // Blacklist
  const banned = await blacklist.check(user.id, guild.id);
  if (banned) return replyError(interaction, `Estás en la lista negra.\n**Razón:** ${banned.reason || "Sin razón"}`);

  // Rol mínimo requerido
  if (s.verify_role) {
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (member && !member.roles.cache.has(s.verify_role)) {
      return replyError(interaction, `Necesitas el rol <@&${s.verify_role}> para abrir tickets.`);
    }
  }

  // Crear el ticket
  await interaction.deferReply({ ephemeral: true });

  try {
    const ticketNumber = await settings.incrementCounter(guild.id);
    const ticketId     = String(ticketNumber).padStart(4, "0");
    const channelName  = `${process.env.TICKET_PREFIX || "ticket"}-${ticketId}`;

    const perms = [
      { id: guild.id,                  deny:  [PermissionFlagsBits.ViewChannel] },
      { id: user.id,                   allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
      { id: interaction.client.user.id,allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] },
    ];

    // Solo agregar roles si existen en la base de datos
    if (s.support_role) {
      perms.push({ id: s.support_role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ManageMessages] });
    }
    if (s.admin_role && s.admin_role !== s.support_role) {
      perms.push({ id: s.admin_role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] });
    }

    // Agregar roles de ping solo si existen
    category.pingRoles?.forEach(r => {
      if (r && !perms.find(p => p.id === r)) {
        perms.push({ id: r, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
      }
    });

    const chOpts = {
      name: channelName,
      type: ChannelType.GuildText,
      topic: `Ticket de ${user.tag} | ${category.label} | #${ticketId}`,
      permissionOverwrites: perms,
    };
    
    // Solo asignar categoría si existe un categoryId válido (por ahora sin categoría para evitar errores)
    // TODO: Implementar lectura de categoría desde base de datos cuando esté disponible
    // if (category.categoryId) chOpts.parent = category.categoryId;
    chOpts.parent = null; // Crear sin categoría temporalmente

    const channel = await guild.channels.create(chOpts);

    const ticket = await tickets.create({
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

    await cooldowns.set(user.id, guild.id);

    // Pings de roles para notificar al staff (Manejar null)
    const pings = [];
    if (s.support_role && s.support_role !== null) {
      pings.push(`<@&${s.support_role}>`);
    }
    category.pingRoles?.forEach(r => { if (r && !pings.includes(`<@&${r}>`)) pings.push(`<@&${r}>`); });

    // Enviar ping primero (fuera del embed)
    if (pings.length > 0) {
      await channel.send({ content: pings.join(" ") });
    }

    // Luego enviar el embed del ticket
    await channel.send({
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
    console.error("[TICKET ERROR]", err);
    await interaction.editReply({ embeds: [E.errorEmbed("Error al crear el ticket. Verifica mis permisos.")] });
  }
}

// ─────────────────────────────────────────────────────
//   CERRAR TICKET
// ─────────────────────────────────────────────────────
async function closeTicket(interaction, reason = null) {
  const channel = interaction.channel;
  const ticket  = await tickets.get(channel.id);
  if (!ticket) return replyError(interaction, "Este no es un canal de ticket.");
  if (ticket.status === "closed") return replyError(interaction, "Este ticket ya está cerrado.");

  const guild = interaction.guild;
  const s     = await settings.get(guild.id);
  const user  = await interaction.client.users.fetch(ticket.user_id).catch(() => null);

  await interaction.deferReply();

  await tickets.close(channel.id, interaction.user.id, reason);
  await staffStats.incrementClosed(guild.id, interaction.user.id);

  const closed = await tickets.get(channel.id);

  await disableButtons(channel);

  // Transcripción
  let transcriptMsg = null;
  try {
    const { attachment } = await generateTranscript(channel, closed, guild);
    if (s.transcript_channel) {
      const tCh = guild.channels.cache.get(s.transcript_channel);
      if (tCh) {
        transcriptMsg = await tCh.send({ 
          embeds: [transcriptEmbed(closed, interaction.user.id, Date.now())], 
          files: [attachment] 
        });
        await tickets.update(channel.id, { transcript_url: transcriptMsg.url });
      }
    }
  } catch (e) { console.error("[TRANSCRIPT]", e.message); }

  // ═══════════════════════════════════════════════════════════
  //   DM PROFESIONAL CON TRANSCRIPT ADJUNTO (Lectura estricta de settings)
  // ═══════════════════════════════════════════════════════════
  
  // Leer configuraciones de DM desde la base de datos
  const dmEnabled = s.dm_on_close === true;
  const dmTranscriptEnabled = s.dm_transcripts === true;
  const dmAlertsEnabled = s.dm_alerts === true;
  
  if (dmEnabled && user && dmAlertsEnabled) {
    try {
      // Construir el embed profesional de despedida
      const dmEmbed = new EmbedBuilder()
        .setColor(E.Colors.SUCCESS)
        .setTitle("🔒 Ticket Cerrado - " + guild.name)
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .addFields(
          { name: "🎫 Ticket", value: `#${ticket.ticket_id}`, inline: true },
          { name: "📁 Categoría", value: ticket.category || "General", inline: true },
          { name: "⏱️ Duración", value: E.duration(ticket.created_at), inline: true },
          { name: "📋 Razón", value: reason || "Sin razón especificada", inline: false },
          { name: "👮 Atendido por", value: `<@${interaction.user.id}>`, inline: true },
        )
        .setFooter({ text: "Gracias por confiar en nuestro soporte • Pando Bot" })
        .setTimestamp();

      // Añadir enlace de transcripción si existe
      if (transcriptMsg) {
        dmEmbed.addFields({ 
          name: "📄 Transcripción", 
          value: `[Ver transcripción completa](${transcriptMsg.url})`,
          inline: false 
        });
      }

      // Preparar archivos adjuntos (transcript HTML)
      const attachmentFiles = [];
      
      if (dmTranscriptEnabled && transcriptMsg && transcriptMsg.attachments?.first()) {
        // Adjuntar el archivo de transcript si está habilitado
        attachmentFiles.push(transcriptMsg.attachments.first());
      }

      // ENVÍO CRÍTICO: Try/Catch estricto para evitar crasheo
      await user.send({ 
        embeds: [dmEmbed],
        files: attachmentFiles.length > 0 ? attachmentFiles : undefined
      }).then(() => {
        console.log(`[DM] Transcript sent to user ${user.id} for ticket #${ticket.ticket_id}`);
      });
      
    } catch (dmError) {
      // ERROR CRÍTICO: El usuario tiene los DMs cerrados o bloqueados
      console.error(`[DM ERROR] No se pudo enviar DM al usuario ${user.id}:`, dmError.message);
      
      // Notificar en el canal de logs si está configurado
      if (s.log_channel) {
        const logCh = guild.channels.cache.get(s.log_channel);
        if (logCh) {
          try {
            await logCh.send({
              embeds: [new EmbedBuilder()
                .setColor(E.Colors.WARNING)
                .setTitle("⚠️ Aviso: DM no enviado")
                .setDescription(`No se pudo enviar el mensaje de cierre por DM al usuario <@${user.id}>.\n\n**Posible causa:** El usuario tiene los mensajes directos cerrados o ha bloqueado al bot.\n\n**Ticket:** #${ticket.ticket_id}`)
                .addFields(
                  { name: "📋 Transcripción disponible", value: transcriptMsg ? `[ aquí](${transcriptMsg.url})` : "No disponible", inline: true },
                )
                .setTimestamp()]
            }).catch(() => {});
          } catch (logError) {
            console.error(`[DM ERROR] Could not send log to log channel:`, logError.message);
          }
        }
      }
    }
  }

  await interaction.editReply({ embeds: [E.ticketClosed(closed, interaction.user.id, reason)] });

  // Rating por DM (habilitado por defecto)
  if (user) {
    const staffWhoHandled = closed.claimed_by || closed.assigned_to || interaction.user.id;
    await sendRating(user, ticket, channel, staffWhoHandled);
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
  const ticket  = await tickets.get(channel.id);
  if (!ticket) return replyError(interaction, "Este no es un canal de ticket.");
  if (ticket.status === "open") return replyError(interaction, "Este ticket ya está abierto.");

  const guild = interaction.guild;
  const s     = await settings.get(guild.id);
  const user  = await interaction.client.users.fetch(ticket.user_id).catch(() => null);

  await channel.permissionOverwrites.edit(ticket.user_id, {
    ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
  }).catch(() => {});

  await tickets.reopen(channel.id, interaction.user.id);
  const reopened = await tickets.get(channel.id);

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
  const ticket = await tickets.get(interaction.channel.id);
  if (!ticket) return replyError(interaction, "Este no es un canal de ticket.");
  if (ticket.claimed_by) return replyError(interaction, `Ya reclamado por <@${ticket.claimed_by}>.`);

  const guild = interaction.guild;
  const s = await settings.get(guild.id);
  
  // Actualizar en base de datos
  await tickets.update(interaction.channel.id, { claimed_by: interaction.user.id });
  await staffStats.incrementClaimed(guild.id, interaction.user.id);
  
  // Actualizar topic del canal
  await interaction.channel.setTopic(`${interaction.channel.topic || ""} | Staff: ${interaction.user.tag}`).catch(() => {});

  // ===== LÓGICA DE PERMISOS =====
  // Quitar permisos de escritura a otros staff (solo mantener lectura)
  if (s.support_role) {
    await interaction.channel.permissionOverwrites.edit(s.support_role, {
      SendMessages: false,
      ManageMessages: false,
    }).catch(() => {});
  }
  if (s.admin_role && s.admin_role !== s.support_role) {
    await interaction.channel.permissionOverwrites.edit(s.admin_role, {
      SendMessages: false,
      ManageMessages: false,
    }).catch(() => {});
  }
  
  // Dar permisos completos al staff que reclamó el ticket
  await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    AttachFiles: true,
    ManageMessages: true,
  }).catch(() => {});
  // =================================

  // Actualizar el embed del ticket para mostrar quién lo reclamó
  try {
    const msgs = await interaction.channel.messages.fetch({ limit: 10 });
    const ticketMsg = msgs.find(m => 
      m.author.id === interaction.client.user.id && 
      m.embeds.length > 0 &&
      m.embeds[0].title?.includes("Ticket")
    );
    
    if (ticketMsg) {
      const oldEmbed = ticketMsg.embeds[0];
      // Verificar si ya existe el campo "Reclamado por"
      const hasClaimedField = oldEmbed.fields?.some(f => f.name === "Reclamado por");
      
      if (!hasClaimedField) {
        const newEmbed = new EmbedBuilder(oldEmbed)
          .addFields({ name: "Reclamado por", value: `<@${interaction.user.id}>`, inline: true });
        await ticketMsg.edit({ embeds: [newEmbed] });
      }
    }
  } catch (e) {
    console.error("[CLAIM UPDATE EMBED]", e.message);
  }

  let dmEnviado = false;
  try {
    const user = await interaction.client.users.fetch(ticket.user_id);
    const channelLink = `https://discord.com/channels/${interaction.guild.id}/${interaction.channel.id}`;

    const dmEmbed = new EmbedBuilder()
      .setColor(E.Colors.SUCCESS)
      .setTitle("👋 ¡El staff ya está atendiendo tu ticket!")
      .setDescription(
        `Tu ticket **#${ticket.ticket_id}** en **${interaction.guild.name}** ya tiene a alguien atendiéndolo.\n\n` +
        `**👤 Staff asignado:** <@${interaction.user.id}>\n` +
        `**📁 Categoría:** ${ticket.category}\n` +
        `**💬 Canal:** [Ir al ticket](${channelLink})\n\n` +
        `Haz clic en el enlace de arriba para ir directamente a tu ticket y continuar la conversación.`
      )
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `${interaction.guild.name} • Sistema de Tickets` })
      .setTimestamp();

    await user.send({ embeds: [dmEmbed] });
    dmEnviado = true;
  } catch {}

  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(E.Colors.PRIMARY)
      .setDescription(
        `✅ **Has reclamado** el ticket **#${ticket.ticket_id}** correctamente.\n` +
        (dmEnviado ? "📩 Se notificó al usuario por DM." : "📩 No se pudo notificar al usuario (DMs desactivados).")
      )
      .setTimestamp()],
    ephemeral: true,
  });
}

async function unclaimTicket(interaction) {
  const ticket = await tickets.get(interaction.channel.id);
  if (!ticket) return replyError(interaction, "Este no es un canal de ticket.");
  if (!ticket.claimed_by) return replyError(interaction, "Este ticket no está reclamanado.");

  await tickets.update(interaction.channel.id, { claimed_by: null });
  return interaction.reply({ embeds: [new EmbedBuilder().setColor(E.Colors.WARNING).setDescription("↩️ Ticket liberado. Cualquier staff puede reclamarlo.").setTimestamp()] });
}

// ─────────────────────────────────────────────────────
//   ASIGNAR STAFF
// ─────────────────────────────────────────────────────
async function assignTicket(interaction, staffUser) {
  const ticket = await tickets.get(interaction.channel.id);
  if (!ticket) return replyError(interaction, "Este no es un canal de ticket.");

  const guild = interaction.guild;
  const s     = await settings.get(guild.id);

  await interaction.channel.permissionOverwrites.edit(staffUser, {
    ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true,
  }).catch(() => {});

  await tickets.update(interaction.channel.id, { assigned_to: staffUser.id });
  await staffStats.incrementAssigned(guild.id, staffUser.id);

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
  const ticket = await tickets.get(interaction.channel.id);
  if (!ticket) return replyError(interaction, "Este no es un canal de ticket.");
  await interaction.channel.permissionOverwrites.edit(user, {
    ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true,
  });
  return interaction.reply({ embeds: [E.successEmbed(`<@${user.id}> añadido al ticket.`)] });
}

async function removeUser(interaction, user) {
  const ticket = await tickets.get(interaction.channel.id);
  if (!ticket) return replyError(interaction, "Este no es un canal de ticket.");
  if (user.id === ticket.user_id) return replyError(interaction, "No puedes quitar al creador del ticket.");
  await interaction.channel.permissionOverwrites.delete(user).catch(() => {});
  return interaction.reply({ embeds: [E.successEmbed(`<@${user.id}> quitado del ticket.`)] });
}

// ─────────────────────────────────────────────────────
//   MOVER CATEGORÍA
// ─────────────────────────────────────────────────────
async function moveTicket(interaction, newCategoryId) {
  const ticket      = await tickets.get(interaction.channel.id);
  if (!ticket) return replyError(interaction, "Este no es un canal de ticket.");
  const newCategory = categories.find(c => c.id === newCategoryId);
  if (!newCategory) return replyError(interaction, "Categoría no encontrada.");

  const oldCategory = ticket.category;
  await tickets.update(interaction.channel.id, { category: newCategory.label, category_id: newCategory.id, priority: newCategory.priority || "normal" });

  const guild = interaction.guild;
  const s     = await settings.get(guild.id);

  if (newCategory.categoryId) {
    await interaction.channel.setParent(newCategory.categoryId, { lockPermissions: false }).catch(() => {});
  }

  const updatedTicket = await tickets.get(interaction.channel.id);
  await sendLog(guild, s, "move", interaction.user, updatedTicket, {
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
async function sendRating(user, ticket, channel, staffId) {
  try {
    const embed = E.ratingEmbed(user, ticket, staffId);
    const options = [1,2,3,4,5].map(n => ({
      label: ["⭐","⭐⭐","⭐⭐⭐","⭐⭐⭐⭐","⭐⭐⭐⭐⭐"][n-1],
      value: String(n),
      description: ["Muy malo 😞","Malo 😐","Regular 🙂","Bueno 😊","Excelente 🤩"][n-1],
    }));
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`ticket_rating_${ticket.ticket_id}_${channel.id}_${staffId}`)
        .setPlaceholder("⭐ ¿Cómo calificarías la atención?")
        .addOptions(options)
    );
    await user.send({ embeds: [embed], components: [row] });
  } catch {}
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

function transcriptEmbed(ticket, closedByStaff = null, closedAt = null) {
  const { EmbedBuilder } = require("discord.js");
  
  // Formatear fecha de cierre
  const fechaCierre = closedAt 
    ? `<t:${Math.floor(closedAt / 1000)}:F>` 
    : (ticket.closed_at ? `<t:${Math.floor(new Date(ticket.closed_at).getTime() / 1000)}:F>` : "No disponible");
  
  // Staff que cerró el ticket
  const staffCierra = closedByStaff 
    ? `<@${closedByStaff}>` 
    : (ticket.closed_by ? `<@${ticket.closed_by}>` : "Desconocido");
  
  return new EmbedBuilder()
    .setTitle("📄 Transcripción de Ticket")
    .setColor(0x00FF00) // Verde para transcripciones
    .addFields(
      { name: "🎫 Ticket",    value: `#${ticket.ticket_id}`, inline: true },
      { name: "👤 Usuario",   value: `<@${ticket.user_id}>`, inline: true },
      { name: "📁 Categoría", value: ticket.category,        inline: true },
      { name: "⏱️ Duración",  value: E.duration(ticket.created_at), inline: true },
      { name: "👮 Staff",     value: staffCierra,             inline: true },
      { name: "📅 Cerrado",  value: fechaCierre,             inline: true },
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
