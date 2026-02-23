const {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  entersState,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  getVoiceConnection,
} = require("@discordjs/voice");
const play = require("play-dl");
const SpotifyWebApi = require("spotify-web-api-node");
const { EmbedBuilder } = require("discord.js");

// ══════════════════════════════════════════════════════════════
//   CONFIGURACIÓN DE SPOTIFY
// ══════════════════════════════════════════════════════════════
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

// Autenticar con Spotify
async function authenticateSpotify() {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body.access_token);
    console.log("✅ Spotify autenticado correctamente");
    
    // Renovar token cada 55 minutos
    setTimeout(authenticateSpotify, 55 * 60 * 1000);
  } catch (error) {
    console.error("❌ Error al autenticar Spotify:", error);
  }
}

// Inicializar autenticación
if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
  authenticateSpotify();
}

// ══════════════════════════════════════════════════════════════
//   SISTEMA DE COLAS
// ══════════════════════════════════════════════════════════════
const queues = new Map();

// Intervalo de limpieza de colas huérfanas (5 minutos)
const ORPHAN_CLEANUP_INTERVAL = 5 * 60 * 1000;

class MusicQueue {
  constructor(guildId, voiceChannel) {
    this.guildId = guildId;
    this.voiceChannel = voiceChannel;
    this.songs = [];
    this.currentSong = null;
    this.playing = false;
    this.volume = 50;
    this.loop = "off"; // off, song, queue
    this.connection = null;
    this.player = null;
    this.resource = null;
    this.startTime = null;
    this.lastActivity = Date.now();
  }
}

// ══════════════════════════════════════════════════════════════
//   FUNCIONES AUXILIARES
// ══════════════════════════════════════════════════════════════

function getQueue(guildId) {
  return queues.get(guildId);
}

function createQueue(guildId, voiceChannel) {
  const queue = new MusicQueue(guildId, voiceChannel);
  queues.set(guildId, queue);
  return queue;
}

function deleteQueue(guildId) {
  const queue = queues.get(guildId);
  if (queue) {
    if (queue.connection) {
      try {
        queue.connection.destroy();
      } catch (err) {
        // Ignorar el error si la conexión ya estaba destruida
      }
    }
    if (queue.player) {
      queue.player.stop();
    }
  }
  queues.delete(guildId);
}

/**
 * Limpiar colas huérfanas - elimina colas cuando no hay nadie en el canal de voz
 */
async function cleanupOrphanedQueues(client) {
  if (!client || !client.guilds) return;
  
  let cleaned = 0;
  
  for (const [guildId, queue] of queues.entries()) {
    try {
      // Verificar si la cola está inactiva por mucho tiempo
      const inactiveTime = Date.now() - queue.lastActivity;
      if (inactiveTime > 30 * 60 * 1000) { // 30 minutos de inactividad
        deleteQueue(guildId);
        cleaned++;
        continue;
      }
      
      // Verificar si hay miembros en el canal de voz (excepto el bot)
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        deleteQueue(guildId);
        cleaned++;
        continue;
      }
      
      const channel = guild.channels.cache.get(queue.voiceChannel?.id);
      if (!channel || channel.type !== 2) { // type 2 = voice channel
        deleteQueue(guildId);
        cleaned++;
        continue;
      }
      
      // Contar miembros (excluyendo al bot)
      const members = channel.members.filter(m => !m.user.bot);
      if (members.size === 0) {
        // No hay usuarios, desconectar después de 1 minuto
        if (inactiveTime > 60 * 1000) {
          deleteQueue(guildId);
          cleaned++;
        }
      }
    } catch (error) {
      // Silenciar errores de limpieza
    }
  }
  
  if (cleaned > 0) {
    console.log(`[MUSIC CLEANUP] Eliminadas ${cleaned} colas huérfanas`);
  }
}

// Iniciar limpieza periódica
function startOrphanCleanup(client) {
  setInterval(() => cleanupOrphanedQueues(client), ORPHAN_CLEANUP_INTERVAL);
  console.log("[MUSIC] Limpieza de colas huérfanas iniciada (cada 5 min)");
}

// ══════════════════════════════════════════════════════════════
//   DETECTAR TIPO DE URL
// ══════════════════════════════════════════════════════════════
function detectUrlType(url) {
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    if (url.includes("list=")) {
      return { type: "youtube_playlist", url };
    }
    return { type: "youtube", url };
  }
  
  if (url.includes("spotify.com")) {
    if (url.includes("/playlist/")) {
      return { type: "spotify_playlist", url };
    }
    if (url.includes("/album/")) {
      return { type: "spotify_album", url };
    }
    if (url.includes("/track/")) {
      return { type: "spotify_track", url };
    }
  }
  
  return { type: "search", url };
}

// ══════════════════════════════════════════════════════════════
//   FORMATEAR DURACIÓN
// ══════════════════════════════════════════════════════════════
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

// ══════════════════════════════════════════════════════════════
//   OBTENER INFO DE SPOTIFY
// ══════════════════════════════════════════════════════════════
async function getSpotifyTrackInfo(trackId) {
  try {
    const track = await spotifyApi.getTrack(trackId);
    return {
      title: track.body.name,
      artist: track.body.artists.map(a => a.name).join(", "),
      duration: formatDuration(track.body.duration_ms / 1000),
      durationSeconds: Math.floor(track.body.duration_ms / 1000),
      thumbnail: track.body.album.images[0]?.url || null,
      url: track.body.external_urls.spotify,
    };
  } catch (error) {
    console.error("Error obteniendo info de Spotify:", error);
    return null;
  }
}

async function getSpotifyPlaylistTracks(playlistId) {
  try {
    const playlist = await spotifyApi.getPlaylist(playlistId);
    const tracks = [];
    
    for (const item of playlist.body.tracks.items) {
      if (item.track) {
        tracks.push({
          title: item.track.name,
          artist: item.track.artists.map(a => a.name).join(", "),
          duration: formatDuration(item.track.duration_ms / 1000),
          durationSeconds: Math.floor(item.track.duration_ms / 1000),
          thumbnail: item.track.album.images[0]?.url || null,
          url: item.track.external_urls.spotify,
          searchQuery: `${item.track.name} ${item.track.artists[0].name}`,
        });
      }
    }
    
    return {
      name: playlist.body.name,
      tracks,
      thumbnail: playlist.body.images[0]?.url || null,
    };
  } catch (error) {
    console.error("Error obteniendo playlist de Spotify:", error);
    return null;
  }
}

async function getSpotifyAlbumTracks(albumId) {
  try {
    const album = await spotifyApi.getAlbum(albumId);
    const tracks = [];
    
    for (const item of album.body.tracks.items) {
      tracks.push({
        title: item.name,
        artist: item.artists.map(a => a.name).join(", "),
        duration: formatDuration(item.duration_ms / 1000),
        durationSeconds: Math.floor(item.duration_ms / 1000),
        thumbnail: album.body.images[0]?.url || null,
        url: item.external_urls.spotify,
        searchQuery: `${item.name} ${item.artists[0].name}`,
      });
    }
    
    return {
      name: album.body.name,
      tracks,
      thumbnail: album.body.images[0]?.url || null,
    };
  } catch (error) {
    console.error("Error obteniendo álbum de Spotify:", error);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
//   BUSCAR Y OBTENER INFO DE YOUTUBE
// ══════════════════════════════════════════════════════════════
async function getYoutubeInfo(query) {
  try {
    // Si es una URL de YouTube
    if (query.includes("youtube.com") || query.includes("youtu.be")) {
      const info = await play.video_info(query);
      return {
        title: info.video_details.title,
        artist: info.video_details.channel.name,
        duration: formatDuration(info.video_details.durationInSec),
        durationSeconds: info.video_details.durationInSec,
        thumbnail: info.video_details.thumbnails[0].url,
        url: info.video_details.url,
      };
    }
    
    // Buscar en YouTube
    const clientID = await play.getFreeClientID();
    play.setToken({ soundcloud: { client_id: clientID } });
    const searched = await play.search(query, { limit: 1, source: { soundcloud: "tracks" } });
    if (searched.length === 0) {
        return null;
    }

    const video = searched[0];
    return {
        title: video.title || video.name,
        artist: video.user?.name || video.channel?.name || "Desconocido",
        duration: formatDuration(video.durationInSec),
        durationSeconds: video.durationInSec,
        thumbnail: video.thumbnail || (video.thumbnails ? video.thumbnails[0].url : ""),
        url: video.url,
    };
  } catch (error) {
    console.error("Error obteniendo info de YouTube:", error);
    return null;
  }
}

async function getYoutubePlaylist(url) {
  try {
    const playlist = await play.playlist_info(url, { incomplete: true });
    const videos = await playlist.all_videos();
    
    const tracks = videos.slice(0, 50).map(video => ({
      title: video.title,
      artist: video.channel.name,
      duration: formatDuration(video.durationInSec),
      durationSeconds: video.durationInSec,
      thumbnail: video.thumbnails[0].url,
      url: video.url,
    }));
    
    return {
      name: playlist.title,
      tracks,
      thumbnail: playlist.thumbnail?.url || null,
    };
  } catch (error) {
    console.error("Error obteniendo playlist de YouTube:", error);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
//   AÑADIR CANCIONES A LA COLA
// ══════════════════════════════════════════════════════════════
async function addToQueue(guildId, voiceChannel, query, user, playNext = false) {
  try {
    let queue = getQueue(guildId);
    if (!queue) {
      queue = createQueue(guildId, voiceChannel);
    }
    
    // Actualizar última actividad
    queue.lastActivity = Date.now();
    queue.voiceChannel = voiceChannel;

    const urlType = detectUrlType(query);
    let songs = [];

    // Procesar según el tipo
    switch (urlType.type) {
      case "youtube_playlist": {
        const playlist = await getYoutubePlaylist(query);
        if (!playlist) {
          return { error: "No se pudo obtener la playlist de YouTube" };
        }
        
        songs = playlist.tracks.map(track => ({
          ...track,
          requestedBy: user,
        }));
        
        if (playNext) {
          queue.songs.unshift(...songs);
        } else {
          queue.songs.push(...songs);
        }
        
        if (!queue.playing) {
          await playNextSong(guildId);
        }
        
        return {
          playlist: {
            name: playlist.name,
            count: songs.length,
            thumbnail: playlist.thumbnail,
          },
          position: queue.songs.length,
        };
      }

      case "spotify_playlist": {
        const playlistId = query.match(/playlist\/([a-zA-Z0-9]+)/)?.[1];
        if (!playlistId) {
          return { error: "URL de playlist de Spotify inválida" };
        }
        
        const playlist = await getSpotifyPlaylistTracks(playlistId);
        if (!playlist) {
          return { error: "No se pudo obtener la playlist de Spotify" };
        }
        
        // Buscar cada track en YouTube
        for (const track of playlist.tracks.slice(0, 50)) {
          const ytInfo = await getYoutubeInfo(track.searchQuery);
          if (ytInfo) {
            songs.push({
              ...ytInfo,
              requestedBy: user,
            });
          }
        }
        
        if (playNext) {
          queue.songs.unshift(...songs);
        } else {
          queue.songs.push(...songs);
        }
        
        if (!queue.playing) {
          await playNextSong(guildId);
        }
        
        return {
          playlist: {
            name: playlist.name,
            count: songs.length,
            thumbnail: playlist.thumbnail,
          },
          position: queue.songs.length,
        };
      }

      case "spotify_album": {
        const albumId = query.match(/album\/([a-zA-Z0-9]+)/)?.[1];
        if (!albumId) {
          return { error: "URL de álbum de Spotify inválida" };
        }
        
        const album = await getSpotifyAlbumTracks(albumId);
        if (!album) {
          return { error: "No se pudo obtener el álbum de Spotify" };
        }
        
        // Buscar cada track en YouTube
        for (const track of album.tracks) {
          const ytInfo = await getYoutubeInfo(track.searchQuery);
          if (ytInfo) {
            songs.push({
              ...ytInfo,
              requestedBy: user,
            });
          }
        }
        
        if (playNext) {
          queue.songs.unshift(...songs);
        } else {
          queue.songs.push(...songs);
        }
        
        if (!queue.playing) {
          await playNextSong(guildId);
        }
        
        return {
          playlist: {
            name: album.name,
            count: songs.length,
            thumbnail: album.thumbnail,
          },
          position: queue.songs.length,
        };
      }

      case "spotify_track": {
        const trackId = query.match(/track\/([a-zA-Z0-9]+)/)?.[1];
        if (!trackId) {
          return { error: "URL de canción de Spotify inválida" };
        }
        
        const spotifyInfo = await getSpotifyTrackInfo(trackId);
        if (!spotifyInfo) {
          return { error: "No se pudo obtener la canción de Spotify" };
        }
        
        // Buscar en YouTube
        const searchQuery = `${spotifyInfo.title} ${spotifyInfo.artist}`;
        const ytInfo = await getYoutubeInfo(searchQuery);
        
        if (!ytInfo) {
          return { error: "No se pudo encontrar la canción en YouTube" };
        }
        
        const song = {
          ...ytInfo,
          requestedBy: user,
        };
        
        if (playNext) {
          queue.songs.unshift(song);
        } else {
          queue.songs.push(song);
        }
        
        if (!queue.playing) {
          await playNextSong(guildId);
          return { song, nowPlaying: true };
        }
        
        return { song, position: queue.songs.length };
      }

      case "youtube":
      case "search":
      default: {
        const info = await getYoutubeInfo(query);
        if (!info) {
          return { error: "No se encontraron resultados" };
        }
        
        const song = {
          ...info,
          requestedBy: user,
        };
        
        if (playNext) {
          queue.songs.unshift(song);
        } else {
          queue.songs.push(song);
        }
        
        if (!queue.playing) {
          await playNextSong(guildId);
          return { song, nowPlaying: true };
        }
        
        return { song, position: queue.songs.length };
      }
    }
  } catch (error) {
    console.error("[MUSIC HANDLER]", error);
    return { error: "Error al procesar la canción" };
  }
}

// ══════════════════════════════════════════════════════════════
//   REPRODUCIR SIGUIENTE CANCIÓN
// ══════════════════════════════════════════════════════════════
async function playNextSong(guildId) {
  const queue = getQueue(guildId);
  if (!queue) return;
  
  // Actualizar última actividad
  queue.lastActivity = Date.now();

  // Si el loop está en "song", volver a reproducir la misma canción
  if (queue.loop === "song" && queue.currentSong) {
    queue.songs.unshift(queue.currentSong);
  }
  
  // Si el loop está en "queue", añadir la canción al final
  if (queue.loop === "queue" && queue.currentSong) {
    queue.songs.push(queue.currentSong);
  }

  if (queue.songs.length === 0) {
    queue.playing = false;
    queue.currentSong = null;
    queue.lastActivity = Date.now(); // Resetear al quedar vacío
    setTimeout(() => {
      const q = getQueue(guildId);
      if (q && q.songs.length === 0 && !q.playing) {
        const connection = getVoiceConnection(guildId);
        if (connection) connection.destroy();
        deleteQueue(guildId);
      }
    }, 300000); // 5 minutos de inactividad
    return;
  }

  const song = queue.songs.shift();
  queue.currentSong = song;

  try {
    // Conectar al canal de voz si no está conectado
    if (!queue.connection) {
      queue.connection = joinVoiceChannel({
        channelId: queue.voiceChannel.id,
        guildId: queue.guildId,
        adapterCreator: queue.voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: true,
      });

      await entersState(queue.connection, VoiceConnectionStatus.Ready, 30000);
    }

    // Crear player si no existe
    if (!queue.player) {
      queue.player = createAudioPlayer();
      queue.connection.subscribe(queue.player);

      queue.player.on(AudioPlayerStatus.Idle, () => {
        playNextSong(guildId);
      });

      queue.player.on("error", error => {
        console.error(`Error en el player:`, error);
        playNextSong(guildId);
      });
    }
  
    // Intentar sacar el audio
    let stream;
    try {
      // Plan A: Intentar con YouTube
      stream = await play.stream(song.url, {
        discordPlayerCompatibility: true,
      });
    } catch (err) {
      console.log(`⚠️ YouTube bloqueó el audio de ${song.title}. Usando el respaldo de SoundCloud...`);
      
      // Generar el pase gratuito de SoundCloud
      const scClientId = await play.getFreeClientID();
      await play.setToken({
        soundcloud: {
          client_id: scClientId
        }
      });
      
      // Plan B: Buscar en SoundCloud con el pase activo
      const scSearch = await play.search(`${song.title} ${song.artist}`, { 
        limit: 1, 
        source: { soundcloud: "tracks" } 
      });
      
      if (scSearch.length === 0) {
        throw new Error("No se pudo encontrar el audio de respaldo.");
      }
      
      stream = await play.stream(scSearch[0].url, {
        discordPlayerCompatibility: true,
      });
    }

    // Crear el recurso de audio
    queue.resource = createAudioResource(stream.stream, {
      inputType: stream.type,
      inlineVolume: true,
    });

    queue.resource.volume.setVolume(queue.volume / 100);
    queue.player.play(queue.resource);
    queue.playing = true;
    queue.startTime = Date.now();
    queue.lastActivity = Date.now();

    console.log(`🎵 Reproduciendo: ${song.title}`);

  } catch (error) {
    console.error("[PLAY NEXT SONG]", error);
    queue.currentSong = null;
    playNextSong(guildId);
  }
}

// ══════════════════════════════════════════════════════════════
//   CONTROLES DE REPRODUCCIÓN
// ══════════════════════════════════════════════════════════════

function skip(guildId) {
  const queue = getQueue(guildId);
  if (!queue || !queue.player) return null;

  const skipped = queue.currentSong;
  queue.player.stop();
  return skipped;
}

function stop(guildId) {
  const queue = getQueue(guildId);
  if (!queue) return;

  queue.songs = [];
  queue.currentSong = null;
  
  if (queue.player) {
    queue.player.stop();
  }
  
  const connection = getVoiceConnection(guildId);
  if (connection) {
    connection.destroy();
  }
  
  deleteQueue(guildId);
}

function shuffle(guildId) {
  const queue = getQueue(guildId);
  if (!queue) return;

  for (let i = queue.songs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue.songs[i], queue.songs[j]] = [queue.songs[j], queue.songs[i]];
  }
}

function remove(guildId, index) {
  const queue = getQueue(guildId);
  if (!queue) return null;

  return queue.songs.splice(index, 1)[0];
}

function clearQueue(guildId) {
  const queue = getQueue(guildId);
  if (!queue) return;

  queue.songs = [];
}

function setVolume(guildId, volume) {
  const queue = getQueue(guildId);
  if (!queue || !queue.resource) return;

  queue.volume = volume;
  queue.resource.volume.setVolume(volume / 100);
}

function setLoop(guildId, mode) {
  const queue = getQueue(guildId);
  if (!queue) return;

  queue.loop = mode;
}

function getProgress(guildId) {
  const queue = getQueue(guildId);
  if (!queue || !queue.currentSong || !queue.startTime) {
    return { bar: "▬▬▬▬▬▬▬▬▬▬", current: "0:00" };
  }

  const elapsed = Math.floor((Date.now() - queue.startTime) / 1000);
  const duration = queue.currentSong.durationSeconds;
  const progress = Math.min(elapsed / duration, 1);
  
  const barLength = 10;
  const filledLength = Math.floor(progress * barLength);
  const bar = "▬".repeat(filledLength) + "🔘" + "▬".repeat(barLength - filledLength);
  
  return {
    bar,
    current: formatDuration(elapsed),
  };
}

// ══════════════════════════════════════════════════════════════
//   EXPORTS
// ══════════════════════════════════════════════════════════════
module.exports = {
  getQueue,
  addToQueue,
  skip,
  stop,
  shuffle,
  remove,
  clearQueue,
  setVolume,
  setLoop,
  getProgress,
  startOrphanCleanup,
};
