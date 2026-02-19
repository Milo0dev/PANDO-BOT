const { EmbedBuilder } = require("discord.js");
const { welcomeSettings, modlogSettings } = require("../utils/database");

module.exports = {
  name: "guildMemberRemove",
  async execute(member, client) {
    const guild = member.guild;
    try {
      const ws = welcomeSettings.get(guild.id);
      if (!ws.goodbye_enabled || !ws.goodbye_channel) return;
      const ch = guild.channels.cache.get(ws.goodbye_channel);
      if (!ch) return;

      const color = parseInt(ws.goodbye_color || "ED4245", 16);
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(fill(ws.goodbye_title || "👋 Hasta luego", member, guild))
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
        { name: "👤 Usuario",     value: `${member.user.tag}`,                                                              inline: true },
        { name: "🆔 ID",          value: `\`${member.id}\``,                                                                inline: true },
        { name: "📅 Se unió",     value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "?",     inline: true },
        { name: "👥 Quedamos",    value: `\`${guild.memberCount}\` miembros`,                                               inline: true },
        { name: "🏷️ Tenía roles", value: roles,                                                                              inline: false },
      );

      await ch.send({ embeds: [embed] }).catch(() => {});
    // ── MODLOG de LEAVE
    const ml = modlogSettings.get(guild.id);
    if (ml.enabled && ml.log_leaves && ml.channel) {
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
              { name: "👤 Usuario",   value: `${member.user.tag} <@${member.id}>`, inline: true },
              { name: "📅 Se unió",   value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp/1000)}:R>` : "?", inline: true },
              { name: "👥 Quedamos",  value: String(guild.memberCount), inline: true },
              { name: "🏷️ Tenía roles", value: roles, inline: false },
            )
            .setFooter({ text: `ID: ${member.id}` })
            .setTimestamp()],
        }).catch(() => {});
      }
    }

    } catch (err) { console.error("[MEMBER REMOVE]", err.message); }
  },
};

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
