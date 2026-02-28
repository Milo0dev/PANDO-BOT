const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require("discord.js");
const { suggestions, suggestSettings } = require("../../utils/database");
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

// ── Construir el embed de una sugerencia con título y descripción
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

// ── Handler del Modal de Sugerencias
module.exports = {
  customId: "suggest_modal",

  async execute(interaction, client) {
    // Deferir la respuesta para ganar tiempo antes de operaciones pesadas
    await interaction.deferReply({ flags: 64 });

    try {
      const gid = interaction.guild.id;
      const ss = await suggestSettings.get(gid);
      
      // Obtener los datos del modal
      const title = interaction.fields.getTextInputValue("suggest_title")?.trim() || "";
      const description = interaction.fields.getTextInputValue("suggest_description")?.trim() || "";

      // Validar que al menos tenga algo
      if (!title && !description) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle("❌ Datos Inválidos")
              .setDescription("Debes proporcionar al menos un título o descripción para tu sugerencia.")
          ],
          flags: 64 // Ephemeral
        });
      }

      // Verificar que el sistema esté activado
      if (!ss?.enabled) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle("❌ Sistema Desactivado")
              .setDescription(
                "El sistema de sugerencias no está activado en este servidor.\nContacta a un administrador para activarlo."
              ),
          ],
          flags: 64
        });
      }

      // Verificar canal configurado
      const targetChannelId = ss?.channel || interaction.channel.id;
      const ch = interaction.guild.channels.cache.get(targetChannelId);
      if (!ch) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle("❌ Error de Configuración")
              .setDescription(
                "No se encontró el canal de sugerencias configurado.\nContacta a un administrador."
              ),
          ],
          flags: 64
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
          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xfee75c)
                .setTitle("⏱️ Cooldown Activo")
                .setDescription(
                  `Debes esperar **${remaining} minutos** antes de enviar otra sugerencia.`
                ),
            ],
            flags: 64
          });
        }
      }

      // Enviar mensaje placeholder para obtener ID
      const placeholder = await ch.send({
        content: "⏳ Creando sugerencia..."
      });

      // Crear en base de datos con título y descripción
      const sug = await suggestions.createWithDetails(
        gid,
        interaction.user.id,
        title,
        description,
        placeholder.id,
        ch.id
      );

      // Construir embed y botones
      const embed = buildSuggestEmbed(sug, interaction.guild, ss?.anonymous);
      const components = buildButtons(sug._id.toString(), sug.status, false);

      // Editar mensaje con el embed completo
      await placeholder.edit({
        content: null,
        embeds: [embed],
        components: components,
      });

      // ── CREAR HILO DE DEBATE AUTOMÁTICO ──
      let threadId = null;
      try {
        const threadName = `Debate: ${title ? title.substring(0, 40) : `Sugerencia #${sug.num}`}`;
        
        // Usar startThread que crea un hilo público
        const thread = await placeholder.startThread({
          name: threadName,
          autoArchiveDuration: 1440, // 24 horas
          type: ChannelType.PublicThread,
          reason: `Hilo de debate para sugerencia #${sug.num}`
        });
        
        threadId = thread.id;
        
        // Guardar el thread_id en la base de datos
        await suggestions.collection().updateOne(
          { _id: sug._id },
          { $set: { thread_id: threadId } }
        );
        
        // Enviar mensaje inicial en el hilo
        await thread.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865f2)
              .setTitle("💬 Debate: Sugerencia #" + sug.num)
              .setDescription(title ? `**${title}**\n\n${description || "(Sin descripción)"}` : `> ${description}`)
              .setFooter({ text: "Usa este hilo para discutir esta sugerencia" })
              .setTimestamp()
          ]
        });
      } catch (threadError) {
        console.error("[SUGGEST THREAD ERROR]", threadError.message);
        // No fallar si el hilo no se puede crear (puede ser por permisos)
      }

      // Responder al usuario
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle("✅ Sugerencia Enviada")
            .setDescription(
              `Tu sugerencia **#${sug.num}** ha sido publicada en ${ch}.\n\n${title ? `**${title}**\n` : ""}${description ? `> ${description.substring(0, 200)}${description.length > 200 ? "..." : ""}` : ""}`
            )
            .setFooter({ text: "¡Gracias por tu aporte!" })
            .setTimestamp(),
        ],
        flags: 64
      });

    } catch (error) {
      console.error("[SUGGEST MODAL ERROR]", error);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle("❌ Error")
            .setDescription("Ocurrió un error al procesar tu sugerencia. Por favor, intenta de nuevo.")
        ],
        flags: 64
      });
    }
  }
};
