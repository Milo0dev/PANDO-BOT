const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, PermissionFlagsBits, AttachmentBuilder,
} = require("discord.js");
const { createCanvas, loadImage } = require("canvas");
const { welcomeSettings, verifSettings, modlogSettings } = require("../utils/database");

// ── Caché anti-raid: guildId → [timestamps]
const joinCache = new Map();

module.exports = {
  name: "guildMemberAdd",
  async execute(member, client) {
    const guild = member.guild;
    try {
      const ws = await welcomeSettings.get(guild.id);
      const vs = await verifSettings.get(guild.id);

      // 1. ANTI-RAID
      if (vs && vs.enabled && vs.antiraid_enabled) {
        const now  = Date.now();
        const prev = (joinCache.get(guild.id) || []).filter(t => now - t < vs.antiraid_seconds * 1000);
        prev.push(now);
        joinCache.set(guild.id, prev);
        if (prev.length >= vs.antiraid_joins) {
          if (vs.log_channel) {
            const logCh = guild.channels.cache.get(vs.log_channel);
            await logCh?.send({
              embeds: [new EmbedBuilder().setColor(0xED4245).setTitle("🚨 ALERTA ANTI-RAID")
                .setDescription(`Se detectaron **${prev.length} joins** en **${vs.antiraid_seconds}s**.\nÚltimo: **${member.user.tag}**`)
                .setTimestamp()],
            }).catch(() => {});
          }
          if (vs.antiraid_action === "kick") {
            await member.kick("Anti-raid activado").catch(() => {});
            return;
          }
        }
      }

      // 2. ROL DE NO VERIFICADO
      if (vs && vs.enabled && vs.unverified_role) {
        const role = guild.roles.cache.get(vs.unverified_role);
        if (role && guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles))
          await member.roles.add(role).catch(() => {});
      }

      // 3. AUTO-ROL (solo si verificación desactivada)
      if (vs && !vs.enabled && ws?.welcome_autorole) {
        const role = guild.roles.cache.get(ws.welcome_autorole);
        if (role && guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles))
          await member.roles.add(role).catch(() => {});
      }

      // 4. BIENVENIDA EN CANAL CON IMAGEN CANVAS
      if (ws?.welcome_enabled && ws.welcome_channel) {
        const ch = guild.channels.cache.get(ws.welcome_channel);
        if (ch) {
          try {
            // Generar imagen de bienvenida
            const welcomeImage = await generateWelcomeImage(member, guild);
            const attachment = new AttachmentBuilder(welcomeImage, { name: "welcome.png" });
            
            // Reemplazar variables en el mensaje
            const welcomeMessage = fill(ws.welcome_message, member, guild);
            
            // Crear embed bonito
            const embed = new EmbedBuilder()
              .setColor(parseInt(ws.welcome_color || "5865F2", 16))
              .setTitle(fill(ws.welcome_title || "👋 ¡Bienvenido/a!", member, guild))
              .setDescription(welcomeMessage)
              .setImage("attachment://welcome.png")
              .setTimestamp();
            
            if (ws.welcome_footer) {
              embed.setFooter({ 
                text: fill(ws.welcome_footer, member, guild), 
                iconURL: guild.iconURL({ dynamic: true }) 
              });
            }

            await ch.send({ 
              content: `<@${member.id}>`,
              embeds: [embed],
              files: [attachment]
            }).catch(() => {});
          } catch (canvasError) {
            console.error("[CANVAS ERROR]", canvasError);
            // Fallback: enviar embed normal sin imagen
            await ch.send({ 
              content: `<@${member.id}>`, 
              embeds: [buildWelcomeEmbed(member, guild, ws)] 
            }).catch(() => {});
          }
        }
      }

      // 5. DM DE BIENVENIDA
      if (ws?.welcome_enabled && ws.welcome_dm) {
        try {
          const dmEmbed = new EmbedBuilder()
            .setColor(parseInt(ws.welcome_color || "5865F2", 16))
            .setTitle(`👋 Bienvenido/a a ${guild.name}`)
            .setDescription(fill(ws.welcome_dm_message, member, guild))
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .setTimestamp();
          if (vs?.enabled && vs.channel)
            dmEmbed.addFields({ name: "✅ Verificación requerida", value: `Ve a <#${vs.channel}> para verificarte y acceder al servidor.` });
          await member.send({ embeds: [dmEmbed] });
        } catch { /* DMs cerrados */ }
      }

    // ── 6. MOD LOG de JOIN
    const ml = await modlogSettings.get(guild.id);
    if (ml && ml.enabled && ml.log_joins && ml.channel) {
      const logCh = guild.channels.cache.get(ml.channel);
      if (logCh) {
        await logCh.send({
          embeds: [new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle("📥 Miembro Entró")
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .addFields(
              { name: "👤 Usuario",     value: `${member.user.tag} <@${member.id}>`, inline: true  },
              { name: "📅 Cuenta creada", value: `<t:${Math.floor(member.user.createdTimestamp/1000)}:R>`, inline: true },
              { name: "👥 Miembro #",   value: `\`${guild.memberCount}\``, inline: true },
            )
            .setFooter({ text: `ID: ${member.id}` })
            .setTimestamp()],
        }).catch(() => {});
      }
    }

    } catch (err) { 
      console.error("[MEMBER ADD]", err.message); 
    }
  },
};

/**
 * Genera una imagen de bienvenida visual usando Canvas
 * @param {GuildMember} member - El miembro que se unió
 * @param {Guild} el servidor
 * @returns {Buffer} - Buffer de la imagen PNG generada
 */
async function generateWelcomeImage(member, guild) {
  // Dimensiones del canvas: 1024x450
  const width = 1024;
  const height = 450;
  
  // Crear canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  
  // ── FONDO CON DEGRADADO ELEGANTE ──
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#1a1a2e");    // Azul muy oscuro
  gradient.addColorStop(0.5, "#16213e");  // Azul oscuro
  gradient.addColorStop(1, "#0f3460");    // Azul medio
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Patrón de partículas decorativas (puntos sutiles)
  ctx.fillStyle = "rgba(88, 101, 242, 0.1)";
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = Math.random() * 3 + 1;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Borde decorativo exterior
  ctx.strokeStyle = "#5865F2"; // Color Discord blurple
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, width - 20, height - 20);
  
  // Borde interior sutil
  ctx.strokeStyle = "rgba(88, 101, 242, 0.3)";
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
    
    // Configurar círculo para el avatar (centrado)
    const avatarSize = 150;
    const avatarX = width / 2 - avatarSize / 2;
    const avatarY = 60;
    
    // Borde decorativo exterior del avatar (glow)
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 10, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(88, 101, 242, 0.5)";
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
    
    // Borde decorativo del avatar
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 6, 0, Math.PI * 2);
    ctx.strokeStyle = "#5865F2";
    ctx.lineWidth = 3;
    ctx.stroke();
    
  } catch (avatarError) {
    // Si falla la carga del avatar, dibujar un círculo con iniciales
    console.error("[AVATAR ERROR]", avatarError.message);
    
    const avatarSize = 150;
    const avatarX = width / 2 - avatarSize / 2;
    const avatarY = 60;
    
    // Fondo del avatar
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#5865F2";
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
  
  // ── TEXTO: ¡BIENVENIDO/A! ──
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 48px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  // Sombra del texto
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  
  ctx.fillText("¡BIENVENIDO/A!", width / 2, 250);
  
  // ── TEXTO: TAG DEL USUARIO ──
  ctx.font = "bold 36px Arial, sans-serif";
  ctx.fillStyle = "#5865F2"; // Color Discord blurple
  
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
  
  const memberCountText = `Eres el miembro #${guild.memberCount}`;
  ctx.fillText(memberCountText, width / 2, 365);
  
  // ── DECORACIÓN ADICIONAL ──
  // Líneas decorativas en las esquinas
  ctx.strokeStyle = "rgba(88, 101, 242, 0.4)";
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
 * Construye un embed de bienvenida (fallback si canvas falla)
 */
function buildWelcomeEmbed(member, guild, ws) {
  const color = parseInt(ws.welcome_color || "5865F2", 16);
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(fill(ws.welcome_title || "👋 ¡Bienvenido/a!", member, guild))
    .setDescription(fill(ws.welcome_message, member, guild))
    .setTimestamp();
  if (ws.welcome_thumbnail !== false) embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }));
  if (ws.welcome_banner)  embed.setImage(ws.welcome_banner);
  if (ws.welcome_footer)  embed.setFooter({ text: fill(ws.welcome_footer, member, guild), iconURL: guild.iconURL({ dynamic: true }) });
  embed.addFields(
    { name: "👤 Usuario",       value: member.user.tag,                                              inline: true },
    { name: "📅 Cuenta creada", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,  inline: true },
    { name: "👥 Miembro #",     value: `\`${guild.memberCount}\``,                                  inline: true },
  );
  return embed;
}

/**
 * Reemplaza las variables en el mensaje de bienvenida
 * Variables: {mention}, {user}, {server}, {tag}, {count}, {id}
 */
function fill(text, member, guild) {
  if (!text) return "";
  return text
    .replace(/{mention}/g, `<@${member.id}>`)
    .replace(/{user}/g,    member.user.username)
    .replace(/{tag}/g,     member.user.tag)
    .replace(/{server}/g,  guild.name)
    .replace(/{count}/g,   String(guild.memberCount))
    .replace(/{id}/g,      member.id);
}
