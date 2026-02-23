const { tickets, settings, staffStatus, staffStats } = require("../utils/database");
const { dashboardEmbed } = require("../utils/embeds");

/**
 * Actualiza o crea el mensaje del dashboard en el canal configurado
 */
async function updateDashboard(guild) {
  try {
    // Las funciones de base de datos son asíncronas
    const s = await settings.get(guild.id);
    if (!s || !s.dashboard_channel) return;

    let channel = guild.channels.cache.get(s.dashboard_channel);
    if (!channel) {
      // Intentar obtener el canal desde la API
      channel = await guild.channels.fetch(s.dashboard_channel);
      if (!channel) {
        console.log("[DASHBOARD] Canal no encontrado:", s.dashboard_channel);
        return;
      }
    }

    const stats     = await tickets.getStats(guild.id);
    const awayStaff = await staffStatus.getAway(guild.id);
    const lb        = await staffStats.getLeaderboard(guild.id);
    const embed     = dashboardEmbed(stats, guild, awayStaff, lb);

    // Si ya existe el mensaje, editarlo
    if (s.dashboard_message_id) {
      try {
        const msg = await channel.messages.fetch(s.dashboard_message_id);
        await msg.edit({ embeds: [embed] });
        return;
      } catch {
        // Mensaje borrado, crear uno nuevo
      }
    }

    // Crear nuevo mensaje
    const msg = await channel.send({ embeds: [embed] });
    await settings.update(guild.id, { dashboard_message_id: msg.id });
  } catch (e) {
    console.error("[DASHBOARD]", e.message);
  }
}

/**
 * Actualizar el dashboard en todos los servidores
 */
async function updateAllDashboards(client) {
  for (const [, guild] of client.guilds.cache) {
    await updateDashboard(guild);
  }
}

module.exports = { updateDashboard, updateAllDashboards };
