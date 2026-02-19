const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, PermissionFlagsBits,
} = require("discord.js");
const { welcomeSettings, verifSettings, modlogSettings } = require("../utils/database");

// ── Caché anti-raid: guildId → [timestamps]
const joinCache = new Map();

module.exports = {
  name: "guildMemberAdd",
  async execute(member, client) {
    const guild = member.guild;
    try {
      const ws = welcomeSettings.get(guild.id);
      const vs = verifSettings.get(guild.id);

      // 1. ANTI-RAID
      if (vs.enabled && vs.antiraid_enabled) {
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
      if (vs.enabled && vs.unverified_role) {
        const role = guild.roles.cache.get(vs.unverified_role);
        if (role && guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles))
          await member.roles.add(role).catch(() => {});
      }

      // 3. AUTO-ROL (solo si verificación desactivada)
      if (!vs.enabled && ws.welcome_autorole) {
        const role = guild.roles.cache.get(ws.welcome_autorole);
        if (role && guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles))
          await member.roles.add(role).catch(() => {});
      }

      // 4. BIENVENIDA EN CANAL
      if (ws.welcome_enabled && ws.welcome_channel) {
        const ch = guild.channels.cache.get(ws.welcome_channel);
        if (ch) await ch.send({ content: `<@${member.id}>`, embeds: [buildWelcomeEmbed(member, guild, ws)] }).catch(() => {});
      }

      // 5. DM DE BIENVENIDA
      if (ws.welcome_enabled && ws.welcome_dm) {
        try {
          const dmEmbed = new EmbedBuilder()
            .setColor(parseInt(ws.welcome_color || "5865F2", 16))
            .setTitle(`👋 Bienvenido/a a ${guild.name}`)
            .setDescription(fill(ws.welcome_dm_message, member, guild))
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .setTimestamp();
          if (vs.enabled && vs.channel)
            dmEmbed.addFields({ name: "✅ Verificación requerida", value: `Ve a <#${vs.channel}> para verificarte y acceder al servidor.` });
          await member.send({ embeds: [dmEmbed] });
        } catch { /* DMs cerrados */ }
      }

    // ── 6. MOD LOG de JOIN
    const ml = modlogSettings.get(guild.id);
    if (ml.enabled && ml.log_joins && ml.channel) {
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
