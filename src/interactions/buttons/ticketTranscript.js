const { generateTranscript } = require("../../utils/transcript");
const { tickets } = require("../../utils/database");
module.exports = {
  customId: "ticket_transcript",
  async execute(interaction, client) {
    await interaction.deferReply({ flags: 64 });
    const ticket = await tickets.get(interaction.channel.id);
    const { attachment } = await generateTranscript(interaction.channel, ticket, interaction.guild);
    await interaction.editReply({ content: "📄 Aquí tienes la transcripción manual del ticket:", files: [attachment] });
  }
};
