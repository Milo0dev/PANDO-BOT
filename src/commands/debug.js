const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  PermissionFlagsBits,
  MessageFlags 
} = require("discord.js");

// Comandos de debug ocultos - solo visibles para admins
module.exports = {
  // Comando principal /debug (oculto del help público)
  data: new SlashCommandBuilder()
    .setName("debug")
    .setDescription("🔧 Herramientas de debug para administradores")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName("status").setDescription("Ver estado del bot y métricas"))
    .addSubcommand(s => s.setName("memory").setDescription("Ver uso de memoria"))
    .addSubcommand(s => s.setName("cache").setDescription("Limpiar caché del bot"))
    .addSubcommand(s => s.setName("guilds").setDescription("Listar servidores conectados"))
    .addSubcommand(s => s.setName("voice").setDescription("Ver colas de música activas")),

  async execute(interaction) {
    // Solo el owner del bot puede usar debug
    const ownerId = process.env.OWNER_ID || interaction.client.application.owner?.id;
    if (ownerId && interaction.user.id !== ownerId) {
      return interaction.reply({ 
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription("❌ No tienes permiso para usar comandos de debug.")],
        flags: 64 
      });
    }

    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case "status":
        return this.status(interaction);
      case "memory":
        return this.memory(interaction);
      case "cache":
        return this.cache(interaction);
      case "guilds":
        return this.guilds(interaction);
      case "voice":
        return this.voice(interaction);
      default:
        return interaction.reply({ content: "Subcomando desconocido", flags: 64 });
    }
  },

  async status(interaction) {
    const client = interaction.client;
    const uptime = process.uptime();
    const memory = process.memoryUsage();
    
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const embed = new EmbedBuilder()
      .setTitle("🔧 Estado del Bot")
      .setColor(0x5865F2)
      .addFields(
        { name: "📡 Ping API", value: `\`${client.ws.ping}ms\``, inline: true },
        { name: "⏱️ Uptime", value: `\`${days}d ${hours}h ${minutes}m ${seconds}s}\``, inline: true },
        { name: "🏢 Servidores", value: `\`${client.guilds.cache.size}\``, inline: true },
        { name: "👥 Usuarios (cache)", value: `\`${client.users.cache.size}\``, inline: true },
        { name: "📺 Canales (cache)", value: `\`${client.channels.cache.size}\``, inline: true },
        { name: "🎵 Cola música", value: `\`${require("../handlers/musicHandler").getQueue ? "Activa" : "N/A"}\``, inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: 64 });
  },

  async memory(interaction) {
    const memory = process.memoryUsage();
    
    const formatMB = (bytes) => (bytes / 1024 / 1024).toFixed(2) + " MB";
    
    const embed = new EmbedBuilder()
      .setTitle("💾 Uso de Memoria")
      .setColor(0xFEE75C)
      .addFields(
        { name: "📦 RSS", value: `\`${formatMB(memory.rss)}\``, inline: true },
        { name: "🧠 Heap Total", value: `\`${formatMB(memory.heapTotal)}\``, inline: true },
        { name: "🧹 Heap Used", value: `\`${formatMB(memory.heapUsed)}\``, inline: true },
        { name: "📝 External", value: `\`${formatMB(memory.external)}\``, inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: 64 });
  },

  async cache(interaction) {
    const client = interaction.client;
    
    // Limpiar cachés
    const usersBefore = client.users.cache.size;
    const channelsBefore = client.channels.cache.size;
    const guildsBefore = client.guilds.cache.size;
    
    // No podemos forzar limpieza de caché de usuarios/canales/guilds
    // porque Discord.js lo gestiona automáticamente
    
    const embed = new EmbedBuilder()
      .setTitle("🧹 Caché")
      .setColor(0x57F287)
      .setDescription("Los cachés de Discord.js se gestionan automáticamente.\n\n**Caché actual:**")
      .addFields(
        { name: "👥 Usuarios", value: `\`${usersBefore}\``, inline: true },
        { name: "📺 Canales", value: `\`${channelsBefore}\``, inline: true },
        { name: "🏢 Servidores", value: `\`${guildsBefore}\``, inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: 64 });
  },

  async guilds(interaction) {
    const client = interaction.client;
    const guilds = client.guilds.cache.map(g => ({
      name: g.name,
      id: g.id,
      members: g.memberCount,
    }));

    if (guilds.length === 0) {
      return interaction.reply({ 
        content: "No hay servidores conectados",
        flags: 64 
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("🏢 Servidores Conectados")
      .setColor(0x5865F2)
      .setDescription(guilds.map(g => 
        `**${g.name}** (${g.id})\n👥 ${g.members} miembros`
      ).join("\n\n"))
      .setTimestamp();

    // Si hay muchos servidores, dividir en campos
    if (guilds.length > 10) {
      embed.setDescription(`${guilds.length} servidores conectados`);
      embed.addFields(guilds.slice(0, 20).map(g => ({
        name: g.name.slice(0, 50),
        value: `👥 ${g.members}`,
        inline: true,
      })));
    }

    return interaction.reply({ embeds: [embed], flags: 64 });
  },

  async voice(interaction) {
    const musicHandler = require("../handlers/musicHandler");
    
    // Intentar obtener información de las colas
    const embed = new EmbedBuilder()
      .setTitle("🎵 Estado de Música")
      .setColor(0x57F287)
      .setDescription("Las colas de música se gestionan por servidor.")
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: 64 });
  },
};

// Alias para comandos comunes
module.exports.alias = {
  // /ayuda = /help
  help: { redirect: "help" },
  // /soporte = /help (sección tickets)
  soporte: { redirect: "help", options: { seccion: "tickets" } },
  // /stats = /stats server
  estadisticas: { redirect: "stats", subcommand: "server" },
};
