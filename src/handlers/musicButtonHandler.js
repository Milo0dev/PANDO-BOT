const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const musicHandler = require("./musicHandler");

// ══════════════════════════════════════════════════════════════
//   HANDLER DE INTERACCIONES DE MÚSICA
// ══════════════════════════════════════════════════════════════

module.exports = async function handleMusicButtons(interaction) {
  if (!interaction.isButton()) return;
  
  const customId = interaction.customId;
  
  // Solo procesar botones de música
  if (!customId.startsWith("music_")) return;

  const queue = musicHandler.getQueue(interaction.guild.id);
  
  // Verificar que haya música
  if (!queue && !["music_pause", "music_resume", "music_stop"].includes(customId)) {
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription("❌ No hay música reproduciéndose.")],
      ephemeral: true,
    });
  }

  // Verificar que el usuario esté en el canal de voz
  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel || (queue && voiceChannel.id !== queue.voiceChannel.id)) {
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription("❌ Debes estar en el mismo canal de voz que el bot.")],
      ephemeral: true,
    });
  }

  // ════════════════════════════════════════════════════════════
  //   BOTÓN: PAUSAR
  // ════════════════════════════════════════════════════════════
  if (customId === "music_pause") {
    if (!queue || !queue.playing) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription("❌ No hay música reproduciéndose.")],
        ephemeral: true,
      });
    }

    if (queue.connection.state.subscription.player.pause()) {
      queue.playing = false;
      
      await interaction.update({
        embeds: [new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle("⏸️ Reproducción Pausada")
          .setDescription(`**[${queue.currentSong.title}](${queue.currentSong.url})**`)
          .setThumbnail(queue.currentSong.thumbnail)
          .setTimestamp()],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("music_resume")
            .setEmoji("▶️")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("music_skip")
            .setEmoji("⏭️")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("music_stop")
            .setEmoji("⏹️")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("music_queue")
            .setEmoji("📋")
            .setLabel("Cola")
            .setStyle(ButtonStyle.Secondary),
        )],
      });
    }
  }

  // ════════════════════════════════════════════════════════════
  //   BOTÓN: REANUDAR
  // ════════════════════════════════════════════════════════════
  else if (customId === "music_resume") {
    if (!queue) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription("❌ No hay música en la cola.")],
        ephemeral: true,
      });
    }

    if (queue.connection.state.subscription.player.unpause()) {
      queue.playing = true;
      
      await interaction.update({
        embeds: [new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle("▶️ Reproducción Reanudada")
          .setDescription(`**[${queue.currentSong.title}](${queue.currentSong.url})**`)
          .setThumbnail(queue.currentSong.thumbnail)
          .setTimestamp()],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("music_pause")
            .setEmoji("⏸️")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("music_skip")
            .setEmoji("⏭️")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("music_stop")
            .setEmoji("⏹️")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("music_queue")
            .setEmoji("📋")
            .setLabel("Cola")
            .setStyle(ButtonStyle.Secondary),
        )],
      });
    }
  }

  // ════════════════════════════════════════════════════════════
  //   BOTÓN: SALTAR
  // ════════════════════════════════════════════════════════════
  else if (customId === "music_skip") {
    const skipped = musicHandler.skip(interaction.guild.id);
    
    await interaction.update({
      embeds: [new EmbedBuilder()
        .setColor(0x5865F2)
        .setDescription(`⏭️ **Saltando:** ${skipped.title}\n\n${queue.songs.length > 0 ? `▶️ Siguiente: **${queue.songs[0].title}**` : "📭 Cola vacía"}`)
        .setTimestamp()],
      components: [],
    });
  }

  // ════════════════════════════════════════════════════════════
  //   BOTÓN: DETENER
  // ════════════════════════════════════════════════════════════
  else if (customId === "music_stop") {
    musicHandler.stop(interaction.guild.id);
    
    await interaction.update({
      embeds: [new EmbedBuilder()
        .setColor(0x5865F2)
        .setDescription("⏹️ Música detenida. ¡Hasta luego! 👋")
        .setTimestamp()],
      components: [],
    });
  }

  // ════════════════════════════════════════════════════════════
  //   BOTÓN: VER COLA
  // ════════════════════════════════════════════════════════════
  else if (customId === "music_queue") {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("📋 Cola de Reproducción")
      .setDescription(
        `**🎵 Reproduciendo Ahora:**\n` +
        `**[${queue.currentSong.title}](${queue.currentSong.url})**\n` +
        `👤 ${queue.currentSong.artist} • ⏱️ ${queue.currentSong.duration}\n` +
        `🙋 Solicitado por: ${queue.currentSong.requestedBy}\n\n` +
        `${queue.songs.length > 0 ? `**📜 Próximas (${queue.songs.length}):**` : "📭 No hay más canciones en cola"}`
      )
      .setThumbnail(queue.currentSong.thumbnail);

    if (queue.songs.length > 0) {
      const queueList = queue.songs
        .slice(0, 10)
        .map((song, i) => `**${i + 1}.** [${song.title}](${song.url})\n⏱️ ${song.duration} • 🙋 ${song.requestedBy}`)
        .join("\n\n");

      embed.addFields({ name: "\u200b", value: queueList });

      if (queue.songs.length > 10) {
        embed.setFooter({ text: `Y ${queue.songs.length - 10} más...` });
      }
    }

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  }

  // ════════════════════════════════════════════════════════════
  //   BOTÓN: MEZCLAR
  // ════════════════════════════════════════════════════════════
  else if (customId === "music_shuffle") {
    if (queue.songs.length < 2) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription("❌ Necesitas al menos 2 canciones en la cola para mezclar.")],
        ephemeral: true,
      });
    }

    musicHandler.shuffle(interaction.guild.id);
    
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x57F287)
        .setDescription(`🔀 Cola mezclada (${queue.songs.length} canciones)`)
        .setTimestamp()],
      ephemeral: true,
    });
  }
};
