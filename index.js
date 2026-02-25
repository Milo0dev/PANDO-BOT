require("dotenv").config();
const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");
const chalk = require("chalk");
const fs    = require("fs");
const path  = require("path");
const express = require("express");

// Middleware de autenticación
const { setupSession, setupAuthRoutes, checkAuth, checkOwner, injectUser } = require("./src/middleware/auth");

// Variable para almacenar el cliente de Discord
let discordClient = null;

// Debug: Mostrar variables de entorno
console.log("🔍 Debug - MONGO_URI:", process.env.MONGO_URI ? "✓ Configurada" : "✗ No encontrada");

// ── Conectar a MongoDB
const { connectDB } = require("./src/utils/database");

async function startBot() {
  try {
    console.log(chalk.yellow("🔄 Conectando a MongoDB..."));
    console.log("🔍 URI usada:", process.env.MONGO_URI);
    await connectDB();
    console.log(chalk.green("✅ MongoDB conectado correctamente\n"));
  } catch (error) {
    console.error(chalk.red("❌ Error fatal: No se pudo conectar a MongoDB"));
    console.error(chalk.yellow("💡 Verifica tu conexión a MongoDB en .env (MONGO_URI)\n"));
    process.exit(1);
  }

  // ── Cliente
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildPresences, // ← Necesario para la presencia
    ],
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
  });

  // Guardar el cliente para uso en el servidor web
  discordClient = client;
  
  // Iniciar servidor Express cuando el bot esté listo
  client.once("ready", () => {
    iniciarServidorExpress(client);
  });

  client.commands = new Collection();

  // ── Cargar todos los comandos
  const setup   = require("./src/commands/setup");
  const ticket  = require("./src/commands/ticket");
  const admin   = require("./src/commands/admin");
  const staff   = require("./src/commands/staff");
  const welcome = require("./src/commands/welcome");
  const verify  = require("./src/commands/verify");
  const help    = require("./src/commands/help");
  const poll    = require("./src/commands/poll");
  const embed   = require("./src/commands/embed");
  const suggest = require("./src/commands/suggest");
  const remind  = require("./src/commands/remind");
  const rank    = require("./src/commands/rank");
  const levels  = require("./src/commands/levels");
  const modlogs = require("./src/commands/modlogs");
  const music   = require("./src/commands/music");
  const ping    = require("./src/commands/ping");
  const debug   = require("./src/commands/debug");
  
  // Entretenimiento
  const economy = require("./src/commands/economy");
  const games   = require("./src/commands/games");
  const giveaway = require("./src/commands/giveaway");

  const allCommands = [
    setup, ping, debug,
    ticket.reopen, ticket.claim, ticket.close, ticket.unclaim,
    ticket.assign, ticket.add, ticket.remove, ticket.rename,
    ticket.priority, ticket.move, ticket.note, ticket.transcript,
    ticket.info, ticket.history,
    admin.stats, admin.blacklist, admin.tag, admin.autoresponse,
    admin.maintenance, admin.closeAll, admin.lockdown,
    staff.away, staff.staffList, staff.refreshDashboard, staff.myTickets,
    welcome, verify, help,
    poll, embed, suggest, remind, rank, levels, modlogs,
    music.play, music.skip, music.stop, music.pause, music.resume, 
    music.queue, music.nowplaying, music.shuffle, music.remove, 
    music.clear, music.volume, music.loop,
    // Economia
    economy.balance, economy.daily, economy.pay, economy.deposit, economy.withdraw,
    economy.shop, economy.buy, economy.work, economy.gamble, economy.leaderboard,
    // Juegos
    games.ahorcado, games.ttt, games.trivia,
    // Giveaway
    giveaway.create
  ];

  for (const cmd of allCommands) {
    if (cmd?.data) client.commands.set(cmd.data.name, cmd);
  }

  // ── Cargar eventos automáticamente
  const eventsDir   = path.join(__dirname, "src/events");
  const eventFiles  = fs.readdirSync(eventsDir).filter(f => f.endsWith(".js"));

  for (const file of eventFiles) {
    const event = require(path.join(eventsDir, file));
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }

  // ── Iniciar sistemas de auto-actualización
  const { startDashboardAutoUpdate, forceUpdateDashboard } = require("./src/handlers/dashboardHandler");
  const { startOrphanCleanup } = require("./src/handlers/musicHandler");
  
  // Dashboard auto-update (cada 30 segundos)
  startDashboardAutoUpdate(client);
  
  // Music orphan cleanup (cada 5 minutos)
  startOrphanCleanup(client);

  // ── Manejo de errores global
  process.on("unhandledRejection", err => console.error(chalk.red("[ERROR]"), err?.message || err));
  process.on("uncaughtException",  err => console.error(chalk.red("[EXCEPTION]"), err?.message || err));
  client.on("error", err => console.error(chalk.red("[CLIENT ERROR]"), err?.message));

  process.removeAllListeners("warning");
  process.on("warning", (warning) => {
    if (warning.name === "TimeoutNegativeWarning") return; 
    console.warn(warning);
  });

  // ── Banner
  console.log(chalk.blue(`
╔══════════════════════════════════════════╗
║                                          ║
║        🐼  PANDO BOT  v1.1  🐼          ║
║      Sistema Profesional Completo         ║
║      con MongoDB                         ║
║                                          ║
╚══════════════════════════════════════════╝
`));
  console.log("🔥 BOT ACTUALIZADO - " + new Date().toLocaleTimeString());

  // ── Registrar comandos de slash automáticamente
  client.once("ready", async () => {
    await registrarComandos(client);
  });

  // ── Iniciar sesión
  client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error(chalk.red("\n❌ Error al iniciar:"), err.message);
    console.error(chalk.yellow("💡 Verifica que DISCORD_TOKEN en .env sea correcto.\n"));
    process.exit(1);
  });
}

// Función para registrar comandos de slash - reemplaza todos para evitar duplicados
async function registrarComandos(client) {
  try {
    console.log(chalk.yellow("📝 Registrando comandos de slash..."));
    
    const commands = [];
    
    // Recoger todos los comandos del código local
    for (const [name, cmd] of client.commands) {
      if (cmd.data) {
        commands.push(cmd.data);
      }
    }
    
    // 🔧 LIMPIEZA EXPLICITA: Eliminar TODOS los comandos existentes primero
    // Esto asegura que no queden duplicados ni comandos huérfanos
    console.log(chalk.gray("   🧹 Limpiando comandos existentes..."));
    const comandosRegistrados = await client.application.commands.fetch();
    
    if (comandosRegistrados.size > 0) {
      // Eliminar cada comando individualmente para asegurar limpieza total
      for (const [, cmd] of comandosRegistrados) {
        try {
          await client.application.commands.delete(cmd.id);
        } catch (e) {
          // Ignorar errores al eliminar (puede ser que ya fue eliminado)
        }
      }
      console.log(chalk.gray(`   🗑️ ${comandosRegistrados.size} comandos antiguos eliminados`));
    }
    
    // Crear mapas para comparar
    const comandosLocales = new Map(commands.map(c => [c.name, c]));
    
    // Comandos nuevos o modificados (para mostrar en logs)
    const comandosNuevos = [];
    const comandosModificados = [];
    
    // Verificar comandos locales
    for (const [nombre, cmdLocal] of comandosLocales) {
      comandosNuevos.push(nombre);
    }
    
    // MOSTRAR RESUMEN DE CAMBIOS
    if (comandosNuevos.length > 0) {
      console.log(chalk.gray(`   + Registrando: ${comandosNuevos.join(", ")}`));
    }
    
    // Registrar los comandos limpio (sin duplicados)
    await client.application.commands.set(commands);
    
    console.log(chalk.green(`✅ ${commands.length} comandos registrados correctamente (duplicados eliminados)`));
    console.log(chalk.blue("🎉 Registro de comandos completado!\n"));
    
  } catch (error) {
    console.error(chalk.red("❌ Error al registrar comandos:"), error.message);
  }
}

// Función para iniciar el servidor Express con la dashboard
function iniciarServidorExpress(client) {
  const app = express();
  
  // Puerto dinámico (process.env.SERVER_PORT para Pterodactyl, fallback 19318)
  const PORT = process.env.SERVER_PORT || process.env.PORT || 19318;
  
  // Configurar EJS como motor de plantillas
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  
  // Middleware para parsing JSON y URL encoded
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Configurar sesiones
  setupSession(app);
  
// Rutas de autenticación (públicas) - DEFINIR ANTES del middleware
  setupAuthRoutes(app);
  
  // Injectar usuario en todas las vistas
  app.use(injectUser);
  
  // Middleware de autenticación - se aplica a todas las rutas definidas después
  // IMPORTANTE: Las rutas /login, /callback, /logout ya están definidas arriba
  // Por eso funciona correctamente
  
  // Ruta principal - Dashboard (PROTEGIDA)
  app.get("/", checkAuth, checkOwner, (req, res) => {
    // Calcular tiempo activo
    const uptimeSeconds = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const uptime = `${hours}h ${minutes}m`;
    
    // Calcular usuarios totales
    let totalUsers = 0;
    client.guilds.cache.forEach(guild => {
      totalUsers += guild.memberCount;
    });
    
    // Datos para la vista (ahora incluye datos del usuario logueado)
    const datos = {
      botName: client.user.username,
      botAvatar: client.user.displayAvatarURL({ format: "png", size: 256 }),
      serverCount: client.guilds.cache.size,
      userCount: totalUsers,
      ping: client.ws.ping,
      uptime: uptime,
      // Datos del usuario desde la sesión
      user: req.session.user
    };
    
    res.render("dashboard", datos);
  });
  
  // Ruta de health check (para Pterodactyl) - PÚBLICA
  app.get("/health", (req, res) => {
    res.json({ 
      status: "ok", 
      bot: client.user?.username || "connecting",
      servers: client.guilds.cache.size
    });
  });
  
// ==================== API ROUTES ====================
  
  // Get list of servers the bot is in
  app.get("/api/servers", checkAuth, checkOwner, (req, res) => {
    const servers = client.guilds.cache.map(guild => ({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL({ format: "png", size: 64 }),
      memberCount: guild.memberCount
    }));
    res.json(servers);
  });
  
// Get settings for a specific server
  app.get("/api/settings/:guildId", checkAuth, checkOwner, async (req, res) => {
    const { guildId } = req.params;
    
    // Verify bot is in this guild
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: "Servidor no encontrado" });
    }
    
    try {
      const { settings } = require("./src/utils/database");
      const s = await settings.get(guildId);
      res.json({
        guild: {
          id: guild.id,
          name: guild.name,
          icon: guild.iconURL({ format: "png", size: 64 })
        },
        settings: s
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get channels for a specific server
  app.get("/api/channels/:guildId", checkAuth, checkOwner, async (req, res) => {
    const { guildId } = req.params;
    
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: "Servidor no encontrado" });
    }
    
    try {
      // Fetch all channels to ensure we have the latest data
      await guild.channels.fetch();
      
      // Get text channels and categories
      const channels = guild.channels.cache
        .filter(c => c.type === 0 || c.type === 4) // text channels and categories
        .map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
          parentId: c.parentId,
          position: c.position
        }))
        .sort((a, b) => {
          // Sort by type (categories first) then by position
          if (a.type !== b.type) return b.type - a.type;
          return a.position - b.position;
        });
      
      res.json({ channels });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get roles for a specific server
  app.get("/api/roles/:guildId", checkAuth, checkOwner, async (req, res) => {
    const { guildId } = req.params;
    
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: "Servidor no encontrado" });
    }
    
    try {
      const roles = guild.roles.cache
        .filter(r => r.id !== guild.id) // Exclude @everyone
        .map(r => ({
          id: r.id,
          name: r.name,
          color: r.color.hexString ? '#' + r.color.hexString : '#ffffff',
          position: r.position,
          managed: r.managed
        }))
        .sort((a, b) => b.position - a.position); // Sort by position (highest first)
      
      res.json({ roles });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Update settings for a specific server
  app.post("/api/settings/:guildId", checkAuth, checkOwner, async (req, res) => {
    const { guildId } = req.params;
    const updates = req.body;

    console.log("[API] POST /api/settings/:guildId recibido", {
      guildId,
      updates
    });
    
    // Verify bot is in this guild
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      console.warn("[API] Guild no encontrada para settings", { guildId });
      return res.status(404).json({ error: "Servidor no encontrado" });
    }
    
    try {
      const { settings } = require("./src/utils/database");
      
      // Validate and sanitize updates
      const allowedFields = [
        "log_channel", "transcript_channel", "dashboard_channel", 
        "weekly_report_channel", "panel_channel_id",
        "support_role", "admin_role", "verify_role",
        "max_tickets", "global_ticket_limit", "cooldown_minutes", "min_days",
        "auto_close_minutes", "sla_minutes", "smart_ping_minutes",
        "dm_on_open", "dm_on_close", "log_edits", "log_deletes",
        "maintenance_mode", "maintenance_reason"
      ];
      
      const sanitizedUpdates = {};
      for (const key of allowedFields) {
        if (updates[key] !== undefined) {
          sanitizedUpdates[key] = updates[key];
        }
      }

      console.log("[API] /api/settings sanitizedUpdates:", {
        guildId,
        sanitizedUpdates
      });
      
      const updatedSettings = await settings.update(guildId, sanitizedUpdates);

      console.log("[API] settings.update completado", {
        guildId,
        updatedSettings
      });

      // Aplicar inmediatamente la nueva configuración al dashboard en Discord
      try {
        console.log("[DASHBOARD] Forzando actualización de dashboard para guild", guildId);
        await forceUpdateDashboard(guildId);
        console.log("[DASHBOARD] Actualización de dashboard completada para guild", guildId);
      } catch (error) {
        console.error("[DASHBOARD] Error al forzar actualización después de guardar settings:", error?.message || error);
      }
      
      res.status(200).json({ success: true, message: "Configuración guardada", settings: updatedSettings });
    } catch (error) {
      console.error("[API] Error en POST /api/settings/:guildId:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // ==================== END API ROUTES ====================
  
  // Iniciar el servidor - Escuchar en 0.0.0.0 para Pterodactyl
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(chalk.green(`🌐 Servidor web iniciado en puerto ${PORT}`));
    console.log(chalk.blue(`   📊 Dashboard: http://localhost:${PORT}`));
    console.log(chalk.gray(`   🔗 Escuchando en: 0.0.0.0:${PORT}`));
  });
  
  // Guardar referencia del servidor para uso futuro
  client.httpServer = server;
}

// Iniciar el bot
startBot();
