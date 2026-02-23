const { tickets, settings, staffStatus, staffStats } = require("../utils/database");
const { dashboardEmbed } = require("../utils/embeds");

// Intervalo de actualización del dashboard (30 segundos)
const DASHBOARD_UPDATE_INTERVAL = 30 * 1000;

// Variable para almacenar el cliente
let dashboardClient = null;

/**
 * Actualiza o crea el mensaje del dashboard en el canal configurado
 */
async function updateDashboard(guild) {
  try {
    const s = await settings.get(guild.id);
    if (!s || !s.dashboard_channel) return;

    let channel = guild.channels.cache.get(s.dashboard_channel);
    if (!channel) {
      channel = await guild.channels.fetch(s.dashboard_channel);
      if (!channel) return;
    }

    const stats     = await tickets.getStats(guild.id);
    const awayStaff = await staffStatus.getAway(guild.id);
    const lb        = await staffStats.getLeaderboard(guild.id);
    const embed     = dashboardEmbed(stats, guild, awayStaff, lb);

    if (s.dashboard_message_id) {
      try {
        const msg = await channel.messages.fetch(s.dashboard_message_id);
        await msg.edit({ embeds: [embed] });
        return;
      } catch {}
    }

    const msg = await channel.send({ embeds: [embed] });
    await settings.update(guild.id, { dashboard_message_id: msg.id });
  } catch (e) {}
}

/**
 * Actualizar el dashboard en todos los servidores
 */
async function updateAllDashboards(client) {
  for (const [, guild] of client.guilds.cache) {
    await updateDashboard(guild);
  }
}

/**
 * Iniciar actualización automática del dashboard
 */
function startDashboardAutoUpdate(client) {
  dashboardClient = client;
  setTimeout(() => updateAllDashboards(client), 5000);
  setInterval(() => {
    if (client && client.isReady()) {
      updateAllDashboards(client);
    }
  }, DASHBOARD_UPDATE_INTERVAL);
  console.log("[DASHBOARD] Auto-actualización iniciada (cada 30s)");
}

/**
 * Forzar actualización inmediata del dashboard
 */
async function forceUpdateDashboard(guildId) {
  if (!dashboardClient) return;
  const guild = dashboardClient.guilds.cache.get(guildId);
  if (guild) await updateDashboard(guild);
}

module.exports = { 
  updateDashboard, 
  updateAllDashboards,
  startDashboardAutoUpdate,
  forceUpdateDashboard
};
