const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require("discord.js");

const PALABRAS_AHORCADO = [
  "programacion", "computadora", "desarrollador", "javascript", "discord", 
  "servidor", "basededatos", "aplicacion", "interfaz", "algoritmo",
  "variable", "funcion", "objeto", "array", "string", "numero",
  "framework", "frontend", "backend", "fullstack",
  "windows", "linux", "macos", "navegador", "internet",
  "hosting", "dominio", "https", "http",
  "json", "html", "css", "python", "java", "rust",
  "react", "vue", "angular", "node", "express", "mongo"
];

const CATEGORIAS = {
  programacion: "💻 Programación", computadora: "💻 Programación", desarrollador: "💻 Programación",
  javascript: "💻 Programación", variable: "💻 Programación", funcion: "💻 Programación",
  objeto: "💻 Programación", array: "💻 Programación", string: "💻 Programación",
  numero: "💻 Programación", algoritmo: "💻 Programación", framework: "💻 Programación",
  frontend: "💻 Programación", backend: "💻 Programación", fullstack: "💻 Programación",
  discord: "🔧 Tecnologia", servidor: "🔧 Tecnologia", aplicacion: "🔧 Tecnologia",
  interfaz: "🔧 Tecnologia", basededatos: "🔧 Tecnologia", hosting: "🌐 Internet",
  dominio: "🌐 Internet", https: "🌐 Internet", http: "🌐 Internet", navegador: "🌐 Internet",
  internet: "🌐 Internet", json: "🔧 Tecnologia", html: "🔧 Tecnologia", css: "🔧 Tecnologia",
  python: "🐍 Lenguajes", java: "🐍 Lenguajes", rust: "🐍 Lenguajes",
  react: "🔧 Tecnologia", vue: "🔧 Tecnologia", angular: "🔧 Tecnologia",
  node: "🔧 Tecnologia", express: "🔧 Tecnologia", mongo: "🔧 Tecnologia",
  windows: "🖥️ Sistemas", linux: "🖥️ Sistemas", macos: "🖥️ Sistemas"
};

const TRIVIA_PREGUNTAS = [
  { pregunta: "¿Cuántos bits tiene un byte?", respuesta: "8", opciones: ["4", "8", "16", "32"] },
  { pregunta: "¿Qué significa HTML?", respuesta: "HyperText Markup Language", opciones: ["Hyper Text", "HyperText Markup Language", "High Tech"] },
  { pregunta: "¿Cuál es el lenguaje más usado para desarrollo web?", respuesta: "JavaScript", opciones: ["Python", "JavaScript", "Java", "C++"] },
  { pregunta: "¿Qué significa CSS?", respuesta: "Cascading Style Sheets", opciones: ["Computer Style", "Cascading Style Sheets", "Creative Style"] },
  { pregunta: "¿Qué empresa creó Discord?", respuesta: "Discord Inc", opciones: ["Microsoft", "Discord Inc", "Tencent", "Sony"] },
  { pregunta: "¿En qué año se lanzó Discord?", respuesta: "2015", opciones: ["2014", "2015", "2016", "2017"] },
  { pregunta: "¿Qué base de datos es NoSQL?", respuesta: "MongoDB", opciones: ["MySQL", "PostgreSQL", "MongoDB", "Oracle"] },
  { pregunta: "¿Qué significa API?", respuesta: "Application Programming Interface", opciones: ["Application Program", "Application Programming Interface", "Advanced Program"] },
  { pregunta: "¿Cuál es el puerto default de HTTP?", respuesta: "80", opciones: ["80", "443", "8080", "3000"] },
  { pregunta: "¿Qué significa DNS?", respuesta: "Domain Name System", opciones: ["Domain Name System", "Dynamic Network", "Data Network"] }
];

const ahorcadoActivos = new Map();

const obtenerCategoria = (palabra) => {
  return CATEGORIAS[palabra.toLowerCase()] || "📝 General";
};

const crearBarraProgreso = (intentos, maxIntentos) => {
  const total = 10;
  const filled = Math.round((intentos / maxIntentos) * total);
  const empty = total - filled;
  let barra = "▰".repeat(filled) + "▱".repeat(empty);
  if (intentos >= 5) barra += " ✅";
  else if (intentos >= 3) barra += " ⚠️";
  else if (intentos >= 1) barra += " 🔥";
  else barra += " 💀";
  return barra;
};

const dibujarAhorcado = (intentos) => {
  const etapas = [
    "  ┌───────────┐\n  │           │\n            │\n            │\n            │\n            │\n═════════════",
    "  ┌───────────┐\n  │           │\n  ●           │\n            │\n            │\n            │\n═════════════",
    "  ┌───────────┐\n  │           │\n  ●           │\n  │           │\n            │\n            │\n═════════════",
    "  ┌───────────┐\n  │           │\n  ●           │\n /│           │\n            │\n            │\n═════════════",
    "  ┌───────────┐\n  │           │\n  ●           │\n /│\\          │\n            │\n            │\n═════════════",
    "  ┌───────────┐\n  │           │\n  ●           │\n /│\\          │\n /            │\n            │\n═════════════",
    "  ┌───────────┐\n  │           │\n  ●           │\n /│\\          │\n / \\          │\n            │\n═════════════"
  ];
  var debut = String.fromCharCode(96,96,96) + "\n";
  var fin = "\n" + String.fromCharCode(96,96,96);
  return debut + etapas[6 - intentos] + fin;
};

const formatearPalabra = (progreso) => {
  return progreso.map(letra => letra === "_" ? "⬛" : "`" + letra + "`").join(" ");
};

const obtenerColor = (intentos) => {
  if (intentos >= 5) return 0x57F287;
  if (intentos >= 3) return 0xFEE75C;
  if (intentos >= 1) return 0xFAA61A;
  return 0xED4245;
};

// ============================================
// FUNCIONES DE EJECUCIÓN DE CADA JUEGO
// ============================================

async function executeAhorcado(interaction) {
  const palabraInput = interaction.options.getString("palabra");
  const palabra = palabraInput ? palabraInput.toLowerCase() : PALABRAS_AHORCADO[Math.floor(Math.random() * PALABRAS_AHORCADO.length)];
  
  const maxIntentos = 6;
  const estado = {
    palabra: palabra.toUpperCase(),
    intentos: maxIntentos,
    letrasUsadas: new Set(),
    progreso: "_".repeat(palabra.length).split(""),
    usuario: interaction.user.id,
    categoria: obtenerCategoria(palabra)
  };
  
  ahorcadoActivos.set(interaction.user.id, estado);

  const crearEmbed = () => {
    const color = obtenerColor(estado.intentos);
    const letrasOrdenadas = Array.from(estado.letrasUsadas).sort();
    
    return new EmbedBuilder()
      .setColor(color)
      .setTitle("🎯 AHORCADO")
      .setDescription(estado.categoria + " • " + palabra.length + " letras")
      .addFields(
        { name: "📊 Progreso", value: "`" + crearBarraProgreso(estado.intentos, maxIntentos) + "`\n" + estado.intentos + "/" + maxIntentos + " intentos", inline: false },
        { name: "🔤 Palabra", value: formatearPalabra(estado.progreso), inline: false },
        { name: "📝 Letras usadas", value: letrasOrdenadas.length > 0 ? letrasOrdenadas.map(l => "`" + l + "`").join(" ") : "*Ninguna*", inline: false },
        { name: "🎮 Dibujo", value: dibujarAhorcado(estado.intentos), inline: false }
      )
      .setFooter({ text: "Jugador: " + interaction.user.username + " | Adivina la palabra!" })
      .setTimestamp();
  };

  const crearComponentes = () => {
    const letras1 = "ABCDEFGHIJKLMNOÑ".split("");
    const letras2 = "PQRSTUVWXYZ".split("");
    
    const opciones1 = letras1.map(letra => {
      const estaUsada = estado.letrasUsadas.has(letra);
      const option = new StringSelectMenuOptionBuilder()
        .setLabel(letra)
        .setValue(letra);
      if (estaUsada) {
        option.setEmoji("❌");
      }
      return option;
    });

    const opciones2 = letras2.map(letra => {
      const estaUsada = estado.letrasUsadas.has(letra);
      const option = new StringSelectMenuOptionBuilder()
        .setLabel(letra)
        .setValue(letra);
      if (estaUsada) {
        option.setEmoji("❌");
      }
      return option;
    });

    const menu1 = new StringSelectMenuBuilder()
      .setCustomId("ahorcado_letra_1")
      .setPlaceholder("Selecciona una letra (A-Ñ)")
      .addOptions(opciones1)
      .setMinValues(1)
      .setMaxValues(1);

    const menu2 = new StringSelectMenuBuilder()
      .setCustomId("ahorcado_letra_2")
      .setPlaceholder("Selecciona una letra (P-Z)")
      .addOptions(opciones2)
      .setMinValues(1)
      .setMaxValues(1);

    const btnRendirse = new ButtonBuilder()
      .setCustomId("ahorcado_rendirse")
      .setLabel("💀 Rendirse")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(estado.intentos <= 0);

    const btnNuevaPartida = new ButtonBuilder()
      .setCustomId("ahorcado_nueva")
      .setLabel("🔄 Nueva Partida")
      .setStyle(ButtonStyle.Success);

    return [new ActionRowBuilder().addComponents(menu1), new ActionRowBuilder().addComponents(menu2), new ActionRowBuilder().addComponents(btnRendirse, btnNuevaPartida)];
  };

  await interaction.reply({ embeds: [crearEmbed()], components: crearComponentes() });

  const filter = i => i.user.id === interaction.user.id;
  const collector = interaction.channel.createMessageComponentCollector({ filter, time: 300000 });

  collector.on("collect", async i => {
    if (i.customId === "ahorcado_rendirse") {
      await i.update({ 
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle("💀 TE RENDISTE")
          .setDescription("La palabra era: **`" + estado.palabra + "`**\n\n" + dibujarAhorcado(0))
          .addFields(
            { name: "Estadísticas", value: "Letras adivinadas: " + estado.progreso.filter(l => l !== "_").length + "/" + estado.palabra.length, inline: true },
            { name: "Letras usadas", value: Array.from(estado.letrasUsadas).map(l => "`" + l + "`").join(" "), inline: false }
          )
          .setFooter({ text: "Partida terminada" })
          .setTimestamp()], 
        components: [] 
      });
      return collector.stop();
    }

    if (i.customId === "ahorcado_nueva") {
      await i.update({ 
        embeds: [new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle("🔄 NUEVA PARTIDA")
          .setDescription("¡Iniciando una nueva partida!")
          .setFooter({ text: "Cargando..." })
          .setTimestamp()], 
        components: [] 
      });
      const nuevaPalabra = PALABRAS_AHORCADO[Math.floor(Math.random() * PALABRAS_AHORCADO.length)];
      estado.palabra = nuevaPalabra.toUpperCase();
      estado.intentos = maxIntentos;
      estado.letrasUsadas = new Set();
      estado.progreso = "_".repeat(nuevaPalabra.length).split("");
      estado.categoria = obtenerCategoria(nuevaPalabra);
      
      await interaction.editReply({ embeds: [crearEmbed()], components: crearComponentes() });
      return;
    }

    const letra = i.values[0];
    if (estado.letrasUsadas.has(letra)) {
      await i.reply({ content: "¡Ya usaste esa letra! 🔄", flags: 64 });
      return;
    }
    estado.letrasUsadas.add(letra);

    if (estado.palabra.includes(letra)) {
      for (let idx = 0; idx < estado.palabra.length; idx++) {
        if (estado.palabra[idx] === letra) estado.progreso[idx] = letra;
      }
      
      if (!estado.progreso.includes("_")) {
        await i.update({ 
          embeds: [new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle("🎉 ¡GANASTE!")
            .setDescription("¡Felicidades! Has adivinado la palabra: **`" + estado.palabra + "`**")
            .addFields(
              { name: "📊 Estadísticas", value: "Letras adivinadas: " + estado.palabra.length + "/" + estado.palabra.length, inline: true },
              { name: "💪 Intentos restantes: ", value: "" + estado.intentos + "/" + maxIntentos, inline: true },
              { name: "🔤 Letras usadas", value: Array.from(estado.letrasUsadas).sort().map(l => "`" + l + "`").join(" "), inline: false }
            )
            .setFooter({ text: "¡Victoria!" })
            .setTimestamp()], 
          components: [] 
        });
        return collector.stop();
      }
    } else {
      estado.intentos--;
      
      if (estado.intentos <= 0) {
        await i.update({ 
          embeds: [new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("💀 PERDISTE")
            .setDescription("La palabra era: **`" + estado.palabra + "`**\n\n" + dibujarAhorcado(0))
            .addFields(
              { name: "Letras correctas", value: estado.progreso.filter(l => l !== "_").length > 0 ? estado.progreso.filter(l => l !== "_").map(l => "`" + l + "`").join(" ") : "Ninguna", inline: false },
              { name: "Letras usadas", value: Array.from(estado.letrasUsadas).sort().map(l => "`" + l + "`").join(" "), inline: false }
            )
            .setFooter({ text: "Game Over" })
            .setTimestamp()], 
          components: [] 
        });
        return collector.stop();
      }
    }
    
    await i.update({ embeds: [crearEmbed()], components: crearComponentes() });
  });
}

async function executeTTT(interaction) {
  const oponente = interaction.options.getUser("oponente");
  const esVsBot = !oponente;

  const estado = {
    tablero: Array(9).fill(null),
    turno: interaction.user.id,
    jugadorX: interaction.user.id,
    jugadorO: esVsBot ? "bot" : oponente.id,
    esVsBot
  };

  const dibujar = () => {
    let msg = "";
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const idx = i * 3 + j;
        const cell = estado.tablero[idx];
        msg += cell ? (cell === "X" ? "🔴" : "🔵") : "⬜";
        if (j < 2) msg += "│";
      }
      msg += "\n";
      if (i < 2) msg += "─────┬─────┬─────\n";
    }
    return ">>> " + msg;
  };

  const crearBotones = () => {
    const botones = [];
    let fila = new ActionRowBuilder();
    for (let i = 0; i < 9; i++) {
      const cell = estado.tablero[i];
      let emoji = cell ? (cell === "X" ? "🔴" : "🔵") : "➕";
      fila.addComponents(new ButtonBuilder()
        .setCustomId("ttt_" + i)
        .setLabel(emoji)
        .setStyle(cell === "X" ? ButtonStyle.Danger : cell === "O" ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(cell !== null));
      if ((i + 1) % 3 === 0) { botones.push(fila); fila = new ActionRowBuilder(); }
    }
    return botones;
  };

  const verificar = () => {
    const lineas = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a,b,c] of lineas) {
      if (estado.tablero[a] && estado.tablero[a] === estado.tablero[b] && estado.tablero[a] === estado.tablero[c]) return estado.tablero[a];
    }
    return !estado.tablero.includes(null) ? "empate" : null;
  };

  const botMove = () => {
    const disponibles = estado.tablero.map((v, i) => v === null ? i : -1).filter(i => i >= 0);
    return disponibles[Math.floor(Math.random() * disponibles.length)];
  };

  const crearEmbed = () => {
    const esTurnoX = estado.turno === estado.jugadorX;
    const nombreTurno = esTurnoX ? "<@" + estado.jugadorX + ">" : (estado.esVsBot ? "🤖 Bot" : "<@" + estado.turno + ">");
    const colorTurno = esTurnoX ? 0xED4245 : 0x5865F2;
    const infoJugadores = esVsBot ? "🔴 **X:** " + interaction.user + "\n🔵 **O:** 🤖 Bot" : "🔴 **X:** <@" + estado.jugadorX + ">\n🔵 **O:** <@" + estado.jugadorO + ">";

    return new EmbedBuilder()
      .setColor(colorTurno)
      .setTitle("🎮 Tic Tac Toe - 3 en Raya")
      .setDescription("¡Partido en progreso!")
      .addFields(
        { name: "👥 Jugadores", value: infoJugadores, inline: false },
        { name: "🎯 Turno de", value: nombreTurno, inline: true },
        { name: "🔢 Ronda", value: (estado.tablero.filter(c => c !== null).length + 1) + "/9", inline: true },
        { name: "📊 Tablero", value: dibujar(), inline: false }
      )
      .setFooter({ text: esVsBot ? "Jugando contra el Bot" : "PvP" })
      .setTimestamp();
  };

  const msg = await interaction.reply({ embeds: [crearEmbed()], components: crearBotones(), fetchReply: true });

  const filter = i => {
    if (estado.esVsBot) return i.user.id === interaction.user.id;
    return i.user.id === estado.jugadorX || i.user.id === estado.jugadorO;
  };
  const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

  collector.on("collect", async i => {
    if (i.replied || i.deferred) return;
    
    const idx = parseInt(i.customId.replace("ttt_", ""));
    if (estado.tablero[idx] !== null) return;
    
    estado.tablero[idx] = estado.turno === estado.jugadorX ? "X" : "O";
    let winner = verificar();
    
    if (winner) {
      const colorFinal = winner === "empate" ? 0xFEE75C : (winner === "X" ? 0xED4245 : 0x5865F2);
      const tituloFinal = winner === "empate" ? "🤝 ¡EMPATE!" : (winner === "X" ? "🔴 ¡X GANA!" : "🔵 ¡O GANA!");
      const descFinal = winner === "empate" ? "¡El tablero está lleno!" : "¡Felicidades <@" + (winner === "X" ? estado.jugadorX : estado.jugadorO) + ">!";
      
      await i.update({ 
        embeds: [new EmbedBuilder().setColor(colorFinal).setTitle(tituloFinal).setDescription(descFinal).addFields({ name: "📊 Tablero final", value: dibujar(), inline: false }).setFooter({ text: "Partida terminada" }).setTimestamp()], 
        components: [] 
      }).catch(() => {});
      return collector.stop();
    }

    if (esVsBot) {
      const mov = botMove();
      if (mov !== undefined) estado.tablero[mov] = "O";
      winner = verificar();
      if (winner) {
        const colorFinal = winner === "empate" ? 0xFEE75C : (winner === "X" ? 0xED4245 : 0x5865F2);
        const tituloFinal = winner === "empate" ? "🤝 ¡EMPATE!" : (winner === "X" ? "🔴 ¡GANASTE!" : "🔵 ¡GANÓ EL BOT!");
        const descFinal = winner === "X" ? "¡Felicidades! Has ganado." : "¡El bot ha ganado!";
        
        await i.update({ 
          embeds: [new EmbedBuilder().setColor(colorFinal).setTitle(tituloFinal).setDescription(descFinal).addFields({ name: "📊 Tablero final", value: dibujar(), inline: false }).setFooter({ text: "Partida terminada" }).setTimestamp()], 
          components: [] 
        }).catch(() => {});
        return collector.stop();
      }
    }

    estado.turno = esVsBot ? interaction.user.id : (estado.turno === estado.jugadorX ? estado.jugadorO : estado.jugadorX);
    await i.update({ embeds: [crearEmbed()], components: crearBotones() }).catch(() => {});
  });
}

async function executeTrivia(interaction) {
  const numPreguntas = interaction.options.getInteger("preguntas") || 5;
  const preguntas = [...TRIVIA_PREGUNTAS].sort(() => Math.random() - 0.5).slice(0, numPreguntas);
  
  const estado = { preguntaActual: 0, preguntas, puntuacion: 0, respondida: false };

  const mostrar = () => {
    const preg = estado.preguntas[estado.preguntaActual];
    const opciones = [...preg.opciones, preg.respuesta].sort(() => Math.random() - 0.5);
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("TRIVIA - Pregunta " + (estado.preguntaActual + 1) + "/" + numPreguntas)
      .setDescription("**" + preg.pregunta + "**\n\nElige una respuesta:");
    const botones = new ActionRowBuilder();
    opciones.forEach((op, i) => botones.addComponents(new ButtonBuilder().setCustomId("trivia_" + i).setLabel(op).setStyle(ButtonStyle.Primary)));
    return { embed, botones };
  };

  const msg = await interaction.reply({ embeds: [mostrar().embed], components: [mostrar().botones], fetchReply: true });
  const collector = msg.createMessageCollector({ filter: i => i.user.id === interaction.user.id && i.isButton(), time: 15000 });

  collector.on("collect", async i => {
    if (estado.respondida) return;
    const preg = estado.preguntas[estado.preguntaActual];
    const correcta = preg.respuesta;
    
    estado.respondida = true;
    if (i.customId.includes(correcta)) {
      estado.puntuacion++;
      await i.update({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle("CORRECTO!").setDescription("**" + correcta + "**\nPuntuacion: " + estado.puntuacion)], components: [] });
    } else {
      await i.update({ embeds: [new EmbedBuilder().setColor(0xED4245).setTitle("INCORRECTO").setDescription("Era: **" + correcta + "**")], components: [] });
    }

    setTimeout(async () => {
      estado.preguntaActual++;
      estado.respondida = false;
      if (estado.preguntaActual >= numPreguntas) {
        await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xFEE75C).setTitle("TERMINADO!").setDescription("Puntuacion: **" + estado.puntuacion + "/" + numPreguntas + "**")], components: [] });
        return collector.stop();
      }
      const sig = mostrar();
      await interaction.editReply({ embeds: [sig.embed], components: [sig.botones] });
    }, 1500);
  });
}

// ============================================
// COMANDO PRINCIPAL CON SUBCOMANDOS
// ============================================

module.exports = {
  data: new SlashCommandBuilder()
    .setName("juegos")
    .setDescription("🎮 Minijuegos interactivos")
    .addSubcommand(subcommand =>
      subcommand
        .setName("ahorcado")
        .setDescription("Jugar al ahorcado")
        .addStringOption(option =>
          option
            .setName("palabra")
            .setDescription("Palabra a adivinar (opcional)")
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("ttt")
        .setDescription("Jugar 3 en raya contra el bot o contra otro jugador")
        .addUserOption(option =>
          option
            .setName("oponente")
            .setDescription("Jugador contra quien jugar (opcional, por defecto vs Bot)")
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("trivia")
        .setDescription("Jugar trivia de conocimientos")
        .addIntegerOption(option =>
          option
            .setName("preguntas")
            .setDescription("Número de preguntas (1-10, por defecto 5)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "ahorcado":
        return executeAhorcado(interaction);
      
      case "ttt":
        return executeTTT(interaction);
      
      case "trivia":
        return executeTrivia(interaction);
      
      default:
        return interaction.reply({
          content: "⚠️ Subcomando no reconocido.",
          flags: 64
        });
    }
  }
};
