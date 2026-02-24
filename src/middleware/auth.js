const axios = require("axios");
const chalk = require("chalk");

// ================================================
//        CONFIGURACIÓN DE AUTENTICACIÓN
// ================================================

const config = {
  // URLs de Discord OAuth2
  discord: {
    authorizeUrl: "https://discord.com/api/oauth2/authorize",
    tokenUrl: "https://discord.com/api/oauth2/token",
    apiUrl: "https://discord.com/api/users/@me",
  },
  
  // Permisos solicitados (identify = básica)
  // scope: "identify" te da acceso a /users/@me
  scope: "identify",
  
  // Scopes opcionales que puedes añadir:
  // - guilds: lista de servidores del usuario
  // - guilds.members.read: miembros de servidores
  // - email: correo electrónico (requiere verificar email)
};

// ================================================
//        MIDDLEWARE DE SESIONES
// ================================================

function setupSession(app) {
  const session = require("express-session");
  
  app.use(session({
    secret: process.env.SESSION_SECRET || "cambia-esto-en-produccion",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // true en producción (HTTPS)
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
      httpOnly: true,
    },
  }));
  
  console.log(chalk.cyan("✅ Sesiones configuradas"));
}

// ================================================
//        RUTAS DE AUTENTICACIÓN
// ================================================

function setupAuthRoutes(app) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  const ownerId = process.env.DISCORD_OWNER_ID;
  
  // Verificar configuración
  if (!clientId || !clientSecret || !redirectUri || !ownerId) {
    console.warn(chalk.yellow("⚠️  Configuración OAuth incompleta. Revisa las variables de entorno."));
  }
  
  // ─────────────────────────────────────────────
  // GET /login - Redirigir a Discord
  // ─────────────────────────────────────────────
  app.get("/login", (req, res) => {
    if (!clientId) {
      return res.status(500).send("Error: DISCORD_CLIENT_ID no configurado");
    }
    
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: config.scope,
    });
    
    const authUrl = `${config.discord.authorizeUrl}?${params.toString()}`;
    res.redirect(authUrl);
  });
  
  // ─────────────────────────────────────────────
  // GET /callback - Procesar código de OAuth
  // ─────────────────────────────────────────────
  app.get("/callback", async (req, res) => {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).send("Código de autorización no proporcionado");
    }
    
    try {
      // 1. Intercambiar código por token
      const tokenResponse = await axios.post(
        config.discord.tokenUrl,
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code: code,
          redirect_uri: redirectUri,
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      
      const accessToken = tokenResponse.data.access_token;
      
      // 2. Obtener datos del usuario
      const userResponse = await axios.get(config.discord.apiUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      
      const user = userResponse.data;
      
      // 3. Verificar si es el owner (DUEÑO)
      if (user.id !== ownerId) {
        // No es el owner - acceso denegado
        console.log(chalk.red(`❌ Acceso denegado: ${user.username} (${user.id}) intentò acceder`));
        return res.status(403).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Acceso Denegado</title>
            <style>
              body { 
                font-family: 'Segoe UI', sans-serif; 
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #fff;
              }
              .container { text-align: center; padding: 40px; }
              .error { font-size: 4em; margin-bottom: 20px; }
              h1 { color: #ed4245; margin-bottom: 10px; }
              p { color: #99aab5; }
              a { color: #7289da; text-decoration: none; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="error">🚫</div>
              <h1>Acceso Denegado</h1>
              <p>No tienes permisos para acceder a esta dashboard.</p>
              <p>Solo el propietario del bot puede acceder.</p>
              <br>
              <a href="/">← Volver</a>
            </div>
          </body>
          </html>
        `);
      }
      
      // 4. Es el owner - guardar en sesión
      req.session.user = {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        avatar: user.avatar,
        global_name: user.global_name,
      };
      
      console.log(chalk.green(`✅ Owner autenticado: ${user.username}#${user.discriminator}`));
      
      // 5. Redirigir al dashboard
      res.redirect("/");
      
    } catch (error) {
      console.error(chalk.red("❌ Error en OAuth:"), error.message);
      res.status(500).send("Error durante la autenticación");
    }
  });
  
  // ─────────────────────────────────────────────
  // GET /logout - Cerrar sesión
  // ─────────────────────────────────────────────
  app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error(chalk.red("❌ Error al cerrar sesión:"), err.message);
      }
      res.redirect("/");
    });
  });
  
  console.log(chalk.cyan("✅ Rutas de autenticación configuradas"));
}

// ================================================
//        MIDDLEWARE DE PROTECCIÓN
// ================================================

// Verificar si el usuario ha iniciado sesión
function checkAuth(req, res, next) {
  // Ignorar rutas de autenticación
  const publicPaths = ["/login", "/callback", "/logout", "/health"];
  if (publicPaths.includes(req.path)) {
    return next();
  }
  
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect("/login");
}

// Verificar si es el owner (doble verificación)
function checkOwner(req, res, next) {
  const ownerId = process.env.DISCORD_OWNER_ID;
  
  if (req.session && req.session.user && req.session.user.id === ownerId) {
    return next();
  }
  
  res.status(403).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Acceso Denegado</title>
      <style>
        body { 
          font-family: 'Segoe UI', sans-serif; 
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }
        .container { text-align: center; padding: 40px; }
        .error { font-size: 4em; margin-bottom: 20px; }
        h1 { color: #ed4245; margin-bottom: 10px; }
        a { color: #7289da; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="error">🚫</div>
        <h1>Acceso Denegado</h1>
        <p>No tienes permisos para acceder a esta sección.</p>
        <br>
        <a href="/">← Volver</a>
      </div>
    </body>
    </html>
  `);
}

// Hacer disponible el usuario en todas las vistas
function injectUser(req, res, next) {
  res.locals.user = req.session ? req.session.user : null;
  next();
}

module.exports = {
  setupSession,
  setupAuthRoutes,
  checkAuth,
  checkOwner,
  injectUser,
};
