const {
  ChannelType, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  EmbedBuilder, AttachmentBuilder
} = require("discord.js");

const { tickets, settings, blacklist, staffStats, staffRatings, cooldowns } = require("../utils/database");
const { generateTranscript } = require("../utils/transcript");
const { updateDashboard } = require("./dashboardHandler");
const E = require("../utils/embeds");
const { categories } = require("../../config");

// ─────────────────────────────────────────────────────
//   PANEL PREMIUM
// ─────────────────────────────────────────────────────
async function sendPanel(channel, guild) {
  // Crear un embed premium para el panel de tickets
  const embed = new EmbedBuilder()
    .setAuthor({ 
      name: "Centro de Soporte Premium", 
      iconURL: guild.iconURL({ dynamic: true }) 
    })
    .setTitle("🧷 TICKET DE SOPORTE")
    .setDescription(
      "Bienvenido a nuestro sistema de asistencia personalizada. Estamos aquí para ayudarte con cualquier consulta o problema que puedas tener.\n\n" +
      "**¿Cómo podemos ayudarte hoy?**\n" +
      "Selecciona la categoría que mejor se adapte a tu consulta en el menú desplegable a continuación."
    )
    .addFields(
      { 
        name: "📋 Antes de abrir un ticket", 
        value: "• Revisa nuestras **FAQ** para soluciones rápidas\n" +
               "• Prepara capturas de pantalla si son necesarias\n" +
               "• Describe tu problema con el mayor detalle posible", 
        inline: false 
      },
      { 
        name: "⏱️ Tiempo de respuesta", 
        value: "Nuestro equipo de soporte está disponible y responderá a tu ticket lo antes posible.", 
        inline: false 
      },
      { 
        name: "🔒 Privacidad garantizada", 
        value: "Tu ticket será visible únicamente para ti y nuestro equipo de soporte.", 
        inline: false 
      }
    )
    .setColor(0x5865F2)
    // BANNER PERSONALIZABLE - Descomenta la siguiente línea y añade tu URL
    .setImage("https://media.discordapp.net/attachments/756736685387022417/1477017203378225182/PANDOBOT_TICKET.PNG?ex=69a33af6&is=69a1e976&hm=d0e7ada6689e3ea4a8f81c2bbb701b0904c42f8d06e9b1d7de1eba4f59d8ced6&=&format=webp&quality=lossless&width=1211&height=429") // PON TU URL AQUÍ - Banner recomendado: 1500x300px
    .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
    .setFooter({
      text: `${guild.name} • Sistema Premium de Soporte`,
      iconURL: guild.iconURL({ dynamic: true }),
    })
    .setTimestamp();

  // Mostrar contador de tickets activos si hay alguno
  const openCount = await tickets.getAllOpen(guild.id);
  if (openCount.length > 0) {
    embed.addFields({ 
      name: "🎫 Tickets activos", 
      value: `\`${openCount.length}\``, 
      inline: true 
    });
  }

  // Crear el menú de categorías
  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_category_select")
    .setPlaceholder("✨ Selecciona una categoría de soporte...")
    .addOptions(categories.map(c => ({
      label: c.label,
      description: c.description?.substring(0, 100) || "Selecciona esta categoría para recibir ayuda",
      value: c.id,
      emoji: c.emoji,
    })));

  // Enviar el panel con el menú de selección
  return channel.send({ 
    embeds: [embed], 
    components: [new ActionRowBuilder().addComponents(menu)] 
  });
}

// ─────────────────────────────────────────────────────
//   MODAL DE PREGUNTAS PREMIUM
// ─────────────────────────────────────────────────────
function buildModal(category) {
  const modal = new ModalBuilder()
    .setCustomId(`ticket_modal_${category.id}`)
    .setTitle(`${category.emoji} ${category.label}`.substring(0, 45));

  // Añadir preguntas al modal (máximo 5)
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
        .setPlaceholder(i === 0 ? "Describe tu problema con el mayor detalle posible..." : "Tu respuesta aquí...")
    ));
  });
  
  return modal;
}

// ─────────────────────────────────────────────────────
//   CREAR TICKET PREMIUM
// ─────────────────────────────────────────────────────
async function createTicket(interaction, categoryId, answers = []) {
  const guild = interaction.guild;
  const user = interaction.user;
  const s = await settings.get(guild.id);
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
    const ticketId = String(ticketNumber).padStart(4, "0");
    const channelName = `${process.env.TICKET_PREFIX || "ticket"}-${ticketId}`;

    // Configurar permisos del canal
    const perms = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
      { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] },
    ];

    // Añadir roles de soporte si existen
    if (s.support_role) {
      perms.push({ id: s.support_role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ManageMessages] });
    }
    if (s.admin_role && s.admin_role !== s.support_role) {
      perms.push({ id: s.admin_role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] });
    }

    // Añadir roles de ping específicos de la categoría
    category.pingRoles?.forEach(r => {
      if (r && !perms.find(p => p.id === r)) {
        perms.push({ id: r, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
      }
    });

    // Opciones del canal
    const chOpts = {
      name: channelName,
      type: ChannelType.GuildText,
      topic: `Ticket de ${user.tag} | ${category.label} | #${ticketId}`,
      permissionOverwrites: perms,
    };
    
    // Asignar categoría si existe
    if (category.categoryId) chOpts.parent = category.categoryId;

    // Crear el canal
    const channel = await guild.channels.create(chOpts);

    // Registrar el ticket en la base de datos
    const ticket = await tickets.create({
      ticket_id: ticketId,
      channel_id: channel.id,
      guild_id: guild.id,
      user_id: user.id,
      category: category.label,
      category_id: category.id,
      priority: category.priority || "normal",
      subject: answers[0]?.substring(0, 100) || null,
      answers: answers.length ? JSON.stringify(answers) : null,
    });

    // Establecer cooldown
    await cooldowns.set(user.id, guild.id);

    // Preparar menciones para el staff
    const pings = [];
    if (s.support_role && s.support_role !== null) {
      pings.push(`<@&${s.support_role}>`);
    }
    category.pingRoles?.forEach(r => { 
      if (r && !pings.includes(`<@&${r}>`)) pings.push(`<@&${r}>`); 
    });

    // MEJORA: Separar el ping y el panel de control
    // 1. Enviar ping primero (fuera del embed)
    if (pings.length > 0) {
      await channel.send({ 
        content: `> 👋 <@${user.id}>, tu ticket **#${ticketId}** fue creado.\n\n${pings.join(" ")}` 
      });
    } else {
      await channel.send({ 
        content: `> 👋 <@${user.id}>, tu ticket **#${ticketId}** fue creado. Describe tu situación con detalle.` 
      });
    }

    // 2. Enviar el Panel de Control del Ticket
    const controlPanel = new EmbedBuilder()
      .setTitle("🎮 Panel de Control")
      .setDescription(
        `Este es el panel de control para el ticket **#${ticketId}**.\n` +
        `Utiliza los botones de abajo para gestionar este ticket.`
      )
      .addFields(
        { name: "👤 Usuario", value: `<@${user.id}>`, inline: true },
        { name: "📁 Categoría", value: category.label, inline: true },
        { name: "🔑 ID", value: `#${ticketId}`, inline: true },
        { name: "⏰ Creado", value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true },
        { name: "⚡ Prioridad", value: priorityLabel(category.priority || "normal"), inline: true }
      )
      .setColor(category.color || 0x5865F2)
      .setFooter({ 
        text: `${guild.name} • Sistema Premium de Tickets`, 
        iconURL: guild.iconURL({ dynamic: true }) 
      })
      .setTimestamp();

    // Añadir el formulario si hay respuestas
    if (answers?.length) {
      const questions = category.questions || [];
      const qaText = answers.map((a, i) => `**${questions[i] || `Pregunta ${i+1}`}**\n${a}`).join("\n\n");
      controlPanel.addFields({ name: "📝 Formulario", value: qaText.substring(0, 1000) });
    }

    // Botones del panel de control
    const controlButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_close")
        .setLabel("Cerrar")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("ticket_claim")
        .setLabel("Reclamar")
        .setEmoji("👋")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("ticket_transcript")
        .setLabel("Transcripción")
        .setEmoji("📄")
        .setStyle(ButtonStyle.Secondary)
    );

    // Enviar el panel de control
    await channel.send({
      embeds: [controlPanel],
      components: [controlButtons],
    });

    // DM de confirmación
    if (s.dm_on_open) {
      try {
        await user.send({ 
          embeds: [
            new EmbedBuilder()
              .setColor(E.Colors.SUCCESS)
              .setTitle("🎫 Ticket Creado")
              .setDescription(
                `Tu ticket **#${ticketId}** ha sido creado en **${guild.name}**.\n` +
                `Canal: <#${channel.id}>\n\n` +
                `Te avisaremos cuando el staff responda.`
              )
              .setThumbnail(guild.iconURL({ dynamic: true }))
              .setFooter({ 
                text: `${guild.name} • Sistema Premium de Tickets`, 
                iconURL: guild.iconURL({ dynamic: true }) 
              })
              .setTimestamp()
          ] 
        });
      } catch (dmError) {
        console.log(`[DM ERROR] No se pudo enviar DM al usuario ${user.id}: ${dmError.message}`);
      }
    }

    // Log y dashboard
    await sendLog(guild, s, "open", user, ticket, { "📁 Canal": `<#${channel.id}>` });
    await updateDashboard(guild);

    // Responder al usuario
    await interaction.editReply({ 
      embeds: [
        new EmbedBuilder()
          .setColor(E.Colors.SUCCESS)
          .setTitle("✅ Ticket Creado Correctamente")
          .setDescription(
            `Tu ticket ha sido creado: <#${channel.id}> | **#${ticketId}**\n\n` +
            `Por favor, dirígete al canal para continuar con tu consulta.`
          )
          .setFooter({ 
            text: `${guild.name} • Sistema Premium de Tickets`, 
            iconURL: guild.iconURL({ dynamic: true }) 
          })
          .setTimestamp()
      ] 
    });
  } catch (err) {
    console.error("[TICKET ERROR]", err);
    await interaction.editReply({ 
      embeds: [E.errorEmbed("Error al crear el ticket. Verifica mis permisos o contacta a un administrador.")] 
    });
  }
}

// ─────────────────────────────────────────────────────
//   CERRAR TICKET PREMIUM
// ─────────────────────────────────────────────────────
async function closeTicket(interaction, reason = null) {
  const channel = interaction.channel;
  const ticket = await tickets.get(channel.id);
  
  if (!ticket) return replyError(interaction, "Este no es un canal de ticket.");
  if (ticket.status === "closed") return replyError(interaction, "Este ticket ya está cerrado.");

  const guild = interaction.guild;
  const s = await settings.get(guild.id);
  const user = await interaction.client.users.fetch(ticket.user_id).catch(() => null);

  // Verificar si la interacción ya fue respondida o diferida antes de llamar a deferReply
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply();

  // Actualizar el ticket en la base de datos
  await tickets.close(channel.id, interaction.user.id, reason);
  await staffStats.incrementClosed(guild.id, interaction.user.id);

  const closed = await tickets.get(channel.id);

  // Deshabilitar botones
  await disableButtons(channel);

  // Generar transcripción
  let transcriptMsg = null;
  let transcriptAttachment = null;
  try {
    const { attachment } = await generateTranscript(channel, closed, guild);
    transcriptAttachment = attachment;
    
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
  } catch (e) { 
    console.error("[TRANSCRIPT ERROR]", e.message); 
  }

  // ═══════════════════════════════════════════════════════════
  //   DM PROFESIONAL CON TRANSCRIPT ADJUNTO
  // ═══════════════════════════════════════════════════════════
  
  // Leer configuraciones de DM desde la base de datos
  const dmEnabled = s.dm_on_close === true;
  const dmTranscriptEnabled = s.dm_transcripts === true;
  const dmAlertsEnabled = s.dm_alerts === true;
  
  if (dmEnabled && user && dmAlertsEnabled) {
    try {
      // Calcular duración exacta
      const createdAt = new Date(ticket.created_at);
      const closedAt = new Date();
      const durationMs = closedAt - createdAt;
      
      // Formatear duración en formato legible
      const days = Math.floor(durationMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((durationMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      
      let durationText = "";
      if (days > 0) durationText += `${days}d `;
      if (hours > 0) durationText += `${hours}h `;
      durationText += `${minutes}m`;
      
      // Construir el embed profesional de despedida (estilo factura/recibo)
      const dmEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({ 
          name: guild.name, 
          iconURL: guild.iconURL({ dynamic: true }) 
        })
        .setTitle("🧾 Recibo de Soporte Técnico")
        .setDescription(
          `Gracias por contactar con nuestro equipo de soporte. A continuación encontrarás un resumen de tu ticket.`
        )
        .addFields(
          { name: "🎫 Ticket", value: `#${ticket.ticket_id}`, inline: true },
          { name: "📁 Categoría", value: ticket.category || "General", inline: true },
          { name: "📅 Fecha de apertura", value: `<t:${Math.floor(createdAt.getTime() / 1000)}:F>`, inline: false },
          { name: "📅 Fecha de cierre", value: `<t:${Math.floor(closedAt.getTime() / 1000)}:F>`, inline: true },
          { name: "⏱️ Duración total", value: durationText, inline: true },
          { name: "📋 Razón de cierre", value: reason || "No se proporcionó una razón", inline: false },
          { name: "👮 Atendido por", value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : `<@${interaction.user.id}>`, inline: true },
          { name: "💬 Mensajes", value: `${ticket.message_count || 0}`, inline: true },
        )
        .setFooter({ 
          text: "Gracias por confiar en nuestro soporte • Sistema Premium de Tickets", 
          iconURL: "https://i.imgur.com/YourLogoIcon.png" // PON TU URL AQUÍ
        })
        .setTimestamp();

      // Añadir enlace de transcripción si existe
      if (transcriptMsg) {
        dmEmbed.addFields({ 
          name: "📄 Transcripción en línea", 
          value: `[Ver transcripción completa](${transcriptMsg.url})`,
          inline: false 
        });
      }

      // Preparar archivos adjuntos (transcript HTML)
      const attachmentFiles = [];
      
      if (dmTranscriptEnabled && transcriptAttachment) {
        // Adjuntar el archivo de transcript si está habilitado
        attachmentFiles.push(transcriptAttachment);
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

  // Responder al comando de cierre
  // Usar editReply si la interacción fue diferida, o followUp si ya fue respondida
  if (interaction.deferred) {
    await interaction.editReply({ embeds: [E.ticketClosed(closed, interaction.user.id, reason)] });
  } else if (interaction.replied) {
    await interaction.followUp({ embeds: [E.ticketClosed(closed, interaction.user.id, reason)] });
  }

  // Rating por DM (habilitado por defecto)
  if (user) {
    const staffWhoHandled = closed.claimed_by || closed.assigned_to || interaction.user.id;
    await sendRating(user, ticket, channel, staffWhoHandled);
  }

  // Enviar log y actualizar dashboard
  await sendLog(guild, s, "close", interaction.user, closed, {
    "📋 Razón": reason || "Sin razón",
    "⏱️ Duración": E.duration(ticket.created_at),
    "👤 Usuario": `<@${ticket.user_id}>`,
  });

  await updateDashboard(guild);
  
  // Mensaje de cierre y eliminación retrasada
  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(E.Colors.WARNING)
        .setTitle("🔒 Cerrando Ticket")
        .setDescription(
          `Este ticket será eliminado en **5 segundos**...\n\n` +
          `Se ha enviado una transcripción completa al usuario por mensaje directo.`
        )
        .setFooter({ text: "Sistema Premium de Tickets" })
        .setTimestamp()
    ]
  });
  
  // Eliminar el canal después de 5 segundos
  setTimeout(() => channel.delete().catch(() => {}), 5000);
}

// ─────────────────────────────────────────────────────
//   REABRIR TICKET
// ─────────────────────────────────────────────────────
async function reopenTicket(interaction) {
  const channel = interaction.channel;
  const ticket = await tickets.get(channel.id);
  if (!ticket) return replyError(interaction, "Este no es un canal de ticket.");
  if (ticket.status === "open") return replyError(interaction, "Este ticket ya está abierto.");

  const guild = interaction.guild;
  const s = await settings.get(guild.id);
  const user = await interaction.client.users.fetch(ticket.user_id).catch(() => null);

  // Restaurar permisos del usuario
  await channel.permissionOverwrites.edit(ticket.user_id, {
    ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
  }).catch(() => {});

  // Actualizar en la base de datos
  await tickets.reopen(channel.id, interaction.user.id);
  const reopened = await tickets.get(channel.id);

  // Enviar mensaje de reapertura
  await channel.send({
    embeds: [E.ticketReopened(reopened, interaction.user.id)],
    components: [buildTicketButtons()],
  });

  // Notificar al usuario por DM
  if (user) {
    try {
      await user.send({ 
        embeds: [
          new EmbedBuilder()
            .setColor(E.Colors.SUCCESS)
            .setTitle("🔓 Ticket Reabierto")
            .setDescription(
              `Tu ticket **#${ticket.ticket_id}** en **${guild.name}** ha sido reabierto por <@${interaction.user.id}>.\n\n` +
              `Puedes volver al canal para continuar la conversación.`
            )
            .setFooter({ 
              text: `${guild.name} • Sistema Premium de Tickets`, 
              iconURL: guild.iconURL({ dynamic: true }) 
            })
            .setTimestamp()
        ] 
      });
    } catch (dmError) {
      console.log(`[DM ERROR] No se pudo enviar DM al usuario ${user.id}: ${dmError.message}`);
    }
  }

  // Log y dashboard
  await sendLog(guild, s, "reopen", interaction.user, reopened, { "🔄 Reaperturas": reopened.reopen_count });
  await updateDashboard(guild);
  
  return interaction.reply({ 
    embeds: [
      new EmbedBuilder()
        .setColor(E.Colors.SUCCESS)
        .setTitle("🔓 Ticket Reabierto")
        .setDescription("El ticket ha sido reabierto correctamente.")
        .setFooter({ text: "Sistema Premium de Tickets" })
        .setTimestamp()
    ], 
    ephemeral: true 
  });
}

// ─────────────────────────────────────────────────────
//   RECLAMAR / LIBERAR TICKET PREMIUM
// ─────────────────────────────────────────────────────
async function claimTicket(interaction) {
  // Respuesta Inmediata: Añadir deferReply al inicio para evitar timeout
  await interaction.deferReply({ ephemeral: true });
  console.log('[CLAIM] Iniciando proceso de reclamación de ticket');

  const ticket = await tickets.get(interaction.channel.id);
  if (!ticket) return replyError(interaction, "Este no es un canal de ticket.");
  if (ticket.claimed_by) return replyError(interaction, `Ya reclamado por <@${ticket.claimed_by}>.`);

  const guild = interaction.guild;
  const s = await settings.get(guild.id);
  
  // Verificar que el bot tenga permisos de ManageChannels
  const botMember = await guild.members.fetch(interaction.client.user.id).catch(() => null);
  if (!botMember || !interaction.channel.permissionsFor(botMember).has(PermissionFlagsBits.ManageChannels)) {
    return replyError(interaction, "No tengo los permisos necesarios (ManageChannels) para reclamar este ticket.");
  }
  
  // Verificación de Base de Datos: Actualizar BD antes de cambiar permisos
  await tickets.update(interaction.channel.id, { claimed_by: interaction.user.id });
  await staffStats.incrementClaimed(guild.id, interaction.user.id);
  console.log('[CLAIM] BD actualizada correctamente');
  
  // Actualizar topic del canal
  try {
    await interaction.channel.setTopic(`${interaction.channel.topic || ""} | Staff: ${interaction.user.tag}`);
    console.log('[CLAIM] Topic del canal actualizado');
  } catch (error) {
    console.error("[CLAIM TOPIC ERROR]", error.message);
    // Continuar con el proceso aunque falle el cambio de topic
  }

  // ===== LÓGICA DE PERMISOS A PRUEBA DE ERRORES =====
  // Quitar permisos de escritura a otros staff (solo mantener lectura)
  let permisosStaffActualizados = false;
  if (s.support_role) {
    try {
      await interaction.channel.permissionOverwrites.edit(s.support_role, {
        ViewChannel: true,
        SendMessages: false,
        ReadMessageHistory: true,
        ManageMessages: false,
      });
      permisosStaffActualizados = true;
      console.log('[CLAIM] Permisos del rol de soporte actualizados');
    } catch (error) {
      console.error(`[CLAIM PERMISSIONS ERROR] No se pudieron actualizar los permisos para el rol de soporte: ${error.message}`);
      // Continuar con el proceso aunque falle este permiso específico
    }
  }
  
  if (s.admin_role && s.admin_role !== s.support_role) {
    try {
      await interaction.channel.permissionOverwrites.edit(s.admin_role, {
        ViewChannel: true,
        SendMessages: false,
        ReadMessageHistory: true,
        ManageMessages: false,
      });
      console.log('[CLAIM] Permisos del rol de admin actualizados');
    } catch (error) {
      console.error(`[CLAIM PERMISSIONS ERROR] No se pudieron actualizar los permisos para el rol de admin: ${error.message}`);
      // Continuar con el proceso aunque falle este permiso específico
    }
  }
  
  // Dar permisos completos al staff que reclamó el ticket
  try {
    await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
      ManageMessages: true,
    });
    console.log('[CLAIM] Permisos del usuario reclamante actualizados');
  } catch (error) {
    console.error(`[CLAIM PERMISSIONS ERROR] No se pudieron actualizar los permisos para el usuario ${interaction.user.id}: ${error.message}`);
    
    // Si no se pudieron quitar permisos al rol de staff pero el ticket está reclamado en BD,
    // al menos intentamos dar permisos al reclamante
    if (!permisosStaffActualizados) {
      console.log('[CLAIM] Intentando método alternativo para dar permisos al reclamante');
    }
  }
  // =================================

  // Actualización del Mensaje: Lógica más robusta para editar el embed
  try {
    const msgs = await interaction.channel.messages.fetch({ limit: 10 });
    const ticketMsg = msgs.find(m => 
      m.author.id === interaction.client.user.id && 
      m.embeds.length > 0 &&
      m.embeds[0].title?.includes("Panel de Control")
    );
    
    if (ticketMsg) {
      const oldEmbed = ticketMsg.embeds[0];
      
      // Crear un nuevo embed preservando todas las propiedades del original
      const newEmbed = new EmbedBuilder()
        .setTitle(oldEmbed.title || "Panel de Control")
        .setDescription(oldEmbed.description || "")
        .setColor(0x57F287) // Verde para tickets reclamados
        .setFooter(oldEmbed.footer)
        .setTimestamp(oldEmbed.timestamp ? new Date(oldEmbed.timestamp) : new Date());
      
      // Copiar todos los campos existentes
      if (oldEmbed.fields && oldEmbed.fields.length > 0) {
        oldEmbed.fields.forEach(field => {
          if (field.name !== "👋 Reclamado por") {
            newEmbed.addFields({ 
              name: field.name, 
              value: field.value, 
              inline: field.inline 
            });
          }
        });
      }
      
      // Añadir el campo de reclamado
      newEmbed.addFields({ 
        name: "👋 Reclamado por", 
        value: `<@${interaction.user.id}>`, 
        inline: true 
      });
      
      // Si había thumbnail o imagen, preservarlos
      if (oldEmbed.thumbnail) newEmbed.setThumbnail(oldEmbed.thumbnail.url);
      if (oldEmbed.image) newEmbed.setImage(oldEmbed.image.url);
      
      // Actualizar los botones (deshabilitar el botón de reclamar)
      const oldComponents = ticketMsg.components;
      const newComponents = oldComponents.map(row => {
        const newRow = ActionRowBuilder.from(row);
        newRow.components = newRow.components.map(button => {
          const newButton = ButtonBuilder.from(button);
          if (button.customId === "ticket_claim") {
            newButton.setDisabled(true);
            newButton.setLabel("Reclamado");
          }
          return newButton;
        });
        return newRow;
      });
      
      await ticketMsg.edit({ embeds: [newEmbed], components: newComponents });
      console.log('[CLAIM] Mensaje editado correctamente');
    } else {
      console.log('[CLAIM] No se encontró el mensaje del panel de control');
    }
  } catch (e) {
    console.error("[CLAIM UPDATE EMBED]", e.message);
  }

  // Enviar DM al usuario notificando que su ticket ha sido reclamado
  let dmEnviado = false;
  try {
    const user = await interaction.client.users.fetch(ticket.user_id);
    const channelLink = `https://discord.com/channels/${interaction.guild.id}/${interaction.channel.id}`;

    const dmEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle("👋 ¡Tu ticket está siendo atendido!")
      .setDescription(
        `Tu ticket **#${ticket.ticket_id}** en **${interaction.guild.name}** ya tiene a alguien atendiéndolo.\n\n` +
        `**👤 Staff asignado:** <@${interaction.user.id}>\n` +
        `**📁 Categoría:** ${ticket.category}\n` +
        `**💬 Canal:** [Ir al ticket](${channelLink})\n\n` +
        `Haz clic en el enlace de arriba para ir directamente a tu ticket y continuar la conversación.`
      )
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `${interaction.guild.name} • Sistema Premium de Tickets` })
      .setTimestamp();

    await user.send({ embeds: [dmEmbed] });
    dmEnviado = true;
    console.log('[CLAIM] DM enviado al usuario');
  } catch (dmError) {
    console.error(`[DM ERROR] No se pudo enviar DM al usuario ${ticket.user_id}: ${dmError.message}`);
  }

  // Enviar mensaje de confirmación
  console.log('[CLAIM] Proceso completado con éxito');
  return interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(E.Colors.SUCCESS)
      .setTitle("✅ Ticket Reclamado")
      .setDescription(
        `Has reclamado el ticket **#${ticket.ticket_id}** correctamente.\n` +
        (dmEnviado ? "📩 Se notificó al usuario por DM." : "📩 No se pudo notificar al usuario (DMs desactivados).")
      )
      .setFooter({ text: "Sistema Premium de Tickets" })
      .setTimestamp()],
  });
}

async function unclaimTicket(interaction) {
  const ticket = await tickets.get(interaction.channel.id);
  if (!ticket) return replyError(interaction, "Este no es un canal de ticket.");
  if (!ticket.claimed_by) return replyError(interaction, "Este ticket no está reclamado.");

  // Verificar que quien libera es quien reclamó o un admin
  const s = await settings.get(interaction.guild.id);
  const isAdmin = interaction.member.roles.cache.has(s.admin_role);
  const isClaimer = ticket.claimed_by === interaction.user.id;
  
  if (!isAdmin && !isClaimer) {
    return replyError(interaction, "Solo quien reclamó el ticket o un administrador puede liberarlo.");
  }

  // Actualizar en base de datos
  await tickets.update(interaction.channel.id, { claimed_by: null });
  
  // Restaurar permisos para el staff
  if (s.support_role) {
    await interaction.channel.permissionOverwrites.edit(s.support_role, {
      SendMessages: true,
      ManageMessages: true,
    }).catch(() => {});
  }
  
  // Actualizar el embed del ticket
  try {
    const msgs = await interaction.channel.messages.fetch({ limit: 10 });
    const ticketMsg = msgs.find(m => 
      m.author.id === interaction.client.user.id && 
      m.embeds.length > 0 &&
      m.embeds[0].title?.includes("Panel de Control")
    );
    
    if (ticketMsg) {
      const oldEmbed = ticketMsg.embeds[0];
      const newFields = oldEmbed.fields.filter(f => f.name !== "👋 Reclamado por");
      
      const newEmbed = EmbedBuilder.from(oldEmbed)
        .setColor(0x5865F2) // Volver al color original
        .setFields(newFields);
      
      // Actualizar los botones (habilitar el botón de reclamar)
      const oldComponents = ticketMsg.components;
      const newComponents = oldComponents.map(row => {
        const newRow = ActionRowBuilder.from(row);
        newRow.components = newRow.components.map(button => {
          const newButton = ButtonBuilder.from(button);
          if (button.customId === "ticket_claim") {
            newButton.setDisabled(false);
            newButton.setLabel("Reclamar");
          }
          return newButton;
        });
        return newRow;
      });
      
      await ticketMsg.edit({ embeds: [newEmbed], components: newComponents });
    }
  } catch (e) {
    console.error("[UNCLAIM UPDATE EMBED]", e.message);
  }

  return interaction.reply({ 
    embeds: [
      new EmbedBuilder()
        .setColor(E.Colors.WARNING)
        .setTitle("↩️ Ticket Liberado")
        .setDescription("El ticket ha sido liberado. Cualquier miembro del staff puede reclamarlo ahora.")
        .setFooter({ text: "Sistema Premium de Tickets" })
        .setTimestamp()
    ] 
  });
}

// ─────────────────────────────────────────────────────
//   ASIGNAR STAFF
// ─────────────────────────────────────────────────────
async function assignTicket(interaction, staffUser) {
  const ticket = await tickets.get(interaction.channel.id);
  if (!ticket) return replyError(interaction, "Este no es un canal de ticket.");

  const guild = interaction.guild;
  const s = await settings.get(guild.id);

  // Dar permisos al staff asignado
  await interaction.channel.permissionOverwrites.edit(staffUser, {
    ViewChannel: true, 
    SendMessages: true, 
    ReadMessageHistory: true, 
    AttachFiles: true,
    ManageMessages: true
  }).catch(() => {});

  // Actualizar en base de datos
  await tickets.update(interaction.channel.id, { assigned_to: staffUser.id });
  await staffStats.incrementAssigned(guild.id, staffUser.id);

  // Actualizar el embed del ticket
  try {
    const msgs = await interaction.channel.messages.fetch({ limit: 10 });
    const ticketMsg = msgs.find(m => 
      m.author.id === interaction.client.user.id && 
      m.embeds.length > 0 &&
      m.embeds[0].title?.includes("Panel de Control")
    );
    
    if (ticketMsg) {
      const oldEmbed = ticketMsg.embeds[0];
      // Verificar si ya existe el campo "Asignado a"
      const hasAssignedField = oldEmbed.fields?.some(f => f.name === "📌 Asignado a");
      
      if (!hasAssignedField) {
        const newEmbed = EmbedBuilder.from(oldEmbed)
          .addFields({ name: "📌 Asignado a", value: `<@${staffUser.id}>`, inline: true });
        
        await ticketMsg.edit({ embeds: [newEmbed] });
      }
    }
  } catch (e) {
    console.error("[ASSIGN UPDATE EMBED]", e.message);
  }

  // Enviar log
  await sendLog(guild, s, "assign", interaction.user, ticket, { "📌 Asignado a": `<@${staffUser.id}>` });

  // Notificar al staff asignado por DM
  try {
    await staffUser.send({ 
      embeds: [
        new EmbedBuilder()
          .setColor(E.Colors.INFO)
          .setTitle("📌 Ticket Asignado")
          .setDescription(
            `Se te ha asignado el ticket **#${ticket.ticket_id}** en **${guild.name}**.\n\n` +
            `**📁 Categoría:** ${ticket.category}\n` +
            `**👤 Usuario:** <@${ticket.user_id}>\n` +
            `**🔗 Canal:** <#${ticket.channel_id}>\n\n` +
            `Por favor, revisa el ticket lo antes posible.`
          )
          .setFooter({ text: `${guild.name} • Sistema Premium de Tickets` })
          .setTimestamp()
      ] 
    });
  } catch (dmError) {
    console.error(`[DM ERROR] No se pudo enviar DM al staff ${staffUser.id}: ${dmError.message}`);
  }

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(E.Colors.INFO)
        .setTitle("📌 Ticket Asignado")
        .setDescription(`El ticket ha sido asignado a <@${staffUser.id}>.\nRecibirá acceso y notificación.`)
        .setFooter({ text: "Sistema Premium de Tickets" })
        .setTimestamp()
    ],
  });
}

// ─────────────────────────────────────────────────────
//   AÑADIR / QUITAR USUARIO
// ─────────────────────────────────────────────────────
async function addUser(interaction, user) {
  const ticket = await tickets.get(interaction.channel.id);
  if (!ticket) return replyError(interaction, "Este no es un canal de ticket.");
  
  // Dar permisos al usuario
  await interaction.channel.permissionOverwrites.edit(user, {
    ViewChannel: true, 
    SendMessages: true, 
    ReadMessageHistory: true, 
    AttachFiles: true,
  });
  
  return interaction.reply({ 
    embeds: [
      new EmbedBuilder()
        .setColor(E.Colors.SUCCESS)
        .setTitle("➕ Usuario Añadido")
        .setDescription(`<@${user.id}> ha sido añadido al ticket.`)
        .setFooter({ text: "Sistema Premium de Tickets" })
        .setTimestamp()
    ] 
  });
}

async function removeUser(interaction, user) {
  const ticket = await tickets.get(interaction.channel.id);
  if (!ticket) return replyError(interaction, "Este no es un canal de ticket.");
  if (user.id === ticket.user_id) return replyError(interaction, "No puedes quitar al creador del ticket.");
  
  // Quitar permisos al usuario
  await interaction.channel.permissionOverwrites.delete(user).catch(() => {});
  
  return interaction.reply({ 
    embeds: [
      new EmbedBuilder()
        .setColor(E.Colors.SUCCESS)
        .setTitle("➖ Usuario Quitado")
        .setDescription(`<@${user.id}> ha sido quitado del ticket.`)
        .setFooter({ text: "Sistema Premium de Tickets" })
        .setTimestamp()
    ] 
  });
}

// ─────────────────────────────────────────────────────
//   MOVER CATEGORÍA
// ─────────────────────────────────────────────────────
async function moveTicket(interaction, newCategoryId) {
  const ticket = await tickets.get(interaction.channel.id);
  if (!ticket) return replyError(interaction, "Este no es un canal de ticket.");
  const newCategory = categories.find(c => c.id === newCategoryId);
  if (!newCategory) return replyError(interaction, "Categoría no encontrada.");

  const oldCategory = ticket.category;
  await tickets.update(interaction.channel.id, { 
    category: newCategory.label, 
    category_id: newCategory.id, 
    priority: newCategory.priority || "normal" 
  });

  const guild = interaction.guild;
  const s = await settings.get(guild.id);

  // Mover a la categoría de Discord si está configurada
  if (newCategory.categoryId) {
    await interaction.channel.setParent(newCategory.categoryId, { lockPermissions: false }).catch(() => {});
  }

  // Actualizar el embed del ticket
  try {
    const msgs = await interaction.channel.messages.fetch({ limit: 10 });
    const ticketMsg = msgs.find(m => 
      m.author.id === interaction.client.user.id && 
      m.embeds.length > 0 &&
      m.embeds[0].title?.includes("Panel de Control")
    );
    
    if (ticketMsg) {
      const oldEmbed = ticketMsg.embeds[0];
      
      // Actualizar los campos de categoría y prioridad
      const newFields = oldEmbed.fields.map(f => {
        if (f.name === "📁 Categoría") {
          return { name: f.name, value: newCategory.label, inline: f.inline };
        }
        if (f.name === "⚡ Prioridad") {
          return { name: f.name, value: priorityLabel(newCategory.priority || "normal"), inline: f.inline };
        }
        return f;
      });
      
      const newEmbed = EmbedBuilder.from(oldEmbed)
        .setColor(newCategory.color || 0x5865F2)
        .setFields(newFields);
      
      await ticketMsg.edit({ embeds: [newEmbed] });
    }
  } catch (e) {
    console.error("[MOVE UPDATE EMBED]", e.message);
  }

  const updatedTicket = await tickets.get(interaction.channel.id);
  await sendLog(guild, s, "move", interaction.user, updatedTicket, {
    "📂 Anterior": oldCategory, 
    "📂 Nueva": newCategory.label,
  });

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(E.Colors.INFO)
        .setTitle("📂 Categoría Cambiada")
        .setDescription(`Ticket movido de **${oldCategory}** → **${newCategory.label}**`)
        .setFooter({ text: "Sistema Premium de Tickets" })
        .setTimestamp()
    ],
  });
}

// ─────────────────────────────────────────────────────
//   RATING PREMIUM (por DM al usuario)
// ─────────────────────────────────────────────────────
async function sendRating(user, ticket, channel, staffId) {
  try {
    // Crear un embed premium para la calificación
    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle("⭐ ¿Cómo calificarías la atención recibida?")
      .setDescription(
        `Hola <@${user.id}>, tu ticket **#${ticket.ticket_id}** ha sido cerrado.\n\n` +
        `Nos encantaría conocer tu opinión sobre la atención que recibiste. Tu feedback nos ayuda a mejorar nuestro servicio.`
      )
      .addFields(
        { name: "👤 Staff que te atendió", value: `<@${staffId}>`, inline: true },
        { name: "📁 Categoría", value: ticket.category || "General", inline: true }
      )
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setFooter({ 
        text: "Tu opinión es importante para nosotros • Esta calificación expira en 10 minutos",
        iconURL: "https://i.imgur.com/YourLogoIcon.png" // PON TU URL AQUÍ
      })
      .setTimestamp();

    // Opciones de calificación mejoradas
    const options = [
      {
        label: "⭐ Deficiente",
        value: "1",
        description: "La atención no cumplió mis expectativas",
        emoji: "😞"
      },
      {
        label: "⭐⭐ Regular",
        value: "2",
        description: "La atención fue aceptable pero mejorable",
        emoji: "😐"
      },
      {
        label: "⭐⭐⭐ Buena",
        value: "3",
        description: "La atención fue correcta y adecuada",
        emoji: "🙂"
      },
      {
        label: "⭐⭐⭐⭐ Muy Buena",
        value: "4",
        description: "La atención fue muy profesional",
        emoji: "😊"
      },
      {
        label: "⭐⭐⭐⭐⭐ Excelente",
        value: "5",
        description: "La atención superó mis expectativas",
        emoji: "🤩"
      }
    ];
    
    // Crear el menú de selección
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`ticket_rating_${ticket.ticket_id}_${channel.id}_${staffId}`)
        .setPlaceholder("⭐ Selecciona una calificación...")
        .addOptions(options)
    );
    
    // Enviar el mensaje de calificación
    await user.send({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error("[RATING ERROR]", error.message);
  }
}

// ─────────────────────────────────────────────────────
//   HELPERS
// ─────────────────────────────────────────────────────
function buildTicketButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Cerrar")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("ticket_claim")
      .setLabel("Reclamar")
      .setEmoji("👋")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("ticket_transcript")
      .setLabel("Transcripción")
      .setEmoji("📄")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ticket_reopen")
      .setLabel("Reabrir")
      .setEmoji("🔓")
      .setStyle(ButtonStyle.Primary),
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
  } catch (error) {
    console.error("[DISABLE BUTTONS ERROR]", error.message);
  }
}

function transcriptEmbed(ticket, closedByStaff = null, closedAt = null) {
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
    .setColor(0x5865F2)
    .addFields(
      { name: "🎫 Ticket", value: `#${ticket.ticket_id}`, inline: true },
      { name: "👤 Usuario", value: `<@${ticket.user_id}>`, inline: true },
      { name: "📁 Categoría", value: ticket.category, inline: true },
      { name: "⏱️ Duración", value: E.duration(ticket.created_at), inline: true },
      { name: "👮 Staff", value: staffCierra, inline: true },
      { name: "📅 Cerrado", value: fechaCierre, inline: true },
      { name: "💬 Mensajes", value: `${ticket.message_count || 0}`, inline: true },
      { name: "⭐ Rating", value: ticket.rating ? `${ticket.rating}/5` : "Sin calificar", inline: true },
    )
    .setFooter({ text: "Sistema Premium de Tickets" })
    .setTimestamp();
}

async function sendLog(guild, s, action, user, ticket, details = {}) {
  if (!s.log_channel) return;
  const ch = guild.channels.cache.get(s.log_channel);
  if (!ch) return;
  
  try {
    await ch.send({ embeds: [E.ticketLog(ticket, user, action, details)] });
  } catch (error) {
    console.error("[LOG ERROR]", error.message);
  }
}

function replyError(interaction, msg) {
  const payload = { 
    embeds: [
      new EmbedBuilder()
        .setColor(E.Colors.ERROR)
        .setDescription(`❌ **Error:** ${msg}`)
        .setFooter({ text: "Sistema Premium de Tickets" })
    ], 
    ephemeral: true 
  };
  
  return interaction.replied || interaction.deferred
    ? interaction.followUp(payload)
    : interaction.reply(payload);
}

function priorityLabel(p) {
  const map = { 
    low: "🟢 Baja", 
    normal: "🔵 Normal", 
    high: "🟡 Alta", 
    urgent: "🔴 Urgente" 
  };
  return map[p] || p;
}

module.exports = {
  sendPanel, buildModal, createTicket, closeTicket, reopenTicket,
  claimTicket, unclaimTicket, assignTicket,
  addUser, removeUser, moveTicket,
  buildTicketButtons, sendLog, replyError, priorityLabel,
};
