const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { staffStatus, settings, tickets } = require("../utils/database");
const { updateDashboard }                = require("../handlers/dashboardHandler");
const E = require("../utils/embeds");

function isStaff(member, s) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (s.support_role && member.roles.cache.has(s.support_role)) return true;
  if (s.admin_role   && member.roles.cache.has(s.admin_role))   return true;
  return false;
}

// ────── /away ───────────────────────────────────────────────────────
module.exports.away = {
  data: new SlashCommandBuilder().setName("away").setDescription("😴 Activar/desactivar modo ausente del staff")
    .addSubcommand(s => s.setName("on").setDescription("Marcarme como ausente").addStringOption(o => o.setName("razon").setDescription("Razón de ausencia").setRequired(false)))
    .addSubcommand(s => s.setName("off").setDescription("Volver a estar disponible")),
  async execute(interaction) {
    const s = settings.get(interaction.guild.id);
    if (!isStaff(interaction.member, s)) return interaction.reply({ embeds: [E.errorEmbed("Solo el staff puede usar este comando.")], ephemeral: true });

    const sub = interaction.options.getSubcommand();
    if (sub === "on") {
      const razon = interaction.options.getString("razon") || null;
      staffStatus.setAway(interaction.guild.id, interaction.user.id, razon);
      await updateDashboard(interaction.guild);
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(E.Colors.WARNING)
          .setTitle("😴 Modo Ausente Activado")
          .setDescription(`Has marcado tu estado como **ausente**.\n${razon ? `**Razón:** ${razon}` : ""}`)
          .setFooter({ text: "Usa /away off para volver a estar disponible" })
          .setTimestamp()],
        ephemeral: true,
      });
    }
    if (sub === "off") {
      staffStatus.setOnline(interaction.guild.id, interaction.user.id);
      await updateDashboard(interaction.guild);
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(E.Colors.SUCCESS)
          .setDescription("✅ Has vuelto a estar **disponible** para atender tickets.")
          .setTimestamp()],
        ephemeral: true,
      });
    }
  },
};

// ────── /stafflist ──────────────────────────────────────────────────
module.exports.staffList = {
  data: new SlashCommandBuilder().setName("stafflist").setDescription("👥 Ver el estado actual del equipo de staff"),
  async execute(interaction) {
    const s     = settings.get(interaction.guild.id);
    if (!isStaff(interaction.member, s)) return interaction.reply({ embeds: [E.errorEmbed("Solo el staff puede ver este comando.")], ephemeral: true });

    const away  = staffStatus.getAway(interaction.guild.id);
    const total = tickets.getAllOpen(interaction.guild.id);

    const awayText = away.length
      ? away.map(a => `😴 <@${a.staff_id}> — ${a.away_reason || "Sin razón"}`).join("\n")
      : "✅ Todo el staff disponible";

    const embed = new EmbedBuilder()
      .setTitle("👥 Estado del Staff")
      .setColor(E.Colors.PRIMARY)
      .addFields(
        { name: "😴 Ausentes", value: awayText, inline: false },
        { name: "🎫 Tickets abiertos ahora", value: `\`${total.length}\``, inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

// ────── /refreshdashboard ───────────────────────────────────────────
module.exports.refreshDashboard = {
  data: new SlashCommandBuilder().setName("refreshdashboard").setDescription("🔄 Actualizar el dashboard manualmente")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    await updateDashboard(interaction.guild);
    return interaction.editReply({ embeds: [E.successEmbed("Dashboard actualizado correctamente.")] });
  },
};

// ────── /mytickets ──────────────────────────────────────────────────
module.exports.myTickets = {
  data: new SlashCommandBuilder().setName("mytickets").setDescription("🎫 Ver mis tickets abiertos"),
  async execute(interaction) {
    const open = tickets.getByUser(interaction.user.id, interaction.guild.id, "open");
    if (!open.length) return interaction.reply({ embeds: [E.infoEmbed("🎫 Mis Tickets", "No tienes tickets abiertos.")], ephemeral: true });
    const list = open.map(t => `▸ **#${t.ticket_id}** <#${t.channel_id}> — ${t.category} — ${E.priorityLabel(t.priority)}`).join("\n");
    return interaction.reply({
      embeds: [new EmbedBuilder().setTitle(`🎫 Mis Tickets (${open.length})`).setColor(E.Colors.PRIMARY).setDescription(list).setTimestamp()],
      ephemeral: true,
    });
  },
};
