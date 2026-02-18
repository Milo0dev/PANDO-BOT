const cron  = require("node-cron");
const chalk = require("chalk");
const { ActivityType, EmbedBuilder } = require("discord.js");

const { tickets, settings, staffStats } = require("../utils/database");
const { updateAllDashboards }            = require("../handlers/dashboardHandler");
const { weeklyReportEmbed }              = require("../utils/embeds");

module.exports = {
  name: "clientReady",
  once: true,
  async execute(client) {
    console.log(chalk.green(`\n✅ Conectado como ${chalk.bold(client.user.tag)}`));
    console.log(chalk.blue(`📊 Servidores: ${chalk.bold(client.guilds.cache.size)}`));
    console.log(chalk.yellow(`🎫 Ticket Bot v3.0 listo\n`));

    // ── Actividad rotativa
    const activities = [
      { name: "🎫 Gestionando tickets",                    type: ActivityType.Watching },
      { name: `${client.guilds.cache.size} servidores`,   type: ActivityType.Watching },
      { name: "🛠️ Soporte 24/7",                           type: ActivityType.Playing  },
    ];
    let ai = 0;
    const setActivity = () => { client.user.setActivity(activities[ai++ % activities.length]); };
    setActivity();
    setInterval(setActivity, 5 * 60 * 1000);

    // ── Dashboard inicial
    await updateAllDashboards(client);

    // ── Actualizar dashboard cada 5 minutos
    cron.schedule("*/5 * * * *", () => updateAllDashboards(client));

    // ── Auto-cierre y avisos (cada 10 minutos)
    cron.schedule("*/10 * * * *", async () => {
      for (const [, guild] of client.guilds.cache) {
        const s = settings.get(guild.id);
        if (!s.auto_close_minutes || s.auto_close_minutes <= 0) continue;

        const inactive = tickets.getInactive(guild.id, s.auto_close_minutes);
        for (const ticket of inactive) {
          try {
            const channel = guild.channels.cache.get(ticket.channel_id);
            if (!channel) { tickets.close(ticket.channel_id, client.user.id, "Canal eliminado"); continue; }

            // Avisar 30 minutos antes
            const warnCutoff = new Date(Date.now() - (s.auto_close_minutes - 30) * 60000);
            if (new Date(ticket.last_activity) < warnCutoff) {
              await channel.send({
                embeds: [new EmbedBuilder()
                  .setColor(0xFEE75C)
                  .setDescription(`⚠️ <@${ticket.user_id}> Este ticket será **cerrado automáticamente** en ~30 minutos por inactividad.\nResponde para evitar el cierre.`)
                  .setTimestamp()],
              }).catch(() => {});
            }

            // Cerrar si ya pasó el tiempo
            const closeCutoff = new Date(Date.now() - s.auto_close_minutes * 60000);
            if (new Date(ticket.last_activity) < closeCutoff) {
              tickets.close(ticket.channel_id, client.user.id, "Inactividad");
              await channel.send({
                embeds: [new EmbedBuilder()
                  .setColor(0xED4245).setTitle("⏰ Ticket Cerrado Automáticamente")
                  .setDescription("Este ticket fue cerrado por inactividad.").setTimestamp()],
              }).catch(() => {});
              setTimeout(() => channel.delete().catch(() => {}), 8000);
            }
          } catch (e) { console.error("[AUTO-CLOSE]", e.message); }
        }
      }
    });

    // ── Alertas SLA (cada 5 minutos) — tickets sin respuesta del staff
    cron.schedule("*/5 * * * *", async () => {
      for (const [, guild] of client.guilds.cache) {
        const s = settings.get(guild.id);
        if (!s.sla_minutes || s.sla_minutes <= 0 || !s.log_channel) continue;

        const waiting = tickets.getWithoutStaffResponse(guild.id, s.sla_minutes);
        const logCh   = guild.channels.cache.get(s.log_channel);
        if (!logCh) continue;

        for (const ticket of waiting) {
          const mins = Math.floor((Date.now() - new Date(ticket.created_at).getTime()) / 60000);
          await logCh.send({
            embeds: [new EmbedBuilder()
              .setColor(0xE67E22).setTitle("⚠️ Alerta SLA — Sin respuesta del staff")
              .setDescription(`El ticket <#${ticket.channel_id}> **#${ticket.ticket_id}** lleva **${mins} minutos** sin respuesta del staff.`)
              .addFields(
                { name: "👤 Usuario",   value: `<@${ticket.user_id}>`, inline: true },
                { name: "📁 Categoría", value: ticket.category,        inline: true },
              ).setTimestamp()],
          }).catch(() => {});
        }
      }
    });

    // ── Smart ping — notificar si no hay respuesta del staff en X minutos
    cron.schedule("*/3 * * * *", async () => {
      for (const [, guild] of client.guilds.cache) {
        const s = settings.get(guild.id);
        if (!s.smart_ping_minutes || s.smart_ping_minutes <= 0) continue;

        const waiting = tickets.getWithoutStaffResponse(guild.id, s.smart_ping_minutes);
        for (const ticket of waiting) {
          try {
            const channel = guild.channels.cache.get(ticket.channel_id);
            if (!channel) continue;

            // Solo enviar el ping una vez (verificamos si ya se envió buscando el mensaje)
            const recentMsgs = await channel.messages.fetch({ limit: 20 }).catch(() => null);
            if (!recentMsgs) continue;
            const alreadyPinged = recentMsgs.some(m => m.author.id === client.user.id && m.content?.includes("🔔"));
            if (alreadyPinged) continue;

            const ping = s.support_role ? `<@&${s.support_role}>` : "";
            await channel.send({
              content: ping || undefined,
              embeds: [new EmbedBuilder()
                .setColor(0xE67E22)
                .setDescription(`🔔 **Atención necesaria** — Este ticket lleva más de **${s.smart_ping_minutes} minutos** sin respuesta del staff.`)
                .setTimestamp()],
            }).catch(() => {});
          } catch {}
        }
      }
    });

    // ── Reporte semanal (lunes a las 9:00)
    cron.schedule("0 9 * * 1", async () => {
      for (const [, guild] of client.guilds.cache) {
        const s = settings.get(guild.id);
        if (!s.weekly_report_channel) continue;
        const ch = guild.channels.cache.get(s.weekly_report_channel);
        if (!ch) continue;
        try {
          const stats = tickets.getStats(guild.id);
          const lb    = staffStats.getLeaderboard(guild.id);
          await ch.send({ embeds: [weeklyReportEmbed(stats, guild, lb)] });
        } catch (e) { console.error("[WEEKLY REPORT]", e.message); }
      }
    });

    // ── Limpiar canales de tickets huérfanos (cada hora)
    cron.schedule("0 * * * *", async () => {
      for (const [, guild] of client.guilds.cache) {
        const open = tickets.getAllOpen(guild.id);
        for (const t of open) {
          if (!guild.channels.cache.get(t.channel_id)) {
            tickets.close(t.channel_id, client.user.id, "Canal no encontrado");
          }
        }
      }
    });
  },
};
