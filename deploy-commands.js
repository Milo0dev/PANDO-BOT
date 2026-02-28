require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const chalk = require("chalk");

// 1. Importamos todos tus comandos
const setup        = require("./src/commands/setup");
const setupTickets = require("./src/commands/setupTickets"); // <--- AÑADIMOS EL NUEVO COMANDO
const staffRanking = require("./src/commands/staffRanking");
const ticket       = require("./src/commands/ticket");
const admin        = require("./src/commands/admin");
const staff        = require("./src/commands/staff");
const welcome      = require("./src/commands/welcome");
const verify       = require("./src/commands/verify");
const help         = require("./src/commands/help");
const poll         = require("./src/commands/poll");
const embed        = require("./src/commands/embed");
const suggest      = require("./src/commands/suggest");
const remind       = require("./src/commands/remind");
const rank         = require("./src/commands/rank");
const levels       = require("./src/commands/levels");
const modlogs      = require("./src/commands/modlogs");
const music        = require("./src/commands/music");
const ping         = require("./src/commands/ping");
const debug        = require("./src/commands/debug");
const economy      = require("./src/commands/economy");
const games        = require("./src/commands/games");
const giveaway     = require("./src/commands/giveaway");

// 2. Metemos los comandos en la lista maestra
const allCommands = [
  setup, setupTickets, ping, debug, staffRanking,
  ticket, // <--- AHORA ES UN SOLO COMANDO MAESTRO
  admin.stats, admin.blacklist, admin.tag, admin.autoresponse,
  admin.maintenance, admin.closeAll, admin.lockdown,
  staff.away, staff.staffList, staff.refreshDashboard, staff.myTickets,
  welcome, verify, help,
  poll, embed, suggest, remind, rank, levels, modlogs,
  music,   // <--- AHORA ES UN SOLO COMANDO MAESTRO
  economy, // <--- AHORA ES UN SOLO COMANDO MAESTRO
  games,   // <--- AHORA ES UN SOLO COMANDO MAESTRO
  giveaway.create
];

const commands = allCommands.map(c => c.data);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("clientReady", async () => {
  try {
    console.log(chalk.yellow(`\n⏳ Registrando ${commands.length} comandos slash...\n`));

    // El método .set() reemplaza todo limpiamente en 1 segundo sin causar pausas (Rate Limits)
    if (process.env.GUILD_ID) {
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      await guild.commands.set(commands);
      console.log(chalk.green(`✅ Comandos sincronizados en el servidor ${guild.name}`));
    } else {
      await client.application.commands.set(commands);
      console.log(chalk.green("✅ Comandos sincronizados globalmente"));
    }

    console.log(chalk.blue(`\n📋 Comandos registrados (${commands.length}):`));
    console.log(chalk.green("\n🚀 Deployment completado!\n"));
    
    client.destroy();
    process.exit(0);
  } catch (err) {
    console.error(chalk.red("❌ Error:"), err.message);
    client.destroy();
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error(chalk.red("❌ Error al iniciar sesión:"), err.message);
  process.exit(1);
});