const {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, MessageFlags,
} = require("discord.js");
const { levelSettings, levels } = require("../utils/database");
const E = require("../utils/embeds");

// ── Helpers visuales
function xpBar(current, needed, length = 12) {
  const pct   = Math.min(current / needed, 1);
  const filled = Math.round(pct * length);
  return "█".repeat(filled) + "░".repeat(length - filled);
}

function formatXP(n) {
  return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("levels")
    .setDescription("⭐ Sistema de niveles y XP")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // ── Configuración (solo admins)
    .addSubcommandGroup(g => g
      .setName("config")
      .setDescription("Configurar el sistema de niveles")
      .addSubcommand(s => s.setName("activar").setDescription("Activar o desactivar el sistema de XP")
        .addBooleanOption(o => o.setName("estado").setDescription("Activar / desactivar").setRequired(true)))
      .addSubcommand(s => s.setName("canal").setDescription("Canal donde se anuncian las subidas de nivel (vacío = mismo canal)")
        .addChannelOption(o => o.setName("canal").setDescription("Canal de anuncios (vacío = desactivar canal específico)").addChannelTypes(ChannelType.GuildText).setRequired(false)))
      .addSubcommand(s => s.setName("xp").setDescription("Configurar XP por mensaje y cooldown")
        .addIntegerOption(o => o.setName("minimo").setDescription("XP mínimo por mensaje").setRequired(true).setMinValue(1).setMaxValue(100))
        .addIntegerOption(o => o.setName("maximo").setDescription("XP máximo por mensaje").setRequired(true).setMinValue(1).setMaxValue(200))
        .addIntegerOption(o => o.setName("cooldown").setDescription("Segundos entre ganancias de XP").setRequired(true).setMinValue(5).setMaxValue(300)))
      .addSubcommand(s => s.setName("mensaje").setDescription("Personalizar mensaje de subida de nivel")
        .addStringOption(o => o.setName("texto").setDescription("Variables: {mention} {user} {level} {xp}").setRequired(true).setMaxLength(500)))
      .addSubcommand(s => s.setName("rolreward").setDescription("Asignar un rol al llegar a cierto nivel")
        .addIntegerOption(o => o.setName("nivel").setDescription("Nivel requerido").setRequired(true).setMinValue(1).setMaxValue(999))
        .addRoleOption(o => o.setName("rol").setDescription("Rol a otorgar (vacío = eliminar recompensa de ese nivel)").setRequired(false)))
      .addSubcommand(s => s.setName("ignorarcanalal").setDescription("Ignorar/desigNorar un canal para XP")
        .addChannelOption(o => o.setName("canal").setDescription("Canal").addChannelTypes(ChannelType.GuildText).setRequired(true)))
      .addSubcommand(s => s.setName("doublexp").setDescription("Dar XP x2 a un rol")
        .addRoleOption(o => o.setName("rol").setDescription("Rol con XP doble").setRequired(true)))
      .addSubcommand(s => s.setName("resetear").setDescription("Reiniciar el XP de un usuario")
        .addUserOption(o => o.setName("usuario").setDescription("Usuario a resetear").setRequired(true)))
      .addSubcommand(s => s.setName("setxp").setDescription("Establecer XP manualmente a un usuario")
        .addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true))
        .addIntegerOption(o => o.setName("cantidad").setDescription("XP a establecer").setRequired(true).setMinValue(0)))
      .addSubcommand(s => s.setName("info").setDescription("Ver toda la configuración actual del sistema de niveles"))
    ),

  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup(false);
    const sub   = interaction.options.getSubcommand();
    const gid   = interaction.guild.id;
    const ls    = levelSettings.get(gid);
    const ok    = msg => interaction.reply({ embeds: [E.successEmbed(msg)], flags: MessageFlags.Ephemeral });
    const er    = msg => interaction.reply({ embeds: [E.errorEmbed(msg)],   flags: MessageFlags.Ephemeral });

    // ── CONFIG subcomandos
    if (group === "config") {
      if (sub === "activar") {
        const estado = interaction.options.getBoolean("estado");
        levelSettings.update(gid, { enabled: estado });
        return ok(`Sistema de niveles **${estado ? "✅ activado" : "❌ desactivado"}**.`);
      }

      if (sub === "canal") {
        const canal = interaction.options.getChannel("canal");
        levelSettings.update(gid, { channel: canal?.id || null });
        return ok(canal ? `Canal de nivel-up: ${canal}` : "Los anuncios se enviarán en el mismo canal donde escribe el usuario.");
      }

      if (sub === "xp") {
        const min = interaction.options.getInteger("minimo");
        const max = interaction.options.getInteger("maximo");
        const cd  = interaction.options.getInteger("cooldown");
        if (min > max) return er("El XP mínimo no puede ser mayor que el máximo.");
        levelSettings.update(gid, { xp_min: min, xp_max: max, xp_cooldown: cd });
        return ok(`XP por mensaje: **${min}–${max}** · Cooldown: **${cd}s**`);
      }

      if (sub === "mensaje") {
        const texto = interaction.options.getString("texto");
        levelSettings.update(gid, { levelup_message: texto });
        return ok(`Mensaje de nivel actualizado.\n**Variables:** \`{mention}\` \`{user}\` \`{level}\` \`{xp}\`\n\n**Preview:** ${texto.replace(/{mention}/g,"@usuario").replace(/{user}/g,"usuario").replace(/{level}/g,"5").replace(/{xp}/g,"1250")}`);
      }

      if (sub === "rolreward") {
        const nivel = interaction.options.getInteger("nivel");
        const rol   = interaction.options.getRole("rol");
        const lsNow = levelSettings.get(gid);
        let rewards = lsNow.role_rewards || [];

        if (!rol) {
          rewards = rewards.filter(r => r.level !== nivel);
          levelSettings.update(gid, { role_rewards: rewards });
          return ok(`Recompensa del nivel **${nivel}** eliminada.`);
        }

        const existing = rewards.findIndex(r => r.level === nivel);
        if (existing !== -1) rewards[existing].role_id = rol.id;
        else rewards.push({ level: nivel, role_id: rol.id });
        rewards.sort((a, b) => a.level - b.level);
        levelSettings.update(gid, { role_rewards: rewards });
        return ok(`Al llegar al nivel **${nivel}** se otorgará ${rol}.`);
      }

      if (sub === "ignorarcanalal") {
        const canal   = interaction.options.getChannel("canal");
        const lsNow   = levelSettings.get(gid);
        let ignored   = lsNow.ignored_channels || [];
        if (ignored.includes(canal.id)) {
          ignored = ignored.filter(c => c !== canal.id);
          levelSettings.update(gid, { ignored_channels: ignored });
          return ok(`${canal} ya **no está ignorado** — los usuarios ganarán XP ahí.`);
        } else {
          ignored.push(canal.id);
          levelSettings.update(gid, { ignored_channels: ignored });
          return ok(`${canal} **ignorado** — no se ganará XP en ese canal.`);
        }
      }

      if (sub === "doublexp") {
        const rol    = interaction.options.getRole("rol");
        const lsNow  = levelSettings.get(gid);
        let dxp      = lsNow.double_xp_roles || [];
        if (dxp.includes(rol.id)) {
          dxp = dxp.filter(r => r !== rol.id);
          levelSettings.update(gid, { double_xp_roles: dxp });
          return ok(`${rol} ya no tiene XP doble.`);
        } else {
          dxp.push(rol.id);
          levelSettings.update(gid, { double_xp_roles: dxp });
          return ok(`${rol} ahora tiene **XP x2** 🔥`);
        }
      }

      if (sub === "resetear") {
        const user = interaction.options.getUser("usuario");
        levels.reset(gid, user.id);
        return ok(`XP de <@${user.id}> reiniciado a **0**.`);
      }

      if (sub === "setxp") {
        const user   = interaction.options.getUser("usuario");
        const amount = interaction.options.getInteger("cantidad");
        levels.setXp(gid, user.id, amount);
        const newLevel = levels.levelFromXp(amount);
        return ok(`XP de <@${user.id}> establecido en **${formatXP(amount)} XP** (nivel **${newLevel}**).`);
      }

      if (sub === "info") {
        const lsNow   = levelSettings.get(gid);
        const rewards = (lsNow.role_rewards || []).map(r => `Nv. **${r.level}** → <@&${r.role_id}>`).join("\n") || "Ninguna";
        const ignored = (lsNow.ignored_channels || []).map(c => `<#${c}>`).join(", ") || "Ninguno";
        const dxp     = (lsNow.double_xp_roles || []).map(r => `<@&${r}>`).join(", ") || "Ninguno";

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle("⭐ Configuración del Sistema de Niveles")
            .addFields(
              { name: "⚙️ Estado",       value: lsNow.enabled ? "✅ Activo" : "❌ Inactivo", inline: true },
              { name: "📢 Canal",        value: lsNow.channel ? `<#${lsNow.channel}>` : "Mismo canal", inline: true },
              { name: "⚡ XP/mensaje",   value: `${lsNow.xp_min}–${lsNow.xp_max} XP`, inline: true },
              { name: "⏱️ Cooldown",     value: `${lsNow.xp_cooldown}s`, inline: true },
              { name: "🔥 Roles x2 XP", value: dxp, inline: false },
              { name: "🎁 Recompensas",  value: rewards, inline: false },
              { name: "🚫 Canales ignorados", value: ignored, inline: false },
            ).setTimestamp()],
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};
