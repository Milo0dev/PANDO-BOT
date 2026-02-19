const { EmbedBuilder, AuditLogEvent } = require("discord.js");
const { modlogSettings } = require("../utils/database");

module.exports = {
  name: "guildBanAdd",
  async execute(ban, client) {
    try {
      const { guild, user } = ban;
      const ml = modlogSettings.get(guild.id);
      if (!ml.enabled || !ml.log_bans || !ml.channel) return;

      const ch = guild.channels.cache.get(ml.channel);
      if (!ch) return;

      // Buscar en audit log quién baneó y la razón
      let executor = null;
      let reason   = "Sin razón especificada";
      await new Promise(r => setTimeout(r, 500)); // pequeño delay para que el audit log se actualice
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 5 }).catch(() => null);
      if (logs) {
        const entry = logs.entries.find(e => e.target?.id === user.id && Date.now() - e.createdTimestamp < 5000);
        if (entry) { executor = entry.executor; reason = entry.reason || reason; }
      }

      await ch.send({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle("🔨 Usuario Baneado")
          .setThumbnail(user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: "👤 Usuario",   value: `${user.tag}\n<@${user.id}> \`(${user.id})\``, inline: false },
            { name: "🛡️ Ejecutado por", value: executor ? `<@${executor.id}> ${executor.tag}` : "Desconocido", inline: true },
            { name: "📋 Razón",     value: reason, inline: true },
          )
          .setFooter({ text: `ID: ${user.id}` })
          .setTimestamp()],
      }).catch(() => {});
    } catch (e) { console.error("[BAN LOG]", e.message); }
  },
};
