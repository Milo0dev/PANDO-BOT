const {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require("discord.js");

const { tickets, settings, notes }    = require("../utils/database");
const TH = require("../handlers/ticketHandler");
const { generateTranscript }          = require("../utils/transcript");
const E  = require("../utils/embeds");
const config = require("../../config");

function isStaff(member, s) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (s.support_role && member.roles.cache.has(s.support_role)) return true;
  if (s.admin_role   && member.roles.cache.has(s.admin_role))   return true;
  return false;
}
function getTicket(channel) { return tickets.get(channel.id); }

// ────── /close ──────────────────────────────────────────────────────
module.exports.close = {
  data: new SlashCommandBuilder().setName("close").setDescription("🔒 Cerrar el ticket actual")
    .addStringOption(o => o.setName("razon").setDescription("Razón de cierre").setRequired(false)),
  async execute(interaction) {
    const t = getTicket(interaction.channel);
    if (!t) return interaction.reply({ embeds: [E.errorEmbed("Este no es un canal de ticket.")], ephemeral: true });
    const s = settings.get(interaction.guild.id);
    if (!isStaff(interaction.member, s))
      return interaction.reply({ embeds: [E.errorEmbed("Solo el **staff** puede cerrar tickets.")], ephemeral: true });
    return TH.closeTicket(interaction, interaction.options.getString("razon"));
  },
};

// ────── /reopen ─────────────────────────────────────────────────────
module.exports.reopen = {
  data: new SlashCommandBuilder().setName("reopen").setDescription("🔓 Reabrir un ticket cerrado"),
  async execute(interaction) {
    const s = settings.get(interaction.guild.id);
    if (!isStaff(interaction.member, s)) return interaction.reply({ embeds: [E.errorEmbed("Solo el staff puede reabrir tickets.")], ephemeral: true });
    return TH.reopenTicket(interaction);
  },
};

// ────── /claim ──────────────────────────────────────────────────────
module.exports.claim = {
  data: new SlashCommandBuilder().setName("claim").setDescription("👋 Reclamar este ticket"),
  async execute(interaction) {
    const s = settings.get(interaction.guild.id);
    if (!isStaff(interaction.member, s)) return interaction.reply({ embeds: [E.errorEmbed("Solo el staff puede reclamar tickets.")], ephemeral: true });
    return TH.claimTicket(interaction);
  },
};

// ────── /unclaim ────────────────────────────────────────────────────
module.exports.unclaim = {
  data: new SlashCommandBuilder().setName("unclaim").setDescription("↩️ Liberar este ticket"),
  async execute(interaction) {
    const t = getTicket(interaction.channel);
    if (!t) return interaction.reply({ embeds: [E.errorEmbed("No es un canal de ticket.")], ephemeral: true });
    const s = settings.get(interaction.guild.id);
    if (!isStaff(interaction.member, s) && interaction.user.id !== t.claimed_by)
      return interaction.reply({ embeds: [E.errorEmbed("No tienes permiso para liberar este ticket.")], ephemeral: true });
    return TH.unclaimTicket(interaction);
  },
};

// ────── /assign ─────────────────────────────────────────────────────
module.exports.assign = {
  data: new SlashCommandBuilder().setName("assign").setDescription("📌 Asignar el ticket a un miembro del staff")
    .addUserOption(o => o.setName("staff").setDescription("Miembro del staff").setRequired(true)),
  async execute(interaction) {
    const s = settings.get(interaction.guild.id);
    if (!isStaff(interaction.member, s)) return interaction.reply({ embeds: [E.errorEmbed("Solo el staff puede asignar tickets.")], ephemeral: true });
    const staffUser = interaction.options.getUser("staff");
    return TH.assignTicket(interaction, staffUser);
  },
};

// ────── /add ────────────────────────────────────────────────────────
module.exports.add = {
  data: new SlashCommandBuilder().setName("add").setDescription("➕ Añadir un usuario al ticket")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario a añadir").setRequired(true)),
  async execute(interaction) {
    if (!getTicket(interaction.channel)) return interaction.reply({ embeds: [E.errorEmbed("No es un canal de ticket.")], ephemeral: true });
    const s = settings.get(interaction.guild.id);
    if (!isStaff(interaction.member, s)) return interaction.reply({ embeds: [E.errorEmbed("Solo el **staff** puede añadir usuarios al ticket.")], ephemeral: true });
    return TH.addUser(interaction, interaction.options.getUser("usuario"));
  },
};

// ────── /remove ─────────────────────────────────────────────────────
module.exports.remove = {
  data: new SlashCommandBuilder().setName("remove").setDescription("➖ Quitar un usuario del ticket")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario a quitar").setRequired(true)),
  async execute(interaction) {
    if (!getTicket(interaction.channel)) return interaction.reply({ embeds: [E.errorEmbed("No es un canal de ticket.")], ephemeral: true });
    const s = settings.get(interaction.guild.id);
    if (!isStaff(interaction.member, s)) return interaction.reply({ embeds: [E.errorEmbed("Solo el **staff** puede quitar usuarios del ticket.")], ephemeral: true });
    return TH.removeUser(interaction, interaction.options.getUser("usuario"));
  },
};

// ────── /rename ─────────────────────────────────────────────────────
module.exports.rename = {
  data: new SlashCommandBuilder().setName("rename").setDescription("✏️ Renombrar el canal del ticket")
    .addStringOption(o => o.setName("nombre").setDescription("Nuevo nombre").setRequired(true).setMaxLength(32)),
  async execute(interaction) {
    if (!getTicket(interaction.channel)) return interaction.reply({ embeds: [E.errorEmbed("No es un canal de ticket.")], ephemeral: true });
    const s = settings.get(interaction.guild.id);
    if (!isStaff(interaction.member, s)) return interaction.reply({ embeds: [E.errorEmbed("Solo el staff puede renombrar.")], ephemeral: true });
    const name = interaction.options.getString("nombre").toLowerCase().replace(/[^a-z0-9-]/g, "-").substring(0, 32);
    await interaction.channel.setName(name);
    return interaction.reply({ embeds: [E.successEmbed(`Canal renombrado a **${name}**`)] });
  },
};

// ────── /priority ───────────────────────────────────────────────────
module.exports.priority = {
  data: new SlashCommandBuilder().setName("priority").setDescription("⚡ Cambiar prioridad del ticket")
    .addStringOption(o => o.setName("nivel").setDescription("Nivel").setRequired(true)
      .addChoices(
        { name: "🟢 Baja",    value: "low"    },
        { name: "🔵 Normal",  value: "normal" },
        { name: "🟡 Alta",    value: "high"   },
        { name: "🔴 Urgente", value: "urgent" },
      )),
  async execute(interaction) {
    const t = getTicket(interaction.channel);
    if (!t) return interaction.reply({ embeds: [E.errorEmbed("No es un canal de ticket.")], ephemeral: true });
    const s = settings.get(interaction.guild.id);
    if (!isStaff(interaction.member, s)) return interaction.reply({ embeds: [E.errorEmbed("Solo el staff puede cambiar la prioridad.")], ephemeral: true });
    const level = interaction.options.getString("nivel");
    const info  = config.priorities[level];
    tickets.update(interaction.channel.id, { priority: level });
    await TH.sendLog(interaction.guild, s, "priority", interaction.user, tickets.get(interaction.channel.id), { "⚡ Prioridad": info.label });
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(info.color).setDescription(`⚡ Prioridad cambiada a **${info.label}**`).setTimestamp()] });
  },
};

// ────── /move ───────────────────────────────────────────────────────
module.exports.move = {
  data: new SlashCommandBuilder().setName("move").setDescription("📂 Mover ticket a otra categoría"),
  async execute(interaction) {
    const t = getTicket(interaction.channel);
    if (!t) return interaction.reply({ embeds: [E.errorEmbed("No es un canal de ticket.")], ephemeral: true });
    const s = settings.get(interaction.guild.id);
    if (!isStaff(interaction.member, s)) return interaction.reply({ embeds: [E.errorEmbed("Solo el staff puede mover tickets.")], ephemeral: true });

    const options = config.categories
      .filter(c => c.label !== t.category)
      .map(c => ({ label: c.label, value: c.id, emoji: c.emoji }));

    if (!options.length) return interaction.reply({ embeds: [E.errorEmbed("No hay otras categorías disponibles.")], ephemeral: true });

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_move_select")
      .setPlaceholder("Selecciona la nueva categoría...")
      .addOptions(options);

    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(E.Colors.INFO).setDescription("📂 Selecciona la categoría a la que mover el ticket:")],
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true,
    });
  },
};

// ────── /note ───────────────────────────────────────────────────────
module.exports.note = {
  data: new SlashCommandBuilder().setName("note").setDescription("📝 Notas internas del ticket")
    .addSubcommand(s => s.setName("add").setDescription("Añadir nota").addStringOption(o => o.setName("nota").setDescription("Contenido").setRequired(true).setMaxLength(500)))
    .addSubcommand(s => s.setName("list").setDescription("Ver notas")),
  async execute(interaction) {
    const t = getTicket(interaction.channel);
    if (!t) return interaction.reply({ embeds: [E.errorEmbed("No es un canal de ticket.")], ephemeral: true });
    const s = settings.get(interaction.guild.id);
    if (!isStaff(interaction.member, s)) return interaction.reply({ embeds: [E.errorEmbed("Solo el staff puede ver/añadir notas.")], ephemeral: true });

    if (interaction.options.getSubcommand() === "add") {
      const nota = interaction.options.getString("nota");
      notes.add(t.ticket_id, interaction.user.id, nota);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(E.Colors.WARNING).setTitle("📝 Nota añadida (solo staff)").setDescription(nota).setFooter({ text: `Por ${interaction.user.tag}` }).setTimestamp()], ephemeral: true });
    }

    const nl = notes.get(t.ticket_id);
    if (!nl.length) return interaction.reply({ embeds: [E.infoEmbed("📝 Notas", "No hay notas en este ticket.")], ephemeral: true });
    const txt = nl.map((n, i) => `**${i+1}.** <@${n.staff_id}>: ${n.note}`).join("\n");
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(E.Colors.WARNING).setTitle(`📝 Notas — #${t.ticket_id}`).setDescription(txt).setTimestamp()], ephemeral: true });
  },
};

// ────── /transcript ─────────────────────────────────────────────────
module.exports.transcript = {
  data: new SlashCommandBuilder().setName("transcript").setDescription("📄 Generar transcripción del ticket"),
  async execute(interaction) {
    const t = getTicket(interaction.channel);
    if (!t) return interaction.reply({ embeds: [E.errorEmbed("No es un canal de ticket.")], ephemeral: true });
    const s = settings.get(interaction.guild.id);
    if (!isStaff(interaction.member, s)) return interaction.reply({ embeds: [E.errorEmbed("Solo el staff puede generar transcripciones.")], ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    try {
      const { attachment } = await generateTranscript(interaction.channel, t, interaction.guild);
      return interaction.editReply({ embeds: [E.successEmbed("Transcripción generada.")], files: [attachment] });
    } catch { return interaction.editReply({ embeds: [E.errorEmbed("Error al generar la transcripción.")] }); }
  },
};

// ────── /ticketinfo ─────────────────────────────────────────────────
module.exports.info = {
  data: new SlashCommandBuilder().setName("ticketinfo").setDescription("ℹ️ Ver información del ticket actual"),
  async execute(interaction) {
    const t = getTicket(interaction.channel);
    if (!t) return interaction.reply({ embeds: [E.errorEmbed("No es un canal de ticket.")], ephemeral: true });
    const s = settings.get(interaction.guild.id);
    if (!isStaff(interaction.member, s)) return interaction.reply({ embeds: [E.errorEmbed("Solo el **staff** puede ver la información del ticket.")], ephemeral: true });
    return interaction.reply({ embeds: [E.ticketInfo(t)], ephemeral: true });
  },
};

// ────── /history ────────────────────────────────────────────────────
module.exports.history = {
  data: new SlashCommandBuilder().setName("history").setDescription("📜 Ver historial de tickets de un usuario")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario a consultar").setRequired(false)),
  async execute(interaction) {
    const s    = settings.get(interaction.guild.id);
    const user = interaction.options.getUser("usuario") || interaction.user;

    if (user.id !== interaction.user.id && !isStaff(interaction.member, s)) {
      return interaction.reply({ embeds: [E.errorEmbed("Solo el staff puede ver el historial de otros usuarios.")], ephemeral: true });
    }

    const all    = tickets.getAllByGuild(interaction.guild.id).filter(t => t.user_id === user.id);
    const open   = all.filter(t => t.status === "open");
    const closed = all.filter(t => t.status === "closed");

    if (!all.length) return interaction.reply({ embeds: [E.infoEmbed("📜 Historial", `<@${user.id}> no tiene tickets en este servidor.`)], ephemeral: true });

    const lastClosed = closed.slice(0, 8).map(t => `▸ **#${t.ticket_id}** ${t.category} — ${E.duration(t.created_at)} — ${t.rating ? "⭐".repeat(t.rating) : "Sin rating"}`).join("\n");
    const openList   = open.map(t => `▸ **#${t.ticket_id}** <#${t.channel_id}> ${t.category}`).join("\n");

    const embed = new EmbedBuilder()
      .setTitle(`📜 Historial de ${user.username}`)
      .setColor(E.Colors.PRIMARY)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "📊 Resumen", value: `Total: **${all.length}** | Abiertos: **${open.length}** | Cerrados: **${closed.length}**`, inline: false },
      );

    if (openList) embed.addFields({ name: "🟢 Abiertos ahora", value: openList });
    if (lastClosed) embed.addFields({ name: "🔒 Últimos cerrados", value: lastClosed });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
