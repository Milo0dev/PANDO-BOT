const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require("discord.js");
const { suggestSettings, suggestions } = require("../utils/database");
const { ObjectId } = require("mongodb");

// ── Colores por estado
const STATUS_COLOR = {
  pending: 0x5865f2,
  approved: 0x57f287,
  rejected: 0xed4245,
};
const STATUS_LABEL = {
  pending: "⏳ Pendiente",
  approved: "✅ Aprobada",
  rejected: "❌ Rechazada",
};
const STATUS_EMOJI = {
  pending: "⏳",
  approved: "✅",
  rejected: "❌",
};

// ── Construir el embed de una sugerencia
function buildSuggestEmbed(sug, guild, anonymous = false) {
  const up = sug.upvotes?.length || 0;
  const down = sug.downvotes?.length || 0;
  const total = up + down;
  const pct = total > 0 ? Math.round((up / total) * 100) : 0;
  const barLen = 12;
  const filled = Math.round((pct / 100) * barLen);
  const bar = "🟢".repeat(filled) + "⚫".repeat(barLen - filled);

  // Construir descripción con título y detalles
  let description = "";
  if (sug.title) {
    description += `**${sug.title}**\n\n`;
  }
  if (sug.description) {
    description += `> ${sug.description}`;
  }
  // Fallback para sugerencias antiguas que solo tienen "text"
  if (!sug.title && !sug.description && sug.text) {
    description = `> ${sug.text}`;
  }

  const embed = new EmbedBuilder()
    .setColor(STATUS_COLOR[sug.status] || 0x5865f2)
    .setTitle(`${STATUS_EMOJI[sug.status]} Sugerencia #${sug.num}`)
    .setDescription(description || "> (Sin descripción)")
    .addFields(
      {
        name: "👤 Autor",
        value: anonymous || !sug.user_id ? "Anónimo" : `<@${sug.user_id}>`,
        inline: true,
      },
      {
        name: "📋 Estado",
        value: STATUS_LABEL[sug.status] || sug.status,
        inline: true,
      },
      {
        name: "📅 Enviada",
        value: `<t:${Math.floor(new Date(sug.created_at).getTime() / 1000)}:R>`,
        inline: true,
      },
      {
        name: `👍 ${up}  •  👎 ${down}  •  ${pct}% aprobación`,
        value: bar,
        inline: false,
      }
    )
    .setFooter({ text: `Estado: ${STATUS_LABEL[sug.status]}` })
    .setTimestamp();

  // Avatar del autor si no es anónimo
  if (!anonymous && sug.user_id) {
    const member = guild.members.cache.get(sug.user_id);
    if (member) {
      embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
    }
  }

  return embed;
}

// ── Construir botones
function buildButtons(sugId, status, isAdmin = false) {
  const disabled = status !== "pending";

  // Fila 1: Votos (para todos)
  const voteRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`sug_up_${sugId}`)
      .setLabel("👍 Votar a Favor")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`sug_down_${sugId}`)
      .setLabel("👎 Votar en Contra")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );

  // Fila 2: Admin (solo si es admin y está pendiente)
  if (isAdmin && status === "pending") {
    const adminRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`sug_approve_${sugId}`)
        .setLabel("✅ Aprobar")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`sug_reject_${sugId}`)
        .setLabel("❌ Rechazar")
        .setStyle(ButtonStyle.Secondary)
    );
    return [voteRow, adminRow];
  }

  return [voteRow];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("suggest")
    .setDescription("💡 Envía una sugerencia para el servidor"),

  buildSuggestEmbed,
  buildButtons,

  async execute(interaction) {
    const gid = interaction.guild.id;
    const ss = await suggestSettings.get(gid);
    const isAdmin = interaction.member.permissions.has(
      PermissionFlagsBits.ManageMessages
    );

    // Verificar que el sistema esté activado
    if (!ss?.enabled) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle("❌ Sistema Desactivado")
            .setDescription(
              "El sistema de sugerencias no está activado en este servidor.\nContacta a un administrador para activarlo."
            ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    // Verificar canal configurado
    const targetChannelId = ss?.channel || interaction.channel.id;
    const ch = interaction.guild.channels.cache.get(targetChannelId);
    if (!ch) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle("❌ Error de Configuración")
            .setDescription(
              "No se encontró el canal de sugerencias configurado.\nContacta a un administrador."
            ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    // Verificar cooldown
    if (ss?.cooldown_minutes > 0) {
      const recentSug = await suggestions.collection().findOne(
        {
          guild_id: gid,
          user_id: interaction.user.id,
          created_at: {
            $gte: new Date(Date.now() - ss.cooldown_minutes * 60000).toISOString(),
          },
        },
        { sort: { created_at: -1 } }
      );

      if (recentSug) {
        const minutesAgo = Math.floor(
          (Date.now() - new Date(recentSug.created_at).getTime()) / 60000
        );
        const remaining = ss.cooldown_minutes - minutesAgo;
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xfee75c)
              .setTitle("⏱️ Cooldown Activo")
              .setDescription(
                `Debes esperar **${remaining} minutos** antes de enviar otra sugerencia.`
              ),
          ],
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    // ── MOSTRAR MODAL CON TÍTULO Y DESCRIPCIÓN ──
    const modal = new ModalBuilder()
      .setCustomId("suggest_modal")
      .setTitle("💡 Nueva Sugerencia");

    // Campo 1: Título de la sugerencia
    const titleInput = new TextInputBuilder()
      .setCustomId("suggest_title")
      .setLabel("Título de la sugerencia")
      .setPlaceholder("Ej: Añadir un canal de música")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(200);

    // Campo 2: Descripción detallada
    const descriptionInput = new TextInputBuilder()
      .setCustomId("suggest_description")
      .setLabel("Descripción detallada")
      .setPlaceholder("Explica tu idea con más detalle...")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(2000);

    // Añadir filas al modal
    const titleRow = new ActionRowBuilder().addComponents(titleInput);
    const descRow = new ActionRowBuilder().addComponents(descriptionInput);
    modal.addComponents(titleRow, descRow);

    // Mostrar el modal al usuario
    return interaction.showModal(modal);
  },
};
