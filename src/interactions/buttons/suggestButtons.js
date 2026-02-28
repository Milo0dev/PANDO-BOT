const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");
const { suggestions, suggestSettings } = require("../../utils/database");

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

// ── Construir el embed actualizado
function buildSuggestEmbed(sug, guild, anonymous = false) {
  const up = sug.upvotes?.length || 0;
  const down = sug.downvotes?.length || 0;
  const total = up + down;
  const pct = total > 0 ? Math.round((up / total) * 100) : 0;
  const barLen = 12;
  const filled = Math.round((pct / 100) * barLen);
  const bar = "🟢".repeat(filled) + "⚫".repeat(barLen - filled);

  const embed = new EmbedBuilder()
    .setColor(STATUS_COLOR[sug.status] || 0x5865f2)
    .setTitle(`${STATUS_EMOJI[sug.status]} Sugerencia #${sug.num}`)
    .setDescription(`> ${sug.text}`)
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
    .setTimestamp();

  if (sug.staff_comment && sug.status !== "pending") {
    embed.addFields({
      name: `💬 Comentario del staff`,
      value: sug.staff_comment,
      inline: false,
    });
  }

  if (sug.reviewed_by && sug.status !== "pending") {
    embed.setFooter({
      text: `Revisada por ${sug.reviewed_by} • ${STATUS_LABEL[sug.status]}`,
    });
  } else {
    embed.setFooter({ text: `Estado: ${STATUS_LABEL[sug.status]}` });
  }

  // Avatar del autor si no es anónimo
  if (!anonymous && sug.user_id) {
    const member = guild.members.cache.get(sug.user_id);
    if (member) {
      embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
    }
  }

  return embed;
}

// ── Construir botones (habilitados o deshabilitados)
function buildButtons(sugId, status, isAdmin = false) {
  const disabled = status !== "pending";

  // Fila 1: Votos (para todos)
  const voteRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`sug_up_${sugId}`)
      .setLabel("👍 Upvote")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`sug_down_${sugId}`)
      .setLabel("👎 Downvote")
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

// ── Handler principal con wildcard para capturar sug_*_{id}
module.exports = {
  customId: "sug_*",

  async execute(interaction, client) {
    const customId = interaction.customId;
    const [action, sugId] = customId.split("_").slice(1);

    if (!sugId || !["up", "down", "approve", "reject"].includes(action)) {
      return interaction.reply({
        content: "❌ Interacción no válida.",
        ephemeral: true,
      });
    }

    try {
      // Obtener la sugerencia de la base de datos
      const suggestion = await suggestions.collection().findOne({
        _id: require("mongodb").ObjectId.createFromHexString(sugId),
      });

      if (!suggestion) {
        return interaction.reply({
          content: "❌ Esta sugerencia ya no existe.",
          ephemeral: true,
        });
      }

      const ss = await suggestSettings.get(interaction.guild.id);
      const isAdmin = interaction.member.permissions.has(
        PermissionFlagsBits.ManageMessages
      );

      // ─────────────────── VOTOS ───────────────────
      if (action === "up" || action === "down") {
        if (suggestion.status !== "pending") {
          return interaction.reply({
            content: "❌ Esta sugerencia ya fue revisada y no admite más votos.",
            ephemeral: true,
          });
        }

        // Registrar voto
        const updated = await suggestions.vote(sugId, interaction.user.id, action);
        if (!updated) {
          return interaction.reply({
            content: "❌ Error al registrar tu voto.",
            ephemeral: true,
          });
        }

        // Actualizar el mensaje
        const embed = buildSuggestEmbed(updated, interaction.guild, ss?.anonymous);
        const components = buildButtons(sugId, updated.status, isAdmin);

        await interaction.message.edit({ embeds: [embed], components });
        return interaction.reply({
          content: `✅ Tu voto ha sido registrado. (${action === "up" ? "👍" : "👎"})`,
          ephemeral: true,
        });
      }

      // ─────────────────── ADMIN: APROBAR/RECHAZAR ───────────────────
      if (action === "approve" || action === "reject") {
        if (!isAdmin) {
          return interaction.reply({
            content: "❌ Necesitas permisos de **Gestionar Mensajes** para revisar sugerencias.",
            ephemeral: true,
          });
        }

        if (suggestion.status !== "pending") {
          return interaction.reply({
            content: `❌ Esta sugerencia ya fue ${STATUS_LABEL[suggestion.status]}.`,
            ephemeral: true,
          });
        }

        const newStatus = action === "approve" ? "approved" : "rejected";

        // Actualizar estado en BD
        await suggestions.setStatus(
          sugId,
          newStatus,
          interaction.user.tag,
          null
        );

        // Obtener datos actualizados
        const updated = await suggestions.collection().findOne({
          _id: require("mongodb").ObjectId.createFromHexString(sugId),
        });

        // Actualizar embed y desactivar botones
        const embed = buildSuggestEmbed(updated, interaction.guild, ss?.anonymous);
        const components = buildButtons(sugId, updated.status, false); // false = sin botones de admin

        await interaction.message.edit({ embeds: [embed], components });

        // ── Mover al canal correspondiente si está configurado ──
        const targetChId =
          newStatus === "approved"
            ? ss?.approved_channel
            : newStatus === "rejected"
            ? ss?.rejected_channel
            : null;

        if (targetChId) {
          const targetCh = interaction.guild.channels.cache.get(targetChId);
          if (targetCh) {
            await targetCh
              .send({ embeds: [buildSuggestEmbed(updated, interaction.guild, ss?.anonymous)] })
              .catch(() => {});
          }
        }

        // ── DM al autor ──
        if (ss?.dm_on_result && updated.user_id) {
          const author = await interaction.client.users
            .fetch(updated.user_id)
            .catch(() => null);
          if (author) {
            const dmColor =
              newStatus === "approved" ? 0x57f287 : 0xed4245;
            const dmEmbed = new EmbedBuilder()
              .setColor(dmColor)
              .setTitle(
                `${STATUS_EMOJI[newStatus]} Tu sugerencia fue ${
                  STATUS_LABEL[newStatus].split(" ")[1]
                }`
              )
              .setDescription(
                `Tu sugerencia **#${updated.num}** en **${interaction.guild.name}** fue revisada.`
              )
              .addFields({
                name: "📝 Tu sugerencia",
                value: updated.text.substring(0, 500),
                inline: false,
              })
              .setTimestamp();

            await author.send({ embeds: [dmEmbed] }).catch(() => {});
          }
        }

        return interaction.reply({
          content: `✅ Sugerencia **#${updated.num}** marcada como **${STATUS_LABEL[newStatus]}**.`,
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("[SUGGEST BUTTON ERROR]", error);
      return interaction.reply({
        content: "❌ Ocurrió un error al procesar la interacción.",
        ephemeral: true,
      });
    }
  },
};
