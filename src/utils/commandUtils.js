const { PermissionFlagsBits } = require("discord.js");
const { settings } = require("./database");

// Comandos que requieren permisos de administrador
const ADMIN_COMMANDS = [
  "setup", "stats", "blacklist", "tag", "autoresponse", 
  "maintenance", "closeall", "lockdown"
];

const COMMAND_ALIASES = {
  "ayuda": "help",
  "soporte": "help",
  "ayudaplay": "help",
  "estadisticas": "stats",
  "ranking": "rank",
  "rankingtop": "rank",
  "verificar": "verify",
  "bienvenida": "welcome",
  "verificacion": "verify",
  "configurar": "setup",
  "panel": "setup",
  "rank": "rank",
  "ping": "ping",
};

// Función para resolver comandos (incluye aliases)
function resolveCommand(commandName, client) {
  let cmd = client.commands.get(commandName);
  if (cmd) return cmd;
  
  const alias = COMMAND_ALIASES[commandName.toLowerCase()];
  if (alias) {
    cmd = client.commands.get(alias);
    if (cmd) return cmd;
  }
  
  const parts = commandName.split(" ");
  if (parts.length > 1) {
    cmd = client.commands.get(parts[0]);
    if (cmd) return cmd;
  }
  
  return null;
}

// Función para verificar si el usuario es administrador
// Validación: Permission native Administrator O admin_role de la base de datos
async function checkAdmin(interaction) {
  const guild = interaction.guild;
  const member = interaction.member;
  
  // 1. Verificar permiso nativo Administrator de Discord
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }
  
  // 2. Verificar admin_role desde la base de datos (settings)
  const s = await settings.get(guild.id);
  if (s.admin_role && s.admin_role !== null) {
    if (member.roles.cache.has(s.admin_role)) {
      return true;
    }
  }
  
  // No tiene permisos
  return false;
}

// Función para verificar si el usuario es staff
function checkStaff(member, s) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (s.support_role && s.support_role !== null && member.roles.cache.has(s.support_role)) return true;
  if (s.admin_role && s.admin_role !== null && member.roles.cache.has(s.admin_role)) return true;
  return false;
}

module.exports = {
  ADMIN_COMMANDS,
  COMMAND_ALIASES,
  resolveCommand,
  checkAdmin,
  checkStaff
};
