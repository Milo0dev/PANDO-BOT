const { EmbedBuilder, AuditLogEvent } = require("discord.js");
const { modlogSettings } = require("../utils/database");

module.exports = {
  name: "guildBanRemove",
  async execute(ban, client) {
    try {
      const { guild, user } = ban;
      const ml = await modlogSettings.get(guild.id);
      if (!ml || !ml.enabled || !ml.log_unbans || !ml.channel) return;

      const ch = guild.channels.cache.get(ml.channel);
      if (!ch) return;

      let executor = null;
      await new Promise(r => setTimeout(r, 500));
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanRemove, limit: 5 }).catch(() => null);
      if (logs) {
        const entry = logs.entries.find(e => e.target?.id === user.id && Date.now() - e.createdTimestamp < 5000);
        if (entry) executor = entry.executor;
      }

      await ch.send({
        embeds: [new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle("✅ Usuario Desbaneado")
          .setThumbnail(user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: "👤 Usuario",       value: `${user.tag}\n<@${user.id}> \`(${user.id})\``, inline: false },
            { name: "🛡️ Ejecutado por", value: executor ? `<@${executor.id}> ${executor.tag}` : "Desconocido", inline: true },
          )
          .setFooter({ text: `ID: ${user.id}` })
          .setTimestamp()],
      }).catch(() => {});
    } catch (e) { console.error("[UNBAN LOG]", e.message); }
  },
};
