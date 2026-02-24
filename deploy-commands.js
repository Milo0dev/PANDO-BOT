require("dotenv").config();
const { Client, GatewayIntentBits, REST, Routes } = require("discord.js");
const chalk = require("chalk");

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
const economy = require("./src/commands/economy");
const games   = require("./src/commands/games");
const giveaway = require("./src/commands/giveaway");

// Recoger todos los comandos igual que en index.js
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
  economy.balance, economy.daily, economy.pay, economy.deposit, economy.withdraw,
  economy.shop, economy.buy, economy.work, economy.gamble, economy.leaderboard,
  games.ahorcado, games.ttt, games.trivia,
  giveaway.create
];

const commands = allCommands.map(c => c.data);

// Crear cliente temporal solo para acceder a application.commands
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("ready", async () => {
  try {
    console.log(chalk.yellow(`\n⏳ Registrando ${commands.length} comandos slash...\n`));

    // 🔧 LIMPIEZA EXPLICITA: Eliminar TODOS los comandos existentes primero
    // Esto asegura que no queden duplicados ni comandos huérfanos
    console.log(chalk.gray("   🧹 Limpiando comandos existentes..."));
    
    if (process.env.GUILD_ID) {
      // Por servidor (guild) - primero obtener el guild
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      if (!guild) {
        console.error(chalk.red("❌ No se pudo encontrar el servidor con ese GUILD_ID"));
        process.exit(1);
      }
      
      // Obtener comandos existentes del guild
      const comandosRegistrados = await guild.commands.fetch();
      
      if (comandosRegistrados.size > 0) {
        // Eliminar cada comando individualmente para asegurar limpieza total
        for (const [, cmd] of comandosRegistrados) {
          try {
            await guild.commands.delete(cmd.id);
          } catch (e) {
            // Ignorar errores al eliminar (puede ser que ya fue eliminado)
          }
        }
        console.log(chalk.gray(`   🗑️ ${comandosRegistrados.size} comandos antiguos eliminados`));
      }
      
      // Registrar los comandos limpio (sin duplicados)
      await guild.commands.set(commands);
      console.log(chalk.green(`✅ Comandos registrados en el servidor ${guild.name} (duplicados eliminados)`));
    } else {
      // Global - obtener comandos existentes
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
      
      // Registrar los comandos limpio (sin duplicados)
      await client.application.commands.set(commands);
      console.log(chalk.green("✅ Comandos registrados globalmente (duplicados eliminados)"));
    }

    console.log(chalk.blue(`\n📋 Comandos registrados (${commands.length}):`));
    commands.forEach(c => console.log(chalk.gray(`   /${c.name}`)));
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
