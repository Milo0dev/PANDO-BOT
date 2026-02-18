const { AttachmentBuilder } = require("discord.js");
const moment = require("moment");

async function generateTranscript(channel, ticket, guild) {
  const messages = await fetchAll(channel);
  const html     = buildHTML(messages, ticket, guild, channel);
  const buf      = Buffer.from(html, "utf-8");
  const att      = new AttachmentBuilder(buf, { name: `transcript-${ticket.ticket_id}.html` });
  return { attachment: att, messageCount: messages.length };
}

async function fetchAll(channel) {
  const out = [];
  let lastId;
  while (true) {
    const opts  = { limit: 100 };
    if (lastId) opts.before = lastId;
    const batch = await channel.messages.fetch(opts);
    if (!batch.size) break;
    out.push(...batch.values());
    lastId = batch.last().id;
    if (batch.size < 100) break;
  }
  return out.reverse();
}

function esc(s) {
  if (!s) return "";
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function msgHTML(msg) {
  if (msg.system) return `<div class="sys">— ${esc(msg.content)} —</div>`;
  const avatar = msg.author.displayAvatarURL({ size: 64, format: "png" });
  const time   = moment(msg.createdAt).format("DD/MM/YYYY HH:mm");
  let body = "";
  if (msg.content) {
    let t = esc(msg.content)
      .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
      .replace(/\*(.+?)\*/g,"<em>$1</em>")
      .replace(/`(.+?)`/g,"<code>$1</code>")
      .replace(/&lt;@(\d+)&gt;/g,'<span class="mention">@$1</span>');
    body += `<div class="text">${t}</div>`;
  }
  msg.embeds.forEach(e => {
    const col = e.color ? "#"+e.color.toString(16).padStart(6,"0") : "#5865f2";
    body += `<div class="embed" style="border-left-color:${col}">
      ${e.title ? `<div class="etitle">${esc(e.title)}</div>` : ""}
      ${e.description ? `<div class="edesc">${esc(e.description)}</div>` : ""}
    </div>`;
  });
  msg.attachments.forEach(a => {
    if (a.contentType?.startsWith("image/")) {
      body += `<img class="att" src="${a.url}" alt="img">`;
    } else {
      body += `<div class="text">📎 <a href="${a.url}">${esc(a.name)}</a></div>`;
    }
  });
  const isBot = msg.author.bot;
  return `<div class="msg">
    <img class="av" src="${avatar}" alt="">
    <div class="mc">
      <div class="mh">
        <span class="un ${isBot?"bot":""}">${esc(msg.author.username)}</span>
        ${isBot?'<span class="badge">BOT</span>':""}
        <span class="ts">${time}</span>
      </div>
      ${body}
    </div>
  </div>`;
}

function buildHTML(messages, ticket, guild, channel) {
  const gIcon = guild.iconURL({ size: 64, format: "png" }) || "";
  const opened = moment(ticket.created_at).format("DD/MM/YYYY HH:mm");
  const closed = ticket.closed_at ? moment(ticket.closed_at).format("DD/MM/YYYY HH:mm") : "Activo";

  return `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"><title>Ticket #${ticket.ticket_id}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;background:#313338;color:#dcddde;min-height:100vh}
.header{background:linear-gradient(135deg,#5865f2,#4752c4);padding:20px 32px;display:flex;align-items:center;gap:16px}
.header img{width:48px;height:48px;border-radius:50%}
.header h1{font-size:18px;font-weight:700;color:#fff}
.header p{font-size:13px;color:rgba(255,255,255,.7);margin-top:2px}
.infobar{background:#2b2d31;padding:14px 32px;display:flex;gap:28px;flex-wrap:wrap;border-bottom:1px solid #1e1f22}
.ii{display:flex;flex-direction:column;gap:2px}
.il{font-size:11px;font-weight:600;color:#949ba4;text-transform:uppercase;letter-spacing:.5px}
.iv{font-size:14px;color:#e0e1e5;font-weight:500}
.msgs{max-width:860px;margin:0 auto;padding:24px 32px}
.msg{display:flex;gap:16px;padding:4px 8px;border-radius:4px;margin-top:14px}
.msg:hover{background:rgba(255,255,255,.03)}
.av{width:40px;height:40px;border-radius:50%;flex-shrink:0;margin-top:2px}
.mc{flex:1;min-width:0}
.mh{display:flex;align-items:baseline;gap:8px;margin-bottom:4px}
.un{font-weight:700;font-size:15px;color:#e0e1e5}
.un.bot{color:#5865f2}
.badge{background:#5865f2;color:#fff;font-size:10px;font-weight:600;padding:1px 4px;border-radius:3px}
.ts{font-size:12px;color:#949ba4}
.text{font-size:15px;line-height:1.4;color:#dcddde;word-break:break-word}
code{background:#1e1f22;padding:0 4px;border-radius:3px;font-size:85%;font-family:monospace}
.mention{color:#5865f2;background:rgba(88,101,242,.15);padding:0 2px;border-radius:3px}
.embed{margin-top:8px;border-left:4px solid #5865f2;background:#2b2d31;border-radius:0 4px 4px 0;padding:10px;max-width:520px}
.etitle{font-size:15px;font-weight:600;color:#fff;margin-bottom:6px}
.edesc{font-size:14px;color:#dcddde;line-height:1.4}
.att{max-width:400px;max-height:300px;border-radius:4px;margin-top:8px}
.sys{text-align:center;color:#949ba4;font-size:13px;padding:8px 0;font-style:italic;margin:8px 0}
.footer{text-align:center;padding:24px;color:#949ba4;font-size:12px;border-top:1px solid #1e1f22;margin-top:32px}
a{color:#5865f2}
</style></head><body>
<div class="header">
  ${gIcon?`<img src="${gIcon}" alt="">`:""} 
  <div><h1>📄 Transcripción — Ticket #${ticket.ticket_id}</h1><p>${guild.name} • #${channel.name}</p></div>
</div>
<div class="infobar">
  <div class="ii"><span class="il">Ticket</span><span class="iv">#${ticket.ticket_id}</span></div>
  <div class="ii"><span class="il">Categoría</span><span class="iv">${ticket.category}</span></div>
  <div class="ii"><span class="il">Abierto</span><span class="iv">${opened}</span></div>
  <div class="ii"><span class="il">Cerrado</span><span class="iv">${closed}</span></div>
  <div class="ii"><span class="il">Mensajes</span><span class="iv">${messages.length}</span></div>
  ${ticket.claimed_by?`<div class="ii"><span class="il">Atendido por</span><span class="iv">${ticket.claimed_by}</span></div>`:""}
  ${ticket.rating?`<div class="ii"><span class="il">Calificación</span><span class="iv">${"⭐".repeat(ticket.rating)} (${ticket.rating}/5)</span></div>`:""}
</div>
<div class="msgs">
  ${messages.map(msgHTML).join("\n") || '<div class="sys">Sin mensajes</div>'}
</div>
<div class="footer">Generado automáticamente • ${new Date().toLocaleString("es-ES")}</div>
</body></html>`;
}

module.exports = { generateTranscript };
