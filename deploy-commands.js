require("dotenv").config();
const { REST, Routes } = require("discord.js");
const chalk = require("chalk");

const setup   = require("./src/commands/setup");
const ticket  = require("./src/commands/ticket");
const admin   = require("./src/commands/admin");
const staff   = require("./src/commands/staff");
const welcome = require("./src/commands/welcome");
const verify  = require("./src/commands/verify");

const commands = [
  setup,
  ticket.close, ticket.reopen, ticket.claim, ticket.unclaim,
  ticket.assign, ticket.add, ticket.remove, ticket.rename,
  ticket.priority, ticket.move, ticket.note, ticket.transcript,
  ticket.info, ticket.history,
  admin.stats, admin.blacklist, admin.tag, admin.autoresponse,
  admin.maintenance, admin.closeAll, admin.lockdown,
  staff.away, staff.staffList, staff.refreshDashboard, staff.myTickets,
  welcome, verify,
].map(c => c.data.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(chalk.yellow(`\n⏳ Registrando ${commands.length} comandos slash...\n`));

    if (process.env.GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
      console.log(chalk.green(`✅ Comandos registrados en el servidor instantáneamente.`));
    } else {
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
      console.log(chalk.green("✅ Comandos registrados globalmente (puede tardar hasta 1 hora)."));
    }

    console.log(chalk.blue(`\n📋 Comandos registrados (${commands.length}):`));
    commands.forEach(c => console.log(chalk.gray(`   /${c.name}`)));
    console.log(chalk.green("\n🚀 Ahora ejecuta: node index.js\n"));
  } catch (err) {
    console.error(chalk.red("❌ Error:"), err.message);
    process.exit(1);
  }
})();
