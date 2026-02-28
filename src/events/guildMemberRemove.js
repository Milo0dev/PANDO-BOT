const {
  EmbedBuilder,
  AttachmentBuilder,
} = require("discord.js");
const { createCanvas, loadImage } = require("canvas");
const { welcomeSettings, modlogSettings } = require("../utils/database");

module.exports = {
  name: "guildMemberRemove",
  async execute(member, client) {
    const guild = member.guild;
    try {
      // Obtener configuración de despedidas
      const ws = await welcomeSettings.get(guild.id);

      // Verificar si el sistema de despedidas está activo
      if (!ws || !ws.goodbye_enabled || !ws.goodbye_channel) return;

      // Obtener el canal de despedida
      const ch = guild.channels.cache.get(ws.goodbye_channel);

      // Verificar que el canal existe
      if (!ch) return;

      // Verificar permisos del bot
      const botPermissions = ch.permissionsFor(guild.members.me);
      if (!botPermissions.has("SendMessages") || !botPermissions.has("AttachFiles")) {
        return console.log(`[GOODBYE] No tengo permisos en el canal ${ch.id}`);
      }

      // Generar imagen de despedida
      try {
        const goodbyeImage = await generateGoodbyeImage(member);
        const attachment = new AttachmentBuilder(goodbyeImage, { name: "goodbye.png" });

        // Crear embed con la imagen
        const color = parseInt(ws.goodbye_color || "ED4245", 16);
        const embed = new EmbedBuilder()
          .setColor(color)
          .setTitle(fill(ws.goodbye_title || "👋 ¡Hasta luego!", member, guild))
          .setDescription(fill(ws.goodbye_message || "¡Lamentamos verte partir **{user}**! Esperamos verte pronto.", member, guild))
          .setImage("attachment://goodbye.png")
          .setTimestamp();

        if (ws.goodbye_footer) {
          embed.setFooter({
            text: fill(ws.goodbye_footer, member, guild),
            iconURL: guild.iconURL({ dynamic: true })
          });
        }

        await ch.send({ embeds: [embed], files: [attachment] }).catch(() => {});
      } catch (canvasError) {
        console.error("[CANVAS ERROR - GOODBYE]", canvasError);
        // Fallback: enviar embed normal sin imagen
        const color = parseInt(ws.goodbye_color || "ED4245", 16);
        const embed = new EmbedBuilder()
          .setColor(color)
          .setTitle(fill(ws.goodbye_title || "👋 ¡Hasta luego!", member, guild))
          .setDescription(fill(ws.goodbye_message, member, guild))
          .setTimestamp();

        if (ws.goodbye_thumbnail !== false) embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }));
        if (ws.goodbye_footer) embed.setFooter({ text: fill(ws.goodbye_footer, member, guild), iconURL: guild.iconURL({ dynamic: true }) });

        const roles = member.roles.cache
          .filter(r => r.id !== guild.id)
          .sort((a, b) => b.position - a.position)
          .map(r => `<@&${r.id}>`)
          .slice(0, 5).join(", ") || "Ninguno";

        embed.addFields(
          { name: "👤 Usuario", value: `${member.user.tag}`, inline: true },
          { name: "🆔 ID", value: `\`${member.id}\``, inline: true },
          { name: "📅 Se unió", value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "?", inline: true },
          { name: "👥 Quedamos", value: `\`${guild.memberCount}\` miembros`, inline: true },
          { name: "🏷️ Tenía roles", value: roles, inline: false },
        );

        await ch.send({ embeds: [embed] }).catch(() => {});
      }

      // ── MODLOG DE SALIDA ──
      const ml = await modlogSettings.get(guild.id);
      if (ml && ml.enabled && ml.log_leaves && ml.channel) {
        const logCh = guild.channels.cache.get(ml.channel);
        if (logCh) {
          const roles = member.roles.cache
            .filter(r => r.id !== guild.id)
            .sort((a, b) => b.position - a.position)
            .map(r => `<@&${r.id}>`).slice(0, 5).join(", ") || "Ninguno";
          await logCh.send({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setTitle("📤 Miembro Salió")
              .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
              .addFields(
                { name: "👤 Usuario", value: `${member.user.tag} <@${member.id}>`, inline: true },
                { name: "📅 Se unió", value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "?", inline: true },
                { name: "👥 Quedamos", value: String(guild.memberCount), inline: true },
                { name: "🏷️ Tenía roles", value: roles, inline: false },
              )
              .setFooter({ text: `ID: ${member.id}` })
              .setTimestamp()],
          }).catch(() => {});
        }
      }

    } catch (err) {
      console.error("[MEMBER REMOVE]", err.message);
    }
  },
};

/**
 * Genera una imagen de despedida visual usando Canvas
 * @param {GuildMember} member - El miembro que salió
 * @returns {Buffer} - Buffer de la imagen PNG generada
 */
async function generateGoodbyeImage(member) {
  // Dimensiones del canvas
  const canvas = createCanvas(700, 250);
  const ctx = canvas.getContext("2d");

  // ═══ FONDO ═══
  ctx.fillStyle = "#23272A";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ═══ AVATAR ═══
  const avatarSize = 150;
  const avatarX = canvas.width / 2;
  const avatarY = canvas.height / 2 - 20;

  // Cargar avatar del usuario
  const avatarURL = member.user.displayAvatarURL({
    extension: "png",
    size: 256,
    forceStatic: false
  });

  try {
    const avatar = await loadImage(avatarURL);

    // Dibujar avatar con裁剪 circular
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Dibujar avatar centrado
    ctx.drawImage(avatar, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
    ctx.restore();

    // Borde circular del avatar
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 4;
    ctx.stroke();

  } catch (avatarError) {
    // Si falla la carga del avatar, dibujar un círculo con iniciales
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#ED4245";
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 60px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const initials = member.user.username.slice(0, 2).toUpperCase();
    ctx.fillText(initials, avatarX, avatarY);
  }

  // ═══ TEXTOS ═══
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";

  // "¡Hasta luego!" - arriba del avatar
  ctx.font = "bold 40px Arial, sans-serif";
  ctx.fillText("¡Hasta luego!", canvas.width / 2, 45);

  // Nombre de usuario - debajo del avatar
  ctx.font = "30px Arial, sans-serif";
  let username = member.user.username;
  if (username.length > 17) {
    username = username.slice(0, 14) + "...";
  }
  ctx.fillText(username, canvas.width / 2, canvas.height - 45);

  // Footer - cerca de la parte inferior
  ctx.font = "20px Arial, sans-serif";
  ctx.fillStyle = "#AAAAAA";
  ctx.fillText("Espero verte pronto.", canvas.width / 2, canvas.height - 15);

  // Retornar buffer PNG
  return canvas.toBuffer("image/png");
}

function fill(text, member, guild) {
  if (!text) return "";
  return text
    .replace(/{mention}/g, `<@${member.id}>`)
    .replace(/{user}/g, member.user.username)
    .replace(/{tag}/g, member.user.tag)
    .replace(/{server}/g, guild.name)
    .replace(/{count}/g, String(guild.memberCount))
    .replace(/{id}/g, member.id);
}
