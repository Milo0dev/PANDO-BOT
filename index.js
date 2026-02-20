require("dotenv").config();
const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");
const chalk = require("chalk");
const fs    = require("fs");
const path  = require("path");

// ── Cliente
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
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
const music = require("./src/commands/music");

const allCommands = [
  setup,
  ticket.close, ticket.reopen, ticket.claim, ticket.unclaim,
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
  music.clear, music.volume, music.loop
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

// ── Manejo de errores global
process.on("unhandledRejection", err => console.error(chalk.red("[ERROR]"), err?.message || err));
process.on("uncaughtException",  err => console.error(chalk.red("[EXCEPTION]"), err?.message || err));
client.on("error", err => console.error(chalk.red("[CLIENT ERROR]"), err?.message));

process.removeAllListeners("warning"); // <--- Esta es la línea mágica que borra la regla original
process.on("warning", (warning) => {
  // Ocultar la advertencia inofensiva de los milisegundos negativos
  if (warning.name === "TimeoutNegativeWarning") return; 
  console.warn(warning);
});

// ── Banner
console.log(chalk.blue(`
╔══════════════════════════════════════════╗
║                                          ║
║    🎫  DISCORD TICKET BOT  v1.5  🎫     ║
║         Sistema Profesional Completo     ║
║                                          ║
╚══════════════════════════════════════════╝
`));

// ── Iniciar
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error(chalk.red("\n❌ Error al iniciar:"), err.message);
  console.error(chalk.yellow("💡 Verifica que DISCORD_TOKEN en .env sea correcto.\n"));
  process.exit(1);
});
