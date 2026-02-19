const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require("discord.js");
const { reminders } = require("../utils/database");
const E = require("../utils/embeds");

// ── Parsear duración tipo "2h30m", "1d", "45m", "1h", "2d12h"
function parseDuration(input) {
  const str     = input.toLowerCase().trim();
  const pattern = /(\d+)\s*(s|seg|segundo|segundos|m|min|minuto|minutos|h|hr|hora|horas|d|dia|día|dias|días|w|sem|semana|semanas)/g;
  let totalMs   = 0;
  let match;
  while ((match = pattern.exec(str)) !== null) {
    const val  = parseInt(match[1]);
    const unit = match[2];
    if (["s","seg","segundo","segundos"].includes(unit)) totalMs += val * 1000;
    else if (["m","min","minuto","minutos"].includes(unit)) totalMs += val * 60000;
    else if (["h","hr","hora","horas"].includes(unit))      totalMs += val * 3600000;
    else if (["d","dia","día","dias","días"].includes(unit)) totalMs += val * 86400000;
    else if (["w","sem","semana","semanas"].includes(unit))  totalMs += val * 604800000;
  }
  return totalMs;
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60)     return `${s} segundo${s !== 1 ? "s" : ""}`;
  const m = Math.floor(s / 60);
  if (m < 60)     return `${m} minuto${m !== 1 ? "s" : ""}`;
  const h = Math.floor(m / 60);
  if (h < 24)     return `${h} hora${h !== 1 ? "s" : ""} ${m % 60 > 0 ? `${m % 60}m` : ""}`.trim();
  const d = Math.floor(h / 24);
  return `${d} día${d !== 1 ? "s" : ""} ${h % 24 > 0 ? `${h % 24}h` : ""}`.trim();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remind")
    .setDescription("⏰ Gestionar recordatorios personales")
    .addSubcommand(s => s
      .setName("set")
      .setDescription("Crear un nuevo recordatorio")
      .addStringOption(o => o.setName("tiempo").setDescription("Cuándo recordar — ej: 30m, 2h, 1d, 1h30m, 2d").setRequired(true))
      .addStringOption(o => o.setName("mensaje").setDescription("Qué quieres que te recuerde").setRequired(true).setMaxLength(500)))
    .addSubcommand(s => s
      .setName("lista")
      .setDescription("Ver tus recordatorios pendientes"))
    .addSubcommand(s => s
      .setName("cancelar")
      .setDescription("Cancelar un recordatorio")
      .addStringOption(o => o.setName("id").setDescription("ID del recordatorio (ver con /remind lista)").setRequired(true))),

  async execute(interaction) {
    const sub  = interaction.options.getSubcommand();
    const user = interaction.user;
    const gid  = interaction.guild.id;

    // ── /remind set
    if (sub === "set") {
      const tiempoStr = interaction.options.getString("tiempo");
      const mensaje   = interaction.options.getString("mensaje");
      const ms        = parseDuration(tiempoStr);

      if (!ms || ms < 5000) {
        return interaction.reply({
          embeds: [E.errorEmbed(
            "Duración inválida o demasiado corta.\n\n" +
            "**Ejemplos válidos:**\n" +
            "`30m` · `2h` · `1d` · `1h30m` · `2d12h` · `1 semana`"
          )],
          flags: MessageFlags.Ephemeral,
        });
      }

      const maxMs = 30 * 24 * 3600000; // 30 días máximo
      if (ms > maxMs) {
        return interaction.reply({
          embeds: [E.errorEmbed("El máximo es **30 días**.")],
          flags: MessageFlags.Ephemeral,
        });
      }

      // Límite de 10 recordatorios activos por usuario
      const existing = reminders.getByUser(user.id, gid);
      if (existing.length >= 10) {
        return interaction.reply({
          embeds: [E.errorEmbed("Tienes **10 recordatorios activos** (máximo). Cancela alguno con `/remind cancelar`.")],
          flags: MessageFlags.Ephemeral,
        });
      }

      const fireAt = new Date(Date.now() + ms).toISOString();
      const id     = reminders.create(user.id, gid, interaction.channel.id, mensaje, fireAt);
      const short  = id.slice(-6).toUpperCase();

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle("⏰ Recordatorio Creado")
          .setDescription(`Te recordaré en **${formatDuration(ms)}**:\n\n> ${mensaje}`)
          .addFields(
            { name: "🕐 Cuándo",   value: `<t:${Math.floor((Date.now() + ms) / 1000)}:F>`, inline: true },
            { name: "🕐 En",       value: `<t:${Math.floor((Date.now() + ms) / 1000)}:R>`, inline: true },
            { name: "🆔 ID",       value: `\`${short}\``, inline: true },
          )
          .setFooter({ text: "Te avisaré por DM. Si los tienes cerrados, te mencionaré en este canal." })
          .setTimestamp()],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── /remind lista
    if (sub === "lista") {
      const list = reminders.getByUser(user.id, gid);

      if (!list.length) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("⏰ Tus Recordatorios")
            .setDescription("No tienes recordatorios pendientes.\nCrea uno con `/remind set`.")
            .setTimestamp()],
          flags: MessageFlags.Ephemeral,
        });
      }

      const desc = list.map((r, i) => {
        const short  = r.id.slice(-6).toUpperCase();
        const timeTs = Math.floor(new Date(r.fire_at).getTime() / 1000);
        return `**${i + 1}.** \`${short}\` — <t:${timeTs}:R>\n> ${r.text.substring(0, 100)}${r.text.length > 100 ? "…" : ""}`;
      }).join("\n\n");

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle(`⏰ Tus Recordatorios (${list.length}/10)`)
          .setDescription(desc)
          .setFooter({ text: "Usa /remind cancelar [ID] para eliminar uno" })
          .setTimestamp()],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── /remind cancelar
    if (sub === "cancelar") {
      const inputId = interaction.options.getString("id").toUpperCase().trim();
      const list    = reminders.getByUser(user.id, gid);

      // Buscar por los últimos 6 caracteres del ID (lo que mostramos al usuario)
      const target = list.find(r => r.id.slice(-6).toUpperCase() === inputId);
      if (!target) {
        return interaction.reply({
          embeds: [E.errorEmbed(`No se encontró el recordatorio \`${inputId}\`. Usa \`/remind lista\` para ver tus IDs.`)],
          flags: MessageFlags.Ephemeral,
        });
      }

      reminders.delete(target.id, user.id);
      return interaction.reply({
        embeds: [E.successEmbed(`Recordatorio \`${inputId}\` cancelado:\n> ${target.text.substring(0, 100)}`)],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
