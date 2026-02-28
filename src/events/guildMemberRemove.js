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
      const ws = await welcomeSettings.get(guild.id);

      // ── DESPEDIDA CON IMAGEN CANVAS ──
      if (ws?.goodbye_enabled && ws?.goodbye_channel) {
        const ch = guild.channels.cache.get(ws.goodbye_channel);
        if (ch) {
          // Verificar permisos del bot
          if (!ch.permissionsFor(guild.members.me).has(["SendMessages", "AttachFiles"])) {
            return console.log(`[GOODBYE] No tengo permisos en el canal ${ch.id}`);
          }

          try {
            // Generar imagen de despedida
            const goodbyeImage = await generateGoodbyeImage(member, guild);
            const attachment = new AttachmentBuilder(goodbyeImage, { name: "goodbye.png" });

            // Crear embed con la imagen
            const color = parseInt(ws.goodbye_color || "ED4245", 16);
            const embed = new EmbedBuilder()
              .setColor(color)
              .setTitle(fill(ws.goodbye_title || "👋 ¡Adiós!", member, guild))
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
              .setTitle(fill(ws.goodbye_title || "👋 ¡Adiós!", member, guild))
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
        }
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
 * Genera una imagen de despedida visual usando Canvas (Idéntico a bienvenida pero rojo)
 * @param {GuildMember} member - El miembro que salió
 * @param {Guild} guild - El servidor
 * @returns {Buffer} - Buffer de la imagen PNG generada
 */
async function generateGoodbyeImage(member, guild) {
  // Dimensiones IGUALES al de bienvenida
  const width = 1024;
  const height = 512;
  
  // Crear canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  
  // ── FONDO ──
  // Crear gradiente oscuro (Igual al de bienvenida)
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#23272A"); // Color Discord oscuro
  gradient.addColorStop(0.5, "#2C2F33");
  gradient.addColorStop(1, "#23272A");
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Borde decorativo (Color Rojo Discord en lugar de Blurple)
  ctx.strokeStyle = "#ED4245";
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, width - 8, height - 8);
  
  // ── AVATAR ──
  // Cargar avatar del usuario
  const avatarURL = member.user.displayAvatarURL({ 
    extension: "png", 
    size: 256,
    forceStatic: false 
  });
  
  try {
    const avatar = await loadImage(avatarURL);
    
    // Configurar círculo para el avatar (idéntico a bienvenida)
    const avatarSize = 180;
    const avatarX = (width - avatarSize) / 2;
    const avatarY = 100;
    
    // Crear círculo de recorte
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    
    // Dibujar avatar
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();
    
    // Borde circular del avatar (Blanco)
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 6;
    ctx.stroke();
    
    // Borde exterior decorativo (Rojo)
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 8, 0, Math.PI * 2);
    ctx.strokeStyle = "#ED4245";
    ctx.lineWidth = 4;
    ctx.stroke();
    
  } catch (avatarError) {
    // Si falla la carga del avatar, dibujar un círculo con iniciales
    const avatarSize = 180;
    const avatarX = (width - avatarSize) / 2;
    const avatarY = 100;
    
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#ED4245";
    ctx.fill();
    
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 80px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const initials = member.user.username.slice(0, 2).toUpperCase();
    ctx.fillText(initials, width / 2, avatarY + avatarSize / 2);
  }
  
  // ── TEXTO: ADIÓS ──
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 60px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.fillText("¡Adiós!", width / 2, 330);
  
  // ── TEXTO: NOMBRE DE USUARIO ──
  ctx.font = "bold 45px Arial, sans-serif";
  ctx.fillStyle = "#ED4245"; // Rojo Discord
  
  // Truncar nombre si es muy largo
  let username = member.user.username;
  if (username.length > 20) {
    username = username.slice(0, 17) + "...";
  }
  
  ctx.fillText(username, width / 2, 390);
  
  // ── TEXTO: NÚMERO DE MIEMBROS RESTANTES ──
  ctx.font = "30px Arial, sans-serif";
  ctx.fillStyle = "#99AAB5"; // Color gris Discord
  ctx.shadowBlur = 5;
  const memberCountText = `Quedamos ${guild.memberCount} miembros`;
  ctx.fillText(memberCountText, width / 2, 445);
  
  // ── DECORACIÓN ADICIONAL ──
  // Líneas decorativas en las esquinas (Rojas con opacidad)
  ctx.strokeStyle = "rgba(237, 66, 69, 0.3)";
  ctx.lineWidth = 3;
  
  // Esquina superior izquierda
  ctx.beginPath();
  ctx.moveTo(30, 60);
  ctx.lineTo(30, 30);
  ctx.lineTo(60, 30);
  ctx.stroke();
  
  // Esquina superior derecha
  ctx.beginPath();
  ctx.moveTo(width - 60, 30);
  ctx.lineTo(width - 30, 30);
  ctx.lineTo(width - 30, 60);
  ctx.stroke();
  
  // Esquina inferior izquierda
  ctx.beginPath();
  ctx.moveTo(30, height - 60);
  ctx.lineTo(30, height - 30);
  ctx.lineTo(60, height - 30);
  ctx.stroke();
  
  // Esquina inferior derecha
  ctx.beginPath();
  ctx.moveTo(width - 60, height - 30);
  ctx.lineTo(width - 30, height - 30);
  ctx.lineTo(width - 30, height - 60);
  ctx.stroke();
  
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