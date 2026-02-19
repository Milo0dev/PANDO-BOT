const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const LETTERS = ["🇦","🇧","🇨","🇩","🇪","🇫","🇬","🇭","🇮","🇯"];
const BAR_FULL  = "█";
const BAR_EMPTY = "░";

// Construir el embed de la encuesta
function buildPollEmbed(poll, ended = false) {
  const totalVotes = poll.options.reduce((sum, o) => sum + o.votes.length, 0);

  const optionsText = poll.options.map((o, i) => {
    const count  = o.votes.length;
    const pct    = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    const barLen = Math.round(pct / 10);
    const bar    = BAR_FULL.repeat(barLen) + BAR_EMPTY.repeat(10 - barLen);
    const winner = ended && count === Math.max(...poll.options.map(x => x.votes.length)) && count > 0;
    return `${LETTERS[i]} **${o.text}**\n${winner ? "🏆 " : ""}${"`" + bar + "`"} **${pct}%** (${count} voto${count !== 1 ? "s" : ""})`;
  }).join("\n\n");

  const color = ended ? 0x57F287 : 0x5865F2;
  const endsAt = new Date(poll.ends_at);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle((ended ? "📊 [FINALIZADA] " : "📊 ") + poll.question)
    .setDescription(optionsText || "Sin opciones")
    .addFields(
      { name: "🗳️ Total votos",  value: `\`${totalVotes}\``, inline: true },
      { name: ended ? "✅ Estado" : "⏰ Termina", value: ended ? "Finalizada" : `<t:${Math.floor(endsAt.getTime()/1000)}:R>`, inline: true },
      { name: "👤 Creada por",   value: `<@${poll.creator_id}>`, inline: true },
    );

  if (!ended) {
    embed.setFooter({ text: `${poll.allow_multiple ? "Puedes votar por varias opciones" : "Solo un voto por persona"} • ID: ${poll.id.slice(-6)}` });
  } else {
    embed.setFooter({ text: `Encuesta finalizada • ID: ${poll.id.slice(-6)}` });
  }

  embed.setTimestamp();
  return embed;
}

// Construir los botones de votación
function buildPollButtons(poll) {
  const rows = [];
  const chunkSize = 5;
  for (let i = 0; i < poll.options.length; i += chunkSize) {
    const row = new ActionRowBuilder();
    const chunk = poll.options.slice(i, i + chunkSize);
    for (const opt of chunk) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`poll_vote_${poll.id}_${opt.id}`)
          .setLabel(opt.text.substring(0, 20))
          .setEmoji(LETTERS[opt.id])
          .setStyle(ButtonStyle.Primary)
      );
    }
    rows.push(row);
  }
  return rows;
}

module.exports = { buildPollEmbed, buildPollButtons, LETTERS };
