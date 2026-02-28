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
 * Genera una imagen de despedida visual usando Canvas
 * Diseño espejo exacto de la bienvenida, pero en rojo
 * @param {GuildMember} member - El miembro que salió
 * @param {Guild} guild - El servidor
 * @returns {Buffer} - Buffer de la imagen PNG generada
 */
async function generateGoodbyeImage(member, guild) {
  // Dimensiones del canvas: 1024x450 (IGUAL que bienvenida)
  const width = 1024;
  const height = 450;
  
  // Crear canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  
  // ── FONDO CON DEGRADADO ROJO ELEGANTE ──
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#3A090C");    // Rojo muy oscuro en extremos
  gradient.addColorStop(0.5, "#220406");  // Rojo aún más oscuro en el medio
  gradient.addColorStop(1, "#3A090C");    // Rojo muy oscuro en extremos
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Patrón de partículas decorativas (puntos sutiles) - ROJO
  ctx.fillStyle = "rgba(237, 66, 69, 0.1)";
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = Math.random() * 3 + 1;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Borde decorativo exterior - ROJO (#ED4245)
  ctx.strokeStyle = "#ED4245"; // Color Discord rojo
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, width - 20, height - 20);
  
  // Borde interior sutil - ROJO
  ctx.strokeStyle = "rgba(237, 66, 69, 0.3)";
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, width - 40, height - 40);
  
  // ── AVATAR DEL USUARIO ──
  try {
    // Cargar avatar del usuario con extensión png
    const avatarURL = member.user.displayAvatarURL({ 
      extension: "png", 
      size: 256,
      forceStatic: false 
    });
    
    const avatar = await loadImage(avatarURL);
    
    // Configurar círculo para el avatar (centrado) - IDÉNTICO a bienvenida
    const avatarSize = 150;
    const avatarX = width / 2 - avatarSize / 2;
    const avatarY = 60;
    
    // Borde decorativo exterior del avatar (glow) - ROJO
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 10, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(237, 66, 69, 0.5)";
    ctx.lineWidth = 8;
    ctx.stroke();
    
    // Crear círculo de recorte
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    
    // Dibujar avatar
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();
    
    // Borde blanco del avatar
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 5;
    ctx.stroke();
    
    // Borde decorativo del avatar - ROJO
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 6, 0, Math.PI * 2);
    ctx.strokeStyle = "#ED4245";
    ctx.lineWidth = 3;
    ctx.stroke();
    
  } catch (avatarError) {
    // Si falla la carga del avatar, dibujar un círculo con iniciales
    console.error("[AVATAR ERROR]", avatarError.message);
    
    const avatarSize = 150;
    const avatarX = width / 2 - avatarSize / 2;
    const avatarY = 60;
    
    // Fondo del avatar - ROJO
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#ED4245";
    ctx.fill();
    
    // Borde blanco
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 5;
    ctx.stroke();
    
    // Iniciales del usuario
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 60px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const initials = member.user.username.slice(0, 2).toUpperCase();
    ctx.fillText(initials, width / 2, avatarY + avatarSize / 2);
  }
  
  // ── TEXTO: ¡ADIÓS! ──
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 48px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  // Sombra del texto
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  
  ctx.fillText("¡ADIÓS!", width / 2, 250);
  
  // ── TEXTO: TAG DEL USUARIO ──
  ctx.font = "bold 36px Arial, sans-serif";
  ctx.fillStyle = "#ED4245"; // Color Discord rojo
  
  // Usar member.user.tag (username#0000)
  let userTag = member.user.tag;
  
  // Truncar si es muy largo
  if (userTag.length > 28) {
    userTag = userTag.slice(0, 25) + "...";
  }
  
  ctx.fillText(userTag, width / 2, 310);
  
  // ── TEXTO: NÚMERO DE MIEMBRO ──
  ctx.font = "24px Arial, sans-serif";
  ctx.fillStyle = "#99AAB5"; // Color gris Discord
  
  // Quitar sombra para texto secundario
  ctx.shadowBlur = 4;
  
  const memberCountText = `Quedamos ${guild.memberCount} miembros`;
  ctx.fillText(memberCountText, width / 2, 365);
  
  // ── DECORACIÓN ADICIONAL ──
  // Líneas decorativas en las esquinas - ROJO
  ctx.strokeStyle = "rgba(237, 66, 69, 0.4)";
  ctx.lineWidth = 2;
  
  // Esquina superior izquierda
  ctx.beginPath();
  ctx.moveTo(40, 80);
  ctx.lineTo(40, 40);
  ctx.lineTo(80, 40);
  ctx.stroke();
  
  // Esquina superior derecha
  ctx.beginPath();
  ctx.moveTo(width - 80, 40);
  ctx.lineTo(width - 40, 40);
  ctx.lineTo(width - 40, 80);
  ctx.stroke();
  
  // Esquina inferior izquierda
  ctx.beginPath();
  ctx.moveTo(40, height - 80);
  ctx.lineTo(40, height - 40);
  ctx.lineTo(80, height - 40);
  ctx.stroke();
  
  // Esquina inferior derecha
  ctx.beginPath();
  ctx.moveTo(width - 80, height - 40);
  ctx.lineTo(width - 40, height - 40);
  ctx.lineTo(width - 40, height - 80);
  ctx.stroke();
  
  // ── RETORNAR BUFFER PNG ──
  return canvas.toBuffer("image/png");
}

/**
 * Reemplaza las variables en el mensaje
 * Variables: {mention}, {user}, {server}, {tag}, {count}, {id}
 */
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
