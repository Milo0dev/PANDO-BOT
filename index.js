require("dotenv").config();
const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");
const chalk = require("chalk");
const fs    = require("fs");
const path  = require("path");
const http = require('http');

const port = process.env.SERVER_PORT || process.env.PORT || 8080;

// Eliminamos la variable host y usamos '0.0.0.0' directamente
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Online\n');
}).listen(port, '0.0.0.0', () => {
    console.log(`🟢 Servidor web sincronizado con Holy.gg en el puerto ${port}`);
});

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
  const { startDashboardAutoUpdate } = require("./src/handlers/dashboardHandler");
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

// Función para registrar comandos de slash (solo nuevos o modificados)
async function registrarComandos(client) {
  try {
    console.log(chalk.yellow("📝 Verificando comandos de slash..."));
    
    const commands = [];
    
    // Recoger todos los comandos del código local
    for (const [name, cmd] of client.commands) {
      if (cmd.data) {
        commands.push(cmd.data);
      }
    }
    
    // Obtener comandos ya registrados en Discord
    const comandosRegistrados = await client.application.commands.fetch();
    
    // Crear mapas para comparar
    const comandosLocales = new Map(commands.map(c => [c.name, c]));
    const comandosExistentes = new Map(comandosRegistrados.map(c => [c.name, c]));
    
    // Comandos a registrar (nuevos o modificados)
    const comandosParaRegistrar = [];
    const comandosEliminados = [];
    
    // Verificar comandos locales
    for (const [nombre, cmdLocal] of comandosLocales) {
      const cmdExistente = comandosExistentes.get(nombre);
      
      if (!cmdExistente) {
        // Comando nuevo - registrar
        comandosParaRegistrar.push(cmdLocal);
        console.log(chalk.gray(`   + Nuevo: /${nombre}`));
      } else {
        // Verificar si fue modificado (comparar description y options)
        const localStr = JSON.stringify(cmdLocal);
        const existenteStr = JSON.stringify({
          name: cmdExistente.name,
          description: cmdExistente.description,
          options: cmdExistente.options
        });
        
        if (localStr !== existenteStr) {
          // Comando modificado - actualizar
          comandosParaRegistrar.push(cmdLocal);
          console.log(chalk.cyan(`   ~ Modificado: /${nombre}`));
        }
      }
    }
    
    // Verificar comandos eliminados (existen en Discord pero no en código)
    for (const [nombre] of comandosExistentes) {
      if (!comandosLocales.has(nombre)) {
        comandosEliminados.push(nombre);
        console.log(chalk.red(`   - Eliminado: /${nombre}`));
      }
    }
    
    // Registrar comandos nuevos/modificados
    if (comandosParaRegistrar.length > 0) {
      // Usar set para comandos nuevos (mantiene los existentes)
      for (const cmd of comandosParaRegistrar) {
        await client.application.commands.create(cmd);
      }
      console.log(chalk.green(`✅ ${comandosParaRegistrar.length} comandos actualizados`));
    }
    
    if (comandosEliminados.length > 0) {
      console.log(chalk.yellow(`⚠️ ${comandosEliminados.length} comandos eliminados del código (no se eliminan de Discord automáticamente)`));
    }
    
    if (comandosParaRegistrar.length === 0 && comandosEliminados.length === 0) {
      console.log(chalk.blue("   ✓ No hay cambios en los comandos"));
    }
    
    console.log(chalk.blue("🎉 Verificación de comandos completada!\n"));
    
  } catch (error) {
    console.error(chalk.red("❌ Error al registrar comandos:"), error.message);
  }
}

// Iniciar el bot
startBot();
