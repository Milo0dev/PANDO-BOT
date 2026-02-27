const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");

const { settings } = require("../utils/database");
const E = require("../utils/embeds");
const { categories } = require("../../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-tickets")
    .setDescription("🎫 Configura el sistema premium de tickets en el canal designado")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const gid = interaction.guild.id;
    const s = await settings.get(gid);

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
    const botMember = interaction.guild.members.me;
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

    // ── 4. Construir el embed premium del panel
    const embed = new EmbedBuilder()
      .setAuthor({ 
        name: interaction.guild.name, 
        iconURL: interaction.guild.iconURL({ dynamic: true }) 
      })
      .setTitle("🌟 SOPORTE")
      .setDescription(
        "Bienvenido a nuestro sistema de asistencia personalizada. Estamos aquí para ayudarte con cualquier consulta o problema que puedas tener.\n\n" +
        "**¿Cómo podemos ayudarte hoy?**\n" +
        "Selecciona la categoría que mejor se adapte a tu consulta en el menú desplegable a continuación."
      )
      .addFields(
        { 
          name: "📋 Antes de abrir un ticket", 
          value: "• Revisa nuestras **FAQ** para soluciones rápidas\n" +
                 "• Prepara capturas de pantalla si son necesarias\n" +
                 "• Describe tu problema con el mayor detalle posible", 
          inline: false 
        },
        { 
          name: "⏱️ Tiempo de respuesta", 
          value: "Nuestro equipo de soporte está disponible y responderá a tu ticket lo antes posible.", 
          inline: false 
        },
        { 
          name: "🔒 Privacidad garantizada", 
          value: "Tu ticket será visible únicamente para ti y nuestro equipo de soporte.", 
          inline: false 
        }
      )
      .setColor(0x5865F2)
      // BANNER PERSONALIZABLE - Descomenta la siguiente línea y añade tu URL
      .setImage("https://media.discordapp.net/attachments/756736685387022417/1477017203378225182/PANDOBOT_TICKET.PNG?ex=69a33af6&is=69a1e976&hm=d0e7ada6689e3ea4a8f81c2bbb701b0904c42f8d06e9b1d7de1eba4f59d8ced6&=&format=webp&quality=lossless&width=1211&height=429") // PON TU URL AQUÍ - Banner recomendado: 1500x300px
      .setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 256 }))
      .setFooter({
        text: `${interaction.guild.name} • Sistema Premium de Soporte`,
        iconURL: interaction.guild.iconURL({ dynamic: true }),
      })
      .setTimestamp();

    // ── 5. Crear el menú de categorías
    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_category_select")
      .setPlaceholder("✨ Selecciona una categoría de soporte...")
      .addOptions(categories.map(c => ({
        label: c.label,
        description: c.description?.substring(0, 100) || "Selecciona esta categoría para recibir ayuda",
        value: c.id,
        emoji: c.emoji,
      })));

    // ── 6. Botón alternativo para crear ticket (opcional)
    const button = new ButtonBuilder()
      .setCustomId("create_ticket")
      .setLabel("Crear Ticket")
      .setEmoji("🎫")
      .setStyle(ButtonStyle.Primary);

    // ── 7. Enviar el panel al canal configurado
    try {
      // Primero enviamos el menú de selección
      const msg = await channel.send({ 
        embeds: [embed], 
        components: [
          new ActionRowBuilder().addComponents(menu),
          new ActionRowBuilder().addComponents(button)
        ] 
      });

      // Guardar el ID del mensaje del panel en la DB
      await settings.update(gid, { panel_message_id: msg.id });

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(E.Colors.SUCCESS)
            .setTitle("✅ Panel Premium configurado correctamente")
            .setDescription(
              `El panel de tickets ha sido enviado a ${channel}.\n\n` +
              `Los usuarios pueden seleccionar una categoría para abrir un ticket privado.\n\n` +
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
