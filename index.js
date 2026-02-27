require("dotenv").config();
const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");
const chalk   = require("chalk");
const fs      = require("fs");
const path    = require("path");

// Limpieza de música (solo tareas del bot)
const { startOrphanCleanup } = require("./src/handlers/musicHandler");

// ── Conectar a MongoDB
const { connectDB } = require("./src/utils/database");

async function startBot() {
  try {
    console.log(chalk.yellow("🔄 Conectando a MongoDB..."));
    await connectDB();
    console.log(chalk.green("✅ MongoDB conectado correctamente\n"));
  } catch (error) {
    console.error(chalk.red("❌ Error fatal: No se pudo conectar a MongoDB"));
    process.exit(1);
  }

  // ── Cliente de Discord
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildPresences,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
  });

  client.commands = new Collection();

  // ── Cargar comandos dinámicamente
  function loadCommands(dir) {
    const commandFiles = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of commandFiles) {
      const filePath = path.join(dir, file.name);
      if (file.isDirectory()) {
        loadCommands(filePath);
      } else if (file.name.endsWith('.js')) {
        const command = require(filePath);
        if (command?.data) {
          client.commands.set(command.data.name, command);
        }
        for (const key in command) {
          if (command[key]?.data) {
            client.commands.set(command[key].data.name, command[key]);
          }
        }
      }
    }
  }
  loadCommands(path.join(__dirname, "src/commands"));

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

  // Tareas de mantenimiento de música
  startOrphanCleanup(client);

  // ── Manejo de errores global
  process.on("unhandledRejection", err => console.error(chalk.red("[ERROR]"), err?.message || err));
  process.on("uncaughtException",  err => console.error(chalk.red("[EXCEPTION]"), err?.message || err));
  client.on("error", err => console.error(chalk.red("[CLIENT ERROR]"), err?.message));

  console.log(chalk.blue(`
╔══════════════════════════════════════════╗
║        🐼  PANDO BOT (DISCORD)           ║
║      Ejecutándose Independiente           ║
╚══════════════════════════════════════════╝
`));

  // ── Iniciar sesión en Discord
  client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error(chalk.red("\n❌ Error al iniciar:"), err.message);
    console.error(chalk.yellow("💡 Verifica que DISCORD_TOKEN en .env sea correcto.\n"));
    process.exit(1);
  });
}

// Función para registrar comandos de slash
async function registrarComandos(client) {
  try {
    console.log(chalk.yellow("📝 Registrando comandos de slash..."));
    const commands = [];
    for (const [name, cmd] of client.commands) {
      if (cmd.data) {
        commands.push(cmd.data);
      }
    }
    await client.application.commands.set(commands);
    console.log(chalk.green(`✅ ${commands.length} comandos registrados correctamente.`));
  } catch (error) {
    console.error(chalk.red("❌ Error al registrar comandos:"), error.message);
  }
}

// Iniciar el bot
startBot();