// ================================================
//        CONFIGURACIÓN PRINCIPAL DEL BOT
//     Edita este archivo a tu gusto
// ================================================

module.exports = {

  // ────────────────────────────────────────────
  //   PROPIETARIO (Para OAuth)
  // ────────────────────────────────────────────
  // Tu ID de Discord - se usa para proteger la dashboard
  ownerId: process.env.DISCORD_OWNER_ID || null,

  // ────────────────────────────────────────────
  //   CATEGORÍAS DE TICKETS
  // ────────────────────────────────────────────
  categories: [
    {
      id: "support",
      label: "Soporte General",
      description: "Ayuda con problemas generales",
      emoji: "🛠️",
      color: 0x5865F2,
      categoryId: null,       // ID de categoría de Discord (null = sin categoría)
      pingRoles: [],          // Roles a mencionar al abrir
      welcomeMessage: "¡Hola {user}! 👋\n\nGracias por contactar con **Soporte General**.\nUn miembro del equipo te atenderá en breve.\n\n> Describe tu problema con el mayor detalle posible.",
      questions: [
        "¿Cuál es tu problema?",
        "¿Desde cuándo ocurre?",
        "¿Intentaste solucionarlo?",
      ],
      priority: "normal",
    },
    {
      id: "billing",
      label: "Pagos",
      description: "Problemas con pagos o reembolsos",
      emoji: "💳",
      color: 0x57F287,
      categoryId: null,
      pingRoles: [],
      welcomeMessage: "¡Hola {user}! 💳\n\nHas abierto un ticket de **Pagos y Facturación**.\n\n> ⚠️ Nunca compartas datos bancarios completos.",
      questions: [
        "¿Qué problema tienes con tu pago?",
        "¿Cuál es tu ID de transacción?",
        "¿Qué método de pago usaste?",
      ],
      priority: "high",
    },
    {
      id: "report",
      label: "Reportar Usuario",
      description: "Reporta comportamientos inapropiados",
      emoji: "🚨",
      color: 0xED4245,
      categoryId: null,
      pingRoles: [],
      welcomeMessage: "¡Hola {user}! 🚨\n\nHas abierto un **Reporte de Usuario**.\nEl staff lo revisará lo antes posible.\n\n> Proporciona evidencias (capturas, etc.)",
      questions: [
        "¿A quién reportas?",
        "¿Por qué razón?",
        "¿Tienes evidencias?",
      ],
      priority: "urgent",
    },
    {
      id: "partnership",
      label: "Asociaciones",
      description: "Propuestas de colaboración",
      emoji: "🤝",
      color: 0xFEE75C,
      categoryId: null,
      pingRoles: [],
      welcomeMessage: "¡Hola {user}! 🤝\n\nHas abierto un ticket de **Asociaciones**.\nPor favor comparte la información de tu servidor o proyecto.",
      questions: [
        "¿Nombre y descripción de tu servidor?",
        "¿Cuántos miembros tiene?",
        "¿Qué tipo de colaboración propones?",
      ],
      priority: "low",
    },
    {
      id: "staff",
      label: "Aplicación Staff",
      description: "Aplica para ser parte del equipo",
      emoji: "⭐",
      color: 0xF1C40F,
      categoryId: null,
      pingRoles: [],
      welcomeMessage: "¡Hola {user}! ⭐\n\nHas abierto una **Aplicación de Staff**.\nResponde con honestidad y detalle.",
      questions: [
        "¿Edad y experiencia como staff?",
        "¿Por qué quieres ser staff?",
        "¿Horas semanales disponibles?",
        "¿Zona horaria?",
      ],
      priority: "normal",
    },
    {
      id: "bug",
      label: "Reportar Bug",
      description: "Reporta un error o fallo",
      emoji: "🐛",
      color: 0xE67E22,
      categoryId: null,
      pingRoles: [],
      welcomeMessage: "¡Hola {user}! 🐛\n\nHas abierto un **Reporte de Bug**.\nDescribe el error con detalle para reproducirlo.",
      questions: [
        "¿Qué error encontraste?",
        "¿Cómo se reproduce?",
        "¿En qué dispositivo/plataforma?",
      ],
      priority: "high",
    },
    {
      id: "other",
      label: "Otro",
      description: "Cualquier otro asunto",
      emoji: "📩",
      color: 0x95A5A6,
      categoryId: null,
      pingRoles: [],
      welcomeMessage: "¡Hola {user}! 📩\n\nHas abierto un ticket.\nEl staff te atenderá pronto.",
      questions: [
        "¿En qué te podemos ayudar?",
      ],
      priority: "normal",
    },
  ],

  // ────────────────────────────────────────────
  //   PRIORIDADES
  // ────────────────────────────────────────────
  priorities: {
    low:    { label: "🟢 Baja",    color: 0x57F287 },
    normal: { label: "🔵 Normal",  color: 0x5865F2 },
    high:   { label: "🟡 Alta",    color: 0xFEE75C },
    urgent: { label: "🔴 Urgente", color: 0xED4245 },
  },

  // ────────────────────────────────────────────
  //   PANEL DE TICKETS
  // ────────────────────────────────────────────
  panel: {
    title: "🎫 Sistema de Soporte",
    description:
      "Bienvenido al sistema de tickets.\nSelecciona la categoría que mejor se adapte a tu consulta.\n\n" +
      "**📋 Antes de abrir un ticket:**\n" +
      "▸ Lee las reglas del servidor\n" +
      "▸ Revisa el canal de preguntas frecuentes\n" +
      "▸ Sé específico y proporciona detalles\n\n" +
      "**⏰ Tiempo de respuesta:** Menos de 24h",
    footer: "Sistema de Tickets v3.0 • Respetamos tu tiempo",
    color: 0x5865F2,
  },

  // ────────────────────────────────────────────
  //   RATING (calificación al cerrar)
  // ────────────────────────────────────────────
  ratings: {
    enabled: true,
    dmRating: true, // Enviar el rating por DM en vez de en el canal
  },

  // ────────────────────────────────────────────
  //   MENSAJES DE MANTENIMIENTO
  // ────────────────────────────────────────────
  maintenance: {
    defaultMessage: "El sistema de tickets está en mantenimiento. Por favor vuelve más tarde.",
  },
};
