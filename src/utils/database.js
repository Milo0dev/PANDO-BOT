const fs   = require("fs");
const path = require("path");

// ─────────────────────────────────────────────────────
//   CONFIGURACIÓN DE ARCHIVOS
// ─────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, "../../data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const F = {
  tickets:       path.join(DATA_DIR, "tickets.json"),
  notes:         path.join(DATA_DIR, "notes.json"),
  blacklist:     path.join(DATA_DIR, "blacklist.json"),
  settings:      path.join(DATA_DIR, "settings.json"),
  staffStats:    path.join(DATA_DIR, "staff_stats.json"),
  tags:          path.join(DATA_DIR, "tags.json"),
  cooldowns:     path.join(DATA_DIR, "cooldowns.json"),
  staffStatus:   path.join(DATA_DIR, "staff_status.json"),
  autoResponses: path.join(DATA_DIR, "auto_responses.json"),
  ticketLogs:    path.join(DATA_DIR, "ticket_logs.json"),
};

// ─────────────────────────────────────────────────────
//   HELPERS
// ─────────────────────────────────────────────────────
function readArr(file) {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : []; }
  catch { return []; }
}
function readObj(file) {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {}; }
  catch { return {}; }
}
function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}
function now() { return new Date().toISOString(); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ─────────────────────────────────────────────────────
//   TICKETS
// ─────────────────────────────────────────────────────
const tickets = {
  _r() { return readArr(F.tickets); },
  _s(d) { save(F.tickets, d); },

  create(data) {
    const all = this._r();
    const t = {
      _id:                  uid(),
      ticket_id:            data.ticket_id,
      channel_id:           data.channel_id,
      guild_id:             data.guild_id,
      user_id:              data.user_id,
      category:             data.category,
      category_id:          data.category_id || null,
      status:               "open",
      priority:             data.priority || "normal",
      claimed_by:           null,
      assigned_to:          null,
      subject:              data.subject || null,
      created_at:           now(),
      closed_at:            null,
      closed_by:            null,
      close_reason:         null,
      last_activity:        now(),
      message_count:        0,
      staff_message_count:  0,
      first_staff_response: null,
      rating:               null,
      rating_comment:       null,
      transcript_url:       null,
      answers:              data.answers || null,
      reopen_count:         0,
      reopened_at:          null,
      reopened_by:          null,
    };
    all.push(t);
    this._s(all);
    return t;
  },

  get(channelId)   { return this._r().find(t => t.channel_id  === channelId)  || null; },
  getById(id)      { return this._r().find(t => t.ticket_id   === id)         || null; },

  getByUser(userId, guildId, status = "open") {
    return this._r().filter(t => t.user_id === userId && t.guild_id === guildId && t.status === status);
  },

  getAllOpen(guildId) {
    return this._r().filter(t => t.guild_id === guildId && t.status === "open")
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  getAllByGuild(guildId) {
    return this._r().filter(t => t.guild_id === guildId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  update(channelId, data) {
    const all = this._r();
    const i = all.findIndex(t => t.channel_id === channelId);
    if (i === -1) return null;
    all[i] = { ...all[i], ...data };
    this._s(all);
    return all[i];
  },

  close(channelId, closedBy, reason) {
    return this.update(channelId, {
      status: "closed", closed_at: now(), closed_by: closedBy, close_reason: reason || null,
    });
  },

  reopen(channelId, reopenedBy) {
    const t = this.get(channelId);
    if (!t) return null;
    return this.update(channelId, {
      status:       "open",
      closed_at:    null,
      closed_by:    null,
      close_reason: null,
      reopened_at:  now(),
      reopened_by:  reopenedBy,
      reopen_count: (t.reopen_count || 0) + 1,
      last_activity: now(),
    });
  },

  incrementMessages(channelId, isStaff = false) {
    const all = this._r();
    const i = all.findIndex(t => t.channel_id === channelId);
    if (i === -1) return;
    all[i].message_count = (all[i].message_count || 0) + 1;
    all[i].last_activity = now();
    if (isStaff) {
      all[i].staff_message_count = (all[i].staff_message_count || 0) + 1;
      if (!all[i].first_staff_response) all[i].first_staff_response = now();
    }
    this._s(all);
  },

  setRating(channelId, rating, comment = null) {
    return this.update(channelId, { rating, rating_comment: comment });
  },

  getInactive(guildId, minutes) {
    const cutoff = new Date(Date.now() - minutes * 60000);
    return this._r().filter(t =>
      t.guild_id === guildId &&
      t.status   === "open"  &&
      new Date(t.last_activity) < cutoff
    );
  },

  getWithoutStaffResponse(guildId, minutes) {
    const cutoff = new Date(Date.now() - minutes * 60000);
    return this._r().filter(t =>
      t.guild_id === guildId &&
      t.status   === "open"  &&
      !t.first_staff_response &&
      new Date(t.created_at) < cutoff
    );
  },

  getStats(guildId) {
    const all    = this._r().filter(t => t.guild_id === guildId);
    const open   = all.filter(t => t.status === "open").length;
    const closed = all.filter(t => t.status === "closed").length;

    const today  = new Date(); today.setHours(0,0,0,0);
    const openedToday  = all.filter(t => new Date(t.created_at) >= today).length;
    const closedToday  = all.filter(t => t.closed_at && new Date(t.closed_at) >= today).length;

    const thisWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const openedWeek  = all.filter(t => new Date(t.created_at) >= thisWeek).length;
    const closedWeek  = all.filter(t => t.closed_at && new Date(t.closed_at) >= thisWeek).length;

    const ratings = all.filter(t => t.rating !== null).map(t => t.rating);
    const avg_rating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : null;

    const closedWithTime = all.filter(t => t.status === "closed" && t.closed_at && t.first_staff_response);
    const avg_response_minutes = closedWithTime.length
      ? closedWithTime.reduce((acc, t) => acc + (new Date(t.first_staff_response) - new Date(t.created_at)) / 60000, 0) / closedWithTime.length
      : null;

    const avg_close_minutes = all.filter(t => t.closed_at).length
      ? all.filter(t => t.closed_at).reduce((acc, t) => acc + (new Date(t.closed_at) - new Date(t.created_at)) / 60000, 0) / all.filter(t => t.closed_at).length
      : null;

    // Categorías más usadas
    const catCount = {};
    all.forEach(t => { catCount[t.category] = (catCount[t.category] || 0) + 1; });
    const topCategories = Object.entries(catCount).sort((a, b) => b[1] - a[1]).slice(0, 3);

    return { total: all.length, open, closed, openedToday, closedToday, openedWeek, closedWeek, avg_rating, avg_response_minutes, avg_close_minutes, topCategories };
  },

  delete(channelId) {
    this._s(this._r().filter(t => t.channel_id !== channelId));
  },
};

// ─────────────────────────────────────────────────────
//   NOTAS
// ─────────────────────────────────────────────────────
const notes = {
  _r() { return readArr(F.notes); },
  _s(d) { save(F.notes, d); },
  add(ticketId, staffId, note) {
    const all   = this._r();
    const entry = { id: uid(), ticket_id: ticketId, staff_id: staffId, note, created_at: now() };
    all.push(entry);
    this._s(all);
    return entry;
  },
  get(ticketId) {
    return this._r().filter(n => n.ticket_id === ticketId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  },
  delete(id) { this._s(this._r().filter(n => n.id !== id)); },
};

// ─────────────────────────────────────────────────────
//   BLACKLIST
// ─────────────────────────────────────────────────────
const blacklist = {
  _r() { return readArr(F.blacklist); },
  _s(d) { save(F.blacklist, d); },
  add(userId, guildId, reason, addedBy) {
    const all = this._r().filter(b => !(b.user_id === userId && b.guild_id === guildId));
    all.push({ id: uid(), user_id: userId, guild_id: guildId, reason, added_by: addedBy, added_at: now() });
    this._s(all);
  },
  remove(userId, guildId) {
    const all = this._r(); const prev = all.length;
    this._s(all.filter(b => !(b.user_id === userId && b.guild_id === guildId)));
    return { changes: prev - this._r().length };
  },
  check(userId, guildId)  { return this._r().find(b => b.user_id === userId && b.guild_id === guildId) || null; },
  getAll(guildId)         { return this._r().filter(b => b.guild_id === guildId).sort((a, b) => new Date(b.added_at) - new Date(a.added_at)); },
};

// ─────────────────────────────────────────────────────
//   SETTINGS
// ─────────────────────────────────────────────────────
const settings = {
  _r() { return readObj(F.settings); },
  _s(d) { save(F.settings, d); },

  _default(guildId) {
    return {
      guild_id:              guildId,
      // Canales
      log_channel:           null,
      transcript_channel:    null,
      dashboard_channel:     null,
      dashboard_message_id:  null,
      weekly_report_channel: null,
      // Roles
      support_role:          null,
      admin_role:            null,
      verify_role:           null,
      // Límites
      max_tickets:           3,
      global_ticket_limit:   0,
      cooldown_minutes:      0,
      min_days:              0,
      // Auto-close
      auto_close_minutes:    0,
      // SLA
      sla_minutes:           0,
      smart_ping_minutes:    0,
      // DM
      dm_on_open:            true,
      dm_on_close:           true,
      // Logs
      log_edits:             true,
      log_deletes:           true,
      // Mantenimiento
      maintenance_mode:      false,
      maintenance_reason:    null,
      // Contadores
      ticket_counter:        0,
      // Panel
      panel_message_id:      null,
      panel_channel_id:      null,
      // Timestamps
      created_at:            now(),
    };
  },

  get(guildId) {
    const all = this._r();
    if (!all[guildId]) { all[guildId] = this._default(guildId); this._s(all); }
    // Asegurar campos nuevos en configs antiguas
    const def = this._default(guildId);
    let changed = false;
    for (const k of Object.keys(def)) {
      if (all[guildId][k] === undefined) { all[guildId][k] = def[k]; changed = true; }
    }
    if (changed) this._s(all);
    return all[guildId];
  },

  update(guildId, data) {
    const all = this._r();
    if (!all[guildId]) all[guildId] = this._default(guildId);
    all[guildId] = { ...all[guildId], ...data };
    this._s(all);
    return all[guildId];
  },

  incrementCounter(guildId) {
    const all = this._r();
    if (!all[guildId]) all[guildId] = this._default(guildId);
    all[guildId].ticket_counter = (all[guildId].ticket_counter || 0) + 1;
    this._s(all);
    return all[guildId].ticket_counter;
  },
};

// ─────────────────────────────────────────────────────
//   STAFF STATS
// ─────────────────────────────────────────────────────
const staffStats = {
  _k(guildId, staffId) { return `${guildId}::${staffId}`; },
  _r() { return readObj(F.staffStats); },
  _s(d) { save(F.staffStats, d); },
  _ensure(all, guildId, staffId) {
    const k = this._k(guildId, staffId);
    if (!all[k]) all[k] = { guild_id: guildId, staff_id: staffId, tickets_closed: 0, tickets_claimed: 0, tickets_assigned: 0, last_updated: now() };
    return k;
  },
  incrementClosed(guildId, staffId)   { const all = this._r(); const k = this._ensure(all, guildId, staffId); all[k].tickets_closed++;   all[k].last_updated = now(); this._s(all); },
  incrementClaimed(guildId, staffId)  { const all = this._r(); const k = this._ensure(all, guildId, staffId); all[k].tickets_claimed++;  all[k].last_updated = now(); this._s(all); },
  incrementAssigned(guildId, staffId) { const all = this._r(); const k = this._ensure(all, guildId, staffId); all[k].tickets_assigned++; all[k].last_updated = now(); this._s(all); },
  getLeaderboard(guildId) {
    return Object.values(this._r()).filter(s => s.guild_id === guildId)
      .sort((a, b) => b.tickets_closed - a.tickets_closed).slice(0, 10);
  },
  get(guildId, staffId) { return this._r()[this._k(guildId, staffId)] || null; },
};

// ─────────────────────────────────────────────────────
//   TAGS
// ─────────────────────────────────────────────────────
const tags = {
  _r() { return readArr(F.tags); },
  _s(d) { save(F.tags, d); },
  create(guildId, name, content, createdBy) {
    const all = this._r();
    if (all.find(t => t.guild_id === guildId && t.name === name)) throw new Error("Ya existe");
    const t = { id: uid(), guild_id: guildId, name, content, created_by: createdBy, uses: 0, created_at: now() };
    all.push(t); this._s(all); return t;
  },
  get(guildId, name)  { return this._r().find(t => t.guild_id === guildId && t.name === name) || null; },
  getAll(guildId)     { return this._r().filter(t => t.guild_id === guildId).sort((a, b) => b.uses - a.uses); },
  use(guildId, name)  { const all = this._r(); const i = all.findIndex(t => t.guild_id === guildId && t.name === name); if (i !== -1) { all[i].uses++; this._s(all); } },
  update(guildId, name, content) { const all = this._r(); const i = all.findIndex(t => t.guild_id === guildId && t.name === name); if (i !== -1) { all[i].content = content; this._s(all); return all[i]; } return null; },
  delete(guildId, name) { this._s(this._r().filter(t => !(t.guild_id === guildId && t.name === name))); },
};

// ─────────────────────────────────────────────────────
//   COOLDOWNS
// ─────────────────────────────────────────────────────
const cooldowns = {
  _r() { return readArr(F.cooldowns); },
  _s(d) { save(F.cooldowns, d); },
  set(userId, guildId) {
    const all = this._r().filter(c => !(c.user_id === userId && c.guild_id === guildId));
    all.push({ user_id: userId, guild_id: guildId, last_ticket_at: now() });
    this._s(all);
  },
  check(userId, guildId, minutes) {
    const entry = this._r().find(c => c.user_id === userId && c.guild_id === guildId);
    if (!entry) return null;
    const diff = (Date.now() - new Date(entry.last_ticket_at).getTime()) / 60000;
    if (diff < minutes) return Math.ceil(minutes - diff);
    return null;
  },
};

// ─────────────────────────────────────────────────────
//   STAFF STATUS (modo ausente)
// ─────────────────────────────────────────────────────
const staffStatus = {
  _k(guildId, staffId) { return `${guildId}::${staffId}`; },
  _r() { return readObj(F.staffStatus); },
  _s(d) { save(F.staffStatus, d); },
  setAway(guildId, staffId, reason) {
    const all = this._r();
    all[this._k(guildId, staffId)] = { guild_id: guildId, staff_id: staffId, is_away: true, away_reason: reason || null, away_since: now() };
    this._s(all);
  },
  setOnline(guildId, staffId) {
    const all = this._r();
    delete all[this._k(guildId, staffId)];
    this._s(all);
  },
  isAway(guildId, staffId)  { const e = this._r()[this._k(guildId, staffId)]; return e ? e.is_away : false; },
  getAway(guildId)          { return Object.values(this._r()).filter(s => s.guild_id === guildId && s.is_away); },
  get(guildId, staffId)     { return this._r()[this._k(guildId, staffId)] || null; },
};

// ─────────────────────────────────────────────────────
//   AUTO-RESPUESTAS
// ─────────────────────────────────────────────────────
const autoResponses = {
  _r() { return readArr(F.autoResponses); },
  _s(d) { save(F.autoResponses, d); },
  create(guildId, trigger, response, createdBy) {
    const all = this._r();
    if (all.find(a => a.guild_id === guildId && a.trigger.toLowerCase() === trigger.toLowerCase())) throw new Error("Ya existe");
    const entry = { id: uid(), guild_id: guildId, trigger, response, created_by: createdBy, uses: 0, enabled: true, created_at: now() };
    all.push(entry); this._s(all); return entry;
  },
  match(guildId, message) {
    const text = message.toLowerCase();
    return this._r().find(a => a.guild_id === guildId && a.enabled && text.includes(a.trigger.toLowerCase())) || null;
  },
  getAll(guildId) { return this._r().filter(a => a.guild_id === guildId); },
  get(guildId, trigger) { return this._r().find(a => a.guild_id === guildId && a.trigger.toLowerCase() === trigger.toLowerCase()) || null; },
  toggle(guildId, trigger) {
    const all = this._r();
    const i = all.findIndex(a => a.guild_id === guildId && a.trigger.toLowerCase() === trigger.toLowerCase());
    if (i === -1) return null;
    all[i].enabled = !all[i].enabled; this._s(all); return all[i];
  },
  use(guildId, trigger) {
    const all = this._r();
    const i = all.findIndex(a => a.guild_id === guildId && a.trigger.toLowerCase() === trigger.toLowerCase());
    if (i !== -1) { all[i].uses++; this._s(all); }
  },
  delete(guildId, trigger) { this._s(this._r().filter(a => !(a.guild_id === guildId && a.trigger.toLowerCase() === trigger.toLowerCase()))); },
};

// ─────────────────────────────────────────────────────
//   TICKET LOGS (edición/eliminación de mensajes)
// ─────────────────────────────────────────────────────
const ticketLogs = {
  _r() { return readArr(F.ticketLogs); },
  _s(d) { save(F.ticketLogs, d); },
  add(guildId, channelId, type, data) {
    const all = this._r();
    all.push({ id: uid(), guild_id: guildId, channel_id: channelId, type, data, created_at: now() });
    // Mantener solo los últimos 500 logs para no crecer indefinidamente
    if (all.length > 500) all.splice(0, all.length - 500);
    this._s(all);
  },
  get(channelId) { return this._r().filter(l => l.channel_id === channelId).slice(-50); },
};

module.exports = { tickets, notes, blacklist, settings, staffStats, tags, cooldowns, staffStatus, autoResponses, ticketLogs };
