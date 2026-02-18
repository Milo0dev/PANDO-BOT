const { EmbedBuilder } = require("discord.js");
const moment = require("moment");

const Colors = {
  PRIMARY: 0x5865F2, SUCCESS: 0x57F287, ERROR: 0xED4245,
  WARNING: 0xFEE75C, GOLD: 0xF1C40F,   INFO: 0x3498DB,
  DARK: 0x2B2D31,   ORANGE: 0xE67E22,
};

// ─────────────────────────────────────────────────────
//   TICKET EMBEDS
// ─────────────────────────────────────────────────────
function ticketOpen(ticketData, user, category, answers) {
  const embed = new EmbedBuilder()
    .setTitle(`🎫 Ticket #${ticketData.ticket_id}`)
    .setColor(category.color || Colors.PRIMARY)
    .setDescription(
      category.welcomeMessage?.replace("{user}", `<@${user.id}>`) ||
      `¡Hola <@${user.id}>! Un miembro del staff te atenderá pronto.`
    )
    .addFields(
      { name: "📁 Categoría", value: category.label,                      inline: true },
      { name: "⚡ Prioridad", value: priorityLabel(ticketData.priority),   inline: true },
      { name: "🕐 Creado",    value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true }
    )
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: `ID de usuario: ${user.id}` })
    .setTimestamp();

  if (answers?.length) {
    const questions = category.questions || [];
    const qaText = answers.map((a, i) => `**${questions[i] || `Pregunta ${i+1}`}**\n${a}`).join("\n\n");
    embed.addFields({ name: "📝 Formulario", value: qaText.substring(0, 1000) });
  }
  return embed;
}

function ticketClosed(ticket, closedBy, reason) {
  return new EmbedBuilder()
    .setTitle("🔒 Ticket Cerrado")
    .setColor(Colors.ERROR)
    .addFields(
      { name: "🎫 ID",          value: `#${ticket.ticket_id}`,           inline: true },
      { name: "👤 Cerrado por", value: `<@${closedBy}>`,                 inline: true },
      { name: "📋 Razón",       value: reason || "Sin razón",            inline: false },
      { name: "⏱️ Duración",    value: duration(ticket.created_at),      inline: true },
      { name: "💬 Mensajes",    value: `${ticket.message_count}`,        inline: true },
    )
    .setTimestamp();
}

function ticketReopened(ticket, reopenedBy) {
  return new EmbedBuilder()
    .setTitle("🔓 Ticket Reabierto")
    .setColor(Colors.SUCCESS)
    .setDescription(`<@${reopenedBy}> ha reabierto este ticket.\nUn miembro del staff retomará la atención pronto.`)
    .addFields({ name: "🔄 Reaperturas", value: `${ticket.reopen_count}`, inline: true })
    .setTimestamp();
}

function ticketInfo(ticket) {
  const fields = [
    { name: "👤 Creador",       value: `<@${ticket.user_id}>`,           inline: true },
    { name: "📁 Categoría",     value: ticket.category,                  inline: true },
    { name: "⚡ Prioridad",     value: priorityLabel(ticket.priority),   inline: true },
    { name: "🟢 Estado",        value: ticket.status === "open" ? "✅ Abierto" : "🔒 Cerrado", inline: true },
    { name: "💬 Mensajes",      value: `${ticket.message_count}`,        inline: true },
    { name: "⏱️ Duración",      value: duration(ticket.created_at),      inline: true },
    { name: "📅 Creado",        value: `<t:${Math.floor(new Date(ticket.created_at).getTime()/1000)}:F>`, inline: false },
  ];
  if (ticket.claimed_by)  fields.push({ name: "👋 Reclamado por",  value: `<@${ticket.claimed_by}>`,  inline: true });
  if (ticket.assigned_to) fields.push({ name: "📌 Asignado a",     value: `<@${ticket.assigned_to}>`, inline: true });
  if (ticket.subject)     fields.push({ name: "📋 Asunto",         value: ticket.subject,             inline: false });
  if (ticket.first_staff_response) {
    const respTime = Math.round((new Date(ticket.first_staff_response) - new Date(ticket.created_at)) / 60000);
    fields.push({ name: "⚡ 1ª Respuesta", value: `${respTime} min`, inline: true });
  }
  if (ticket.reopen_count > 0) fields.push({ name: "🔄 Reaperturas", value: `${ticket.reopen_count}`, inline: true });
  return new EmbedBuilder()
    .setTitle(`ℹ️ Ticket #${ticket.ticket_id}`)
    .setColor(Colors.PRIMARY)
    .addFields(...fields)
    .setTimestamp();
}

function ticketLog(ticket, user, action, details = {}) {
  const map = {
    open:       { title: "🎫 Ticket Abierto",          color: Colors.SUCCESS },
    close:      { title: "🔒 Ticket Cerrado",          color: Colors.ERROR   },
    reopen:     { title: "🔓 Ticket Reabierto",        color: Colors.SUCCESS },
    claim:      { title: "👋 Ticket Reclamado",        color: Colors.PRIMARY },
    unclaim:    { title: "↩️ Ticket Liberado",          color: Colors.WARNING },
    assign:     { title: "📌 Ticket Asignado",         color: Colors.INFO    },
    unassign:   { title: "📌 Asignación Removida",     color: Colors.WARNING },
    add:        { title: "➕ Usuario Añadido",          color: Colors.SUCCESS },
    remove:     { title: "➖ Usuario Quitado",          color: Colors.WARNING },
    transcript: { title: "📄 Transcripción Generada",  color: Colors.INFO    },
    rate:       { title: "⭐ Ticket Calificado",        color: Colors.GOLD    },
    move:       { title: "📂 Categoría Cambiada",      color: Colors.INFO    },
    priority:   { title: "⚡ Prioridad Cambiada",      color: Colors.WARNING },
    edit:       { title: "✏️ Mensaje Editado",          color: Colors.WARNING },
    delete:     { title: "🗑️ Mensaje Eliminado",        color: Colors.ERROR   },
    sla:        { title: "⚠️ Alerta SLA",               color: Colors.ORANGE  },
    smartping:  { title: "🔔 Sin Respuesta del Staff",  color: Colors.ORANGE  },
    autoclose:  { title: "⏰ Ticket Auto-cerrado",      color: Colors.ERROR   },
  };
  const info = map[action] || { title: "📋 Acción", color: Colors.PRIMARY };
  const embed = new EmbedBuilder()
    .setTitle(info.title)
    .setColor(info.color)
    .addFields(
      { name: "🎫 Ticket", value: `#${ticket.ticket_id} (<#${ticket.channel_id}>)`, inline: true },
      { name: "👤 Por",    value: `<@${user.id}>`,                                  inline: true },
      { name: "📁 Cat.",   value: ticket.category,                                  inline: true },
    )
    .setFooter({ text: `UID: ${user.id}` })
    .setTimestamp();
  Object.entries(details).forEach(([k, v]) => embed.addFields({ name: k, value: String(v).substring(0, 200), inline: true }));
  return embed;
}

// ─────────────────────────────────────────────────────
//   DASHBOARD
// ─────────────────────────────────────────────────────
function dashboardEmbed(stats, guild, awayStaff, leaderboard) {
  const rating    = stats.avg_rating     ? `${stats.avg_rating.toFixed(1)}/5 ⭐`    : "Sin datos";
  const respTime  = stats.avg_response_minutes ? formatMinutes(stats.avg_response_minutes)  : "Sin datos";
  const closeTime = stats.avg_close_minutes    ? formatMinutes(stats.avg_close_minutes)     : "Sin datos";

  const topCats = stats.topCategories?.length
    ? stats.topCategories.map(([cat, count]) => `▸ ${cat}: **${count}**`).join("\n")
    : "Sin datos";

  const topStaff = leaderboard.slice(0, 3).length
    ? leaderboard.slice(0, 3).map((s, i) => `${["🥇","🥈","🥉"][i]} <@${s.staff_id}> — **${s.tickets_closed}** cerrados`).join("\n")
    : "Sin actividad";

  const awayText = awayStaff.length
    ? awayStaff.map(s => `▸ <@${s.staff_id}> — ${s.away_reason || "Sin razón"}`).join("\n")
    : "✅ Todo el staff disponible";

  return new EmbedBuilder()
    .setTitle(`📊 Dashboard — ${guild.name}`)
    .setColor(Colors.PRIMARY)
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .addFields(
      { name: "━━━ 🎫 Tickets ━━━", value: "\u200b", inline: false },
      { name: "🟢 Abiertos",       value: `\`${stats.open}\``,         inline: true },
      { name: "🔒 Cerrados",       value: `\`${stats.closed}\``,       inline: true },
      { name: "📊 Total",          value: `\`${stats.total}\``,        inline: true },
      { name: "📅 Hoy abiertos",   value: `\`${stats.openedToday}\``,  inline: true },
      { name: "📅 Hoy cerrados",   value: `\`${stats.closedToday}\``,  inline: true },
      { name: "📆 Esta semana",    value: `\`${stats.openedWeek}\``,   inline: true },
      { name: "━━━ ⚡ Rendimiento ━━━", value: "\u200b", inline: false },
      { name: "⭐ Calificación",   value: rating,    inline: true },
      { name: "⚡ Tiempo respuesta",value: respTime,  inline: true },
      { name: "⏱️ Tiempo cierre",  value: closeTime, inline: true },
      { name: "━━━ 📁 Categorías más usadas ━━━", value: topCats, inline: false },
      { name: "━━━ 🏆 Top Staff ━━━",             value: topStaff, inline: false },
      { name: "━━━ 😴 Staff Ausente ━━━",          value: awayText, inline: false },
    )
    .setFooter({ text: `Última actualización` })
    .setTimestamp();
}

// ─────────────────────────────────────────────────────
//   STATS
// ─────────────────────────────────────────────────────
function statsEmbed(stats, guildName) {
  return new EmbedBuilder()
    .setTitle(`📊 Estadísticas — ${guildName}`)
    .setColor(Colors.PRIMARY)
    .addFields(
      { name: "🎫 Total",           value: `\`${stats.total}\``,                                              inline: true },
      { name: "🟢 Abiertos",        value: `\`${stats.open}\``,                                              inline: true },
      { name: "🔒 Cerrados",        value: `\`${stats.closed}\``,                                            inline: true },
      { name: "📅 Hoy",             value: `Abiertos: \`${stats.openedToday}\` | Cerrados: \`${stats.closedToday}\``, inline: false },
      { name: "📆 Esta semana",     value: `Abiertos: \`${stats.openedWeek}\` | Cerrados: \`${stats.closedWeek}\``,   inline: false },
      { name: "⭐ Cal. Promedio",   value: stats.avg_rating ? `\`${stats.avg_rating.toFixed(1)}/5\`` : "`Sin datos`", inline: true },
      { name: "⚡ T. Respuesta",    value: stats.avg_response_minutes ? `\`${formatMinutes(stats.avg_response_minutes)}\`` : "`Sin datos`", inline: true },
      { name: "⏱️ T. Cierre",      value: stats.avg_close_minutes ? `\`${formatMinutes(stats.avg_close_minutes)}\`` : "`Sin datos`", inline: true },
    )
    .setTimestamp();
}

function weeklyReportEmbed(stats, guild, leaderboard) {
  const topStaff = leaderboard.slice(0, 5).map((s, i) =>
    `${["🥇","🥈","🥉","4️⃣","5️⃣"][i]} <@${s.staff_id}> — **${s.tickets_closed}** cerrados`
  ).join("\n") || "Sin actividad esta semana";

  const topCats = stats.topCategories?.map(([c, n]) => `▸ ${c}: **${n}**`).join("\n") || "Sin datos";

  return new EmbedBuilder()
    .setTitle(`📆 Reporte Semanal — ${guild.name}`)
    .setColor(Colors.GOLD)
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .setDescription(`Resumen de la actividad de tickets de los últimos 7 días.`)
    .addFields(
      { name: "🎫 Tickets abiertos",  value: `\`${stats.openedWeek}\``, inline: true },
      { name: "🔒 Tickets cerrados",  value: `\`${stats.closedWeek}\``, inline: true },
      { name: "🟢 Actualmente abiertos", value: `\`${stats.open}\``,   inline: true },
      { name: "⭐ Calificación promedio", value: stats.avg_rating ? `\`${stats.avg_rating.toFixed(1)}/5\`` : "`Sin datos`", inline: true },
      { name: "⚡ Tiempo de respuesta",  value: stats.avg_response_minutes ? `\`${formatMinutes(stats.avg_response_minutes)}\`` : "`Sin datos`", inline: true },
      { name: "🏆 Staff Destacado",    value: topStaff,  inline: false },
      { name: "📁 Categorías Activas", value: topCats,   inline: false },
    )
    .setFooter({ text: "Reporte automático semanal" })
    .setTimestamp();
}

function leaderboardEmbed(lb, guild) {
  const medals  = ["🥇","🥈","🥉"];
  const desc = lb.length
    ? lb.map((s, i) =>
        `${medals[i] || `**${i+1}.**`} <@${s.staff_id}> — **${s.tickets_closed}** cerrados · **${s.tickets_claimed}** reclamados`
      ).join("\n")
    : "Aún no hay datos de staff.";
  return new EmbedBuilder()
    .setTitle("🏆 Leaderboard de Staff")
    .setColor(Colors.GOLD)
    .setDescription(desc)
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .setTimestamp();
}

// ─────────────────────────────────────────────────────
//   MANTENIMIENTO
// ─────────────────────────────────────────────────────
function maintenanceEmbed(reason) {
  return new EmbedBuilder()
    .setTitle("🔧 Sistema en Mantenimiento")
    .setColor(Colors.WARNING)
    .setDescription(`El sistema de tickets está temporalmente desactivado.\n\n**Razón:** ${reason || "Mantenimiento programado"}\n\nPor favor vuelve más tarde.`)
    .setTimestamp();
}

// ─────────────────────────────────────────────────────
//   RATING
// ─────────────────────────────────────────────────────
function ratingEmbed(user, ticketId) {
  return new EmbedBuilder()
    .setTitle("⭐ ¿Cómo fue tu atención?")
    .setColor(Colors.GOLD)
    .setDescription(
      `Hola <@${user.id}>, tu ticket **#${ticketId}** ha sido cerrado.\n\n` +
      `**¿Puedes calificarnos del 1 al 5?**\nTu opinión nos ayuda a mejorar.\n\n*Tienes 5 minutos para responder.*`
    )
    .setThumbnail(user.displayAvatarURL({ dynamic: true }));
}

// ─────────────────────────────────────────────────────
//   GENERALES
// ─────────────────────────────────────────────────────
function successEmbed(msg) { return new EmbedBuilder().setColor(Colors.SUCCESS).setDescription(`✅ ${msg}`); }
function errorEmbed(msg)   { return new EmbedBuilder().setColor(Colors.ERROR).setDescription(`❌ **Error:** ${msg}`); }
function warningEmbed(msg) { return new EmbedBuilder().setColor(Colors.WARNING).setDescription(`⚠️ ${msg}`); }
function infoEmbed(title, desc) {
  return new EmbedBuilder().setColor(Colors.INFO).setTitle(title).setDescription(desc).setTimestamp();
}

// ─────────────────────────────────────────────────────
//   HELPERS
// ─────────────────────────────────────────────────────
function priorityLabel(p) {
  return { low: "🟢 Baja", normal: "🔵 Normal", high: "🟡 Alta", urgent: "🔴 Urgente" }[p] || "🔵 Normal";
}

function duration(createdAt) {
  const ms   = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins/60)}h ${mins%60}m`;
  return `${Math.floor(mins/1440)}d ${Math.floor((mins%1440)/60)}h`;
}

function formatMinutes(m) {
  const mins = Math.round(m);
  if (mins < 60)   return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins/60)}h ${mins%60}m`;
  return `${Math.floor(mins/1440)}d ${Math.floor((mins%1440)/60)}h`;
}

module.exports = {
  Colors, ticketOpen, ticketClosed, ticketReopened, ticketInfo, ticketLog,
  dashboardEmbed, statsEmbed, weeklyReportEmbed, leaderboardEmbed,
  maintenanceEmbed, ratingEmbed,
  successEmbed, errorEmbed, warningEmbed, infoEmbed,
  priorityLabel, duration, formatMinutes,
};
