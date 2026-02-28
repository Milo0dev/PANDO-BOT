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
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("anonimo")
        .setDescription("Configura si las sugerencias son anónimas")
        .addBooleanOption((option) =>
          option
            .setName("estado")
            .setDescription("True = anónimo, False = mostrar autor")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("cooldown")
        .setDescription("Configura el cooldown entre sugerencias (en minutos)")
        .addIntegerOption((option) =>
          option
            .setName("minutos")
            .setDescription("Minutos de espera entre sugerencias")
            .setMinValue(0)
            .setMaxValue(1440)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("config")
        .setDescription("Muestra la configuración actual del sistema de sugerencias")
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const gid = interaction.guild.id;

    try {
      // Obtener configuración actual
      const ss = await suggestSettings.get(gid);

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

        case "anonimo": {
          const anonymous = interaction.options.getBoolean("estado");

          await suggestSettings.update(gid, { anonymous });

          const embed = new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle("✅ Configuración de Anonimato Actualizada")
            .setDescription(
              anonymous
                ? "Las sugerencias ahora serán **anónimas**. El autor no será mostrado en el embed."
                : "Las sugerencias ahora **mostrarán el autor**. El usuario será mencionado en el embed."
            )
            .setTimestamp();

          return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        case "cooldown": {
          const minutes = interaction.options.getInteger("minutos");

          await suggestSettings.update(gid, { cooldown_minutes: minutes });

          const embed = new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle("✅ Cooldown Configurado")
            .setDescription(
              minutes > 0
                ? `Los usuarios deben esperar **${minutes} minuto(s)** entre sugerencias.`
                : "El cooldown ha sido **desactivado**. Los usuarios pueden enviar sugerencias sin esperar."
            )
            .setTimestamp();

          return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        case "config": {
          const channel = ss?.channel
            ? interaction.guild.channels.cache.get(ss.channel)
            : null;

          const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle("⚙️ Configuración del Sistema de Sugerencias")
            .addFields(
              {
                name: "📌 Estado",
                value: ss?.enabled ? "🟢 Activado" : "🔴 Desactivado",
                inline: true,
              },
              {
                name: "📝 Canal",
                value: channel ? `${channel}` : "❌ No configurado",
                inline: true,
              },
              {
                name: "🔒 Anónimo",
                value: ss?.anonymous ? "✅ Sí" : "❌ No",
                inline: true,
              },
              {
                name: "⏱️ Cooldown",
                value: ss?.cooldown_minutes > 0 ? `${ss.cooldown_minutes} minutos` : "Sin cooldown",
                inline: true,
              },
              {
                name: "📨 DM al Autor",
                value: ss?.dm_on_result ? "✅ Sí" : "❌ No",
                inline: true,
              }
            )
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
