const handleMusicButtons = require('../../handlers/musicButtonHandler');

module.exports = {
  customId: "music_*", // El * indica que es un wildcard para cualquier ID que empiece con "music_"
  async execute(interaction, client) {
    await handleMusicButtons(interaction);
  }
};
