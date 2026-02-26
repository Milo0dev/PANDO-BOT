const { tickets, settings, staffStatus, staffStats } = require("../utils/database");
const { dashboardEmbed } = require("../utils/embeds");
const { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder 
} = require("discord.js");

// Intervalo de actualización del dashboard (30 segundos)
const DASHBOARD_UPDATE_INTERVAL = 30 * 1000;

// Variable para almacenar el cliente
let dashboardClient = null;

/**
 * Actualiza o crea el mensaje del dashboard en el canal configurado
 */
async function updateDashboard(guild, isManual = false) {
  if (isManual) {
    console.log(`[DASHBOARD] Intentando actualizar el panel para el servidor ${guild.name}...`);
  }
  try {
    const s = await settings.get(guild.id);
    if (!s || !s.dashboard_channel) {
      if (isManual) {
        console.log(`\x1b[33m[DASHBOARD] ⚠️ Cancelado: No hay 'Canal del Dashboard' configurado en la web para ${guild.name}\x1b[0m`);
      }
      return;
    }

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
        if (isManual) {
          console.log(`\x1b[32m[DASHBOARD] ✅ Panel actualizado correctamente en el canal ${channel.name}\x1b[0m`);
        }
        return;
      } catch {}
    }

    const msg = await channel.send({ embeds: [embed] });
    if (isManual) {
      console.log(`\x1b[32m[DASHBOARD] ✅ Panel actualizado correctamente en el canal ${channel.name}\x1b[0m`);
    }
    await settings.update(guild.id, { dashboard_message_id: msg.id });
  } catch (e) {}
}

/**
 * Actualiza o crea el panel de tickets en el canal configurado desde el Dashboard web
 * Se ejecuta automáticamente cuando se guardan los settings desde la web
 */
async function updateTicketPanel(guild) {
  console.log(`[TICKET PANEL] Intentando actualizar el panel de tickets para el servidor ${guild.name}...`);
  
  try {
    const s = await settings.get(guild.id);
    
    // Verificar si hay un canal configurado para el panel de tickets
    if (!s || !s.panel_channel_id) {
      console.log(`\x1b[33m[TICKET PANEL] ⚠️ Cancelado: No hay 'Canal del Panel de Tickets' configurado en la web para ${guild.name}\x1b[0m`);
      return;
    }

    // Obtener el canal
    let channel = guild.channels.cache.get(s.panel_channel_id);
    if (!channel) {
      try {
        channel = await guild.channels.fetch(s.panel_channel_id);
      } catch (fetchError) {
        console.log(`\x1b[33m[TICKET PANEL] ⚠️ No se pudo obtener el canal ${s.panel_channel_id} para ${guild.name}\x1b[0m`);
        return;
      }
    }
    
    if (!channel) {
      console.log(`\x1b[33m[TICKET PANEL] ⚠️ Canal no encontrado: ${s.panel_channel_id} para ${guild.name}\x1b[0m`);
      return;
    }

    // Verificar permisos del bot para enviar mensajes en el canal
    const botMember = guild.members.me;
    if (!channel.permissionsFor(botMember).has("SendMessages") || !channel.permissionsFor(botMember).has("EmbedLinks")) {
      console.log(`\x1b[33m[TICKET PANEL] ⚠️ El bot no tiene permisos para enviar mensajes/embeds en el canal ${channel.name}\x1b[0m`);
      return;
    }

    // Verificar si ya existe un mensaje del panel en ese canal
    if (s.panel_message_id) {
      try {
        const existingMsg = await channel.messages.fetch(s.panel_message_id);
        if (existingMsg) {
          // El mensaje ya existe, verificar si tiene los componentes correctos
          const embed = new EmbedBuilder()
            .setTitle("🎫 Sistema de Tickets")
            .setDescription("¿Necesitas ayuda? ¡Abre un ticket y el staff te atenderá!")
            .setColor(0x5865F2)
            .addFields(
              { name: "📝 Cómo funciona", value: "1. Haz clic en el botón de abajo\n2. Selecciona una categoría\n3. Describe tu problema\n4. Espera a que un staff te atienda", inline: false }
            )
            .setFooter({ text: "Pando Bot - Sistema de Tickets" })
            .setTimestamp();

          const button = new ButtonBuilder()
            .setCustomId("create_ticket")
            .setLabel("Abrir Ticket")
            .setEmoji("🎫")
            .setStyle(ButtonStyle.Success);

          const actionRow = new ActionRowBuilder().addComponents(button);

          await existingMsg.edit({ embeds: [embed], components: [actionRow] });
          console.log(`\x1b[32m[TICKET PANEL] ✅ Panel actualizado correctamente en el canal ${channel.name}\x1b[0m`);
          return;
        }
      } catch (fetchError) {
        // El mensaje fue eliminado, continuamos para crear uno nuevo
        console.log(`\x1b[33m[TICKET PANEL] ℹ️ El mensaje anterior fue eliminado, creando uno nuevo...\x1b[0m`);
      }
    }

    // Crear el Embed profesional para el panel de tickets
    const embed = new EmbedBuilder()
      .setTitle("🎫 Sistema de Tickets")
      .setDescription("¿Necesitas ayuda? ¡Abre un ticket y el staff te atenderá!")
      .setColor(0x5865F2)
      .addFields(
        { name: "📝 Cómo funciona", value: "1. Haz clic en el botón de abajo\n2. Selecciona una categoría\n3. Describe tu problema\n4. Espera a que un staff te atienda", inline: false }
      )
      .setFooter({ text: "Pando Bot - Sistema de Tickets" })
      .setTimestamp();

    // Crear el botón con el customId exacto requerido
    const button = new ButtonBuilder()
      .setCustomId("create_ticket")
      .setLabel("Abrir Ticket")
      .setEmoji("🎫")
      .setStyle(ButtonStyle.Success);

    const actionRow = new ActionRowBuilder().addComponents(button);

    // Enviar el mensaje al canal
    const msg = await channel.send({ embeds: [embed], components: [actionRow] });
    
    // Guardar el ID del mensaje en la base de datos para evitar duplicados
    await settings.update(guild.id, { panel_message_id: msg.id });
    
    console.log(`\x1b[32m[TICKET PANEL] ✅ Panel de tickets creado correctamente en el canal ${channel.name}\x1b[0m`);
    
  } catch (error) {
    console.error(`\x1b[31m[TICKET PANEL] ❌ Error al actualizar el panel de tickets para ${guild.name}:\x1b[0m`, error.message);
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
  if (guild) await updateDashboard(guild, true);
}

module.exports = { 
  updateDashboard, 
  updateTicketPanel,
  updateAllDashboards,
  startDashboardAutoUpdate,
  forceUpdateDashboard
};
