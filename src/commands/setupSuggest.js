const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  MessageFlags,
} = require("discord.js");
const { suggestSettings } = require("../utils/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-suggest")
    .setDescription("⚙️ Configura el sistema de sugerencias")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("activar")
        .setDescription("Activa o desactiva el sistema de sugerencias")
        .addBooleanOption((option) =>
          option
            .setName("estado")
            .setDescription("True = activar, False = desactivar")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("canal")
        .setDescription("Define el canal donde se enviarán las sugerencias")
        .addChannelOption((option) =>
          option
            .setName("sugerencias")
            .setDescription("Canal de texto para las sugerencias")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const gid = interaction.guild.id;

    try {
      switch (subcommand) {
        case "activar": {
          const enabled = interaction.options.getBoolean("estado");

          await suggestSettings.update(gid, { enabled });

          const embed = new EmbedBuilder()
            .setColor(enabled ? 0x57f287 : 0xed4245)
            .setTitle(`✅ Sistema de Sugerencias ${enabled ? "Activado" : "Desactivado"}`)
            .setDescription(
              enabled
                ? "El sistema de sugerencias ahora está activo. Los usuarios pueden usar `/suggest` para enviar sugerencias."
                : "El sistema de sugerencias ha sido desactivado. Los usuarios no pueden enviar sugerencias."
            )
            .setTimestamp();

          return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        case "canal": {
          const channel = interaction.options.getChannel("sugerencias");

          await suggestSettings.update(gid, { channel: channel.id });

          const embed = new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle("✅ Canal de Sugerencias Configurado")
            .setDescription(`Las sugerencias ahora se enviarán a ${channel}.`)
            .setTimestamp();

          return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        default:
          return interaction.reply({
            content: "❌ Subcomando no reconocido.",
            flags: MessageFlags.Ephemeral,
          });
      }
    } catch (error) {
      console.error("[SETUP SUGGEST ERROR]", error);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle("❌ Error")
            .setDescription("Ocurrió un error al guardar la configuración.")
        ],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
