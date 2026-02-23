const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require("discord.js");
const { settings }    = require("../utils/database");
const { sendPanel }   = require("../handlers/ticketHandler");
const { updateDashboard } = require("../handlers/dashboardHandler");
const E               = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("⚙️ Configurar el bot de tickets")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // ── Canales
    .addSubcommand(s => s.setName("panel").setDescription("Enviar panel de tickets").addChannelOption(o => o.setName("canal").setDescription("Canal del panel").addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(s => s.setName("logs").setDescription("Canal de logs").addChannelOption(o => o.setName("canal").setDescription("Canal").addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(s => s.setName("transcripts").setDescription("Canal de transcripciones").addChannelOption(o => o.setName("canal").setDescription("Canal").addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(s => s.setName("dashboard").setDescription("Canal del dashboard en tiempo real").addChannelOption(o => o.setName("canal").setDescription("Canal").addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(s => s.setName("weekly-report").setDescription("Canal para reporte semanal automático").addChannelOption(o => o.setName("canal").setDescription("Canal").addChannelTypes(ChannelType.GuildText).setRequired(true)))
    // ── Roles
    .addSubcommand(s => s.setName("staff-role").setDescription("Rol del equipo de soporte").addRoleOption(o => o.setName("rol").setDescription("Rol").setRequired(true)))
    .addSubcommand(s => s.setName("admin-role").setDescription("Rol de administrador del bot").addRoleOption(o => o.setName("rol").setDescription("Rol").setRequired(true)))
    .addSubcommand(s => s.setName("verify-role").setDescription("Rol mínimo para abrir tickets (0 para desactivar)").addRoleOption(o => o.setName("rol").setDescription("Rol requerido").setRequired(false)))
    // ── Límites
    .addSubcommand(s => s.setName("max-tickets").setDescription("Máximo de tickets por usuario").addIntegerOption(o => o.setName("cantidad").setDescription("1-10").setMinValue(1).setMaxValue(10).setRequired(true)))
    .addSubcommand(s => s.setName("global-limit").setDescription("Límite global de tickets abiertos (0=sin límite)").addIntegerOption(o => o.setName("cantidad").setDescription("0-500").setMinValue(0).setMaxValue(500).setRequired(true)))
    .addSubcommand(s => s.setName("cooldown").setDescription("Tiempo de espera entre tickets en minutos (0=desactivado)").addIntegerOption(o => o.setName("minutos").setDescription("Minutos").setMinValue(0).setMaxValue(1440).setRequired(true)))
    .addSubcommand(s => s.setName("min-days").setDescription("Días mínimos en el servidor para abrir tickets (0=desactivado)").addIntegerOption(o => o.setName("dias").setDescription("Días").setMinValue(0).setMaxValue(365).setRequired(true)))
    // ── Auto-close y SLA
    .addSubcommand(s => s.setName("auto-close").setDescription("Auto-cierre por inactividad en minutos (0=desactivado)").addIntegerOption(o => o.setName("minutos").setDescription("Minutos").setMinValue(0).setMaxValue(10080).setRequired(true)))
    .addSubcommand(s => s.setName("sla").setDescription("Alerta SLA si no hay respuesta en X minutos (0=desactivado)").addIntegerOption(o => o.setName("minutos").setDescription("Minutos").setMinValue(0).setMaxValue(1440).setRequired(true)))
    .addSubcommand(s => s.setName("smart-ping").setDescription("Ping al staff si no responde en X minutos (0=desactivado)").addIntegerOption(o => o.setName("minutos").setDescription("Minutos").setMinValue(0).setMaxValue(1440).setRequired(true)))
    // ── DM
    .addSubcommand(s => s.setName("dm-open").setDescription("DM de confirmación al abrir ticket").addBooleanOption(o => o.setName("activado").setDescription("Sí/No").setRequired(true)))
    .addSubcommand(s => s.setName("dm-close").setDescription("DM de notificación al cerrar ticket").addBooleanOption(o => o.setName("activado").setDescription("Sí/No").setRequired(true)))
    // ── Logs
    .addSubcommand(s => s.setName("log-edits").setDescription("Registrar mensajes editados en tickets").addBooleanOption(o => o.setName("activado").setDescription("Sí/No").setRequired(true)))
    .addSubcommand(s => s.setName("log-deletes").setDescription("Registrar mensajes eliminados en tickets").addBooleanOption(o => o.setName("activado").setDescription("Sí/No").setRequired(true)))
    // ── Info
    .addSubcommand(s => s.setName("info").setDescription("Ver la configuración actual")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guild.id;
    const s   = settings.get(gid);

    const ok  = msg => interaction.reply({ embeds: [E.successEmbed(msg)], ephemeral: true });

    if (sub === "panel") {
      await interaction.deferReply({ ephemeral: true });
      const canal = interaction.options.getChannel("canal");
      try {
        const msg = await sendPanel(canal, interaction.guild);
        settings.update(gid, { panel_channel_id: canal.id, panel_message_id: msg.id });
        return interaction.editReply({ embeds: [E.successEmbed(`Panel enviado a ${canal}.`)] });
      } catch { return interaction.editReply({ embeds: [E.errorEmbed("Error al enviar el panel. Verifica mis permisos.")] }); }
    }

    const channelSubs = { logs: "log_channel", transcripts: "transcript_channel", dashboard: "dashboard_channel", "weekly-report": "weekly_report_channel" };
    if (channelSubs[sub]) {
      const canal = interaction.options.getChannel("canal");
      await settings.update(gid, { [channelSubs[sub]]: canal.id });
      
      // Si es el subcomando dashboard, actualizar el mensaje del dashboard inmediatamente
      if (sub === "dashboard") {
        await updateDashboard(interaction.guild);
        return ok(`Canal **${sub}** configurado: ${canal}. Dashboard actualizado.`);
      }
      
      return ok(`Canal **${sub}** configurado: ${canal}`);
    }

    if (sub === "staff-role")  { settings.update(gid, { support_role: interaction.options.getRole("rol").id });  return ok(`Rol de soporte: ${interaction.options.getRole("rol")}`); }
    if (sub === "admin-role")  { settings.update(gid, { admin_role:   interaction.options.getRole("rol").id });  return ok(`Rol de admin: ${interaction.options.getRole("rol")}`);  }
    if (sub === "verify-role") {
      const rol = interaction.options.getRole("rol");
      settings.update(gid, { verify_role: rol ? rol.id : null });
      return ok(rol ? `Rol mínimo requerido: ${rol}` : "Rol mínimo **desactivado**.");
    }

    if (sub === "max-tickets")   { settings.update(gid, { max_tickets:           interaction.options.getInteger("cantidad") }); return ok(`Máx. tickets por usuario: **${interaction.options.getInteger("cantidad")}**`); }
    if (sub === "global-limit")  { settings.update(gid, { global_ticket_limit:   interaction.options.getInteger("cantidad") }); return ok(interaction.options.getInteger("cantidad") === 0 ? "Límite global **desactivado**." : `Límite global: **${interaction.options.getInteger("cantidad")}** tickets.`); }
    if (sub === "cooldown")      { settings.update(gid, { cooldown_minutes:       interaction.options.getInteger("minutos") });  return ok(interaction.options.getInteger("minutos") === 0 ? "Cooldown **desactivado**." : `Cooldown: **${interaction.options.getInteger("minutos")} minutos**.`); }
    if (sub === "min-days")      { settings.update(gid, { min_days:               interaction.options.getInteger("dias") });    return ok(interaction.options.getInteger("dias") === 0 ? "Días mínimos **desactivado**." : `Días mínimos en el servidor: **${interaction.options.getInteger("dias")}**.`); }
    if (sub === "auto-close")    { settings.update(gid, { auto_close_minutes:     interaction.options.getInteger("minutos") }); return ok(interaction.options.getInteger("minutos") === 0 ? "Auto-cierre **desactivado**." : `Auto-cierre: **${interaction.options.getInteger("minutos")} minutos** de inactividad.`); }
    if (sub === "sla")           { settings.update(gid, { sla_minutes:            interaction.options.getInteger("minutos") }); return ok(interaction.options.getInteger("minutos") === 0 ? "Alerta SLA **desactivada**." : `SLA: alerta si no hay respuesta en **${interaction.options.getInteger("minutos")} minutos**.`); }
    if (sub === "smart-ping")    { settings.update(gid, { smart_ping_minutes:     interaction.options.getInteger("minutos") }); return ok(interaction.options.getInteger("minutos") === 0 ? "Smart ping **desactivado**." : `Smart ping: **${interaction.options.getInteger("minutos")} minutos** sin respuesta.`); }
    if (sub === "dm-open")       { settings.update(gid, { dm_on_open:             interaction.options.getBoolean("activado") }); return ok(`DM al abrir ticket: **${interaction.options.getBoolean("activado") ? "✅ Activado" : "❌ Desactivado"}**`); }
    if (sub === "dm-close")      { settings.update(gid, { dm_on_close:            interaction.options.getBoolean("activado") }); return ok(`DM al cerrar ticket: **${interaction.options.getBoolean("activado") ? "✅ Activado" : "❌ Desactivado"}**`); }
    if (sub === "log-edits")     { settings.update(gid, { log_edits:              interaction.options.getBoolean("activado") }); return ok(`Log de ediciones: **${interaction.options.getBoolean("activado") ? "✅ Activado" : "❌ Desactivado"}**`); }
    if (sub === "log-deletes")   { settings.update(gid, { log_deletes:            interaction.options.getBoolean("activado") }); return ok(`Log de eliminaciones: **${interaction.options.getBoolean("activado") ? "✅ Activado" : "❌ Desactivado"}**`); }

    if (sub === "info") {
      const yn = v => v ? "✅ Sí" : "❌ No";
      const ch = id => id ? `<#${id}>` : "❌ No configurado";
      const rl = id => id ? `<@&${id}>` : "❌ No configurado";
      const embed = new EmbedBuilder()
        .setTitle("⚙️ Configuración Actual")
        .setColor(E.Colors.PRIMARY)
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .addFields(
          { name: "📋 Canales", value: `Logs: ${ch(s.log_channel)}\nTranscripts: ${ch(s.transcript_channel)}\nDashboard: ${ch(s.dashboard_channel)}\nReporte semanal: ${ch(s.weekly_report_channel)}\nPanel: ${ch(s.panel_channel_id)}`, inline: false },
          { name: "👥 Roles",   value: `Soporte: ${rl(s.support_role)}\nAdmin: ${rl(s.admin_role)}\nVerificación: ${rl(s.verify_role)}`, inline: false },
          { name: "🎫 Tickets", value: `Máx/usuario: **${s.max_tickets}** | Límite global: **${s.global_ticket_limit || "∞"}**\nCooldown: **${s.cooldown_minutes}m** | Días mínimos: **${s.min_days}**\nTotal creados: **${s.ticket_counter}**`, inline: false },
          { name: "⚙️ Auto",   value: `Auto-cierre: **${s.auto_close_minutes || "❌"}m** | SLA: **${s.sla_minutes || "❌"}m** | Smart ping: **${s.smart_ping_minutes || "❌"}m**`, inline: false },
          { name: "📩 DM",      value: `Al abrir: ${yn(s.dm_on_open)} | Al cerrar: ${yn(s.dm_on_close)}`, inline: true },
          { name: "📝 Logs",    value: `Ediciones: ${yn(s.log_edits)} | Eliminaciones: ${yn(s.log_deletes)}`, inline: true },
          { name: "🔧 Mant.",   value: s.maintenance_mode ? `🔴 ACTIVO — ${s.maintenance_reason || "Sin razón"}` : "🟢 Desactivado", inline: true },
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
