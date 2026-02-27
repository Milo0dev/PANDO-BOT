const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const { settings } = require("../utils/database");
const E = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-tickets")
    .setDescription("🎫 Enviar el panel de tickets al canal configurado en el Dashboard")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const gid = interaction.guild.id;
    const s   = await settings.get(gid);

    // ── 1. Validar que el canal de tickets esté configurado
    if (!s.panel_channel_id) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(E.Colors.ERROR)
            .setTitle("❌ Canal no configurado")
            .setDescription(
              "No hay un canal de tickets configurado para este servidor.\n\n" +
              "**¿Cómo configurarlo?**\n" +
              "▸ Ve al **Dashboard web** y configura el canal de tickets.\n" +
              "▸ O usa `/setup panel #canal` para configurarlo desde Discord."
            )
            .setTimestamp(),
        ],
      });
    }

    // ── 2. Obtener el canal de Discord
    const channel = interaction.guild.channels.cache.get(s.panel_channel_id);
    if (!channel) {
      return interaction.editReply({
        embeds: [
          E.errorEmbed(
            `El canal configurado (<#${s.panel_channel_id}>) no existe o no es accesible.\n\n` +
            "Reconfigura el canal desde el **Dashboard** o con `/setup panel #canal`."
          ),
        ],
      });
    }

    // ── 3. Verificar permisos del bot en el canal
    const botMember      = interaction.guild.members.me;
    const permsInChannel = channel.permissionsFor(botMember);
    if (
      !permsInChannel.has(PermissionFlagsBits.ViewChannel) ||
      !permsInChannel.has(PermissionFlagsBits.SendMessages) ||
      !permsInChannel.has(PermissionFlagsBits.EmbedLinks)
    ) {
      return interaction.editReply({
        embeds: [
          E.errorEmbed(
            `No tengo los permisos necesarios en ${channel}.\n\n` +
            "Asegúrate de que el bot tenga:\n" +
            "▸ **Ver Canal**\n" +
            "▸ **Enviar Mensajes**\n" +
            "▸ **Insertar enlaces**"
          ),
        ],
      });
    }

    // ── 4. Construir el embed elegante del panel
    const embed = new EmbedBuilder()
      .setTitle("🎫 Centro de Soporte")
      .setDescription(
        "¿Necesitas ayuda o tienes algún problema? ¡Estamos aquí para ayudarte!\n\n" +
        "Haz clic en el botón de abajo para **abrir un ticket privado** con nuestro equipo de soporte.\n\n" +
        "**📋 Antes de abrir un ticket:**\n" +
        "▸ Describe tu problema con el mayor detalle posible.\n" +
        "▸ Adjunta capturas de pantalla si es necesario.\n" +
        "▸ Sé respetuoso con el equipo de soporte.\n\n" +
        "**🕐 Tiempo de respuesta:**\n" +
        "Nuestro equipo te atenderá lo antes posible."
      )
      .setColor(0x5865F2)
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setFooter({
        text: `${interaction.guild.name} • Sistema de Soporte`,
        iconURL: interaction.guild.iconURL({ dynamic: true }),
      })
      .setTimestamp();

    // ── 5. Botón azul "🎫 Crear Ticket"
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_open_simple")
        .setLabel("Crear Ticket")
        .setEmoji("🎫")
        .setStyle(ButtonStyle.Primary)
    );

    // ── 6. Enviar el panel al canal configurado
    try {
      const msg = await channel.send({ embeds: [embed], components: [row] });

      // Guardar el ID del mensaje del panel en la DB
      await settings.update(gid, { panel_message_id: msg.id });

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(E.Colors.SUCCESS)
            .setTitle("✅ Panel enviado correctamente")
            .setDescription(
              `El panel de tickets ha sido enviado a ${channel}.\n\n` +
              `Los usuarios pueden hacer clic en **🎫 Crear Ticket** para abrir un ticket privado.\n\n` +
              (s.support_role
                ? `👥 Rol de soporte activo: <@&${s.support_role}>`
                : "⚠️ **Nota:** No hay un rol de soporte configurado.\n" +
                  "Configúralo en el Dashboard o con `/setup staff-role @rol`.")
            )
            .setTimestamp(),
        ],
      });
    } catch (err) {
      console.error("[SETUP-TICKETS ERROR]", err);
      return interaction.editReply({
        embeds: [
          E.errorEmbed(
            "Error al enviar el panel de tickets.\n\n" +
            "Verifica que el bot tenga permisos para enviar mensajes en el canal configurado."
          ),
        ],
      });
    }
  },
};
