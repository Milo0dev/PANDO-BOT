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
            
            // Crear embed bonito
            const embed = new EmbedBuilder()
              .setColor(parseInt(ws.welcome_color || "5865F2", 16))
              .setTitle(fill(ws.welcome_title || "👋 ¡Bienvenido/a!", member, guild))
              .setDescription(fill(ws.welcome_message || "¡Bienvenido/a **{mention}** al servidor **{server}**! 🎉", member, guild))
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

    } catch (err) { console.error("[MEMBER ADD]", err.message); }
  },
};

/**
 * Genera una imagen de bienvenida visual usando Canvas
 * @param {GuildMember} member - El miembro que se unió
 * @param {Guild} guild - El servidor
 * @returns {Buffer} - Buffer de la imagen PNG generada
 */
async function generateWelcomeImage(member, guild) {
  // Dimensiones del canvas
  const width = 1024;
  const height = 512;
  
  // Crear canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  
  // ── FONDO ──
  // Crear gradiente oscuro
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#23272A"); // Color Discord oscuro
  gradient.addColorStop(0.5, "#2C2F33");
  gradient.addColorStop(1, "#23272A");
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Borde decorativo
  ctx.strokeStyle = "#5865F2"; // Color Discord blurple
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
    
    // Configurar círculo para el avatar
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
    
    // Borde circular del avatar
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 6;
    ctx.stroke();
    
    // Borde exterior decorativo
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 8, 0, Math.PI * 2);
    ctx.strokeStyle = "#5865F2";
    ctx.lineWidth = 4;
    ctx.stroke();
    
  } catch (avatarError) {
    // Si falla la carga del avatar, dibujar un círculo con iniciales
    const avatarSize = 180;
    const avatarX = (width - avatarSize) / 2;
    const avatarY = 100;
    
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#5865F2";
    ctx.fill();
    
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 80px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const initials = member.user.username.slice(0, 2).toUpperCase();
    ctx.fillText(initials, width / 2, avatarY + avatarSize / 2);
  }
  
  // ── TEXTO: BIENVENIDO ──
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 60px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.fillText("¡Bienvenido/a!", width / 2, 330);
  
  // ── TEXTO: NOMBRE DE USUARIO ──
  ctx.font = "bold 45px Arial, sans-serif";
  ctx.fillStyle = "#5865F2"; // Color Discord blurple
  
  // Truncar nombre si es muy largo
  let username = member.user.username;
  if (username.length > 20) {
    username = username.slice(0, 17) + "...";
  }
  
  ctx.fillText(username, width / 2, 390);
  
  // ── TEXTO: NÚMERO DE MIEMBRO ──
  ctx.font = "30px Arial, sans-serif";
  ctx.fillStyle = "#99AAB5"; // Color gris Discord
  ctx.shadowBlur = 5;
  const memberCountText = `Eres el miembro número ${guild.memberCount}`;
  ctx.fillText(memberCountText, width / 2, 445);
  
  // ── DECORACIÓN ADICIONAL ──
  // Líneas decorativas en las esquinas
  ctx.strokeStyle = "rgba(88, 101, 242, 0.3)";
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
