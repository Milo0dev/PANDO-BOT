const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} = require("discord.js");
const { tags } = require("../utils/database");
const E = require("../utils/embeds");

// Configuración de colores
const Colors = {
  PRIMARY: 0x5865F2,
  SUCCESS: 0x57F287,
  ERROR: 0xED4245,
  WARNING: 0xFEE75C,
  INFO: 0x3498DB,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("tag")
    .setDescription("📝 Sistema de respuestas rápidas (shortcuts)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)

    // Subcomando: enviar un tag
    .addSubcommand((sub) =>
      sub
        .setName("enviar")
        .setDescription("Envía una respuesta rápida al canal")
        .addStringOption((opt) =>
          opt
            .setName("nombre")
            .setDescription("Nombre del tag a enviar")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )

    // Subcomando: crear un tag
    .addSubcommand((sub) =>
      sub
        .setName("crear")
        .setDescription("Crea una nueva respuesta rápida")
        .addStringOption((opt) =>
          opt
            .setName("nombre")
            .setDescription("Nombre único para el tag")
            .setRequired(true)
            .setMaxLength(50)
        )
    )

    // Subcomando: listar todos los tags
    .addSubcommand((sub) =>
      sub.setName("lista").setDescription("Muestra todos los tags del servidor")
    )

    // Subcomando: eliminar un tag
    .addSubcommand((sub) =>
      sub
        .setName("borrar")
        .setDescription("Elimina una respuesta rápida")
        .addStringOption((opt) =>
          opt
            .setName("nombre")
            .setDescription("Nombre del tag a eliminar")
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  // Función de autocomplete
  async autocomplete(interaction) {
    try {
      const guildId = interaction.guild.id;
      const focusedValue = interaction.options.getFocused();

      // Obtener todos los tags del servidor
      const allTags = await tags.getAll(guildId);

      // Filtrar tags que coincidan con lo que el usuario está escribiendo
      const filtered = allTags.filter((tag) =>
        tag.name.toLowerCase().includes(focusedValue.toLowerCase())
      );

      // Limitar a 25 opciones (límite de Discord)
      const options = filtered.slice(0, 25).map((tag) => ({
        name: `${tag.name} (${tag.uses} usos)`,
        value: tag.name,
      }));

      // Responder con las opciones
      await interaction.respond(options);
    } catch (error) {
      console.error("[TAG AUTOCOMPLETE ERROR]", error);
      // Responder con array vacío en caso de error
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const er = (msg) =>
      interaction.reply({ embeds: [E.errorEmbed(msg)], flags: MessageFlags.Ephemeral });
    const ok = (msg) =>
      interaction.reply({ embeds: [E.successEmbed(msg)], flags: MessageFlags.Ephemeral });

    // ─────────────────────────────────────────────
    // SUBCOMANDO: ENVIAR
    // ─────────────────────────────────────────────
    if (subcommand === "enviar") {
      const name = interaction.options.getString("nombre");

      try {
        // Buscar el tag en la base de datos
        const tag = await tags.get(guildId, name);

        if (!tag) {
          return er(`No encontré el tag **${name}**. Usa \`/tag lista\` para ver los disponibles.`);
        }

        // Crear embed elegante para el tag
        const embed = new EmbedBuilder()
          .setColor(Colors.PRIMARY)
          .setTitle(`📝 ${tag.name}`)
          .setDescription(tag.content)
          .setFooter({
            text: `Tag usado ${tag.uses + 1} veces`,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
          })
          .setTimestamp();

        // Enviar el tag al canal
        await interaction.reply({ embeds: [embed] });

        // Incrementar contador de usos
        await tags.use(guildId, name);
      } catch (error) {
        console.error("[TAG SEND ERROR]", error);
        return er("Ocurrió un error al enviar el tag.");
      }
    }

    // ─────────────────────────────────────────────
    // SUBCOMANDO: CREAR
    // ─────────────────────────────────────────────
    if (subcommand === "crear") {
      const name = interaction.options.getString("nombre");

      // Verificar si ya existe
      const existing = await tags.get(guildId, name);
      if (existing) {
        return er(`Ya existe un tag llamado **${name}**. Usa \`/tag borrar\` para eliminarlo primero.`);
      }

      // Crear modal para el contenido
      const modal = new ModalBuilder()
        .setCustomId(`tag_create_${name}`)
        .setTitle(`➕ Crear Tag: ${name}`);

      // Input para el contenido
      const contentInput = new TextInputBuilder()
        .setCustomId("tag_content")
        .setLabel("Contenido del tag")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(2000)
        .setPlaceholder("Escribe el contenido de tu respuesta rápida...");

      const actionRow = new ActionRowBuilder().addComponents(contentInput);
      modal.addComponents(actionRow);

      // Mostrar el modal
      return interaction.showModal(modal);
    }

    // ─────────────────────────────────────────────
    // SUBCOMANDO: LISTA
    // ─────────────────────────────────────────────
    if (subcommand === "lista") {
      try {
        const allTags = await tags.getAll(guildId);

        if (allTags.length === 0) {
          return er("No hay ningún tag creado en este servidor.");
        }

        // Crear embed con la lista de tags
        const embed = new EmbedBuilder()
          .setColor(Colors.INFO)
          .setTitle("📝 Lista de Respuestas Rápidas")
          .setDescription(
            `Total de tags: **${allTags.length}**\n\n` +
              allTags
                .map(
                  (tag, index) =>
                    `**${index + 1}.** \`${tag.name}\` — ${tag.uses} usos`
                )
                .join("\n")
          )
          .setFooter({
            text: `Servidor: ${interaction.guild.name}`,
            iconURL: interaction.guild.iconURL({ dynamic: true }),
          })
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      } catch (error) {
        console.error("[TAG LIST ERROR]", error);
        return er("Ocurrió un error al obtener la lista de tags.");
      }
    }

    // ─────────────────────────────────────────────
    // SUBCOMANDO: BORRAR
    // ─────────────────────────────────────────────
    if (subcommand === "borrar") {
      const name = interaction.options.getString("nombre");

      try {
        // Verificar si existe
        const existing = await tags.get(guildId, name);
        if (!existing) {
          return er(`No encontré el tag **${name}**.`);
        }

        // Confirmar eliminación
        const embed = new EmbedBuilder()
          .setColor(Colors.WARNING)
          .setTitle("🗑️ Confirmar eliminación")
          .setDescription(
            `¿Estás seguro de eliminar el tag **${name}**?\n\n` +
              `📄 **Contenido:**\n${existing.content.substring(0, 500)}`
          )
          .setFooter({
            text: "Esta acción no se puede deshacer",
            iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
          });

        // Crear botones de confirmación
        const { ButtonBuilder, ButtonStyle } = require("discord.js");
        const confirmBtn = new ButtonBuilder()
          .setCustomId(`tag_delete_confirm_${name}`)
          .setLabel("✅ Eliminar")
          .setStyle(ButtonStyle.Danger);
        const cancelBtn = new ButtonBuilder()
          .setCustomId("tag_delete_cancel")
          .setLabel("❌ Cancelar")
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

        return interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
      } catch (error) {
        console.error("[TAG DELETE ERROR]", error);
        return er("Ocurrió un error al eliminar el tag.");
      }
    }
  },
};

// ─────────────────────────────────────────────────────
// HANDLER PARA MODALES DE TAG
// ─────────────────────────────────────────────────────
async function handleTagModal(interaction) {
  const { customId } = interaction;

  // Modal de crear tag
  if (customId.startsWith("tag_create_")) {
    const name = customId.replace("tag_create_", "");
    const content = interaction.fields.getTextInputValue("tag_content").trim();

    if (!content) {
      return interaction.reply({
        embeds: [E.errorEmbed("El contenido no puede estar vacío.")],
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      // Verificar si ya existe
      const existing = await tags.get(interaction.guild.id, name);
      if (existing) {
        return interaction.reply({
          embeds: [E.errorEmbed("Ya existe un tag con ese nombre.")],
          flags: MessageFlags.Ephemeral,
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

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } catch (error) {
      console.error("[TAG CREATE MODAL ERROR]", error);
      return interaction.reply({
        embeds: [E.errorEmbed("Ocurrió un error al crear el tag.")],
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

// Exportar handler del modal
module.exports.handleTagModal = handleTagModal;
