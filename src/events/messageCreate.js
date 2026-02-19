const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { tickets, settings, autoResponses, levelSettings, levels } = require("../utils/database");

// Cooldown de XP en memoria: "guildId::userId" -> timestamp
const xpCooldown = new Map();

module.exports = {
  name: "messageCreate",
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    // ── 1. SISTEMA DE TICKETS (lógica original)
    const ticket  = tickets.get(message.channel.id);
    if (ticket && ticket.status === "open") {
      const s      = settings.get(message.guild.id);
      const isStaff = isStaffMember(message.member, s);
      tickets.incrementMessages(message.channel.id, isStaff);

      if (!isStaff && message.content) {
        const match = autoResponses.match(message.guild.id, message.content);
        if (match) {
          autoResponses.use(message.guild.id, match.trigger);
          await message.channel.send({
            content: `> 🤖 **Respuesta automática** — *"${match.trigger}"*\n\n${match.response}`,
          }).catch(() => {});
        }
      }
    }

    // ── 2. SISTEMA DE XP / NIVELES
    await handleXP(message, client);
  },
};

async function handleXP(message, client) {
  const guild = message.guild;
  const ls    = levelSettings.get(guild.id);

  if (!ls.enabled) return;
  if (!message.content || message.content.startsWith("/")) return;

  // Ignorar canales excluidos
  if (ls.ignored_channels.includes(message.channel.id)) return;

  // Ignorar roles excluidos
  if (ls.ignored_roles.some(r => message.member?.roles.cache.has(r))) return;

  // Cooldown
  const key  = guild.id + "::" + message.author.id;
  const last = xpCooldown.get(key) || 0;
  const now_ = Date.now();
  if (now_ - last < ls.xp_cooldown * 1000) return;
  xpCooldown.set(key, now_);

  // Calcular XP a dar (aleatorio entre min y max)
  let xpAmount = Math.floor(Math.random() * (ls.xp_max - ls.xp_min + 1)) + ls.xp_min;

  // XP doble si tiene rol especial
  if (ls.double_xp_roles.some(r => message.member?.roles.cache.has(r))) xpAmount *= 2;

  const result = levels.addXp(guild.id, message.author.id, xpAmount);

  // Si subió de nivel
  if (result.leveled) {
    const lvl = result.level;

    // Recompensas de roles
    if (ls.role_rewards?.length) {
      const reward = ls.role_rewards.find(r => r.level === lvl);
      if (reward) {
        const role = guild.roles.cache.get(reward.role_id);
        if (role) {
          await message.member.roles.add(role).catch(() => {});
          // Quitar rol anterior si stack está desactivado
          if (!ls.stack_roles) {
            const prevReward = ls.role_rewards.find(r => r.level === lvl - 1);
            if (prevReward) {
              const prevRole = guild.roles.cache.get(prevReward.role_id);
              if (prevRole) await message.member.roles.remove(prevRole).catch(() => {});
            }
          }
        }
      }
    }

    // Anuncio de subida de nivel
    const lvlMsg = ls.levelup_message
      .replace(/{mention}/g, `<@${message.author.id}>`)
      .replace(/{user}/g,    message.author.username)
      .replace(/{level}/g,   String(lvl))
      .replace(/{xp}/g,      String(result.total_xp));

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setDescription(lvlMsg)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    const targetChannel = ls.channel
      ? (guild.channels.cache.get(ls.channel) || message.channel)
      : message.channel;

    await targetChannel.send({ embeds: [embed] }).catch(() => {});
  }
}

function isStaffMember(member, s) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (s.support_role && member.roles.cache.has(s.support_role)) return true;
  if (s.admin_role   && member.roles.cache.has(s.admin_role))   return true;
  return false;
}
