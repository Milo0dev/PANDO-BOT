const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  PermissionsBitField
} = require("discord.js");
const { getDB } = require("../utils/database");

const giveaways = new Map();

// ══════════════════════════════════════════════════════════════
//   /GIVEAWAY CREATE - Crear un giveaway
// ══════════════════════════════════════════════════════════════
module.exports.create = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("🎁 Administrador de giveaways")
    .addSubcommand(sub => sub
      .setName("create")
      .setDescription("Crear un nuevo giveaway")
      .addStringOption(o => o.setName("premio").setDescription("Premio del giveaway").setRequired(true))
      .addIntegerOption(o => o.setName("ganadores").setDescription("Número de ganadores").setRequired(true).setMinValue(1).setMaxValue(10))
      .addStringOption(o => o.setName("tiempo").setDescription("Tiempo (ej: 1h, 30m, 2d)").setRequired(true))
      .addChannelOption(o => o.setName("canal").setDescription("Canal donde se creará").setRequired(false)))
    .addSubcommand(sub => sub
      .setName("reroll")
      .setDescription("Rerollear un giveaway")
      .addStringOption(o => o.setName("mensaje_id").setDescription("ID del mensaje del giveaway").setRequired(true))),

  async execute(interaction) {
    if (interaction.options.getSubcommand() === "create") {
      await this.createGiveaway(interaction);
    } else if (interaction.options.getSubcommand() === "reroll") {
      await this.rerollGiveaway(interaction);
    }
  },

  async createGiveaway(interaction) {
    const prize = interaction.options.getString("premio");
    const winners = interaction.options.getInteger("ganadores");
    const timeStr = interaction.options.getString("tiempo");
    const channel = interaction.options.getChannel("canal") || interaction.channel;

    // Parsear tiempo
    const timeMs = this.parseTime(timeStr);
    if (!timeMs) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription("❌ Formato de tiempo inválido. Usa: 1s, 1m, 1h, 1d")],
        flags: 64
      });
    }

    const endTime = Date.now() + timeMs;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("🎁 GIVEAWAY")
      .setDescription(`**Premio:** ${prize}\n\n🎉 Reacciona para participar!\n\n🏆 Ganadores: **${winners}**\n⏰ Termina en: **${timeStr}**`)
      .setFooter({ text: "Haz clic en el botón para participar" })
      .setTimestamp(new Date(endTime));

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId("giveaway_join")
          .setLabel("🎉 Participar")
          .setStyle(ButtonStyle.Success)
      );

    const msg = await channel.send({ embeds: [embed], components: [row] });

    // Guardar giveaway
    const giveawayData = {
      messageId: msg.id,
      channelId: channel.id,
      guildId: interaction.guildId,
      prize,
      winners,
      endTime,
      participants: [],
      ended: false,
      createdBy: interaction.user.id
    };

    giveaways.set(msg.id, giveawayData);

    // Programar terminación
    setTimeout(async () => {
      await this.endGiveaway(msg.id);
    }, timeMs);

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x57F287)
        .setDescription(`✅ Giveaway creado en ${channel}\nPremio: ${prize}\nGanadores: ${winners}`)]
    });
  },

  async rerollGiveaway(interaction) {
    const messageId = interaction.options.getString("mensaje_id");
    const giveaway = giveaways.get(messageId);

    if (!giveaway || !giveaway.ended) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription("❌ Giveaway no encontrado o no ha terminado.")],
        flags: 64
      });
    }

    if (giveaway.participants.length === 0) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription("❌ No hay participantes para rerappear.")],
        flags: 64
      });
    }

    const winners = [];
    const participants = [...giveaway.participants];
    
    for (let i = 0; i < Math.min(giveaway.winners, participants.length); i++) {
      const idx = Math.floor(Math.random() * participants.length);
      winners.push(participants[idx]);
      participants.splice(idx, 1);
    }

    const channel = interaction.guild.channels.cache.get(giveaway.channelId);
    const msg = await channel.messages.fetch(giveaway.messageId).catch(() => null);

    if (msg) {
      const newEmbed = EmbedBuilder.from(msg.embeds[0])
        .setColor(0xFEE75C)
        .setTitle("🎁 GIVEAWAY - REROLL")
        .setDescription(msg.embeds[0].description + "\n\n🏆 **Nuevos ganadores:**\n" + 
          winners.map(w => `<@${w}>`).join(", "));

      await msg.edit({ embeds: [newEmbed], components: [] });
    }

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle("🎉 Nuevos ganadores!")
        .setDescription("Los nuevos ganadores son:\n" + winners.map(w => `<@${w}>`).join(", "))]
    });
  },

  async endGiveaway(messageId) {
    const giveaway = giveaways.get(messageId);
    if (!giveaway || giveaway.ended) return;

    giveaway.ended = true;

    if (giveaway.participants.length === 0) {
      const channel = giveaway.channelId ? 
        (await import("discord.js")).Client.channels.cache.get(giveaway.channelId) : null;
      if (channel) {
        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (msg) {
          await msg.edit({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setTitle("🎁 GIVEAWAY TERMINADO")
              .setDescription("❌ No hubo participantes.")],
            components: []
          });
        }
      }
      return;
    }

    // Seleccionar ganadores
    const winners = [];
    const participants = [...giveaway.participants];
    
    for (let i = 0; i < Math.min(giveaway.winners, participants.length); i++) {
      const idx = Math.floor(Math.random() * participants.length);
      winners.push(participants[idx]);
      participants.splice(idx, 1);
    }

    // Actualizar mensaje
    const channel = giveaway.channelId ? 
      (await import("discord.js")).Client.channels.cache.get(giveaway.channelId) : null;
    
    if (channel) {
      const msg = await channel.messages.fetch(messageId).catch(() => null);
      if (msg) {
        await msg.edit({
          embeds: [new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle("🎁 GIVEAWAY TERMINADO!")
            .setDescription(`**Premio:** ${giveaway.prize}\n\n🏆 **Ganadores:**\n` + 
              winners.map(w => `<@${w}>`).join(", ") + 
              "\n\n¡Felicidades a los ganadores!")
            .setTimestamp()],
          components: []
        });

        // Mention winners
        await channel.send({
          content: "🎉 ¡Felicidades! " + winners.map(w => `<@${w}>`).join(", ") + 
            ` ¡Ganaste el giveaway: **${giveaway.prize}**!`
        });
      }
    }
  },

  parseTime(timeStr) {
    const match = timeStr.match(/^(\d+)(s|m|h|d)$/i);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };

    return value * multipliers[unit];
  }
};

// Exportar para usar en el handler de interacciones
module.exports.handleGiveawayJoin = async function(interaction, client) {
  if (interaction.customId !== "giveaway_join") return false;

  const message = interaction.message;
  const giveaway = giveaways.get(message.id);

  if (!giveaway) {
    await interaction.reply({ 
      content: "Este giveaway ya ha terminado.", 
      flags: 64 
    });
    return true;
  }

  if (giveaway.participants.includes(interaction.user.id)) {
    await interaction.reply({ 
      content: "Ya estás participando en este giveaway!", 
      flags: 64 
    });
    return true;
  }

  giveaway.participants.push(interaction.user.id);

  await interaction.reply({ 
    content: "¡Estás participando en el giveaway! 🎉", 
    flags: 64 
  });

  // Actualizar contador
  const newEmbed = EmbedBuilder.from(message.embeds[0])
    .setDescription(message.embeds[0].description + `\n\n👥 Participantes: **${giveaway.participants.length}**`);

  await message.edit({ embeds: [newEmbed] });

  return true;
};
