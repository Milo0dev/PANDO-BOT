const { tickets, settings, autoResponses } = require("../utils/database");

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const ticket = tickets.get(message.channel.id);
    if (!ticket || ticket.status !== "open") return;

    const s       = settings.get(message.guild.id);
    const isStaff = isStaffMember(message.member, s);

    // Contar mensaje y registrar 1ª respuesta del staff
    tickets.incrementMessages(message.channel.id, isStaff);

    // Auto-respuestas (solo si el mensaje es del usuario, no del staff)
    if (!isStaff && message.content) {
      const match = autoResponses.match(message.guild.id, message.content);
      if (match) {
        autoResponses.use(message.guild.id, match.trigger);
        await message.channel.send({
          content: `> 🤖 **Respuesta automática** — *"${match.trigger}"*\n\n${match.response}`,
        }).catch(() => {});
      }
    }
  },
};

function isStaffMember(member, s) {
  if (!member) return false;
  const { PermissionFlagsBits } = require("discord.js");
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (s.support_role && member.roles.cache.has(s.support_role)) return true;
  if (s.admin_role   && member.roles.cache.has(s.admin_role))   return true;
  return false;
}
