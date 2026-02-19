const {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ChannelType, MessageFlags,
} = require("discord.js");
const { polls } = require("../utils/database");
const { buildPollEmbed, buildPollButtons } = require("../handlers/pollHandler");
const E = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("📊 Sistema de encuestas interactivas")

    // ── Crear encuesta
    .addSubcommand(s => s
      .setName("crear")
      .setDescription("Crear una nueva encuesta con hasta 10 opciones")
      .addStringOption(o => o.setName("pregunta").setDescription("Pregunta de la encuesta").setRequired(true).setMaxLength(200))
      .addStringOption(o => o.setName("opciones").setDescription("Opciones separadas por | — ej: Opción A | Opción B | Opción C").setRequired(true).setMaxLength(500))
      .addStringOption(o => o.setName("duracion").setDescription("Duración — ej: 1h, 30m, 2d, 1h30m").setRequired(true))
      .addBooleanOption(o => o.setName("multiple").setDescription("¿Permitir votar por varias opciones? (default: No)").setRequired(false))
      .addChannelOption(o => o.setName("canal").setDescription("Canal donde publicar (vacío = canal actual)").addChannelTypes(ChannelType.GuildText).setRequired(false)))

    // ── Finalizar encuesta manualmente
    .addSubcommand(s => s
      .setName("finalizar")
      .setDescription("Finalizar una encuesta antes de que termine 🔐")
      .addStringOption(o => o.setName("id").setDescription("ID de la encuesta (últimos 6 caracteres)").setRequired(true)))

    // ── Ver encuestas activas
    .addSubcommand(s => s
      .setName("lista")
      .setDescription("Ver encuestas activas en el servidor")),

  async execute(interaction) {
    const sub  = interaction.options.getSubcommand();
    const gid  = interaction.guild.id;
    const er   = msg => interaction.reply({ embeds: [E.errorEmbed(msg)], flags: MessageFlags.Ephemeral });

    // ── /poll crear
    if (sub === "crear") {
      const pregunta  = interaction.options.getString("pregunta");
      const optsRaw   = interaction.options.getString("opciones");
      const durStr    = interaction.options.getString("duracion");
      const multiple  = interaction.options.getBoolean("multiple") || false;
      const targetCh  = interaction.options.getChannel("canal") || interaction.channel;

      // Parsear opciones
      const optsArr = optsRaw.split("|").map(o => o.trim()).filter(Boolean);
      if (optsArr.length < 2) return er("Necesitas al menos **2 opciones** separadas por `|`.");
      if (optsArr.length > 10) return er("Máximo **10 opciones** por encuesta.");
      if (optsArr.some(o => o.length > 80)) return er("Cada opción puede tener máximo **80 caracteres**.");

      // Parsear duración
      const ms = parseDuration(durStr);
      if (!ms || ms < 60000) return er("Duración mínima: **1 minuto**.\n\n**Ejemplos:** `30m` · `2h` · `1d` · `1h30m`");
      if (ms > 30 * 24 * 3600000) return er("Duración máxima: **30 días**.");

      const endsAt = new Date(Date.now() + ms).toISOString();

      // Crear placeholder en el canal
      const placeholder = await targetCh.send({ content: "⏳ Creando encuesta..." });

      const poll = polls.create(gid, targetCh.id, placeholder.id, interaction.user.id, pregunta, optsArr, endsAt, multiple);
      const embed   = buildPollEmbed(poll);
      const buttons = buildPollButtons(poll);

      await placeholder.edit({ content: null, embeds: [embed], components: buttons });

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("📊 Encuesta Creada")
          .setDescription(`Tu encuesta fue publicada en ${targetCh}.`)
          .addFields(
            { name: "❓ Pregunta",     value: pregunta,                                                  inline: false },
            { name: "🗳️ Opciones",    value: optsArr.map((o, i) => `${["🇦","🇧","🇨","🇩","🇪","🇫","🇬","🇭","🇮","🇯"][i]} ${o}`).join("\n"), inline: false },
            { name: "⏰ Termina",      value: `<t:${Math.floor((Date.now() + ms) / 1000)}:F>`,           inline: true },
            { name: "⏰ En",           value: `<t:${Math.floor((Date.now() + ms) / 1000)}:R>`,           inline: true },
            { name: "🗳️ Modo",        value: multiple ? "✅ Voto múltiple" : "1️⃣ Un voto",             inline: true },
            { name: "🆔 ID",           value: `\`${poll.id.slice(-6).toUpperCase()}\``,                  inline: true },
          )
          .setTimestamp()],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── /poll finalizar
    if (sub === "finalizar") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
        return er("Necesitas permiso de **Gestionar Mensajes** para finalizar encuestas.");

      const inputId = interaction.options.getString("id").toUpperCase().trim();
      const active  = polls.getByGuild(gid, false);
      const poll    = active.find(p => p.id.slice(-6).toUpperCase() === inputId);

      if (!poll) return er(`No se encontró la encuesta \`${inputId}\`. Usa \`/poll lista\` para ver las activas.`);

      polls.end(poll.id);

      const ch  = interaction.guild.channels.cache.get(poll.channel_id);
      const msg = ch ? await ch.messages.fetch(poll.message_id).catch(() => null) : null;
      if (msg) {
        const finalEmbed = buildPollEmbed(poll, true);
        await msg.edit({ embeds: [finalEmbed], components: [] }).catch(() => {});
      }

      return interaction.reply({
        embeds: [E.successEmbed(`Encuesta **"${poll.question}"** finalizada.`)],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── /poll lista
    if (sub === "lista") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const active = polls.getByGuild(gid, false);

      if (!active.length) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("📊 Encuestas Activas")
            .setDescription("No hay encuestas activas en este momento.\nCrea una con `/poll crear`.")
            .setTimestamp()],
        });
      }

      const desc = active.map(p => {
        const totalVotes = p.options.reduce((s, o) => s + o.votes.length, 0);
        const ch = interaction.guild.channels.cache.get(p.channel_id);
        return (
          `**"${p.question}"**\n` +
          `📢 ${ch ? `<#${p.channel_id}>` : "Canal eliminado"} · 🗳️ ${totalVotes} votos · ` +
          `⏰ <t:${Math.floor(new Date(p.ends_at).getTime() / 1000)}:R> · ` +
          `🆔 \`${p.id.slice(-6).toUpperCase()}\``
        );
      }).join("\n\n");

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(`📊 Encuestas Activas (${active.length})`)
          .setDescription(desc)
          .setFooter({ text: "Usa /poll finalizar [ID] para cerrar una manualmente" })
          .setTimestamp()],
      });
    }
  },
};

// ── Parser de duración
function parseDuration(input) {
  const str     = input.toLowerCase().trim();
  const pattern = /(\d+)\s*(s|seg|m|min|minuto|minutos|h|hr|hora|horas|d|dia|día|dias|días)/g;
  let totalMs   = 0, match;
  while ((match = pattern.exec(str)) !== null) {
    const val  = parseInt(match[1]);
    const unit = match[2];
    if (["s","seg"].includes(unit))                        totalMs += val * 1000;
    else if (["m","min","minuto","minutos"].includes(unit)) totalMs += val * 60000;
    else if (["h","hr","hora","horas"].includes(unit))      totalMs += val * 3600000;
    else if (["d","dia","día","dias","días"].includes(unit)) totalMs += val * 86400000;
  }
  return totalMs;
}
