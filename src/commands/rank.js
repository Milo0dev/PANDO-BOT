const {
  SlashCommandBuilder, EmbedBuilder, AttachmentBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require("discord.js");
const { levels, levelSettings } = require("../utils/database");
const E = require("../utils/embeds");

// ── Helpers
function xpBar(totalXp, level, length = 14) {
  const needed = levels.xpForLevel(level + 1);
  // XP acumulado en el nivel actual
  let accumulated = 0;
  for (let i = 1; i <= level; i++) accumulated += levels.xpForLevel(i);
  const currentLevelXp = totalXp - accumulated;
  const pct = Math.min(currentLevelXp / needed, 1);
  const filled = Math.round(pct * length);
  return {
    bar: "█".repeat(filled) + "░".repeat(length - filled),
    current: currentLevelXp,
    needed,
    pct: Math.round(pct * 100),
  };
}

function rankMedal(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

function levelColor(level) {
  if (level >= 50) return 0xFF0000; // rojo
  if (level >= 30) return 0xFF6B35; // naranja
  if (level >= 20) return 0xFFD700; // dorado
  if (level >= 10) return 0x57F287; // verde
  if (level >= 5)  return 0x5865F2; // azul
  return 0x99AAB5;                  // gris
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("⭐ Ver tu nivel y posición en la tabla de ranking")
    .addSubcommand(s => s
      .setName("ver")
      .setDescription("Ver el nivel y XP de un usuario")
      .addUserOption(o => o.setName("usuario").setDescription("Usuario a consultar (vacío = tú mismo)").setRequired(false)))
    .addSubcommand(s => s
      .setName("top")
      .setDescription("Ver la tabla de posiciones del servidor")),

  async execute(interaction) {
    const sub   = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const gid   = guild.id;
    const ls    = levelSettings.get(gid);

    if (!ls.enabled) {
      return interaction.reply({
        embeds: [E.errorEmbed("El sistema de niveles no está activado en este servidor.\nUn administrador puede activarlo con `/levels config activar`.")],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── /rank ver
    if (sub === "ver") {
      const target = interaction.options.getUser("usuario") || interaction.user;
      const data   = levels.get(gid, target.id);
      const rank   = levels.getRank(gid, target.id);
      const bar    = xpBar(data.total_xp, data.level);
      const color  = levelColor(data.level);

      // Calcular XP para siguiente nivel
      const nextLevel = data.level + 1;
      const rewards   = (ls.role_rewards || []).filter(r => r.level > data.level).slice(0, 3);
      const rewardTxt = rewards.length
        ? rewards.map(r => `Nv. **${r.level}** → <@&${r.role_id}>`).join("\n")
        : "No hay recompensas próximas";

      const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({
          name:    `${target.username} — Nivel ${data.level}`,
          iconURL: target.displayAvatarURL({ dynamic: true }),
        })
        .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
        .setDescription(
          `\`\`\`\n${bar.bar}  ${bar.pct}%\n\`\`\`` +
          `**${bar.current.toLocaleString()} / ${bar.needed.toLocaleString()} XP** para el nivel ${nextLevel}`
        )
        .addFields(
          { name: "🏆 Nivel",          value: `\`${data.level}\``,                             inline: true },
          { name: "⭐ XP Total",       value: `\`${data.total_xp.toLocaleString()}\``,          inline: true },
          { name: "📊 Posición",       value: rank ? `\`${rankMedal(rank)}\`` : "`Sin datos`",  inline: true },
          { name: "💬 Mensajes",       value: `\`${(data.messages || 0).toLocaleString()}\``,   inline: true },
          { name: "🎯 Sig. nivel",     value: `\`${nextLevel}\``,                               inline: true },
          { name: "⚡ Faltan",         value: `\`${(bar.needed - bar.current).toLocaleString()} XP\``, inline: true },
          { name: "🎁 Próximas recompensas", value: rewardTxt, inline: false },
        )
        .setFooter({ text: `${guild.name} · Sistema de Niveles` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ── /rank top
    if (sub === "top") {
      await interaction.deferReply();
      const lb    = levels.getLeaderboard(gid, 15);
      const myRank = levels.getRank(gid, interaction.user.id);

      if (!lb.length) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle("🏆 Top del Servidor")
            .setDescription("Aún nadie ha ganado XP. ¡Empieza a escribir mensajes! 💬")
            .setTimestamp()],
        });
      }

      // Construir la tabla con fetch de nombres
      const entries = await Promise.all(
        lb.map(async (entry, i) => {
          const member = await guild.members.fetch(entry.user_id).catch(() => null);
          const name   = member?.displayName || `Usuario ${entry.user_id.slice(-4)}`;
          const bar    = xpBar(entry.total_xp, entry.level, 8);
          const medal  = rankMedal(i + 1);
          return `${medal} **${name}**\n` +
                 `\`${bar.bar}\` Nv. **${entry.level}** · **${entry.total_xp.toLocaleString()}** XP`;
        })
      );

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle("🏆 Top 15 — Tabla de Posiciones")
        .setDescription(entries.join("\n\n"))
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .setFooter({
          text: myRank
            ? `Tu posición: #${myRank} · ${guild.name}`
            : `No tienes XP aún · ${guild.name}`,
        })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
