const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
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

module.exports.ahorcado = {
  data: new SlashCommandBuilder()
    .setName("ahorcado")
    .setDescription("Jugar al ahorcado")
    .addStringOption(o => o.setName("palabra").setDescription("Palabra a adivinar").setRequired(false)),

  async execute(interaction) {
    const palabraInput = interaction.options.getString("palabra");
    const palabra = palabraInput ? palabraInput.toLowerCase() : 
                   PALABRAS_AHORCADO[Math.floor(Math.random() * PALABRAS_AHORCADO.length)];
    
    const estado = {
      palabra: palabra.toUpperCase(),
      intentos: 6,
      letrasUsadas: new Set(),
      progreso: "_".repeat(palabra.length).split(""),
      usuario: interaction.user.id
    };
    
    ahorcadoActivos.set(interaction.user.id, estado);

    const dibujar = (intentos) => {
      const stages = [
        "  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========",
        "  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========",
        "  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========",
        "  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========",
        "  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========",
        "  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========",
        "  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n========="
      ];
      return stages[6 - intentos];
    };

    const crearEmbed = () => {
      return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("AHORCADO")
        .setDescription("Intentos: " + estado.intentos + "\n\n**Palabra:** " + estado.progreso.join(" ") + "\n\nLetras usadas: " + (Array.from(estado.letrasUsadas).join(", ") || "Ninguna"));
    };

    const crearBotones = () => {
      const letras = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");
      const filas = [];
      for (let i = 0; i < letras.length; i += 7) {
        const fila = new ActionRowBuilder();
        for (const letra of letras.slice(i, i + 7)) {
          fila.addComponents(new ButtonBuilder()
            .setCustomId("ahorcado_" + letra)
            .setLabel(letra)
            .setStyle(estado.letrasUsadas.has(letra) ? ButtonStyle.Secondary : ButtonStyle.Primary)
            .setDisabled(estado.letrasUsadas.has(letra) || estado.intentos <= 0));
        }
        filas.push(fila);
      }
      return filas;
    };

    await interaction.reply({ embeds: [crearEmbed()], components: crearBotones() });

    const filter = i => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 300000 });

    collector.on("collect", async i => {
      const letra = i.customId.replace("ahorcado_", "");
      if (estado.letrasUsadas.has(letra)) return;
      estado.letrasUsadas.add(letra);

      if (estado.palabra.includes(letra)) {
        for (let idx = 0; idx < estado.palabra.length; idx++) {
          if (estado.palabra[idx] === letra) estado.progreso[idx] = letra;
        }
        if (!estado.progreso.includes("_")) {
          await i.update({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle("GANASTE!").setDescription("La palabra era: **" + estado.palabra + "**")], components: [] });
          return collector.stop();
        }
      } else {
        estado.intentos--;
        if (estado.intentos <= 0) {
          await i.update({ embeds: [new EmbedBuilder().setColor(0xED4245).setTitle("PERDISTE").setDescription("La palabra era: **" + estado.palabra + "**")], components: [] });
          return collector.stop();
        }
      }
      await i.update({ embeds: [crearEmbed()], components: crearBotones() });
    });
  }
};

module.exports.ttt = {
  data: new SlashCommandBuilder()
    .setName("ttt")
    .setDescription("Jugar 3 en raya contra el bot")
    .addUserOption(o => o.setName("oponente").setDescription("Jugador contra quien jugar").setRequired(false)),

  async execute(interaction) {
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
          msg += cell ? (cell === "X" ? "X" : "O") : ".";
          msg += " ";
        }
        msg += "\n";
      }
      return msg;
    };

    const crearBotones = () => {
      const botones = [];
      let fila = new ActionRowBuilder();
      for (let i = 0; i < 9; i++) {
        const cell = estado.tablero[i];
        fila.addComponents(new ButtonBuilder()
          .setCustomId("ttt_" + i)
          .setLabel(cell ? (cell === "X" ? "X" : "O") : (i + 1).toString())
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

    const msg = await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle("TIC TAC TOE").setDescription(dibujar())], components: crearBotones(), fetchReply: true });

    const filter = i => {
      if (estado.esVsBot) {
        return i.user.id === interaction.user.id;
      } else {
        return i.user.id === estado.jugadorX || i.user.id === estado.jugadorO;
      }
    };
    const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

    collector.on("collect", async i => {
      // Verificar si la interacción ya fue procesada
      if (i.replied || i.deferred) return;
      
      const idx = parseInt(i.customId.replace("ttt_", ""));
      if (estado.tablero[idx] !== null) return;
      
      estado.tablero[idx] = estado.turno === estado.jugadorX ? "X" : "O";
      let winner = verificar();
      
      if (winner) {
        await i.update({ embeds: [new EmbedBuilder().setColor(winner === "empate" ? 0xFEE75C : 0x57F287).setTitle(winner === "empate" ? "EMPATE" : winner + " GANA").setDescription(dibujar())], components: [] }).catch(() => {});
        return collector.stop();
      }

      if (esVsBot) {
        await i.update({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle("TIC TAC TOE").setDescription(dibujar() + "\nBot pensando...")], components: crearBotones() }).catch(() => {});
        await new Promise(r => setTimeout(r, 500));
        const mov = botMove();
        if (mov !== undefined) estado.tablero[mov] = "O";
        winner = verificar();
        if (winner) {
          await i.update({ embeds: [new EmbedBuilder().setColor(winner === "empate" ? 0xFEE75C : 0x57F287).setTitle(winner === "empate" ? "EMPATE" : winner + " GANA").setDescription(dibujar())], components: [] }).catch(() => {});
          return collector.stop();
        }
      }

      estado.turno = esVsBot ? interaction.user.id : (estado.turno === estado.jugadorX ? estado.jugadorO : estado.jugadorX);
      await i.update({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle("TIC TAC TOE").setDescription(dibujar())], components: crearBotones() }).catch(() => {});
    });
  }
};

module.exports.trivia = {
  data: new SlashCommandBuilder()
    .setName("trivia")
    .setDescription("Jugar trivia")
    .addIntegerOption(o => o.setName("preguntas").setDescription("Numero de preguntas (1-10)").setRequired(false).setMinValue(1).setMaxValue(10)),

  async execute(interaction) {
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
};
