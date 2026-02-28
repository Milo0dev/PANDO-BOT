const {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, StringSelectMenuBuilder,
} = require("discord.js");

const { tickets, settings, notes } = require("../utils/database");
const TH = require("../handlers/ticketHandler");
const { generateTranscript } = require("../utils/transcript");
const E = require("../utils/embeds");
const config = require("../../config");

const MAX_NOTES_PER_TICKET = 20; // Límite máximo de notas por ticket

function isStaff(member, s) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (s?.support_role && member.roles.cache.has(s.support_role)) return true;
  if (s?.admin_role && member.roles.cache.has(s.admin_role)) return true;
  return false;
}

async function getTicket(channel) {
  return await tickets.get(channel.id);
}

// ════════════════════════════════════════════════════════════════════════════════
//   COMANDO MAESTRO: /ticket
// ════════════════════════════════════════════════════════════════════════════════

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("🎫 Sistema de tickets")
    
    // ──────────────────────────────────────────────────────────────────────────
    //   SUBCOMANDO: close
    // ──────────────────────────────────────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName("close")
      .setDescription("🔒 Cerrar el ticket actual")
      .addStringOption(o => o
        .setName("razon")
        .setDescription("Razón de cierre")
        .setRequired(false)
      )
    )
    
    // ──────────────────────────────────────────────────────────────────────────
    //   SUBCOMANDO: reopen
    // ──────────────────────────────────────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName("reopen")
      .setDescription("🔓 Reabrir un ticket cerrado")
    )
    
    // ──────────────────────────────────────────────────────────────────────────
    //   SUBCOMANDO: claim
    // ──────────────────────────────────────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName("claim")
      .setDescription("👋 Reclamar este ticket")
    )
    
    // ──────────────────────────────────────────────────────────────────────────
    //   SUBCOMANDO: unclaim
    // ──────────────────────────────────────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName("unclaim")
      .setDescription("↩️ Liberar este ticket")
    )
    
    // ──────────────────────────────────────────────────────────────────────────
    //   SUBCOMANDO: assign
    // ──────────────────────────────────────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName("assign")
      .setDescription("📌 Asignar el ticket a un miembro del staff")
      .addUserOption(o => o
        .setName("staff")
        .setDescription("Miembro del staff")
        .setRequired(true)
      )
    )
    
    // ──────────────────────────────────────────────────────────────────────────
    //   SUBCOMANDO: add
    // ──────────────────────────────────────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName("add")
      .setDescription("➕ Añadir un usuario al ticket")
      .addUserOption(o => o
        .setName("usuario")
        .setDescription("Usuario a añadir")
        .setRequired(true)
      )
    )
    
    // ──────────────────────────────────────────────────────────────────────────
    //   SUBCOMANDO: remove
    // ──────────────────────────────────────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName("remove")
      .setDescription("➖ Quitar un usuario del ticket")
      .addUserOption(o => o
        .setName("usuario")
        .setDescription("Usuario a quitar")
        .setRequired(true)
      )
    )
    
    // ──────────────────────────────────────────────────────────────────────────
    //   SUBCOMANDO: rename
    // ──────────────────────────────────────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName("rename")
      .setDescription("✏️ Renombrar el canal del ticket")
      .addStringOption(o => o
        .setName("nombre")
        .setDescription("Nuevo nombre")
        .setRequired(true)
        .setMaxLength(32)
      )
    )
    
    // ──────────────────────────────────────────────────────────────────────────
    //   SUBCOMANDO: priority
    // ──────────────────────────────────────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName("priority")
      .setDescription("⚡ Cambiar prioridad del ticket")
      .addStringOption(o => o
        .setName("nivel")
        .setDescription("Nivel de prioridad")
        .setRequired(true)
        .addChoices(
          { name: "🟢 Baja", value: "low" },
          { name: "🔵 Normal", value: "normal" },
          { name: "🟡 Alta", value: "high" },
          { name: "🔴 Urgente", value: "urgent" }
        )
      )
    )
    
    // ──────────────────────────────────────────────────────────────────────────
    //   SUBCOMANDO: move
    // ──────────────────────────────────────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName("move")
      .setDescription("📂 Mover ticket a otra categoría")
    )
    
    // ──────────────────────────────────────────────────────────────────────────
    //   SUBCOMANDO: transcript
    // ──────────────────────────────────────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName("transcript")
      .setDescription("📄 Generar transcripción del ticket")
    )
    
    // ──────────────────────────────────────────────────────────────────────────
    //   SUBCOMANDO: info
    // ──────────────────────────────────────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName("info")
      .setDescription("ℹ️ Ver información del ticket actual")
    )
    
    // ──────────────────────────────────────────────────────────────────────────
    //   SUBCOMANDO: history
    // ──────────────────────────────────────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName("history")
      .setDescription("📜 Ver historial de tickets de un usuario")
      .addUserOption(o => o
        .setName("usuario")
        .setDescription("Usuario a consultar")
        .setRequired(false)
      )
    )
    
    // ══════════════════════════════════════════════════════════════════════════
    //   GRUPO DE SUBCOMANDOS: note
    // ══════════════════════════════════════════════════════════════════════════
    .addSubcommandGroup(group => group
      .setName("note")
      .setDescription("📝 Notas internas del ticket")
      
      // ────────────────────────────────────────────────────────────────────────
      //   note add
      // ────────────────────────────────────────────────────────────────────────
      .addSubcommand(sub => sub
        .setName("add")
        .setDescription("Añadir nota interna")
        .addStringOption(o => o
          .setName("nota")
          .setDescription("Contenido de la nota")
          .setRequired(true)
          .setMaxLength(500)
        )
      )
      
      // ────────────────────────────────────────────────────────────────────────
      //   note list
      // ────────────────────────────────────────────────────────────────────────
      .addSubcommand(sub => sub
        .setName("list")
        .setDescription("Ver todas las notas del ticket")
      )
      
      // ────────────────────────────────────────────────────────────────────────
      //   note clear
      // ────────────────────────────────────────────────────────────────────────
      .addSubcommand(sub => sub
        .setName("clear")
        .setDescription("Borrar todas las notas (solo admins)")
      )
    ),

  // ════════════════════════════════════════════════════════════════════════════
  //   FUNCIÓN EXECUTE - ENRUTADOR DE SUBCOMANDOS
  // ════════════════════════════════════════════════════════════════════════════
  async execute(interaction) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    // ══════════════════════════════════════════════════════════════════════════
    //   GRUPO: note
    // ══════════════════════════════════════════════════════════════════════════
    if (subcommandGroup === "note") {
      return await handleNoteCommands(interaction, subcommand);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //   ENRUTADOR DE SUBCOMANDOS PRINCIPALES
    // ══════════════════════════════════════════════════════════════════════════
    switch (subcommand) {
      case "close":
        return await handleClose(interaction);
      
      case "reopen":
        return await handleReopen(interaction);
      
      case "claim":
        return await handleClaim(interaction);
      
      case "unclaim":
        return await handleUnclaim(interaction);
      
      case "assign":
        return await handleAssign(interaction);
      
      case "add":
        return await handleAdd(interaction);
      
      case "remove":
        return await handleRemove(interaction);
      
      case "rename":
        return await handleRename(interaction);
      
      case "priority":
        return await handlePriority(interaction);
      
      case "move":
        return await handleMove(interaction);
      
      case "transcript":
        return await handleTranscript(interaction);
      
      case "info":
        return await handleInfo(interaction);
      
      case "history":
        return await handleHistory(interaction);
      
      default:
        return interaction.reply({
          embeds: [E.errorEmbed("Subcomando no reconocido.")],
          flags: 64
        });
    }
  },
};

// ════════════════════════════════════════════════════════════════════════════════
//   HANDLERS DE SUBCOMANDOS
// ════════════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────────────
//   CLOSE
// ──────────────────────────────────────────────────────────────────────────────
async function handleClose(interaction) {
  const t = await getTicket(interaction.channel);
  if (!t) {
    return interaction.reply({
      embeds: [E.errorEmbed("Este no es un canal de ticket.")],
      flags: 64
    });
  }

  const s = await settings.get(interaction.guild.id);
  if (!isStaff(interaction.member, s)) {
    return interaction.reply({
      embeds: [E.errorEmbed("Solo el **staff** puede cerrar tickets.")],
      flags: 64
    });
  }

  return TH.closeTicket(interaction, interaction.options.getString("razon"));
}

// ──────────────────────────────────────────────────────────────────────────────
//   REOPEN
// ──────────────────────────────────────────────────────────────────────────────
async function handleReopen(interaction) {
  const s = await settings.get(interaction.guild.id);
  if (!isStaff(interaction.member, s)) {
    return interaction.reply({
      embeds: [E.errorEmbed("Solo el staff puede reabrir tickets.")],
      flags: 64
    });
  }

  return TH.reopenTicket(interaction);
}

// ──────────────────────────────────────────────────────────────────────────────
//   CLAIM
// ──────────────────────────────────────────────────────────────────────────────
async function handleClaim(interaction) {
  const s = await settings.get(interaction.guild.id);
  if (!isStaff(interaction.member, s)) {
    return interaction.reply({
      embeds: [E.errorEmbed("Solo el staff puede reclamar tickets.")],
      flags: 64
    });
  }

  return TH.claimTicket(interaction);
}

// ──────────────────────────────────────────────────────────────────────────────
//   UNCLAIM
// ──────────────────────────────────────────────────────────────────────────────
async function handleUnclaim(interaction) {
  const t = await getTicket(interaction.channel);
  if (!t) {
    return interaction.reply({
      embeds: [E.errorEmbed("No es un canal de ticket.")],
      flags: 64
    });
  }

  const s = await settings.get(interaction.guild.id);
  if (!isStaff(interaction.member, s) && interaction.user.id !== t.claimed_by) {
    return interaction.reply({
      embeds: [E.errorEmbed("No tienes permiso para liberar este ticket.")],
      flags: 64
    });
  }

  return TH.unclaimTicket(interaction);
}

// ──────────────────────────────────────────────────────────────────────────────
//   ASSIGN
// ──────────────────────────────────────────────────────────────────────────────
async function handleAssign(interaction) {
  const s = await settings.get(interaction.guild.id);
  if (!isStaff(interaction.member, s)) {
    return interaction.reply({
      embeds: [E.errorEmbed("Solo el staff puede asignar tickets.")],
      flags: 64
    });
  }

  const staffUser = interaction.options.getUser("staff");
  return TH.assignTicket(interaction, staffUser);
}

// ──────────────────────────────────────────────────────────────────────────────
//   ADD
// ──────────────────────────────────────────────────────────────────────────────
async function handleAdd(interaction) {
  if (!await getTicket(interaction.channel)) {
    return interaction.reply({
      embeds: [E.errorEmbed("No es un canal de ticket.")],
      flags: 64
    });
  }

  const s = await settings.get(interaction.guild.id);
  if (!isStaff(interaction.member, s)) {
    return interaction.reply({
      embeds: [E.errorEmbed("Solo el **staff** puede añadir usuarios al ticket.")],
      flags: 64
    });
  }

  return TH.addUser(interaction, interaction.options.getUser("usuario"));
}

// ──────────────────────────────────────────────────────────────────────────────
//   REMOVE
// ──────────────────────────────────────────────────────────────────────────────
async function handleRemove(interaction) {
  if (!await getTicket(interaction.channel)) {
    return interaction.reply({
      embeds: [E.errorEmbed("No es un canal de ticket.")],
      flags: 64
    });
  }

  const s = await settings.get(interaction.guild.id);
  if (!isStaff(interaction.member, s)) {
    return interaction.reply({
      embeds: [E.errorEmbed("Solo el **staff** puede quitar usuarios del ticket.")],
      flags: 64
    });
  }

  return TH.removeUser(interaction, interaction.options.getUser("usuario"));
}

// ──────────────────────────────────────────────────────────────────────────────
//   RENAME
// ──────────────────────────────────────────────────────────────────────────────
async function handleRename(interaction) {
  if (!await getTicket(interaction.channel)) {
    return interaction.reply({
      embeds: [E.errorEmbed("No es un canal de ticket.")],
      flags: 64
    });
  }

  const s = await settings.get(interaction.guild.id);
  if (!isStaff(interaction.member, s)) {
    return interaction.reply({
      embeds: [E.errorEmbed("Solo el staff puede renombrar.")],
      flags: 64
    });
  }

  const name = interaction.options.getString("nombre")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .substring(0, 32);

  await interaction.channel.setName(name);
  return interaction.reply({
    embeds: [E.successEmbed(`Canal renombrado a **${name}**`)]
  });
}

// ──────────────────────────────────────────────────────────────────────────────
//   PRIORITY
// ──────────────────────────────────────────────────────────────────────────────
async function handlePriority(interaction) {
  const t = await getTicket(interaction.channel);
  if (!t) {
    return interaction.reply({
      embeds: [E.errorEmbed("No es un canal de ticket.")],
      flags: 64
    });
  }

  const s = await settings.get(interaction.guild.id);
  if (!isStaff(interaction.member, s)) {
    return interaction.reply({
      embeds: [E.errorEmbed("Solo el staff puede cambiar la prioridad.")],
      flags: 64
    });
  }

  const level = interaction.options.getString("nivel");
  const info = config.priorities[level];
  
  await tickets.update(interaction.channel.id, { priority: level });
  const updatedTicket = await tickets.get(interaction.channel.id);
  
  await TH.sendLog(
    interaction.guild,
    s,
    "priority",
    interaction.user,
    updatedTicket,
    { "⚡ Prioridad": info.label }
  );

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(info.color)
        .setDescription(`⚡ Prioridad cambiada a **${info.label}**`)
        .setTimestamp()
    ]
  });
}

// ──────────────────────────────────────────────────────────────────────────────
//   MOVE
// ──────────────────────────────────────────────────────────────────────────────
async function handleMove(interaction) {
  const t = await getTicket(interaction.channel);
  if (!t) {
    return interaction.reply({
      embeds: [E.errorEmbed("No es un canal de ticket.")],
      flags: 64
    });
  }

  const s = await settings.get(interaction.guild.id);
  if (!isStaff(interaction.member, s)) {
    return interaction.reply({
      embeds: [E.errorEmbed("Solo el staff puede mover tickets.")],
      flags: 64
    });
  }

  const options = config.categories
    .filter(c => c.label !== t.category)
    .map(c => ({
      label: c.label,
      value: c.id,
      emoji: c.emoji
    }));

  if (!options.length) {
    return interaction.reply({
      embeds: [E.errorEmbed("No hay otras categorías disponibles.")],
      flags: 64
    });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_move_select")
    .setPlaceholder("Selecciona la nueva categoría...")
    .addOptions(options);

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(E.Colors.INFO)
        .setDescription("📂 Selecciona la categoría a la que mover el ticket:")
    ],
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: 64
  });
}

// ──────────────────────────────────────────────────────────────────────────────
//   TRANSCRIPT
// ──────────────────────────────────────────────────────────────────────────────
async function handleTranscript(interaction) {
  const t = await getTicket(interaction.channel);
  if (!t) {
    return interaction.reply({
      embeds: [E.errorEmbed("No es un canal de ticket.")],
      flags: 64
    });
  }

  const s = await settings.get(interaction.guild.id);
  if (!isStaff(interaction.member, s)) {
    return interaction.reply({
      embeds: [E.errorEmbed("Solo el staff puede generar transcripciones.")],
      flags: 64
    });
  }

  await interaction.deferReply({ flags: 64 });

  try {
    const { attachment } = await generateTranscript(interaction.channel, t, interaction.guild);
    return interaction.editReply({
      embeds: [E.successEmbed("Transcripción generada.")],
      files: [attachment]
    });
  } catch {
    return interaction.editReply({
      embeds: [E.errorEmbed("Error al generar la transcripción.")]
    });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
//   INFO
// ──────────────────────────────────────────────────────────────────────────────
async function handleInfo(interaction) {
  const t = await getTicket(interaction.channel);
  if (!t) {
    return interaction.reply({
      embeds: [E.errorEmbed("No es un canal de ticket.")],
      flags: 64
    });
  }

  const s = await settings.get(interaction.guild.id);
  if (!isStaff(interaction.member, s)) {
    return interaction.reply({
      embeds: [E.errorEmbed("Solo el **staff** puede ver la información del ticket.")],
      flags: 64
    });
  }

  return interaction.reply({
    embeds: [E.ticketInfo(t)],
    flags: 64
  });
}

// ──────────────────────────────────────────────────────────────────────────────
//   HISTORY
// ──────────────────────────────────────────────────────────────────────────────
async function handleHistory(interaction) {
  const s = await settings.get(interaction.guild.id);
  const user = interaction.options.getUser("usuario") || interaction.user;

  if (user.id !== interaction.user.id && !isStaff(interaction.member, s)) {
    return interaction.reply({
      embeds: [E.errorEmbed("Solo el staff puede ver el historial de otros usuarios.")],
      flags: 64
    });
  }

  const all = await tickets.getAllByGuild(interaction.guild.id);
  const userTickets = all.filter(t => t.user_id === user.id);
  const open = userTickets.filter(t => t.status === "open");
  const closed = userTickets.filter(t => t.status === "closed");

  if (!userTickets.length) {
    return interaction.reply({
      embeds: [E.infoEmbed("📜 Historial", `<@${user.id}> no tiene tickets en este servidor.`)],
      flags: 64
    });
  }

  const lastClosed = closed
    .slice(0, 8)
    .map(t => `▸ **#${t.ticket_id}** ${t.category} — ${E.duration(t.created_at)} — ${t.rating ? "⭐".repeat(t.rating) : "Sin rating"}`)
    .join("\n");

  const openList = open
    .map(t => `▸ **#${t.ticket_id}** <#${t.channel_id}> ${t.category}`)
    .join("\n");

  const embed = new EmbedBuilder()
    .setTitle(`📜 Historial de ${user.username}`)
    .setColor(E.Colors.PRIMARY)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .addFields({
      name: "📊 Resumen",
      value: `Total: **${userTickets.length}** | Abiertos: **${open.length}** | Cerrados: **${closed.length}**`,
      inline: false
    });

  if (openList) {
    embed.addFields({ name: "🟢 Abiertos ahora", value: openList });
  }
  if (lastClosed) {
    embed.addFields({ name: "🔒 Últimos cerrados", value: lastClosed });
  }

  return interaction.reply({ embeds: [embed], flags: 64 });
}

// ══════════════════════════════════════════════════════════════════════════════
//   HANDLER DEL GRUPO: note
// ══════════════════════════════════════════════════════════════════════════════
async function handleNoteCommands(interaction, subcommand) {
  const t = await getTicket(interaction.channel);
  if (!t) {
    return interaction.reply({
      embeds: [E.errorEmbed("No es un canal de ticket.")],
      flags: 64
    });
  }

  const s = await settings.get(interaction.guild.id);
  if (!isStaff(interaction.member, s)) {
    return interaction.reply({
      embeds: [E.errorEmbed("Solo el staff puede ver/añadir notas.")],
      flags: 64
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  //   note clear
  // ────────────────────────────────────────────────────────────────────────────
  if (subcommand === "clear") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        embeds: [E.errorEmbed("Solo administradores pueden borrar todas las notas.")],
        flags: 64
      });
    }

    await notes.clear(t.ticket_id);
    return interaction.reply({
      embeds: [E.successEmbed("Todas las notas del ticket han sido borradas.")],
      flags: 64
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  //   note add
  // ────────────────────────────────────────────────────────────────────────────
  if (subcommand === "add") {
    // Verificar límite de notas
    const existingNotes = await notes.get(t.ticket_id);
    if (existingNotes.length >= MAX_NOTES_PER_TICKET) {
      return interaction.reply({
        embeds: [E.errorEmbed(
          `Límite de notas alcanzado (**${MAX_NOTES_PER_TICKET}** notas máximo por ticket. ` +
          `Usa \`/ticket note clear\` para borrar si es necesario.)`
        )],
        flags: 64
      });
    }

    const nota = interaction.options.getString("nota");
    await notes.add(t.ticket_id, interaction.user.id, nota);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(E.Colors.WARNING)
          .setTitle("📝 Nota añadida (solo staff)")
          .setDescription(nota)
          .setFooter({
            text: `Por ${interaction.user.tag} · ${existingNotes.length + 1}/${MAX_NOTES_PER_TICKET}`
          })
          .setTimestamp()
      ],
      flags: 64
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  //   note list
  // ────────────────────────────────────────────────────────────────────────────
  if (subcommand === "list") {
    const nl = await notes.get(t.ticket_id);
    if (!nl.length) {
      return interaction.reply({
        embeds: [E.infoEmbed("📝 Notas", "No hay notas en este ticket.")],
        flags: 64
      });
    }

    const txt = nl.map((n, i) => `**${i + 1}.** <@${n.staff_id}>: ${n.note}`).join("\n");

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(E.Colors.WARNING)
          .setTitle(`📝 Notas — #${t.ticket_id} (${nl.length}/${MAX_NOTES_PER_TICKET})`)
          .setDescription(txt)
          .setTimestamp()
      ],
      flags: 64
    });
  }
}
