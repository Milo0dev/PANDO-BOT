const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ComponentType, MessageFlags,
} = require("discord.js");

// ─────────────────────────────────────────────────────────────────────────────
//   SECCIONES DE AYUDA
// ─────────────────────────────────────────────────────────────────────────────
const SECTIONS = [
  {
    id: "home", emoji: "🏠", label: "Inicio", color: 0x5865F2,
    title: "🤖 PANDO BOT — Centro de Ayuda",
    description:
      "Bienvenido al **centro de ayuda interactivo**.\nUsa el **menú desplegable** para ir a una sección o los botones **◀ ▶** para navegar entre páginas.\n\n" +
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
      "**📋 Secciones disponibles:**\n\n" +
      "🎫 **Tickets** — Gestión completa de tickets de soporte\n" +
      "⚙️ **Configuración** — Ajustes generales del sistema\n" +
      "👥 **Staff** — Herramientas del equipo de soporte\n" +
      "📊 **Estadísticas** — Rankings, métricas y leaderboards\n" +
      "⭐ **Niveles** — Sistema de XP, niveles y recompensas\n" +
      "🎉 **Bienvenidas** — Sistema de bienvenidas y despedidas\n" +
      "✅ **Verificación** — Sistema de verificación de miembros\n" +
      "🔒 **Moderación** — Lockdown y herramientas de control\n" +
      "📋 **Logs** — Registro automático de eventos del servidor\n" +
      "💡 **Sugerencias** — Sistema de sugerencias de la comunidad\n" +
      "📊 **Encuestas** — Sistema de encuestas interactivas\n" +
      "⏰ **Recordatorios** — Recordatorios personales\n" +
      "✨ **Embeds** — Constructor de embeds personalizados\n" +
      "🤖 **Auto-respuestas** — Respuestas automáticas por palabra clave\n" +
      "🏷️ **Tags** — Respuestas rápidas reutilizables\n\n" +
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
      "💡 Los comandos con 🔐 requieren **permisos de staff o admin**.",
    fields: [],
  },

  // ── TICKETS
  {
    id: "tickets", emoji: "🎫", label: "Tickets", color: 0x57F287,
    title: "🎫 Gestión de Tickets",
    description: "Comandos para manejar tickets dentro del canal de un ticket.",
    fields: [
      { name: "🔒 `/close [razón]` 🔐", value: "Cierra el ticket actual. Envía un resumen al usuario por DM y genera la transcripción automáticamente.", inline: false },
      { name: "🔓 `/reopen` 🔐", value: "Reabre un ticket cerrado, restaurando el acceso del usuario.", inline: false },
      { name: "👋 `/claim` 🔐", value: "Reclama el ticket para atenderlo tú mismo. El usuario recibe notificación por DM.", inline: false },
      { name: "↩️ `/unclaim` 🔐", value: "Libera el ticket para que otro miembro del staff pueda reclamarlo.", inline: false },
      { name: "📌 `/assign @staff` 🔐", value: "Asigna el ticket a un miembro específico del staff.", inline: false },
      { name: "➕ `/add @usuario` 🔐", value: "Añade a un usuario al ticket para que pueda ver y escribir en el canal.", inline: false },
      { name: "➖ `/remove @usuario` 🔐", value: "Retira a un usuario del ticket, revocando su acceso.", inline: false },
      { name: "✏️ `/rename [nombre]` 🔐", value: "Renombra el canal del ticket. Solo letras, números y guiones. Máximo 32 caracteres.", inline: false },
      { name: "⚡ `/priority [nivel]` 🔐", value: "Cambia la prioridad: `🟢 Baja` · `🔵 Normal` · `🟡 Alta` · `🔴 Urgente`", inline: false },
      { name: "📂 `/move` 🔐", value: "Mueve el ticket a otra categoría usando un menú desplegable interactivo.", inline: false },
      { name: "📝 `/note add [texto]` 🔐", value: "Añade una nota interna al ticket (solo visible para el staff). Máx. 500 caracteres.", inline: false },
      { name: "📋 `/note list` 🔐", value: "Muestra todas las notas internas del ticket actual.", inline: false },
      { name: "📄 `/transcript` 🔐", value: "Genera y descarga la transcripción completa del ticket en formato HTML.", inline: false },
      { name: "ℹ️ `/ticketinfo` 🔐", value: "Muestra información detallada: usuario, staff, prioridad, fechas y más.", inline: false },
      { name: "📜 `/history [@usuario]` 🔐", value: "Historial de todos los tickets de un usuario. Sin argumento muestra el tuyo propio.", inline: false },
    ],
  },

  // ── CONFIGURACIÓN
  {
    id: "setup", emoji: "⚙️", label: "Configuración", color: 0xFEE75C,
    title: "⚙️ Configuración del Sistema",
    description: "Comandos para configurar el bot. Requieren permiso de **Administrador**. 🔐",
    fields: [
      { name: "⚙️ `/setup panel`", value: "Crea o actualiza el panel de creación de tickets con el menú de categorías.", inline: false },
      { name: "⚙️ `/setup roles`", value: "Define los roles de **staff** y **admin** del servidor.", inline: false },
      { name: "⚙️ `/setup logs`", value: "Canal donde se registran todos los eventos de tickets.", inline: false },
      { name: "⚙️ `/setup transcripts`", value: "Canal para guardar automáticamente todas las transcripciones.", inline: false },
      { name: "⚙️ `/setup maxtickets`", value: "Límite de tickets abiertos simultáneamente por usuario.", inline: false },
      { name: "⚙️ `/setup cooldown`", value: "Tiempo mínimo (en minutos) entre creación de tickets del mismo usuario.", inline: false },
      { name: "⚙️ `/setup dm`", value: "Activar/desactivar DMs automáticos al cerrar un ticket.", inline: false },
      { name: "⚙️ `/setup view`", value: "Ver toda la configuración actual del sistema en un resumen.", inline: false },
    ],
  },

  // ── STAFF
  {
    id: "staff", emoji: "👥", label: "Staff", color: 0x5865F2,
    title: "👥 Herramientas del Staff",
    description: "Comandos pensados para el equipo de soporte.",
    fields: [
      { name: "😴 `/away [razón]` 🔐", value: "Activa/desactiva el modo **ausente**. Tu estado aparece marcado en el dashboard y `/stafflist`. Ejecútalo de nuevo para volver a disponible.", inline: false },
      { name: "👥 `/stafflist` 🔐", value: "Muestra el estado en tiempo real de todo el staff: ✅ Disponible · 😴 Ausente. Incluye tickets asignados.", inline: false },
      { name: "🎫 `/mytickets` 🔐", value: "Lista tus tickets abiertos actualmente con número, categoría y fecha.", inline: false },
      { name: "🔄 `/refreshdashboard` 🔐", value: "Fuerza la actualización manual del panel de control del dashboard.", inline: false },
    ],
  },

  // ── ESTADÍSTICAS
  {
    id: "stats", emoji: "📊", label: "Estadísticas", color: 0xEB459E,
    title: "📊 Estadísticas y Rankings",
    description: "Métricas, rankings y calificaciones del sistema de soporte.",
    fields: [
      { name: "📊 `/stats server`", value: "Estadísticas globales: total/abiertos/cerrados, hoy/semana, tiempo promedio de respuesta y cierre, categorías top, calificación global.", inline: false },
      { name: "📊 `/stats staff [@usuario]` 🔐", value: "Stats individuales: tickets cerrados, reclamados, asignados y calificación promedio recibida.", inline: false },
      { name: "🏆 `/stats leaderboard` 🔐", value: "Ranking del staff por **tickets cerrados**. Top 10 con medallas 🥇🥈🥉.", inline: false },
      { name: "⭐ `/stats ratings` 🔐", value: "Leaderboard por **calificaciones de usuarios** vinculadas al staff que atendió cada ticket. Muestra promedio, barra de estrellas y tendencia 🔥✅⚠️❌.", inline: false },
      { name: "⭐ `/stats staffrating @usuario` 🔐", value: "Perfil detallado: promedio con barra visual, total de calificaciones y distribución de 1 a 5 con gráfico de bloques `█░`.", inline: false },
    ],
  },

  // ── NIVELES
  {
    id: "levels", emoji: "⭐", label: "Niveles & XP", color: 0xFFD700,
    title: "⭐ Sistema de Niveles y XP",
    description: "Los usuarios ganan XP escribiendo mensajes. Al subir de nivel reciben anuncios y pueden obtener roles de recompensa.",
    fields: [
      { name: "⭐ `/rank ver [@usuario]`", value: "Muestra el nivel, XP total, posición en el ranking, barra de progreso y próximas recompensas de cualquier usuario.", inline: false },
      { name: "🏆 `/rank top`", value: "Tabla de posiciones del servidor — top 15 usuarios con nivel, XP y barra de progreso.", inline: false },
      { name: "⚙️ `/levels config activar` 🔐", value: "Activar o desactivar el sistema de XP para el servidor.", inline: false },
      { name: "⚙️ `/levels config canal` 🔐", value: "Canal donde se anuncian las subidas de nivel. Sin canal = mismo canal donde escribe el usuario.", inline: false },
      { name: "⚙️ `/levels config xp` 🔐", value: "Configura XP mínimo/máximo por mensaje y el cooldown (segundos entre ganancias).", inline: false },
      { name: "⚙️ `/levels config mensaje` 🔐", value: "Personaliza el mensaje de subida de nivel. Variables: `{mention}` `{user}` `{level}` `{xp}`.", inline: false },
      { name: "⚙️ `/levels config rolreward` 🔐", value: "Asigna un rol automático al llegar a un nivel específico. Vacío = eliminar esa recompensa.", inline: false },
      { name: "⚙️ `/levels config doublexp` 🔐", value: "Da XP x2 a un rol específico. Úsalo de nuevo en el mismo rol para quitarlo.", inline: false },
      { name: "⚙️ `/levels config ignorarcanalal` 🔐", value: "Ignora/designora un canal para XP — los mensajes en ese canal no dan experiencia.", inline: false },
      { name: "⚙️ `/levels config setxp` 🔐", value: "Establece manualmente el XP de un usuario a una cantidad específica.", inline: false },
      { name: "⚙️ `/levels config resetear` 🔐", value: "Reinicia el XP de un usuario a 0.", inline: false },
      { name: "⚙️ `/levels config info` 🔐", value: "Ver toda la configuración actual del sistema de niveles.", inline: false },
    ],
  },

  // ── BIENVENIDAS
  {
    id: "welcome", emoji: "🎉", label: "Bienvenidas", color: 0x57F287,
    title: "🎉 Sistema de Bienvenidas y Despedidas",
    description: "Mensajes automáticos cuando alguien entra o sale.\n**Variables:** `{mention}` `{user}` `{tag}` `{server}` `{count}` `{id}`",
    fields: [
      { name: "👋 Bienvenida — `/welcome bienvenida ...` 🔐", value: "`activar` `canal` `mensaje` `titulo` `color` `footer` `banner` `avatar` `dm` `autorole` `test`", inline: false },
      { name: "👋 Despedida — `/welcome despedida ...` 🔐", value: "`activar` `canal` `mensaje` `titulo` `color` `footer` `avatar` `test`", inline: false },
      { name: "📋 `/welcome info` 🔐", value: "Ver toda la configuración actual de bienvenidas y despedidas.", inline: false },
    ],
  },

  // ── VERIFICACIÓN
  {
    id: "verify", emoji: "✅", label: "Verificación", color: 0x57F287,
    title: "✅ Sistema de Verificación",
    description: "3 modos: 🖱️ **Botón** (un clic) · 🔢 **Código por DM** · ❓ **Pregunta personalizada**",
    fields: [
      { name: "🚀 `/verify setup` 🔐", value: "Configuración guiada completa: canal, rol verificado, modo y rol no verificado. Envía el panel automáticamente.", inline: false },
      { name: "📋 Panel — `/verify ...` 🔐", value: "`panel` · `activar` · `modo` · `pregunta` · `mensaje` · `dm`", inline: false },
      { name: "🛡️ Seguridad — `/verify ...` 🔐", value: "`antiraid` — Detectar y actuar ante muchos joins en poco tiempo\n`autokick` — Expulsar no verificados tras X horas\n`logs` — Canal de logs de verificaciones", inline: false },
      { name: "👤 Manual — `/verify ...` 🔐", value: "`forzar @usuario` · `desverificar @usuario` · `stats` · `info`", inline: false },
    ],
  },

  // ── MODERACIÓN
  {
    id: "moderation", emoji: "🔒", label: "Moderación", color: 0xED4245,
    title: "🔒 Herramientas de Moderación",
    description: "Control de canales, cierre masivo y lista negra. 🔐",
    fields: [
      { name: "🔒 `/lockdown lock [#canal] [razón]` 🔐", value: "Bloquea un canal: usuarios pueden ver pero no escribir. Sin canal = canal actual.", inline: false },
      { name: "🔓 `/lockdown unlock [#canal] [razón]` 🔐", value: "Desbloquea un canal, restaurando el permiso de escritura.", inline: false },
      { name: "🌐 `/lockdown all [lock|unlock] [razón]` 🔐", value: "Bloquea o desbloquea **todos los canales de texto** del servidor. Ideal para raids.", inline: false },
      { name: "🔧 `/maintenance [activar|desactivar] [razón]` 🔐", value: "Activa modo mantenimiento: los usuarios ven un aviso al intentar abrir tickets.", inline: false },
      { name: "🔒 `/closeall [razón]` 🔐", value: "Cierra **todos los tickets abiertos** masivamente. Pide confirmación antes de ejecutar.", inline: false },
      { name: "🚫 `/blacklist add @usuario [razón]` 🔐", value: "Añade a un usuario a la lista negra: no podrá abrir tickets.", inline: false },
      { name: "✅ `/blacklist remove @usuario` 🔐", value: "Elimina a un usuario de la lista negra, restaurando su acceso.", inline: false },
      { name: "📋 `/blacklist list` 🔐", value: "Lista todos los bloqueados con razón y responsable.", inline: false },
      { name: "🔍 `/blacklist check @usuario` 🔐", value: "Comprueba si un usuario está en la lista negra.", inline: false },
    ],
  },

  // ── LOGS
  {
    id: "modlogs", emoji: "📋", label: "Logs", color: 0x5865F2,
    title: "📋 Sistema de Logs de Moderación",
    description: "Registra automáticamente eventos del servidor en un canal de logs. 🔐",
    fields: [
      { name: "📋 `/modlogs setup #canal` 🔐", value: "Configuración rápida: activa los logs y asigna el canal. Activa todos los eventos por defecto.", inline: false },
      { name: "📋 `/modlogs activar [true|false]` 🔐", value: "Activa o desactiva el sistema de logs completo.", inline: false },
      { name: "📋 `/modlogs canal #canal` 🔐", value: "Cambia el canal donde se registran los logs.", inline: false },
      { name: "📋 `/modlogs config [evento] [true|false]` 🔐", value: "Activa/desactiva eventos individuales:\n🔨 Baneos · ✅ Desbaneos · 🗑️ Mensajes eliminados · ✏️ Mensajes editados\n✅ Roles añadidos · ❌ Roles quitados · ✏️ Nicknames · 📥 Entradas · 📤 Salidas", inline: false },
      { name: "📋 `/modlogs info` 🔐", value: "Ver la configuración completa de logs: canal y estado de cada evento.", inline: false },
    ],
  },

  // ── SUGERENCIAS
  {
    id: "suggest", emoji: "💡", label: "Sugerencias", color: 0x5865F2,
    title: "💡 Sistema de Sugerencias",
    description: "La comunidad puede proponer mejoras. El staff las revisa y los usuarios votan.",
    fields: [
      { name: "💡 `/suggest enviar [texto]`", value: "Envía una sugerencia al canal configurado. Aparece con botones de votación 👍 👎.", inline: false },
      { name: "🔍 `/suggest ver [número]`", value: "Ver el estado, votos y comentarios de una sugerencia por su número.", inline: false },
      { name: "✅ `/suggest aprobar [número] [comentario]` 🔐", value: "Aprueba una sugerencia. Si hay canal de aprobadas, se mueve allí. El autor recibe DM.", inline: false },
      { name: "❌ `/suggest rechazar [número] [razón]` 🔐", value: "Rechaza una sugerencia con razón opcional. El autor recibe DM.", inline: false },
      { name: "🤔 `/suggest considerar [número] [comentario]` 🔐", value: "Marca como **en consideración** — sigue aceptando votos.", inline: false },
      { name: "📊 `/suggest stats`", value: "Estadísticas: total de sugerencias, pendientes, aprobadas y rechazadas.", inline: false },
      { name: "⚙️ `/suggest config setup #canal` 🔐", value: "Configura el canal donde se publican las sugerencias.", inline: false },
      { name: "⚙️ `/suggest config canales` 🔐", value: "Canales separados para sugerencias aprobadas y rechazadas.", inline: false },
      { name: "⚙️ `/suggest config opciones` 🔐", value: "Configurar: DM al revisar · modo anónimo · cooldown entre sugerencias.", inline: false },
    ],
  },

  // ── ENCUESTAS
  {
    id: "polls", emoji: "📊", label: "Encuestas", color: 0x5865F2,
    title: "📊 Sistema de Encuestas",
    description: "Encuestas interactivas con barras de progreso, duración configurable y votación en tiempo real.",
    fields: [
      { name: "📊 `/poll crear`", value: "Crea una encuesta con hasta **10 opciones** separadas por `|`.\n**Parámetros:** pregunta · opciones · duración · múltiple · canal\n**Ejemplo de duración:** `30m` · `2h` · `1d` · `1h30m`", inline: false },
      { name: "⏹️ `/poll finalizar [id]` 🔐", value: "Cierra una encuesta antes de que termine. Muestra los resultados finales con el ganador 🏆.", inline: false },
      { name: "📋 `/poll lista`", value: "Ver todas las encuestas activas en el servidor con votos, canal y tiempo restante.", inline: false },
    ],
  },

  // ── RECORDATORIOS
  {
    id: "remind", emoji: "⏰", label: "Recordatorios", color: 0xFEE75C,
    title: "⏰ Sistema de Recordatorios",
    description: "Crea recordatorios personales. El bot te avisa por DM (o en el canal si los tienes cerrados).",
    fields: [
      { name: "⏰ `/remind set [tiempo] [mensaje]`", value: "Crea un recordatorio. Máximo **10 activos** simultáneamente.\n**Ejemplos de tiempo:** `30m` · `2h` · `1d` · `1h30m` · `2d12h` · `1 semana`", inline: false },
      { name: "📋 `/remind lista`", value: "Ver todos tus recordatorios pendientes con ID, mensaje y tiempo restante.", inline: false },
      { name: "🗑️ `/remind cancelar [id]`", value: "Cancela un recordatorio por su ID de 6 caracteres (visible en `/remind lista`).", inline: false },
    ],
  },

  // ── EMBEDS
  {
    id: "embed", emoji: "✨", label: "Embeds", color: 0xEB459E,
    title: "✨ Constructor de Embeds Personalizados",
    description: "Crea y envía embeds profesionales a cualquier canal. 🔐",
    fields: [
      { name: "✨ `/embed crear #canal` 🔐", value: "Constructor completo con formulario interactivo. Parámetros opcionales: `color` · `imagen` · `thumbnail` · `footer` · `autor` · `autor_icono` · `timestamp` · `mencionar`\nEl formulario pide **título**, **descripción** y **campos extra** opcionales.", inline: false },
      { name: "✏️ `/embed editar [id_mensaje]` 🔐", value: "Edita el título, descripción y color de cualquier embed enviado por el bot. Puedes especificar el canal si el mensaje está en otro canal.", inline: false },
      { name: "⚡ `/embed rapido #canal [título] [desc]` 🔐", value: "Envía un embed simple con título y descripción en segundos, sin formulario.", inline: false },
      { name: "📢 `/embed anuncio #canal [título] [texto]` 🔐", value: "Plantilla de anuncio profesional con icono del servidor, footer del servidor y soporte para imagen. Incluye opción de mención (`@everyone`, roles, etc.).", inline: false },
    ],
  },

  // ── AUTO-RESPUESTAS
  {
    id: "autoresponse", emoji: "🤖", label: "Auto-respuestas", color: 0x5865F2,
    title: "🤖 Sistema de Auto-respuestas",
    description: "Respuestas automáticas dentro de tickets cuando un usuario escribe una palabra o frase clave.",
    fields: [
      { name: "➕ `/autoresponse add` 🔐", value: "Abre un formulario para definir el **trigger** (palabra clave) y la **respuesta**. El bot responde automáticamente cuando detecta el trigger.", inline: false },
      { name: "✏️ `/autoresponse edit [trigger]` 🔐", value: "Edita el texto de respuesta de un trigger existente.", inline: false },
      { name: "🗑️ `/autoresponse delete [trigger]` 🔐", value: "Elimina permanentemente una auto-respuesta.", inline: false },
      { name: "📋 `/autoresponse list` 🔐", value: "Lista todos los triggers configurados con número de usos.", inline: false },
    ],
  },

  // ── TAGS
  {
    id: "tags", emoji: "🏷️", label: "Tags", color: 0xFEE75C,
    title: "🏷️ Sistema de Tags — Respuestas Rápidas",
    description: "Respuestas predefinidas que el staff envía con un comando. Perfectas para FAQs y mensajes estándar.",
    fields: [
      { name: "➕ `/tag create [nombre]` 🔐", value: "Crea un tag con nombre identificador y contenido.", inline: false },
      { name: "📩 `/tag use [nombre]` 🔐", value: "Envía el contenido del tag en el canal actual.", inline: false },
      { name: "✏️ `/tag edit [nombre]` 🔐", value: "Actualiza el contenido de un tag existente.", inline: false },
      { name: "🗑️ `/tag delete [nombre]` 🔐", value: "Elimina permanentemente un tag.", inline: false },
      { name: "📋 `/tag list` 🔐", value: "Lista todos los tags disponibles ordenados por número de usos.", inline: false },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//   HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const FIELDS_PER_PAGE = 5;

function getTotalPages(section) {
  return section.fields.length ? Math.ceil(section.fields.length / FIELDS_PER_PAGE) : 1;
}

function buildEmbed(section, page, totalPages, requester) {
  const idx   = SECTIONS.findIndex(s => s.id === section.id) + 1;
  const embed = new EmbedBuilder()
    .setColor(section.color)
    .setTitle(section.title)
    .setFooter({
      text: "Sección " + idx + "/" + SECTIONS.length + "  •  Pág. " + (page + 1) + "/" + totalPages + "  •  " + requester.username,
      iconURL: requester.displayAvatarURL({ dynamic: true }),
    })
    .setTimestamp();

  if (section.description) embed.setDescription(section.description);

  const start  = page * FIELDS_PER_PAGE;
  const fields = section.fields.slice(start, start + FIELDS_PER_PAGE);
  if (fields.length) embed.addFields(fields);

  return embed;
}

function buildSelectMenu(currentId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("help_section_select")
      .setPlaceholder("📖 Ir a una sección...")
      .addOptions(SECTIONS.map(s => ({
        label:   s.label,
        value:   s.id,
        emoji:   s.emoji,
        default: s.id === currentId,
      })))
  );
}

function buildNavButtons(sectionIdx, page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("help_prev_section").setEmoji("⏮️").setStyle(ButtonStyle.Secondary).setDisabled(sectionIdx === 0),
    new ButtonBuilder().setCustomId("help_prev_page").setEmoji("◀️").setStyle(ButtonStyle.Primary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId("help_home").setEmoji("🏠").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("help_next_page").setEmoji("▶️").setStyle(ButtonStyle.Primary).setDisabled(page >= totalPages - 1),
    new ButtonBuilder().setCustomId("help_next_section").setEmoji("⏭️").setStyle(ButtonStyle.Secondary).setDisabled(sectionIdx >= SECTIONS.length - 1),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//   COMANDO
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("📖 Centro de ayuda interactivo — todos los comandos explicados")
    .addStringOption(o => o
      .setName("seccion")
      .setDescription("Ir directamente a una sección")
      .setRequired(false)
      .addChoices(
        { name: "🏠 Inicio",           value: "home"         },
        { name: "🎫 Tickets",          value: "tickets"      },
        { name: "⚙️ Configuración",    value: "setup"        },
        { name: "👥 Staff",            value: "staff"        },
        { name: "📊 Estadísticas",     value: "stats"        },
        { name: "⭐ Niveles & XP",     value: "levels"       },
        { name: "🎉 Bienvenidas",      value: "welcome"      },
        { name: "✅ Verificación",     value: "verify"       },
        { name: "🔒 Moderación",       value: "moderation"   },
        { name: "📋 Logs",             value: "modlogs"      },
        { name: "💡 Sugerencias",      value: "suggest"      },
        { name: "📊 Encuestas",        value: "polls"        },
        { name: "⏰ Recordatorios",    value: "remind"       },
        { name: "✨ Embeds",           value: "embed"        },
        { name: "🤖 Auto-respuestas",  value: "autoresponse" },
        { name: "🏷️ Tags",             value: "tags"         },
      )
    ),

  async execute(interaction) {
    const arg       = interaction.options.getString("seccion") || "home";
    let sectionIdx  = SECTIONS.findIndex(s => s.id === arg);
    if (sectionIdx === -1) sectionIdx = 0;
    let page        = 0;

    const section    = SECTIONS[sectionIdx];
    const totalPages = getTotalPages(section);

    await interaction.reply({
      embeds:     [buildEmbed(section, page, totalPages, interaction.user)],
      components: [buildSelectMenu(section.id), buildNavButtons(sectionIdx, page, totalPages)],
      flags:      MessageFlags.Ephemeral,
    });

    const reply = await interaction.fetchReply();

    const collector = reply.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time:   5 * 60 * 1000,
    });

    collector.on("collect", async i => {
      if (i.customId === "help_section_select") { sectionIdx = SECTIONS.findIndex(s => s.id === i.values[0]); page = 0; }
      if (i.customId === "help_prev_section")   { sectionIdx = Math.max(0, sectionIdx - 1); page = 0; }
      if (i.customId === "help_next_section")   { sectionIdx = Math.min(SECTIONS.length - 1, sectionIdx + 1); page = 0; }
      if (i.customId === "help_home")           { sectionIdx = 0; page = 0; }
      if (i.customId === "help_prev_page")      { page = Math.max(0, page - 1); }
      if (i.customId === "help_next_page") {
        const tp = getTotalPages(SECTIONS[sectionIdx]);
        page = Math.min(tp - 1, page + 1);
      }

      const newSection = SECTIONS[sectionIdx];
      const newTotal   = getTotalPages(newSection);
      if (page >= newTotal) page = newTotal - 1;

      await i.update({
        embeds:     [buildEmbed(newSection, page, newTotal, interaction.user)],
        components: [buildSelectMenu(newSection.id), buildNavButtons(sectionIdx, page, newTotal)],
      });
    });

    collector.on("end", async () => {
      const sec = SECTIONS[sectionIdx];
      const tot = getTotalPages(sec);
      const expiredEmbed = buildEmbed(sec, page, tot, interaction.user);
      expiredEmbed.setFooter({ text: "⏱️ Menú expirado — Usa /help para abrir uno nuevo.", iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });

      const disabledSelect = new ActionRowBuilder().addComponents(
        StringSelectMenuBuilder.from(buildSelectMenu(sec.id).components[0]).setDisabled(true)
      );
      const disabledNav = new ActionRowBuilder().addComponents(
        buildNavButtons(sectionIdx, page, tot).components.map(b => ButtonBuilder.from(b).setDisabled(true))
      );

      await interaction.editReply({ embeds: [expiredEmbed], components: [disabledSelect, disabledNav] }).catch(() => {});
    });
  },
};
