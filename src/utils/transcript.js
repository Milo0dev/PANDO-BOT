const { AttachmentBuilder } = require("discord.js");
const moment = require("moment");

/**
 * Genera una transcripción HTML del canal de ticket
 * @param {TextChannel} channel - Canal de Discord a transcribir
 * @param {Object} ticket - Datos del ticket desde la base de datos
 * @param {Guild} guild - Servidor de Discord
 * @returns {Object} Objeto con el attachment y el conteo de mensajes
 */
async function generateTranscript(channel, ticket, guild) {
  try {
    // Obtener todos los mensajes del canal
    const messages = await fetchAll(channel);
    
    // Construir el HTML con los mensajes
    const html = buildHTML(messages, ticket, guild, channel);
    
    // Crear el archivo adjunto
    const buf = Buffer.from(html, "utf-8");
    const att = new AttachmentBuilder(buf, { name: `transcript-${ticket.ticket_id}.html` });
    
    // Actualizar el conteo de mensajes en el ticket
    await require("../utils/database").tickets.update(channel.id, { message_count: messages.length });
    
    return { attachment: att, messageCount: messages.length };
  } catch (error) {
    console.error("[TRANSCRIPT ERROR]", error);
    // Crear un HTML de error en caso de fallo
    const errorHtml = `<!DOCTYPE html><html><head><title>Error</title></head><body>
      <h1>Error al generar la transcripción</h1>
      <p>${error.message}</p>
    </body></html>`;
    const buf = Buffer.from(errorHtml, "utf-8");
    const att = new AttachmentBuilder(buf, { name: `transcript-error-${ticket.ticket_id}.html` });
    return { attachment: att, messageCount: 0 };
  }
}

/**
 * Obtiene todos los mensajes de un canal
 * @param {TextChannel} channel - Canal de Discord
 * @returns {Array} Array con todos los mensajes
 */
async function fetchAll(channel) {
  const out = [];
  let lastId;
  
  // Obtener mensajes en lotes de 100 (límite de la API)
  while (true) {
    const opts = { limit: 100 };
    if (lastId) opts.before = lastId;
    
    const batch = await channel.messages.fetch(opts);
    if (!batch.size) break;
    
    out.push(...batch.values());
    lastId = batch.last().id;
    
    if (batch.size < 100) break;
  }
  
  return out.reverse(); // Ordenar cronológicamente
}

/**
 * Escapa caracteres especiales HTML
 * @param {string} s - String a escapar
 * @returns {string} String escapado
 */
function esc(s) {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Convierte un mensaje de Discord a HTML
 * @param {Message} msg - Mensaje de Discord
 * @returns {string} HTML del mensaje
 */
function msgHTML(msg) {
  // Mensaje del sistema
  if (msg.system) {
    return `<div class="system-message">
      <div class="system-content">
        <svg aria-hidden="true" role="img" width="16" height="16" viewBox="0 0 16 16" class="system-icon">
          <path fill="currentColor" d="M12 2.75H8.5V2.5C8.5 1.67 7.83 1 7 1H5.5C4.67 1 4 1.67 4 2.5V2.75H0.5C0.224 2.75 0 2.974 0 3.25V4.25C0 4.526 0.224 4.75 0.5 4.75H1.06L1.54 12.4C1.58 13.32 2.33 14 3.24 14H9.25C10.17 14 10.92 13.32 10.96 12.4L11.44 4.75H12C12.276 4.75 12.5 4.526 12.5 4.25V3.25C12.5 2.974 12.276 2.75 12 2.75ZM5.5 2.5H7V2.75H5.5V2.5ZM9.02 12.31C9 12.72 8.66 13 8.25 13H4.25C3.84 13 3.5 12.72 3.48 12.31L3.01 4.75H9.5L9.02 12.31Z"></path>
        </svg>
        ${esc(msg.content)}
      </div>
    </div>`;
  }
  
  // Obtener avatar y timestamp
  const avatar = msg.author.displayAvatarURL({ size: 128, format: "png" });
  const time = moment(msg.createdAt).format("DD/MM/YYYY HH:mm");
  const timeFormatted = moment(msg.createdAt).format("DD/MM/YYYY [a las] HH:mm:ss");
  
  // Procesar el contenido del mensaje
  let body = "";
  
  // Texto del mensaje
  if (msg.content) {
    let content = esc(msg.content)
      // Formato de texto
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/~~(.+?)~~/g, "<del>$1</del>")
      .replace(/\_\_(.+?)\_\_/g, "<u>$1</u>")
      .replace(/\`\`\`([a-z]*)\n([\s\S]*?)\n\`\`\`/g, (match, lang, code) => {
        return `<div class="code-block"><div class="code-block-lang">${lang || 'Código'}</div><pre><code>${esc(code)}</code></pre></div>`;
      })
      .replace(/\`(.+?)\`/g, "<code>$1</code>")
      // Menciones
      .replace(/&lt;@!?(\d+)&gt;/g, '<span class="mention">@$1</span>')
      .replace(/&lt;#(\d+)&gt;/g, '<span class="mention">#$1</span>')
      .replace(/&lt;@&amp;(\d+)&gt;/g, '<span class="mention">@&amp;$1</span>')
      // URLs
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    
    body += `<div class="message-content">${content}</div>`;
  }
  
  // Embeds
  msg.embeds.forEach(e => {
    const color = e.color ? `#${e.color.toString(16).padStart(6, "0")}` : "#2f3136";
    
    let embedContent = `
      <div class="embed" style="border-color: ${color}">
        ${e.author ? `<div class="embed-author">
          ${e.author.iconURL ? `<img src="${e.author.iconURL}" alt="" class="embed-author-icon">` : ''}
          ${e.author.name ? `<span class="embed-author-name">${esc(e.author.name)}</span>` : ''}
        </div>` : ''}
        
        ${e.title ? `<div class="embed-title">${esc(e.title)}</div>` : ''}
        ${e.description ? `<div class="embed-description">${esc(e.description)}</div>` : ''}
        
        ${e.fields && e.fields.length > 0 ? `
          <div class="embed-fields">
            ${e.fields.map(field => `
              <div class="embed-field ${field.inline ? 'embed-field-inline' : ''}">
                <div class="embed-field-name">${esc(field.name)}</div>
                <div class="embed-field-value">${esc(field.value)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        ${e.image ? `<div class="embed-image"><img src="${e.image.url}" alt="Embed Image"></div>` : ''}
        ${e.thumbnail ? `<div class="embed-thumbnail"><img src="${e.thumbnail.url}" alt="Embed Thumbnail"></div>` : ''}
        
        ${e.footer ? `<div class="embed-footer">
          ${e.footer.iconURL ? `<img src="${e.footer.iconURL}" alt="" class="embed-footer-icon">` : ''}
          <span class="embed-footer-text">${esc(e.footer.text || '')}</span>
          ${e.timestamp ? `<span class="embed-footer-separator">•</span><span class="embed-footer-timestamp">${moment(e.timestamp).format('DD/MM/YYYY')}</span>` : ''}
        </div>` : ''}
      </div>
    `;
    
    body += embedContent;
  });
  
  // Archivos adjuntos
  msg.attachments.forEach(a => {
    if (a.contentType?.startsWith("image/")) {
      body += `<div class="attachment">
        <div class="attachment-image">
          <img src="${a.url}" alt="${esc(a.name)}" class="attachment-img">
        </div>
        <div class="attachment-info">
          <div class="attachment-title">${esc(a.name)}</div>
          <div class="attachment-size">${formatBytes(a.size)}</div>
        </div>
      </div>`;
    } else {
      body += `<div class="attachment">
        <div class="attachment-icon">
          <svg width="30" height="40" viewBox="0 0 30 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M30 10V40H0V0H20L30 10Z" fill="#697ec4"/>
            <path d="M30 10H20V0L30 10Z" fill="#5d72bc"/>
          </svg>
        </div>
        <div class="attachment-info">
          <div class="attachment-title">
            <a href="${a.url}" target="_blank" rel="noopener noreferrer">${esc(a.name)}</a>
          </div>
          <div class="attachment-size">${formatBytes(a.size)}</div>
        </div>
      </div>`;
    }
  });
  
  // Determinar si es un bot
  const isBot = msg.author.bot;
  
  // Construir el HTML del mensaje completo
  return `
    <div class="message" id="message-${msg.id}">
      <div class="message-avatar">
        <img src="${avatar}" alt="Avatar" class="avatar">
      </div>
      <div class="message-container">
        <div class="message-header">
          <span class="message-author ${isBot ? 'bot' : ''}">${esc(msg.author.username)}</span>
          ${isBot ? '<span class="bot-tag">BOT</span>' : ''}
          <span class="message-timestamp" title="${timeFormatted}">${time}</span>
        </div>
        ${body}
      </div>
    </div>
  `;
}

/**
 * Formatea bytes a una unidad legible
 * @param {number} bytes - Tamaño en bytes
 * @returns {string} Tamaño formateado
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Construye el HTML completo de la transcripción
 * @param {Array} messages - Mensajes del canal
 * @param {Object} ticket - Datos del ticket
 * @param {Guild} guild - Servidor de Discord
 * @param {TextChannel} channel - Canal de Discord
 * @returns {string} HTML completo
 */
function buildHTML(messages, ticket, guild, channel) {
  // Información del ticket
  const guildIcon = guild.iconURL({ size: 128, format: "png" }) || "";
  const opened = moment(ticket.created_at).format("DD/MM/YYYY HH:mm");
  const closed = ticket.closed_at ? moment(ticket.closed_at).format("DD/MM/YYYY HH:mm") : "Activo";
  const duration = ticket.closed_at 
    ? moment.duration(moment(ticket.closed_at).diff(moment(ticket.created_at))).humanize()
    : moment.duration(moment().diff(moment(ticket.created_at))).humanize();

  // Construir el HTML completo
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket #${ticket.ticket_id} - ${guild.name}</title>
  <style>
    /* Variables y reset */
    :root {
      --background-primary: #313338;
      --background-secondary: #2b2d31;
      --background-tertiary: #1e1f22;
      --background-accent: #4e5058;
      --text-normal: #dcddde;
      --text-muted: #949ba4;
      --text-link: #00a8fc;
      --header-primary: #ffffff;
      --header-secondary: #b9bbbe;
      --brand: #5865f2;
      --brand-darker: #4752c4;
      --green: #57f287;
      --red: #ed4245;
      --yellow: #fee75c;
      --border-radius: 4px;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: 'gg sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    }
    
    body {
      background-color: var(--background-primary);
      color: var(--text-normal);
      line-height: 1.5;
      font-size: 16px;
    }
    
    a {
      color: var(--text-link);
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
    
    code {
      background-color: var(--background-tertiary);
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: Consolas, 'Courier New', monospace;
      font-size: 85%;
    }
    
    .code-block {
      background-color: var(--background-tertiary);
      border-radius: var(--border-radius);
      margin: 8px 0;
      overflow: hidden;
    }
    
    .code-block-lang {
      background-color: rgba(0, 0, 0, 0.2);
      color: var(--text-muted);
      padding: 4px 8px;
      font-size: 12px;
      font-weight: 600;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .code-block pre {
      padding: 8px;
      overflow-x: auto;
      margin: 0;
    }
    
    .code-block code {
      background-color: transparent;
      padding: 0;
      white-space: pre;
      font-family: Consolas, 'Courier New', monospace;
    }
    
    /* Header */
    .header {
      background: linear-gradient(90deg, var(--brand) 0%, var(--brand-darker) 100%);
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      color: white;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }
    
    .header-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background-color: white;
      overflow: hidden;
    }
    
    .header-icon img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .header-info h1 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    
    .header-info p {
      font-size: 14px;
      opacity: 0.9;
    }
    
    /* Info Bar */
    .info-bar {
      background-color: var(--background-secondary);
      padding: 16px 20px;
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      border-bottom: 1px solid var(--background-tertiary);
    }
    
    .info-item {
      display: flex;
      flex-direction: column;
    }
    
    .info-label {
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    
    .info-value {
      color: var(--header-primary);
      font-size: 14px;
      font-weight: 500;
    }
    
    /* Messages Container */
    .messages-container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 24px 16px;
    }
    
    /* Message */
    .message {
      display: flex;
      margin-bottom: 16px;
      padding: 8px;
      border-radius: var(--border-radius);
    }
    
    .message:hover {
      background-color: rgba(255, 255, 255, 0.03);
    }
    
    .message-avatar {
      margin-right: 16px;
      flex-shrink: 0;
    }
    
    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
    }
    
    .message-container {
      flex: 1;
      min-width: 0;
    }
    
    .message-header {
      display: flex;
      align-items: center;
      margin-bottom: 4px;
    }
    
    .message-author {
      font-weight: 500;
      color: var(--header-primary);
      margin-right: 8px;
    }
    
    .message-author.bot {
      color: var(--brand);
    }
    
    .bot-tag {
      background-color: var(--brand);
      color: white;
      font-size: 10px;
      font-weight: 600;
      padding: 1px 4px;
      border-radius: 3px;
      margin-right: 8px;
      text-transform: uppercase;
    }
    
    .message-timestamp {
      color: var(--text-muted);
      font-size: 12px;
    }
    
    .message-content {
      color: var(--text-normal);
      font-size: 16px;
      word-wrap: break-word;
      white-space: pre-wrap;
    }
    
    /* Mentions */
    .mention {
      background-color: rgba(88, 101, 242, 0.3);
      color: #c9cdfb;
      padding: 0 2px;
      border-radius: 3px;
      font-weight: 500;
    }
    
    /* Embeds */
    .embed {
      max-width: 520px;
      margin-top: 8px;
      padding: 8px 16px 16px 12px;
      background-color: var(--background-secondary);
      border-left: 4px solid;
      border-radius: 0 var(--border-radius) var(--border-radius) 0;
    }
    
    .embed-author {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .embed-author-icon {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      margin-right: 8px;
    }
    
    .embed-author-name {
      color: var(--header-primary);
      font-size: 14px;
      font-weight: 600;
    }
    
    .embed-title {
      color: var(--header-primary);
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    .embed-description {
      color: var(--text-normal);
      font-size: 14px;
      margin-bottom: 8px;
      white-space: pre-wrap;
    }
    
    .embed-fields {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100%, 1fr));
      gap: 8px;
      margin: 8px 0;
    }
    
    .embed-field {
      font-size: 14px;
    }
    
    .embed-field-inline {
      grid-column: span 1;
    }
    
    .embed-field-name {
      color: var(--header-primary);
      font-weight: 600;
      margin-bottom: 2px;
    }
    
    .embed-field-value {
      color: var(--text-normal);
    }
    
    .embed-image {
      margin-top: 16px;
    }
    
    .embed-image img {
      max-width: 100%;
      max-height: 300px;
      border-radius: var(--border-radius);
    }
    
    .embed-thumbnail {
      float: right;
      margin-left: 16px;
      max-width: 80px;
      max-height: 80px;
    }
    
    .embed-thumbnail img {
      max-width: 100%;
      max-height: 100%;
      border-radius: var(--border-radius);
    }
    
    .embed-footer {
      margin-top: 8px;
      display: flex;
      align-items: center;
      color: var(--text-muted);
      font-size: 12px;
    }
    
    .embed-footer-icon {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      margin-right: 8px;
    }
    
    .embed-footer-separator {
      margin: 0 4px;
    }
    
    /* Attachments */
    .attachment {
      margin-top: 8px;
      display: flex;
      background-color: var(--background-secondary);
      border-radius: var(--border-radius);
      max-width: 520px;
      overflow: hidden;
    }
    
    .attachment-image {
      width: 100%;
    }
    
    .attachment-img {
      max-width: 100%;
      max-height: 350px;
      border-radius: var(--border-radius);
    }
    
    .attachment-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      margin: 10px;
    }
    
    .attachment-info {
      padding: 10px;
      flex: 1;
    }
    
    .attachment-title {
      color: var(--header-primary);
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 4px;
    }
    
    .attachment-size {
      color: var(--text-muted);
      font-size: 12px;
    }
    
    /* System Messages */
    .system-message {
      padding: 8px 0;
      color: var(--text-muted);
      font-size: 14px;
      display: flex;
      justify-content: center;
    }
    
    .system-content {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .system-icon {
      color: var(--text-muted);
    }
    
    /* Footer */
    .footer {
      text-align: center;
      padding: 24px;
      color: var(--text-muted);
      font-size: 12px;
      border-top: 1px solid var(--background-tertiary);
      margin-top: 32px;
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      .info-bar {
        flex-direction: column;
        gap: 12px;
      }
      
      .message {
        flex-direction: column;
      }
      
      .message-avatar {
        margin-right: 0;
        margin-bottom: 8px;
      }
      
      .embed-fields {
        grid-template-columns: 1fr;
      }
    }
    
    @media (min-width: 768px) {
      .embed-fields {
        grid-template-columns: repeat(auto-fill, minmax(45%, 1fr));
      }
      
      .embed-field-inline {
        grid-column: span 1;
      }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="header-icon">
      ${guildIcon ? `<img src="${guildIcon}" alt="${guild.name}">` : ''}
    </div>
    <div class="header-info">
      <h1>Transcripción de Ticket #${ticket.ticket_id}</h1>
      <p>${guild.name} • #${channel.name}</p>
    </div>
  </div>
  
  <!-- Info Bar -->
  <div class="info-bar">
    <div class="info-item">
      <span class="info-label">Ticket</span>
      <span class="info-value">#${ticket.ticket_id}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Categoría</span>
      <span class="info-value">${ticket.category}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Creado</span>
      <span class="info-value">${opened}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Estado</span>
      <span class="info-value">${ticket.status === 'open' ? 'Abierto' : 'Cerrado'}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Duración</span>
      <span class="info-value">${duration}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Mensajes</span>
      <span class="info-value">${messages.length}</span>
    </div>
    ${ticket.claimed_by ? `
    <div class="info-item">
      <span class="info-label">Atendido por</span>
      <span class="info-value">${ticket.claimed_by}</span>
    </div>
    ` : ''}
    ${ticket.rating ? `
    <div class="info-item">
      <span class="info-label">Calificación</span>
      <span class="info-value">${"⭐".repeat(ticket.rating)} (${ticket.rating}/5)</span>
    </div>
    ` : ''}
  </div>
  
  <!-- Messages -->
  <div class="messages-container">
    ${messages.map(msgHTML).join("\n") || '<div class="system-message">No hay mensajes en este ticket</div>'}
  </div>
  
  <!-- Footer -->
  <div class="footer">
    <p>Transcripción generada el ${moment().format("DD/MM/YYYY [a las] HH:mm:ss")} • Sistema Premium de Tickets</p>
  </div>
</body>
</html>`;
}

module.exports = { generateTranscript };
