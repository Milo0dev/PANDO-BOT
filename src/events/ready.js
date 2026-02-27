const cron  = require("node-cron");
const chalk = require("chalk");
const { ActivityType, EmbedBuilder } = require("discord.js");

const { tickets, settings, staffStats, verifSettings, verifCodes, reminders, polls } = require("../utils/database");
const { updateAllDashboards }            = require("../handlers/dashboardHandler");
const { weeklyReportEmbed }              = require("../utils/embeds");

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    console.log(chalk.green(`\n✅ Conectado como ${chalk.bold(client.user.tag)}`));
    console.log(chalk.blue(`📊 Servidores: ${chalk.bold(client.guilds.cache.size)}`));
    console.log(chalk.yellow(`🎫 Pando Bot v1.0 listo\n`));

    // ── Actividad rotativa
    const activities = [
      { name: "🎫 Gestionando tickets", type: ActivityType.Watching },
      { name: `🎯 ${client.guilds.cache.size} servidores`, type: ActivityType.Watching },
      { name: "🛠️ Soporte 24/7", type: ActivityType.Playing },
    ];
    let ai = 0;
    const setActivity = () => { 
      const activity = activities[ai++ % activities.length];
      client.user.setActivity(activity.name, { type: activity.type });
    };
    // Delay para asegurar que el cliente esté listo
    setTimeout(() => {
      setActivity();
      setInterval(setActivity, 60000);
    }, 5000);

    // ── Dashboard inicial
    await updateAllDashboards(client);

    // ── Actualizar dashboard cada 5 minutos
    cron.schedule("*/5 * * * *", () => updateAllDashboards(client));

    // ═══════════════════════════════════════════════════════════
    //   AUTO-CIERRE (Lectura estricta de settings.get(guild.id))
    // ═══════════════════════════════════════════════════════════
    cron.schedule("*/10 * * * *", async () => {
      for (const [, guild] of client.guilds.cache) {
        // LEER CONFIGURACIÓN EXCLUSIVAMENTE DE LA BASE DE DATOS
        const s = await settings.get(guild.id);
        
        // Compatibilidad: usar horas si está configurado, sino usar minutos legacy
        let autoCloseHours = s.auto_close_hours || 0;
        let autoCloseMinutes = s.auto_close_minutes || 0;
        
        // Si hay horas configuradas, convertir a minutos
        const autoCloseTotalMinutes = autoCloseHours > 0 ? autoCloseHours * 60 : autoCloseMinutes;
        
        if (!s || autoCloseTotalMinutes <= 0) continue;

        const inactive = await tickets.getInactive(guild.id, autoCloseTotalMinutes);
        for (const ticket of inactive) {
          try {
            const channel = guild.channels.cache.get(ticket.channel_id);
            if (!channel) { await tickets.close(ticket.channel_id, client.user.id, "Canal eliminado"); continue; }

            // Avisar 30 minutos antes (solo si el tiempo total es mayor a 30 minutos)
            if (autoCloseTotalMinutes > 30) {
              const warnCutoff = new Date(Date.now() - (autoCloseTotalMinutes - 30) * 60000);
              if (new Date(ticket.last_activity) < warnCutoff) {
                await channel.send({
                  embeds: [new EmbedBuilder()
                    .setColor(0xFEE75C)
                    .setDescription(`⚠️ <@${ticket.user_id}> Este ticket será **cerrado automáticamente** en ~30 minutos por inactividad.\nResponde para evitar el cierre.`)
                    .setTimestamp()],
                }).catch(() => {});
              }
            }

            // Cerrar si ya pasó el tiempo
            const closeCutoff = new Date(Date.now() - autoCloseTotalMinutes * 60000);
            if (new Date(ticket.last_activity) < closeCutoff) {
              await tickets.close(ticket.channel_id, client.user.id, "Cierre automático por inactividad");
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

    // ═══════════════════════════════════════════════════════════
    //   ALERTA SLA / SMART PING (Lectura estricta de settings.get(guild.id))
    // ═══════════════════════════════════════════════════════════
    
    // ── Alertas SLA (cada 5 minutos) — tickets sin respuesta del staff
    cron.schedule("*/5 * * * *", async () => {
      for (const [, guild] of client.guilds.cache) {
        // LEER CONFIGURACIÓN EXCLUSIVAMENTE DE LA BASE DE DATOS
        const s = await settings.get(guild.id);
        
        // Compatibilidad: usar horas si está configurado, sino usar minutos legacy
        let slaHours = s.sla_hours || 0;
        let slaMinutes = s.sla_minutes || 0;
        const slaTotalMinutes = slaHours > 0 ? slaHours * 60 : slaMinutes;
        
        if (!s || slaTotalMinutes <= 0 || !s.log_channel) continue;

        const waiting = await tickets.getWithoutStaffResponse(guild.id, slaTotalMinutes);
        const logCh   = guild.channels.cache.get(s.log_channel);
        if (!logCh) continue;

        for (const ticket of waiting) {
          const mins = Math.floor((Date.now() - new Date(ticket.created_at).getTime()) / 60000);
          const timeStr = slaHours > 0 ? `${Math.floor(mins / 60)} hora(s)` : `${mins} minutos`;
          await logCh.send({
            embeds: [new EmbedBuilder()
              .setColor(0xE67E22).setTitle("⚠️ Alerta SLA — Sin respuesta del staff")
              .setDescription(`El ticket <#${ticket.channel_id}> **#${ticket.ticket_id}** lleva **${timeStr}** sin respuesta del staff.`)
              .addFields(
                { name: "👤 Usuario",   value: `<@${ticket.user_id}>`, inline: true },
                { name: "📁 Categoría", value: ticket.category,        inline: true },
                { name: "⏱️ Límite SLA", value: slaHours > 0 ? `${slaHours} hora(s)` : `${slaMinutes} minutos`, inline: true },
              ).setTimestamp()],
          }).catch(() => {});
        }
      }
    });

    // ═══════════════════════════════════════════════════════════
    //   SMART PING (Lectura estricta de settings.get(guild.id))
    // ═══════════════════════════════════════════════════════════
    cron.schedule("*/3 * * * *", async () => {
      for (const [, guild] of client.guilds.cache) {
        // LEER CONFIGURACIÓN EXCLUSIVAMENTE DE LA BASE DE DATOS
        const s = await settings.get(guild.id);
        
        // Compatibilidad: usar horas si está configurado, sino usar minutos legacy
        let smartPingHours = s.smart_ping_hours || 0;
        let smartPingMinutes = s.smart_ping_minutes || 0;
        const smartPingTotalMinutes = smartPingHours > 0 ? smartPingHours * 60 : smartPingMinutes;
        
        if (!s || smartPingTotalMinutes <= 0) continue;

        const waiting = await tickets.getWithoutStaffResponse(guild.id, smartPingTotalMinutes);
        for (const ticket of waiting) {
          try {
            const channel = guild.channels.cache.get(ticket.channel_id);
            if (!channel) continue;

            // Solo enviar el ping una vez (verificamos si ya se envió buscando el mensaje)
            const recentMsgs = await channel.messages.fetch({ limit: 20 }).catch(() => null);
            if (!recentMsgs) continue;
            const alreadyPinged = recentMsgs.some(m => m.author.id === client.user.id && m.content?.includes("🔔"));
            if (alreadyPinged) continue;

            const timeStr = smartPingHours > 0 ? `${smartPingHours} hora(s)` : `${smartPingMinutes} minutos`;
            const ping = s.support_role ? `<@&${s.support_role}>` : "";
            await channel.send({
              content: ping || undefined,
              embeds: [new EmbedBuilder()
                .setColor(0xE67E22)
                .setTitle("🔔 Smart Ping - Atención Necesaria")
                .setDescription(`Este ticket lleva más de **${timeStr}** sin respuesta del staff.`)
                .addFields(
                  { name: "👤 Usuario", value: `<@${ticket.user_id}>`, inline: true },
                  { name: "📁 Categoría", value: ticket.category, inline: true },
                )
                .setTimestamp()],
            }).catch(() => {});
          } catch (e) { console.error("[SMART PING]", e.message); }
        }
      }
    });

    // ── Reporte semanal (lunes a las 9:00)
    cron.schedule("0 9 * * 1", async () => {
      for (const [, guild] of client.guilds.cache) {
        const s = await settings.get(guild.id);
        if (!s || !s.weekly_report_channel) continue;
        const ch = guild.channels.cache.get(s.weekly_report_channel);
        if (!ch) continue;
        try {
          const stats = await tickets.getStats(guild.id);
          const lb    = await staffStats.getLeaderboard(guild.id);
          await ch.send({ embeds: [weeklyReportEmbed(stats, guild, lb)] });
        } catch (e) { console.error("[WEEKLY REPORT]", e.message); }
      }
    });

    // ── Auto-kick de no verificados (cada 30 minutos)
    cron.schedule("*/30 * * * *", async () => {
      await verifCodes.cleanup(); // Limpiar códigos expirados
      for (const [, guild] of client.guilds.cache) {
        const vs = await verifSettings.get(guild.id);
        if (!vs || !vs.enabled || !vs.kick_unverified_hours || !vs.unverified_role) continue;
        const cutoff = Date.now() - vs.kick_unverified_hours * 3600000;
        try {
          const members = await guild.members.fetch();
          for (const [, member] of members) {
            if (!member.roles.cache.has(vs.unverified_role)) continue;
            if (member.joinedTimestamp && member.joinedTimestamp < cutoff) {
              await member.kick(`No verificado tras ${vs.kick_unverified_hours}h`).catch(() => {});
              const { verifLogs } = require("../utils/database");
              await verifLogs.add(guild.id, member.id, "kicked", `Auto-kick tras ${vs.kick_unverified_hours}h sin verificar`);
              if (vs.log_channel) {
                const logCh = guild.channels.cache.get(vs.log_channel);
                const { EmbedBuilder } = require("discord.js");
                await logCh?.send({
                  embeds: [new EmbedBuilder().setColor(0xED4245).setTitle("🚫 Auto-kick: No verificado")
                    .setDescription(`<@${member.id}> (\`${member.user.tag}\`) fue expulsado por no verificarse en ${vs.kick_unverified_hours}h.`)
                    .setTimestamp()],
                }).catch(() => {});
              }
            }
          }
        } catch (e) { console.error("[AUTO-KICK VERIF]", e.message); }
      }
    });

    // ── Limpiar canales de tickets huérfanos (cada hora)
    cron.schedule("0 * * * *", async () => {
      for (const [, guild] of client.guilds.cache) {
        const open = await tickets.getAllOpen(guild.id);
        for (const t of open) {
          if (!guild.channels.cache.get(t.channel_id)) {
            await tickets.close(t.channel_id, client.user.id, "Canal no encontrado");
          }
        }
      }
    });

    // ── Disparar recordatorios (cada minuto)
    cron.schedule("* * * * *", async () => {
      await reminders.cleanup();
      const pending = await reminders.getPending();
      for (const rem of pending) {
        try {
          await reminders.markFired(rem.id);
          const user = await client.users.fetch(rem.user_id).catch(() => null);
          if (!user) continue;

          // Calcular tiempo transcurrido
          const elapsed = Date.now() - new Date(rem.created_at).getTime();
          const mins    = Math.floor(elapsed / 60000);
          const timeStr = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${Math.floor(mins/1440)}d`;

          await user.send({
            embeds: [new EmbedBuilder()
              .setColor(0xFEE75C)
              .setTitle("⏰ Recordatorio")
              .setDescription(rem.text)
              .addFields({ name: "⏱️ Establecido hace", value: timeStr, inline: true })
              .setFooter({ text: "Recordatorio de PANDO BOT" })
              .setTimestamp()],
          }).catch(() => {
            // Si DMs cerrados, intentar en el canal original
            if (rem.channel_id) {
              const guild = client.guilds.cache.get(rem.guild_id);
              const ch    = guild?.channels.cache.get(rem.channel_id);
              ch?.send({ content: `<@${rem.user_id}>`, embeds: [new EmbedBuilder().setColor(0xFEE75C).setTitle("⏰ Recordatorio").setDescription(rem.text).setTimestamp()] }).catch(() => {});
            }
          });
        } catch (e) { console.error("[REMINDERS]", e.message); }
      }
    });

    // ── Cerrar encuestas expiradas (cada minuto)
    cron.schedule("* * * * *", async () => {
      const { polls: pollsDb } = require("../utils/database");
      const { buildPollEmbed } = require("../handlers/pollHandler");
      const expired = await pollsDb.getActive();
      for (const poll of expired) {
        try {
          await pollsDb.end(poll.id);
          const guild = client.guilds.cache.get(poll.guild_id);
          if (!guild) continue;
          const ch  = guild.channels.cache.get(poll.channel_id);
          if (!ch) continue;
          const msg = await ch.messages.fetch(poll.message_id).catch(() => null);
          if (!msg) continue;
          // Actualizar el mensaje con los resultados finales
          const finalEmbed = buildPollEmbed(poll, true);
          await msg.edit({ embeds: [finalEmbed], components: [] }).catch(() => {});
          await ch.send({
            embeds: [new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle("📊 Encuesta Finalizada")
              .setDescription(`La encuesta **"${poll.question}"** ha terminado.`)
              .setTimestamp()],
          }).catch(() => {});
        } catch (e) { console.error("[POLL END]", e.message); }
      }
    });

// === TRANSMISOR DE DATOS PARA LA WEB ===
    const guardarStats = async () => {
      try {
        const db = require("../utils/database").getDB();
        
        // 1. Calculamos el total de usuarios sumando los de cada servidor
        const totalUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

        // 2. Enviamos todo el paquete completo a MongoDB
        await db.collection("botStats").updateOne(
          { id: "main" },
          {
            $set: {
              botName: client.user.username,
              botAvatar: client.user.displayAvatarURL({ format: "png", size: 256 }),
              serverCount: client.guilds.cache.size,
              userCount: totalUsers, // <-- Aquí agregamos los usuarios totales
              ping: client.ws.ping,
              uptime: process.uptime()
            }
          },
          { upsert: true }
        );
        console.log("📊 Stats del bot actualizados en la BD.");
      } catch (error) {
        console.error("Error al guardar stats:", error.message);
      }
    };

    // Guardar inmediatamente y luego cada minuto
    guardarStats();
    setInterval(guardarStats, 60000);
    // =======================================

    console.log(chalk.green("✅ Todos los cron jobs activos"));
  },
};
