const { Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { resolveCommand } = require("../utils/commandUtils");
const E = require("../utils/embeds");
const { handleVerif } = require('../handlers/verifHandler');

// Cargar handlers dinámicamente
const buttons = new Collection();
const selects = new Collection();
const modals = new Collection();

// Función para cargar handlers
function loadHandlers() {
  // Cargar botones
  const buttonsPath = path.join(__dirname, "../interactions/buttons");
  if (fs.existsSync(buttonsPath)) {
    const buttonFiles = fs.readdirSync(buttonsPath).filter(file => file.endsWith(".js"));
    for (const file of buttonFiles) {
      const button = require(path.join(buttonsPath, file));
      buttons.set(button.customId, button);
    }
  }

  // Cargar selects
  const selectsPath = path.join(__dirname, "../interactions/selects");
  if (fs.existsSync(selectsPath)) {
    const selectFiles = fs.readdirSync(selectsPath).filter(file => file.endsWith(".js"));
    for (const file of selectFiles) {
      const select = require(path.join(selectsPath, file));
      selects.set(select.customId, select);
    }
  }

  // Cargar modals
  const modalsPath = path.join(__dirname, "../interactions/modals");
  if (fs.existsSync(modalsPath)) {
    const modalFiles = fs.readdirSync(modalsPath).filter(file => file.endsWith(".js"));
    for (const file of modalFiles) {
      const modal = require(path.join(modalsPath, file));
      modals.set(modal.customId, modal);
    }
  }
}

// Función para encontrar el handler adecuado
function findHandler(collection, customId) {
  // Buscar coincidencia exacta
  if (collection.has(customId)) {
    return collection.get(customId);
  }
  
  // Buscar por prefijo (para IDs dinámicos como "ticket_close_123456")
  return Array.from(collection.entries()).find(([key, _]) => {
    // Si la key termina con * es un wildcard
    if (key.endsWith("*")) {
      const prefix = key.slice(0, -1);
      return customId.startsWith(prefix);
    }
    return false;
  })?.[1];
}

module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    try {
      // Cargar handlers si no se han cargado
      if (buttons.size === 0 && selects.size === 0 && modals.size === 0) {
        loadHandlers();
      }

      // Manejar comandos
      if (interaction.isChatInputCommand()) {
        const cmd = resolveCommand(interaction.commandName, client);
        if (cmd) {
          
          await cmd.execute(interaction, client);
        }
        return;
      }

      // Manejar autocompletado
      if (interaction.isAutocomplete()) {
        const cmd = resolveCommand(interaction.commandName, client);
        if (cmd?.autocomplete) await cmd.autocomplete(interaction);
        return;
      }

      // Manejar botones
      if (interaction.isButton()) {
        if (interaction.customId.startsWith('verify_')) { await handleVerif(interaction); return; }
        const handler = findHandler(buttons, interaction.customId);
        if (handler) {
          await handler.execute(interaction, client);
          return;
        }
      }

      // Manejar selects
      if (interaction.isStringSelectMenu()) {
        const handler = findHandler(selects, interaction.customId);
        if (handler) {
          await handler.execute(interaction, client);
          return;
        }
      }

      // Manejar modals
      if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('verify_')) { await handleVerif(interaction); return; }
        const handler = findHandler(modals, interaction.customId);
        if (handler) {
          await handler.execute(interaction, client);
          return;
        }
      }

    } catch (err) {
      console.error("[INTERACTION ERROR]", err);
      const payload = { embeds: [E.errorEmbed("Ocurrió un error inesperado.")], flags: 64 };
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
      else await interaction.reply(payload).catch(() => {});
    }
  },
};
