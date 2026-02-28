const { EmbedBuilder, MessageFlags } = require("discord.js");
const { tags } = require("../../utils/database");
const E = require("../../utils/embeds");

// Configuración de colores
const Colors = {
  SUCCESS: 0x57F287,
  ERROR: 0xED4245,
};

// ── Handler del Modal de Crear Tag
module.exports = {
  customId: "tag_create_*",

  async execute(interaction, client) {
    // Deferir la respuesta para ganar tiempo antes de operaciones con la base de datos
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const { customId } = interaction;
      const name = customId.replace("tag_create_", "");
      const content = interaction.fields.getTextInputValue("tag_content").trim();

      if (!content) {
        return interaction.editReply({
          embeds: [E.errorEmbed("El contenido no puede estar vacío.")],
        });
      }

      // Verificar si ya existe
      const existing = await tags.get(interaction.guild.id, name);
      if (existing) {
        return interaction.editReply({
          embeds: [E.errorEmbed("Ya existe un tag con ese nombre.")],
        });
      }

      // Crear el tag
      await tags.create(interaction.guild.id, name, content, interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(Colors.SUCCESS)
        .setTitle("✅ Tag creado")
        .setDescription(
          `El tag **${name}** ha sido creado correctamente.\n\n` +
            `📄 **Contenido:**\n${content.substring(0, 1000)}${content.length > 1000 ? "..." : ""}`
        )
        .setFooter({
          text: `Creado por ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
        })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("[TAG CREATE MODAL ERROR]", error);
      return interaction.editReply({
        embeds: [E.errorEmbed("Ocurrió un error al crear el tag.")],
      });
    }
  },
};
