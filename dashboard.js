require("dotenv").config();
const express = require("express");
const path = require("path");
const chalk = require("chalk");

// Middleware de autenticación
const { setupSession, setupAuthRoutes, checkAuth, checkOwner, injectUser } = require("./src/middleware/auth");

// Handlers de dashboard
const { updateTicketPanel } = require("./src/handlers/dashboardHandler");

// ── Conectar a MongoDB
const { connectDB, settings } = require("./src/utils/database");

async function startDashboard() {
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
  
// Ruta principal - Dashboard (PROTEGIDA)
app.get("/", checkAuth, checkOwner, async (req, res) => {
  try {
    const { settings } = require("./src/utils/database");
    const db = require("./src/utils/database").getDB();
    
    // Consultar la colección botStats buscando id: "main"
    const botStats = await db.collection("botStats").findOne({ id: "main" });
    
    // Obtenemos todos los servidores guardados en la base de datos de MongoDB
    const allServers = await settings.collection().find({}).toArray();
    
    // Calculamos el tiempo activo del panel web
    const uptimeSeconds = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const uptime = `${hours}h ${minutes}m`;

    // Convertir el uptime del bot (si existe) de segundos a formato horas y minutos
    let botUptime = "Cargando...";
    if (botStats && botStats.uptime) {
      const botUptimeHours = Math.floor(botStats.uptime / 3600);
      const botUptimeMinutes = Math.floor((botStats.uptime % 3600) / 60);
      botUptime = `${botUptimeHours}h ${botUptimeMinutes}m`;
    }

    // AQUI ESTÁ LA VARIABLE "datos" QUE FALTABA
    const datos = {
      botName: botStats?.botName || "Pando Bot",
      botAvatar: botStats?.botAvatar || "https://cdn.discordapp.com/embed/avatars/0.png",
      serverCount: botStats?.serverCount || allServers.length || 0,
      userCount: botStats?.userCount || "Activo",
      ping: botStats?.ping || 0,
      uptime: botStats?.uptime ? botUptime : uptime,
      user: req.session.user
    };
    
    res.render("dashboard", datos);
  } catch (error) {
    console.error("Error en la ruta principal:", error);
    res.status(500).send("Error interno al cargar la dashboard");
  }
});
  
  // Ruta de health check (para Pterodactyl) - PÚBLICA
  app.get("/health", async (req, res) => {
    try {
      const allSettings = await settings.getAll();
      res.json({ 
        status: "ok", 
        bot: process.env.BOT_NAME || "Pando Bot",
        servers: allSettings.length
      });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  });
  
  // ==================== API ROUTES ====================
  
  // Get list of servers the bot is in
  app.get("/api/servers", checkAuth, checkOwner, async (req, res) => {
    try {
      // Obtener datos de servidores desde MongoDB en lugar de client.guilds.cache
      const allSettings = await settings.getAll();
      
      // Mapear los datos de configuración a un formato similar al anterior
      const servers = allSettings.map(setting => ({
        id: setting.guild_id,
        name: setting.guild_name || `Servidor ${setting.guild_id}`,
        icon: setting.guild_icon || null,
        memberCount: "N/A" // No tenemos acceso a esta información sin el cliente de Discord
      }));
      
      res.json(servers);
    } catch (error) {
      console.error("Error al obtener servidores:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get settings for a specific server
  app.get("/api/settings/:guildId", checkAuth, checkOwner, async (req, res) => {
    const { guildId } = req.params;
    
    try {
      // Obtener configuración del servidor desde MongoDB
      const s = await settings.get(guildId);
      
      if (!s) {
        return res.status(404).json({ error: "Servidor no encontrado" });
      }
      
      res.json({
        guild: {
          id: guildId,
          name: s.guild_name || `Servidor ${guildId}`,
          icon: s.guild_icon || null
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
    
    try {
      // Obtener configuración del servidor desde MongoDB
      const s = await settings.get(guildId);
      
      if (!s) {
        return res.status(404).json({ error: "Servidor no encontrado" });
      }
      
      // Si tenemos canales almacenados en la configuración, los devolvemos
      // De lo contrario, devolvemos un array vacío
      const channels = s.channels || [];
      
      res.json({ channels });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get roles for a specific server
  app.get("/api/roles/:guildId", checkAuth, checkOwner, async (req, res) => {
    const { guildId } = req.params;
    
    try {
      // Obtener configuración del servidor desde MongoDB
      const s = await settings.get(guildId);
      
      if (!s) {
        return res.status(404).json({ error: "Servidor no encontrado" });
      }
      
      // Si tenemos roles almacenados en la configuración, los devolvemos
      // De lo contrario, devolvemos un array vacío
      const roles = s.roles || [];
      
      res.json({ roles });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Update settings for a specific server
  app.post("/api/settings/:guildId", checkAuth, checkOwner, async (req, res) => {
    const { guildId } = req.params;
    const updates = req.body;
    
    try {
      // Verificar si el servidor existe en la base de datos
      const existingSettings = await settings.get(guildId);
      
      if (!existingSettings) {
        console.warn("[API] Guild no encontrada para settings", { guildId });
        return res.status(404).json({ error: "Servidor no encontrado" });
      }
      
      // Validate and sanitize updates
      const allowedFields = [
        "log_channel", "logsChannelId", "transcript_channel", "dashboard_channel", 
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
      
      // Actualizar la configuración en la base de datos
      const updatedSettings = await settings.update(guildId, sanitizedUpdates);
      console.log("[DB] Configuración actualizada en base de datos para guild", guildId);
      
      // Insertar documento en pending_updates para que el bot lo procese
      const db = require("./src/utils/database").getDB();
      await db.collection("pending_updates").insertOne({
        guild_id: guildId,
        action: "update_settings",
        created_at: new Date()
      });
      console.log("[DB] Documento insertado en pending_updates para guild", guildId);
      
      // Responder al cliente
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
}

// Iniciar el dashboard
startDashboard();
