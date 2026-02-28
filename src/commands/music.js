const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");
const musicHandler = require("../handlers/musicHandler");

// ══════════════════════════════════════════════════════════════
//   /MUSIC - Sistema de música unificado con subcomandos
// ══════════════════════════════════════════════════════════════
module.exports = {
  data: new SlashCommandBuilder()
    .setName("music")
    .setDescription("🎵 Sistema de música")
    
    // ══════════════════════════════════════════════════════════════
    //   SUBCOMANDO: PLAY
    // ══════════════════════════════════════════════════════════════
    .addSubcommand(subcommand =>
      subcommand
        .setName("play")
        .setDescription("Reproducir música desde SoundCloud o Spotify 🎧")
        .addStringOption(option =>
          option
            .setName("busqueda")
            .setDescription("URL de SoundCloud o términos de búsqueda")
            .setRequired(true)
        )
        .addBooleanOption(option =>
          option
            .setName("siguiente")
            .setDescription("Añadir como siguiente en la cola")
            .setRequired(false)
        )
    )
    
    // ══════════════════════════════════════════════════════════════
    //   SUBCOMANDO: SKIP
    // ══════════════════════════════════════════════════════════════
    .addSubcommand(subcommand =>
      subcommand
        .setName("skip")
        .setDescription("⏭️ Saltar la canción actual")
    )
    
    // ══════════════════════════════════════════════════════════════
    //   SUBCOMANDO: STOP
    // ══════════════════════════════════════════════════════════════
    .addSubcommand(subcommand =>
      subcommand
        .setName("stop")
        .setDescription("⏹️ Detener la música y desconectar el bot")
    )
    
    // ══════════════════════════════════════════════════════════════
    //   SUBCOMANDO: PAUSE
    // ══════════════════════════════════════════════════════════════
    .addSubcommand(subcommand =>
      subcommand
        .setName("pause")
        .setDescription("⏸️ Pausar la reproducción")
    )
    
    // ══════════════════════════════════════════════════════════════
    //   SUBCOMANDO: RESUME
    // ══════════════════════════════════════════════════════════════
    .addSubcommand(subcommand =>
      subcommand
        .setName("resume")
        .setDescription("▶️ Reanudar la reproducción")
    )
    
    // ══════════════════════════════════════════════════════════════
    //   SUBCOMANDO: QUEUE
    // ══════════════════════════════════════════════════════════════
    .addSubcommand(subcommand =>
      subcommand
        .setName("queue")
        .setDescription("📋 Ver la cola de reproducción")
        .addIntegerOption(option =>
          option
            .setName("pagina")
            .setDescription("Número de página")
            .setRequired(false)
            .setMinValue(1)
        )
    )
    
    // ══════════════════════════════════════════════════════════════
    //   SUBCOMANDO: NOWPLAYING
    // ══════════════════════════════════════════════════════════════
    .addSubcommand(subcommand =>
      subcommand
        .setName("nowplaying")
        .setDescription("🎵 Ver la canción que se está reproduciendo ahora")
    )
    
    // ══════════════════════════════════════════════════════════════
    //   SUBCOMANDO: SHUFFLE
    // ══════════════════════════════════════════════════════════════
    .addSubcommand(subcommand =>
      subcommand
        .setName("shuffle")
        .setDescription("🔀 Mezclar la cola de reproducción")
    )
    
    // ══════════════════════════════════════════════════════════════
    //   SUBCOMANDO: REMOVE
    // ══════════════════════════════════════════════════════════════
    .addSubcommand(subcommand =>
      subcommand
        .setName("remove")
        .setDescription("🗑️ Remover una canción de la cola")
        .addIntegerOption(option =>
          option
            .setName("posicion")
            .setDescription("Posición de la canción en la cola")
            .setRequired(true)
            .setMinValue(1)
        )
    )
    
    // ══════════════════════════════════════════════════════════════
    //   SUBCOMANDO: CLEAR
    // ══════════════════════════════════════════════════════════════
    .addSubcommand(subcommand =>
      subcommand
        .setName("clear")
        .setDescription("🗑️ Limpiar toda la cola de reproducción")
    )
    
    // ══════════════════════════════════════════════════════════════
    //   SUBCOMANDO: VOLUME
    // ══════════════════════════════════════════════════════════════
    .addSubcommand(subcommand =>
      subcommand
        .setName("volume")
        .setDescription("🔊 Ajustar el volumen de reproducción")
        .addIntegerOption(option =>
          option
            .setName("nivel")
            .setDescription("Nivel de volumen (1-100)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)
        )
    )
    
    // ══════════════════════════════════════════════════════════════
    //   SUBCOMANDO: LOOP
    // ══════════════════════════════════════════════════════════════
    .addSubcommand(subcommand =>
      subcommand
        .setName("loop")
        .setDescription("🔁 Activar/desactivar modo de repetición")
        .addStringOption(option =>
          option
            .setName("modo")
            .setDescription("Modo de repetición")
            .setRequired(true)
            .addChoices(
              { name: "🔁 Canción actual", value: "song" },
              { name: "🔂 Cola completa", value: "queue" },
              { name: "❌ Desactivar", value: "off" }
            )
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    // ══════════════════════════════════════════════════════════════
    //   VERIFICACIÓN DE CANAL DE VOZ (común para la mayoría)
    // ══════════════════════════════════════════════════════════════
    // Los subcomandos que NO requieren estar en el canal: ninguno requiere verificación especial
    const voiceChannel = interaction.member.voice.channel;
    
    // Para el subcomando 'play', verificar permisos adicionales
    if (subcommand === "play") {
      if (!voiceChannel) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0xED4245)
            .setDescription("❌ Debes estar en un canal de voz para usar este comando.")],
          flags: 64,
        });
      }

      const permissions = voiceChannel.permissionsFor(interaction.client.user);
      if (!permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0xED4245)
            .setDescription("❌ No tengo permisos para conectarme o hablar en ese canal.")],
          flags: 64,
        });
      }
    }

    // ══════════════════════════════════════════════════════════════
    //   SWITCH DE SUBCOMANDOS
    // ══════════════════════════════════════════════════════════════
    switch (subcommand) {
      // ════════════════════════════════════════════════════════════
      //   PLAY
      // ════════════════════════════════════════════════════════════
      case "play": {
        await interaction.deferReply();

        const query = interaction.options.getString("busqueda");
        const playNext = interaction.options.getBoolean("siguiente") || false;

        try {
          const result = await musicHandler.addToQueue(
            interaction.guild.id,
            voiceChannel,
            query,
            interaction.user,
            playNext
          );

          if (result.error) {
            return interaction.editReply({
              embeds: [new EmbedBuilder()
                .setColor(0xED4245)
                .setDescription(`❌ ${result.error}`)],
            });
          }

          if (result.playlist) {
            return interaction.editReply({
              embeds: [new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle("📋 Playlist Añadida")
                .setDescription(`**${result.playlist.name}**\n\n✅ ${result.playlist.count} canciones añadidas a la cola`)
                .setThumbnail(result.playlist.thumbnail)
                .addFields(
                  { name: "👤 Solicitado por", value: interaction.user.toString(), inline: true },
                  { name: "🎵 Posición en cola", value: `${result.position}`, inline: true }
                )
                .setTimestamp()],
            });
          }

          const song = result.song;
          const embed = new EmbedBuilder()
            .setColor(result.nowPlaying ? 0x5865F2 : 0x57F287)
            .setTitle(result.nowPlaying ? "🎵 Reproduciendo Ahora" : "✅ Añadido a la Cola")
            .setDescription(`**[${song.title}](${song.url})**`)
            .setThumbnail(song.thumbnail)
            .addFields(
              { name: "👤 Artista", value: song.artist, inline: true },
              { name: "⏱️ Duración", value: song.duration, inline: true },
              { name: "👤 Solicitado por", value: interaction.user.toString(), inline: true }
            );

          if (!result.nowPlaying) {
            embed.addFields({ name: "📍 Posición", value: `#${result.position}`, inline: true });
          }

          embed.setTimestamp();

          const row = new ActionRowBuilder().addComponents(
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
              .setStyle(ButtonStyle.Secondary)
          );

          await interaction.editReply({ embeds: [embed], components: [row] });
        } catch (error) {
          console.error("[MUSIC PLAY]", error);
          return interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setDescription("❌ Error al procesar la canción. Intenta de nuevo.")],
          });
        }
        break;
      }

      // ════════════════════════════════════════════════════════════
      //   SKIP
      // ════════════════════════════════════════════════════════════
      case "skip": {
        const queue = musicHandler.getQueue(interaction.guild.id);
        if (!queue || !queue.songs.length) {
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setDescription("❌ No hay música reproduciéndose.")],
            flags: 64,
          });
        }

        if (!voiceChannel || voiceChannel.id !== queue.voiceChannel.id) {
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setDescription("❌ Debes estar en el mismo canal de voz que el bot.")],
            flags: 64,
          });
        }

        const skipped = musicHandler.skip(interaction.guild.id);

        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x5865F2)
            .setDescription(`⏭️ **Saltando:** ${skipped.title}\n\n${queue.songs.length > 0 ? `▶️ Siguiente: **${queue.songs[0].title}**` : "📭 Cola vacía"}`)
            .setTimestamp()],
        });
        break;
      }

      // ════════════════════════════════════════════════════════════
      //   STOP
      // ════════════════════════════════════════════════════════════
      case "stop": {
        const queue = musicHandler.getQueue(interaction.guild.id);
        if (!queue) {
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setDescription("❌ No hay música reproduciéndose.")],
            flags: 64,
          });
        }

        if (!voiceChannel || voiceChannel.id !== queue.voiceChannel.id) {
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setDescription("❌ Debes estar en el mismo canal de voz que el bot.")],
            flags: 64,
          });
        }

        musicHandler.stop(interaction.guild.id);

        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x5865F2)
            .setDescription("⏹️ Música detenida. ¡Hasta luego! 👋")
            .setTimestamp()],
        });
        break;
      }

      // ════════════════════════════════════════════════════════════
      //   PAUSE
      // ════════════════════════════════════════════════════════════
      case "pause": {
        const queue = musicHandler.getQueue(interaction.guild.id);
        if (!queue || !queue.playing) {
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setDescription("❌ No hay música reproduciéndose.")],
            flags: 64,
          });
        }

        if (!voiceChannel || voiceChannel.id !== queue.voiceChannel.id) {
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setDescription("❌ Debes estar en el mismo canal de voz que el bot.")],
            flags: 64,
          });
        }

        if (queue.connection.state.subscription.player.pause()) {
          queue.playing = false;
          await interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xFEE75C)
              .setDescription("⏸️ Reproducción pausada.")
              .setTimestamp()],
          });
        } else {
          await interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setDescription("❌ No se pudo pausar la reproducción.")],
            flags: 64,
          });
        }
        break;
      }

      // ════════════════════════════════════════════════════════════
      //   RESUME
      // ════════════════════════════════════════════════════════════
      case "resume": {
        const queue = musicHandler.getQueue(interaction.guild.id);
        if (!queue) {
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setDescription("❌ No hay música en la cola.")],
            flags: 64,
          });
        }

        if (!voiceChannel || voiceChannel.id !== queue.voiceChannel.id) {
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setDescription("❌ Debes estar en el mismo canal de voz que el bot.")],
            flags: 64,
          });
        }

        if (queue.connection.state.subscription.player.unpause()) {
          queue.playing = true;
          await interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0x57F287)
              .setDescription("▶️ Reproducción reanudada.")
              .setTimestamp()],
          });
        } else {
          await interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setDescription("❌ No se pudo reanudar la reproducción.")],
            flags: 64,
          });
        }
        break;
      }

      // ════════════════════════════════════════════════════════════
      //   QUEUE
      // ════════════════════════════════════════════════════════════
      case "queue": {
        const queue = musicHandler.getQueue(interaction.guild.id);
        if (!queue || !queue.currentSong) {
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setDescription("❌ No hay música en la cola.")],
            flags: 64,
          });
        }

        const page = interaction.options.getInteger("pagina") || 1;
        const perPage = 10;
        const start = (page - 1) * perPage;
        const end = start + perPage;
        const totalPages = Math.ceil(queue.songs.length / perPage);

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
            .slice(start, end)
            .map((song, i) => `**${start + i + 1}.** [${song.title}](${song.url})\n⏱️ ${song.duration} • 🙋 ${song.requestedBy}`)
            .join("\n\n");

          embed.addFields({ name: "\u200b", value: queueList });

          if (totalPages > 1) {
            embed.setFooter({ text: `Página ${page}/${totalPages} • ${queue.songs.length} canciones en cola` });
          }
        }

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("music_pause")
            .setEmoji("⏸️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!queue.playing),
          new ButtonBuilder()
            .setCustomId("music_resume")
            .setEmoji("▶️")
            .setStyle(ButtonStyle.Success)
            .setDisabled(queue.playing),
          new ButtonBuilder()
            .setCustomId("music_skip")
            .setEmoji("⏭️")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("music_stop")
            .setEmoji("⏹️")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("music_shuffle")
            .setEmoji("🔀")
            .setLabel("Mezclar")
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
        break;
      }

      // ════════════════════════════════════════════════════════════
      //   NOWPLAYING
      // ════════════════════════════════════════════════════════════
      case "nowplaying": {
        const queue = musicHandler.getQueue(interaction.guild.id);
        if (!queue || !queue.currentSong) {
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setDescription("❌ No hay música reproduciéndose.")],
            flags: 64,
          });
        }

        const song = queue.currentSong;
        const progress = musicHandler.getProgress(interaction.guild.id);

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("🎵 Reproduciendo Ahora")
          .setDescription(`**[${song.title}](${song.url})**`)
          .setThumbnail(song.thumbnail)
          .addFields(
            { name: "👤 Artista", value: song.artist, inline: true },
            { name: "⏱️ Duración", value: song.duration, inline: true },
            { name: "🙋 Solicitado por", value: song.requestedBy.toString(), inline: true },
            { name: "📊 Progreso", value: progress.bar + `\n${progress.current} / ${song.duration}`, inline: false },
            { name: "🔊 Estado", value: queue.playing ? "▶️ Reproduciendo" : "⏸️ Pausado", inline: true },
            { name: "📋 En cola", value: `${queue.songs.length} canciones`, inline: true }
          )
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("music_pause")
            .setEmoji("⏸️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!queue.playing),
          new ButtonBuilder()
            .setCustomId("music_resume")
            .setEmoji("▶️")
            .setStyle(ButtonStyle.Success)
            .setDisabled(queue.playing),
          new ButtonBuilder()
            .setCustomId("music_skip")
            .setEmoji("⏭️")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("music_stop")
            .setEmoji("⏹️")
            .setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
        break;
      }

      // ════════════════════════════════════════════════════════════
      //   SHUFFLE
      // ════════════════════════════════════════════════════════════
      case "shuffle": {
        const queue = musicHandler.getQueue(interaction.guild.id);
        if (!queue || queue.songs.length < 2) {
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setDescription("❌ Necesitas al menos 2 canciones en la cola para mezclar.")],
            flags: 64,
          });
        }

        if (!voiceChannel || voiceChannel.id !== queue.voiceChannel.id) {
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setDescription("❌ Debes estar en el mismo canal de voz que el bot.")],
            flags: 64,
          });
        }

        musicHandler.shuffle(interaction.guild.id);

        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x57F287)
            .setDescription(`🔀 Cola mezclada (${queue.songs.length} canciones)`)
            .setTimestamp()],
        });
        break;
      }

      // ════════════════════════════════════════════════════════════
      //   REMOVE
      // ════════════════════════════════════════════════════════════
      case "remove": {
        const queue = musicHandler.getQueue(interaction.guild.id);
        if (!queue || !queue.songs.length) {
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setDescription("❌ No hay canciones en la cola.")],
            flags: 64,
          });
        }

        const position = interaction.options.getInteger("posicion");
        if (position > queue.songs.length) {
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setDescription(`❌ Solo hay ${queue.songs.length} canciones en la cola.`)],
            flags: 64,
          });
        }

        const removed = musicHandler.remove(interaction.guild.id, position - 1);

        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x57F287)
            .setDescription(`🗑️ **Removido:** ${removed.title}`)
            .setTimestamp()],
        });
        break;
      }

      // ════════════════════════════════════════════════════════════
      //   CLEAR
      // ════════════════════════════════════════════════════════════
      case "clear": {
        const queue = musicHandler.getQueue(interaction.guild.id);
        if (!queue || !queue.songs.length) {
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setDescription("❌ La cola ya está vacía.")],
            flags: 64,
          });
        }

        if (!voiceChannel || voiceChannel.id !== queue.voiceChannel.id) {
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setDescription("❌ Debes estar en el mismo canal de voz que el bot.")],
            flags: 64,
          });
        }

        const count = queue.songs.length;
        musicHandler.clearQueue(interaction.guild.id);

        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x57F287)
            .setDescription(`🗑️ Cola limpiada (${count} canciones removidas)`)
            .setTimestamp()],
        });
        break;
      }

      // ════════════════════════════════════════════════════════════
      //   VOLUME
      // ════════════════════════════════════════════════════════════
      case "volume": {
        const queue = musicHandler.getQueue(interaction.guild.id);
        if (!queue) {
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setDescription("❌ No hay música reproduciéndose.")],
            flags: 64,
          });
        }

        if (!voiceChannel || voiceChannel.id !== queue.voiceChannel.id) {
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setDescription("❌ Debes estar en el mismo canal de voz que el bot.")],
            flags: 64,
          });
        }

        const volume = interaction.options.getInteger("nivel");
        musicHandler.setVolume(interaction.guild.id, volume);

        const emoji = volume >= 70 ? "🔊" : volume >= 30 ? "🔉" : "🔈";

        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x5865F2)
            .setDescription(`${emoji} Volumen ajustado a **${volume}%**`)
            .setTimestamp()],
        });
        break;
      }

      // ════════════════════════════════════════════════════════════
      //   LOOP
      // ════════════════════════════════════════════════════════════
      case "loop": {
        const queue = musicHandler.getQueue(interaction.guild.id);
        if (!queue) {
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setDescription("❌ No hay música reproduciéndose.")],
            flags: 64,
          });
        }

        if (!voiceChannel || voiceChannel.id !== queue.voiceChannel.id) {
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setDescription("❌ Debes estar en el mismo canal de voz que el bot.")],
            flags: 64,
          });
        }

        const mode = interaction.options.getString("modo");
        musicHandler.setLoop(interaction.guild.id, mode);

        const messages = {
          song: "🔁 Repetición de **canción actual** activada",
          queue: "🔂 Repetición de **cola completa** activada",
          off: "❌ Repetición desactivada",
        };

        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x5865F2)
            .setDescription(messages[mode])
            .setTimestamp()],
        });
        break;
      }

      default:
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0xED4245)
            .setDescription("❌ Subcomando no reconocido.")],
          flags: 64,
        });
    }
  },
};
