const { MongoClient, ObjectId } = require("mongodb");
const chalk = require("chalk");
const fs = require("fs");
const path = require("path");

// ─────────────────────────────────────────────────────
//   CONFIGURACIÓN DE MONGODB
// ─────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://PandoBot:@pandobot.sfbdy6u.mongodb.net/?appName=PandoBot";
const DB_NAME = process.env.MONGO_DB || "pando_bot";

let client = null;
let db = null;

// ─────────────────────────────────────────────────────
//   CONEXIÓN A MONGODB
// ─────────────────────────────────────────────────────
async function connectDB() {
  if (db) return db;
  
  try {
    client = new MongoClient(MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    
    await client.connect();
    db = client.db(DB_NAME);
    
    // Crear índices
    await createIndexes();
    
    console.log(chalk.green("✅ Conectado a MongoDB"));
    return db;
  } catch (error) {
    console.error(chalk.red("❌ Error conectando a MongoDB:"), error.message);
    throw error;
  }
}

async function createIndexes() {
  try {
    // Índices para tickets
    await db.collection("tickets").createIndex({ channel_id: 1 }, { unique: true });
    await db.collection("tickets").createIndex({ guild_id: 1, status: 1 });
    await db.collection("tickets").createIndex({ user_id: 1, guild_id: 1 });
    await db.collection("tickets").createIndex({ ticket_id: 1 }, { unique: true });
    
    // Índices para settings
    await db.collection("settings").createIndex({ guild_id: 1 }, { unique: true });
    
    // Índices para levels
    await db.collection("levels").createIndex({ guild_id: 1, user_id: 1 }, { unique: true });
    await db.collection("levels").createIndex({ guild_id: 1, total_xp: -1 });
    
    // Índices para otros
    await db.collection("notes").createIndex({ ticket_id: 1 });
    await db.collection("blacklist").createIndex({ guild_id: 1, user_id: 1 });
    await db.collection("reminders").createIndex({ fire_at: 1 });
    await db.collection("verifCodes").createIndex({ expires_at: 1 });
    
    console.log(chalk.blue("📇 Índices de MongoDB creados"));
  } catch (error) {
    console.error(chalk.yellow("⚠️ Error creando índices:"), error.message);
  }
}

function getDB() {
  if (!db) throw new Error("Base de datos no conectada. Llama a connectDB() primero.");
  return db;
}

function now() { return new Date().toISOString(); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ─────────────────────────────────────────────────────
//   HELPERS CON VALIDACIÓN Y ERRORES
// ─────────────────────────────────────────────────────
function logError(context, error, extra = {}) {
  const errorLog = {
    context,
    message: error.message || String(error),
    stack: error.stack,
    ...extra,
    timestamp: now()
  };
  
  // Log en consola con chalk
  console.error(chalk.red(`[ERROR] ${context}:`), error.message);
  
  // Guardar en archivo de logs si se desea
  try {
    const logsDir = path.join(__dirname, "../../data/logs");
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    
    const logFile = path.join(logsDir, `errors_${new Date().toISOString().split("T")[0]}.json`);
    const logs = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, "utf8")) : [];
    logs.push(errorLog);
    
    // Mantener solo últimos 1000 errores
    if (logs.length > 1000) logs.splice(0, logs.length - 1000);
    
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
  } catch (e) {
    // Silencioso si falla el logging
  }
  
  return errorLog;
}

// Validación de entrada
function validateInput(value, type, options = {}) {
  const { minLength, maxLength, pattern, allowedChars } = options;
  
  if (value === undefined || value === null) {
    if (options.required) throw new Error(`Campo requerido`);
    return value;
  }
  
  if (typeof value === "string") {
    if (minLength && value.length < minLength) {
      throw new Error(`Mínimo ${minLength} caracteres`);
    }
    if (maxLength && value.length > maxLength) {
      throw new Error(`Máximo ${maxLength} caracteres`);
    }
    if (pattern && !pattern.test(value)) {
      throw new Error(`Formato inválido`);
    }
    if (allowedChars) {
      const invalid = value.split("").filter(c => !allowedChars.includes(c));
      if (invalid.length > 0) {
        throw new Error(`Caracteres no permitidos: ${invalid.join(", ")}`);
      }
    }
  }
  
  return value;
}

// Sanitización de entrada
function sanitizeString(str, maxLen = 1000) {
  if (!str || typeof str !== "string") return "";
  return str.slice(0, maxLen).trim();
}

function sanitizeChannelName(name) {
  if (!name || typeof name !== "string") return "";
  return name.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 32);
}

// ─────────────────────────────────────────────────────
//   TICKETS
// ─────────────────────────────────────────────────────
const tickets = {
  collection() { return getDB().collection("tickets"); },
  
  async create(data) {
    try {
      validateInput(data.channel_id, "string", { required: true, maxLength: 50 });
      validateInput(data.guild_id, "string", { required: true, maxLength: 50 });
      validateInput(data.user_id, "string", { required: true, maxLength: 50 });
      validateInput(data.category, "string", { maxLength: 100 });
      
      const ticket = {
        _id: new ObjectId(),
        ticket_id:            data.ticket_id,
        channel_id:           data.channel_id,
        guild_id:             data.guild_id,
        user_id:              data.user_id,
        category:             data.category || "general",
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
      
      await this.collection().insertOne(ticket);
      return ticket;
    } catch (error) {
      logError("tickets.create", error, { data });
      throw error;
    }
  },

  async get(channelId) {
    try {
      return await this.collection().findOne({ channel_id: channelId }) || null;
    } catch (error) {
      logError("tickets.get", error, { channelId });
      return null;
    }
  },

  async getById(id) {
    try {
      return await this.collection().findOne({ ticket_id: id }) || null;
    } catch (error) {
      logError("tickets.getById", error, { id });
      return null;
    }
  },

  async getByUser(userId, guildId, status = "open") {
    try {
      return await this.collection()
        .find({ user_id: userId, guild_id: guildId, status })
        .toArray();
    } catch (error) {
      logError("tickets.getByUser", error, { userId, guildId, status });
      return [];
    }
  },

  async getAllOpen(guildId) {
    try {
      return await this.collection()
        .find({ guild_id: guildId, status: "open" })
        .sort({ created_at: -1 })
        .toArray();
    } catch (error) {
      logError("tickets.getAllOpen", error, { guildId });
      return [];
    }
  },

  async getAllByGuild(guildId) {
    try {
      return await this.collection()
        .find({ guild_id: guildId })
        .sort({ created_at: -1 })
        .toArray();
    } catch (error) {
      logError("tickets.getAllByGuild", error, { guildId });
      return [];
    }
  },

  async update(channelId, data) {
    try {
      validateInput(channelId, "string", { required: true });
      
      const result = await this.collection().findOneAndUpdate(
        { channel_id: channelId },
        { $set: { ...data, last_activity: now() } },
        { returnDocument: "after" }
      );
      return result;
    } catch (error) {
      logError("tickets.update", error, { channelId, data });
      return null;
    }
  },

  async close(channelId, closedBy, reason) {
    return this.update(channelId, {
      status: "closed",
      closed_at: now(),
      closed_by: closedBy,
      close_reason: sanitizeString(reason, 500),
    });
  },

  async reopen(channelId, reopenedBy) {
    const t = await this.get(channelId);
    if (!t) return null;
    
    return this.update(channelId, {
      status: "open",
      closed_at: null,
      closed_by: null,
      close_reason: null,
      reopened_at: now(),
      reopened_by: reopenedBy,
      reopen_count: (t.reopen_count || 0) + 1,
    });
  },

  async incrementMessages(channelId, isStaff = false) {
    try {
      const update = {
        $inc: { message_count: 1 },
        $set: { last_activity: now() }
      };
      
      if (isStaff) {
        update.$inc.staff_message_count = 1;
        update.$setOnInsert = { first_staff_response: now() };
      }
      
      await this.collection().updateOne(
        { channel_id: channelId },
        update
      );
    } catch (error) {
      logError("tickets.incrementMessages", error, { channelId, isStaff });
    }
  },

  async setRating(channelId, rating, comment = null) {
    return this.update(channelId, { 
      rating, 
      rating_comment: sanitizeString(comment, 500) 
    });
  },

  async getInactive(guildId, minutes) {
    try {
      const cutoff = new Date(Date.now() - minutes * 60000);
      return await this.collection()
        .find({
          guild_id: guildId,
          status: "open",
          last_activity: { $lt: cutoff }
        })
        .toArray();
    } catch (error) {
      logError("tickets.getInactive", error, { guildId, minutes });
      return [];
    }
  },

  async getWithoutStaffResponse(guildId, minutes) {
    try {
      const cutoff = new Date(Date.now() - minutes * 60000);
      return await this.collection()
        .find({
          guild_id: guildId,
          status: "open",
          first_staff_response: null,
          created_at: { $lt: cutoff }
        })
        .toArray();
    } catch (error) {
      logError("tickets.getWithoutStaffResponse", error, { guildId, minutes });
      return [];
    }
  },

  async getStats(guildId) {
    try {
      const all = await this.collection()
        .find({ guild_id: guildId })
        .toArray();
      
      const open = all.filter(t => t.status === "open").length;
      const closed = all.filter(t => t.status === "closed").length;

      const today = new Date(); today.setHours(0,0,0,0);
      const openedToday = all.filter(t => new Date(t.created_at) >= today).length;
      const closedToday = all.filter(t => t.closed_at && new Date(t.closed_at) >= today).length;

      const thisWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const openedWeek = all.filter(t => new Date(t.created_at) >= thisWeek).length;
      const closedWeek = all.filter(t => t.closed_at && new Date(t.closed_at) >= thisWeek).length;

      const ratings = all.filter(t => t.rating !== null).map(t => t.rating);
      const avg_rating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : null;

      // Categorías más usadas
      const catCount = {};
      all.forEach(t => { catCount[t.category] = (catCount[t.category] || 0) + 1; });
      const topCategories = Object.entries(catCount).sort((a, b) => b[1] - a[1]).slice(0, 3);

      return { 
        total: all.length, open, closed, openedToday, closedToday, 
        openedWeek, closedWeek, avg_rating, topCategories 
      };
    } catch (error) {
      logError("tickets.getStats", error, { guildId });
      return { total: 0, open: 0, closed: 0 };
    }
  },

  async delete(channelId) {
    try {
      await this.collection().deleteOne({ channel_id: channelId });
    } catch (error) {
      logError("tickets.delete", error, { channelId });
    }
  },
};

// ─────────────────────────────────────────────────────
//   NOTAS
// ─────────────────────────────────────────────────────
const notes = {
  collection() { return getDB().collection("notes"); },
  
  async add(ticketId, staffId, note) {
    try {
      validateInput(ticketId, "string", { required: true });
      validateInput(note, "string", { required: true, maxLength: 500 });
      
      const entry = {
        _id: new ObjectId(),
        ticket_id: ticketId,
        staff_id: staffId,
        note: sanitizeString(note, 500),
        created_at: now()
      };
      
      await this.collection().insertOne(entry);
      return entry;
    } catch (error) {
      logError("notes.add", error, { ticketId, staffId });
      throw error;
    }
  },

  async get(ticketId) {
    try {
      return await this.collection()
        .find({ ticket_id: ticketId })
        .sort({ created_at: 1 })
        .toArray();
    } catch (error) {
      logError("notes.get", error, { ticketId });
      return [];
    }
  },

  async delete(id) {
    try {
      await this.collection().deleteOne({ _id: new ObjectId(id) });
    } catch (error) {
      logError("notes.delete", error, { id });
    }
  },

  async clear(ticketId) {
    try {
      await this.collection().deleteMany({ ticket_id: ticketId });
    } catch (error) {
      logError("notes.clear", error, { ticketId });
    }
  },
};

// ─────────────────────────────────────────────────────
//   BLACKLIST
// ─────────────────────────────────────────────────────
const blacklist = {
  collection() { return getDB().collection("blacklist"); },
  
  async add(userId, guildId, reason, addedBy) {
    try {
      validateInput(userId, "string", { required: true });
      validateInput(guildId, "string", { required: true });
      
      // Verificar si ya existe
      const existing = await this.collection().findOne({ user_id: userId, guild_id: guildId });
      if (existing) return;
      
      const entry = {
        _id: new ObjectId(),
        user_id: userId,
        guild_id: guildId,
        reason: sanitizeString(reason, 500),
        added_by: addedBy,
        added_at: now()
      };
      
      await this.collection().insertOne(entry);
    } catch (error) {
      logError("blacklist.add", error, { userId, guildId });
      throw error;
    }
  },

  async remove(userId, guildId) {
    try {
      const result = await this.collection().deleteOne({ user_id: userId, guild_id: guildId });
      return { changes: result.deletedCount };
    } catch (error) {
      logError("blacklist.remove", error, { userId, guildId });
      return { changes: 0 };
    }
  },

  async check(userId, guildId) {
    try {
      return await this.collection().findOne({ user_id: userId, guild_id: guildId }) || null;
    } catch (error) {
      logError("blacklist.check", error, { userId, guildId });
      return null;
    }
  },

  async getAll(guildId) {
    try {
      return await this.collection()
        .find({ guild_id: guildId })
        .sort({ added_at: -1 })
        .toArray();
    } catch (error) {
      logError("blacklist.getAll", error, { guildId });
      return [];
    }
  },
};

// ─────────────────────────────────────────────────────
//   SETTINGS
// ─────────────────────────────────────────────────────
const settings = {
  collection() { return getDB().collection("settings"); },
  
  _default(guildId) {
    return {
      guild_id: guildId,
      log_channel: null,
      transcript_channel: null,
      dashboard_channel: null,
      dashboard_message_id: null,
      weekly_report_channel: null,
      support_role: null,
      admin_role: null,
      verify_role: null,
      max_tickets: 3,
      global_ticket_limit: 0,
      cooldown_minutes: 0,
      min_days: 0,
      // === AUTOMATION SETTINGS ===
      auto_close_hours: 0,          // Auto-cierre en horas (0 = desactivado)
      sla_hours: 0,                 // Alerta SLA en horas (0 = desactivado)
      smart_ping_hours: 0,          // Smart Ping en horas (0 = desactivado)
      // Legacy support (in minutes)
      auto_close_minutes: 0,
      sla_minutes: 0,
      smart_ping_minutes: 0,
      // === DM SETTINGS ===
      dm_on_open: true,             // DM al abrir ticket
      dm_on_close: true,            // DM al cerrar ticket
      dm_transcripts: true,         // Adjuntar transcript HTML al DM
      dm_alerts: true,              // Enviar alertas de cierre al usuario
      // === LOGS ===
      log_edits: true,
      log_deletes: true,
      maintenance_mode: false,
      maintenance_reason: null,
      ticket_counter: 0,
      panel_message_id: null,
      panel_channel_id: null,
      created_at: now(),
    };
  },

  async get(guildId) {
    try {
      let s = await this.collection().findOne({ guild_id: guildId });
      
      if (!s) {
        s = this._default(guildId);
        await this.collection().insertOne(s);
      }
      
      // Asegurar campos nuevos
      const def = this._default(guildId);
      let changed = false;
      for (const k of Object.keys(def)) {
        if (s[k] === undefined) {
          s[k] = def[k];
          changed = true;
        }
      }
      
      if (changed) {
        await this.collection().updateOne(
          { guild_id: guildId },
          { $set: s }
        );
      }
      
      return s;
    } catch (error) {
      logError("settings.get", error, { guildId });
      return this._default(guildId);
    }
  },

  async update(guildId, data) {
    try {
      validateInput(guildId, "string", { required: true });
      
      const existing = await this.collection().findOne({ guild_id: guildId });
      if (!existing) {
        const newSettings = { ...this._default(guildId), ...data };
        await this.collection().insertOne(newSettings);
        return newSettings;
      }
      
      await this.collection().updateOne(
        { guild_id: guildId },
        { $set: data }
      );
      
      return this.get(guildId);
    } catch (error) {
      logError("settings.update", error, { guildId, data });
      return null;
    }
  },

  async incrementCounter(guildId) {
    try {
      const result = await this.collection().findOneAndUpdate(
        { guild_id: guildId },
        { $inc: { ticket_counter: 1 } },
        { returnDocument: "after" }
      );
      return result?.ticket_counter || 1;
    } catch (error) {
      logError("settings.incrementCounter", error, { guildId });
      return 1;
    }
  },
};

// ─────────────────────────────────────────────────────
//   STAFF STATS
// ─────────────────────────────────────────────────────
const staffStats = {
  collection() { return getDB().collection("staffStats"); },
  
  _key(guildId, staffId) { return `${guildId}::${staffId}`; },
  
  async _ensure(guildId, staffId) {
    const key = this._key(guildId, staffId);
    const existing = await this.collection().findOne({ key });
    
    if (!existing) {
      await this.collection().insertOne({
        key,
        guild_id: guildId,
        staff_id: staffId,
        tickets_closed: 0,
        tickets_claimed: 0,
        tickets_assigned: 0,
        last_updated: now()
      });
    }
  },

  async incrementClosed(guildId, staffId) {
    try {
      await this._ensure(guildId, staffId);
      await this.collection().updateOne(
        { key: this._key(guildId, staffId) },
        { $inc: { tickets_closed: 1 }, $set: { last_updated: now() } }
      );
    } catch (error) {
      logError("staffStats.incrementClosed", error, { guildId, staffId });
    }
  },

  async incrementClaimed(guildId, staffId) {
    try {
      await this._ensure(guildId, staffId);
      await this.collection().updateOne(
        { key: this._key(guildId, staffId) },
        { $inc: { tickets_claimed: 1 }, $set: { last_updated: now() } }
      );
    } catch (error) {
      logError("staffStats.incrementClaimed", error, { guildId, staffId });
    }
  },

  async incrementAssigned(guildId, staffId) {
    try {
      await this._ensure(guildId, staffId);
      await this.collection().updateOne(
        { key: this._key(guildId, staffId) },
        { $inc: { tickets_assigned: 1 }, $set: { last_updated: now() } }
      );
    } catch (error) {
      logError("staffStats.incrementAssigned", error, { guildId, staffId });
    }
  },

  async getLeaderboard(guildId, limit = 10) {
    try {
      return await this.collection()
        .find({ guild_id: guildId })
        .sort({ tickets_closed: -1 })
        .limit(limit)
        .toArray();
    } catch (error) {
      logError("staffStats.getLeaderboard", error, { guildId });
      return [];
    }
  },

  async get(guildId, staffId) {
    try {
      return await this.collection().findOne({ key: this._key(guildId, staffId) }) || null;
    } catch (error) {
      logError("staffStats.get", error, { guildId, staffId });
      return null;
    }
  },
};

// ─────────────────────────────────────────────────────
//   STAFF RATINGS
// ─────────────────────────────────────────────────────
const staffRatings = {
  collection() { return getDB().collection("staffRatings"); },
  
  async add(guildId, staffId, rating, ticketId, userId, comment = null) {
    try {
      validateInput(rating, "number", { required: true, minLength: 1, maxLength: 5 });
      
      const entry = {
        _id: new ObjectId(),
        guild_id: guildId,
        staff_id: staffId,
        rating,
        ticket_id: ticketId,
        user_id: userId,
        comment: sanitizeString(comment, 500),
        created_at: now()
      };
      
      await this.collection().insertOne(entry);
      return entry;
    } catch (error) {
      logError("staffRatings.add", error, { guildId, staffId, rating });
      throw error;
    }
  },

  async getStaffStats(guildId, staffId) {
    try {
      const all = await this.collection()
        .find({ guild_id: guildId, staff_id: staffId })
        .toArray();
      
      const total = all.length;
      if (!total) return { total: 0, avg: null, dist: { 1:0,2:0,3:0,4:0,5:0 }, recent: [] };
      
      const avg = all.reduce((s, r) => s + r.rating, 0) / total;
      const dist = { 1:0, 2:0, 3:0, 4:0, 5:0 };
      all.forEach(r => dist[r.rating]++);
      const recent = all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
      
      return { total, avg: Math.round(avg * 100) / 100, dist, recent };
    } catch (error) {
      logError("staffRatings.getStaffStats", error, { guildId, staffId });
      return { total: 0, avg: null };
    }
  },

  async getLeaderboard(guildId, minRatings = 1) {
    try {
      const all = await this.collection()
        .find({ guild_id: guildId })
        .toArray();
      
      const byStaff = {};
      for (const r of all) {
        if (!byStaff[r.staff_id]) byStaff[r.staff_id] = [];
        byStaff[r.staff_id].push(r.rating);
      }
      
      return Object.entries(byStaff)
        .filter(([, ratings]) => ratings.length >= minRatings)
        .map(([staffId, ratings]) => ({
          staff_id: staffId,
          total: ratings.length,
          avg: Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 100) / 100,
        }))
        .sort((a, b) => b.avg - a.avg || b.total - a.total)
        .slice(0, 15);
    } catch (error) {
      logError("staffRatings.getLeaderboard", error, { guildId });
      return [];
    }
  },

  async getHistory(guildId, staffId, limit = 10) {
    try {
      return await this.collection()
        .find({ guild_id: guildId, staff_id: staffId })
        .sort({ created_at: -1 })
        .limit(limit)
        .toArray();
    } catch (error) {
      logError("staffRatings.getHistory", error, { guildId, staffId });
      return [];
    }
  },
};

// ─────────────────────────────────────────────────────
//   LEVELS
// ─────────────────────────────────────────────────────
const levels = {
  collection() { return getDB().collection("levels"); },
  
  _key(guildId, userId) { return `${guildId}::${userId}`; },
  
  xpForLevel(level) { return Math.floor(100 * Math.pow(level, 1.5) + 100); },
  
  levelFromXp(totalXp) {
    let level = 0;
    let xpNeeded = 0;
    while (totalXp >= xpNeeded + this.xpForLevel(level + 1)) {
      xpNeeded += this.xpForLevel(level + 1);
      level++;
    }
    return level;
  },

  async addXp(guildId, userId, amount) {
    try {
      const key = this._key(guildId, userId);
      let entry = await this.collection().findOne({ key });
      
      if (!entry) {
        entry = {
          key,
          guild_id: guildId,
          user_id: userId,
          xp: 0,
          level: 0,
          total_xp: 0,
          last_xp_at: null,
          messages: 0
        };
      }
      
      entry.total_xp += amount;
      entry.messages++;
      entry.last_xp_at = now();
      
      const newLevel = this.levelFromXp(entry.total_xp);
      const leveled = newLevel > entry.level;
      entry.level = newLevel;
      
      await this.collection().replaceOne({ key }, entry, { upsert: true });
      
      return { leveled, level: newLevel, total_xp: entry.total_xp };
    } catch (error) {
      logError("levels.addXp", error, { guildId, userId, amount });
      return { leveled: false, level: 0, total_xp: 0 };
    }
  },

  async get(guildId, userId) {
    try {
      const key = this._key(guildId, userId);
      return await this.collection().findOne({ key }) || {
        guild_id: guildId,
        user_id: userId,
        xp: 0,
        level: 0,
        total_xp: 0,
        messages: 0
      };
    } catch (error) {
      logError("levels.get", error, { guildId, userId });
      return { level: 0, total_xp: 0 };
    }
  },

  async getLeaderboard(guildId, limit = 15) {
    try {
      return await this.collection()
        .find({ guild_id: guildId })
        .sort({ total_xp: -1 })
        .limit(limit)
        .toArray();
    } catch (error) {
      logError("levels.getLeaderboard", error, { guildId });
      return [];
    }
  },

  async getRank(guildId, userId) {
    try {
      const leaderboard = await this.getLeaderboard(guildId, 9999);
      const idx = leaderboard.findIndex(e => e.user_id === userId);
      return idx === -1 ? null : idx + 1;
    } catch (error) {
      logError("levels.getRank", error, { guildId, userId });
      return null;
    }
  },

  async setXp(guildId, userId, amount) {
    try {
      const key = this._key(guildId, userId);
      await this.collection().updateOne(
        { key },
        { 
          $set: { 
            total_xp: amount,
            level: this.levelFromXp(amount)
          }
        },
        { upsert: true }
      );
    } catch (error) {
      logError("levels.setXp", error, { guildId, userId, amount });
    }
  },

  async reset(guildId, userId) {
    try {
      const key = this._key(guildId, userId);
      await this.collection().deleteOne({ key });
    } catch (error) {
      logError("levels.reset", error, { guildId, userId });
    }
  },
};

// ─────────────────────────────────────────────────────
//   LEVEL SETTINGS
// ─────────────────────────────────────────────────────
const levelSettings = {
  collection() { return getDB().collection("levelSettings"); },
  
  _default(guildId) {
    return {
      guild_id: guildId,
      enabled: false,
      channel: null,
      xp_per_message: 15,
      xp_cooldown: 60,
      xp_min: 10,
      xp_max: 25,
      levelup_message: "🎉 ¡Felicidades {mention}! Subiste al **nivel {level}**! 🏆",
      ignored_channels: [],
      ignored_roles: [],
      role_rewards: [],
      double_xp_roles: [],
      stack_roles: true,
    };
  },

  async get(guildId) {
    try {
      let s = await this.collection().findOne({ guild_id: guildId });
      
      if (!s) {
        s = this._default(guildId);
        await this.collection().insertOne(s);
      }
      
      return s;
    } catch (error) {
      logError("levelSettings.get", error, { guildId });
      return this._default(guildId);
    }
  },

  async update(guildId, data) {
    try {
      await this.collection().updateOne(
        { guild_id: guildId },
        { $set: data },
        { upsert: true }
      );
      return this.get(guildId);
    } catch (error) {
      logError("levelSettings.update", error, { guildId, data });
      return null;
    }
  },
};

// ─────────────────────────────────────────────────────
//   REMINDERS
// ─────────────────────────────────────────────────────
const reminders = {
  collection() { return getDB().collection("reminders"); },
  
  async create(userId, guildId, channelId, text, fireAt) {
    try {
      validateInput(text, "string", { required: true, maxLength: 1000 });
      
      const entry = {
        _id: new ObjectId(),
        user_id: userId,
        guild_id: guildId,
        channel_id: channelId,
        text: sanitizeString(text, 1000),
        fire_at: fireAt,
        created_at: now(),
        fired: false
      };
      
      await this.collection().insertOne(entry);
      return entry._id.toString();
    } catch (error) {
      logError("reminders.create", error, { userId, guildId });
      throw error;
    }
  },

  async getPending() {
    try {
      const now_ = new Date();
      return await this.collection()
        .find({ fired: false, fire_at: { $lte: now_ } })
        .toArray();
    } catch (error) {
      logError("reminders.getPending", error);
      return [];
    }
  },

  async markFired(id) {
    try {
      await this.collection().updateOne(
        { _id: new ObjectId(id) },
        { $set: { fired: true } }
      );
    } catch (error) {
      logError("reminders.markFired", error, { id });
    }
  },

  async getByUser(userId, guildId) {
    try {
      return await this.collection()
        .find({ user_id: userId, guild_id: guildId, fired: false })
        .sort({ fire_at: 1 })
        .toArray();
    } catch (error) {
      logError("reminders.getByUser", error, { userId, guildId });
      return [];
    }
  },

  async delete(id, userId) {
    try {
      const result = await this.collection().deleteOne({ _id: new ObjectId(id), user_id: userId });
      return result.deletedCount > 0;
    } catch (error) {
      logError("reminders.delete", error, { id, userId });
      return false;
    }
  },

  async cleanup() {
    try {
      const cutoff = new Date(Date.now() - 7 * 24 * 3600000);
      await this.collection().deleteMany({
        $or: [
          { fired: true },
          { fire_at: { $lt: cutoff } }
        ]
      });
    } catch (error) {
      logError("reminders.cleanup", error);
    }
  },
};

// ─────────────────────────────────────────────────────
//   AUTO RESPONSES
// ─────────────────────────────────────────────────────
const autoResponses = {
  collection() { return getDB().collection("autoResponses"); },
  
  async create(guildId, trigger, response, createdBy) {
    try {
      validateInput(trigger, "string", { required: true, maxLength: 100 });
      validateInput(response, "string", { required: true, maxLength: 2000 });
      
      // Verificar si ya existe
      const existing = await this.collection().findOne({ guild_id: guildId, trigger });
      if (existing) {
        // Actualizar existente
        await this.collection().updateOne(
          { _id: existing._id },
          { $set: { response, updated_by: createdBy, updated_at: now() } }
        );
        return existing;
      }
      
      const entry = {
        _id: new ObjectId(),
        guild_id: guildId,
        trigger: trigger.toLowerCase(),
        response: sanitizeString(response, 2000),
        created_by: createdBy,
        created_at: now(),
        uses: 0,
        enabled: true
      };
      
      await this.collection().insertOne(entry);
      return entry;
    } catch (error) {
      logError("autoResponses.create", error, { guildId, trigger });
      throw error;
    }
  },

  async get(guildId, trigger) {
    try {
      return await this.collection().findOne({ 
        guild_id: guildId, 
        trigger: trigger.toLowerCase(),
        enabled: true 
      }) || null;
    } catch (error) {
      return null;
    }
  },

  async match(guildId, message) {
    try {
      if (!message) return null;
      
      const all = await this.collection()
        .find({ guild_id: guildId, enabled: true })
        .toArray();
      
      const msgLower = message.toLowerCase();
      
      // Buscar coincidencia exacta o parcial
      for (const ar of all) {
        if (msgLower.includes(ar.trigger)) {
          return ar;
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  },

  async use(guildId, trigger) {
    try {
      await this.collection().updateOne(
        { guild_id: guildId, trigger: trigger.toLowerCase() },
        { $inc: { uses: 1 } }
      );
    } catch (error) {}
  },

  async toggle(guildId, trigger) {
    try {
      const ar = await this.collection().findOne({ guild_id: guildId, trigger: trigger.toLowerCase() });
      if (!ar) return null;
      
      const newEnabled = !ar.enabled;
      await this.collection().updateOne(
        { _id: ar._id },
        { $set: { enabled: newEnabled } }
      );
      
      return { ...ar, enabled: newEnabled };
    } catch (error) {
      return null;
    }
  },

  async delete(guildId, trigger) {
    try {
      const result = await this.collection().deleteOne({ 
        guild_id: guildId, 
        trigger: trigger.toLowerCase() 
      });
      return result.deletedCount > 0;
    } catch (error) {
      return false;
    }
  },

  async getAll(guildId) {
    try {
      return await this.collection()
        .find({ guild_id: guildId })
        .sort({ uses: -1 })
        .toArray();
    } catch (error) {
      return [];
    }
  },

  async getEnabled(guildId) {
    try {
      return await this.collection()
        .find({ guild_id: guildId, enabled: true })
        .toArray();
    } catch (error) {
      return [];
    }
  },
};

// ─────────────────────────────────────────────────────
//   POLLS
// ─────────────────────────────────────────────────────
const polls = {
  collection() { return getDB().collection("polls"); },
  
  async create(guildId, channelId, messageId, creatorId, question, options, endsAt, allowMultiple) {
    try {
      validateInput(question, "string", { required: true, maxLength: 500 });
      
      const poll = {
        _id: new ObjectId(),
        guild_id: guildId,
        channel_id: channelId,
        message_id: messageId,
        creator_id: creatorId,
        question: sanitizeString(question, 500),
        options: options.map((o, i) => ({ id: i, text: sanitizeString(o, 200), votes: [] })),
        allow_multiple: allowMultiple,
        ended: false,
        ends_at: endsAt,
        created_at: now()
      };
      
      await this.collection().insertOne(poll);
      return poll;
    } catch (error) {
      logError("polls.create", error, { guildId, question });
      throw error;
    }
  },

  async vote(id, userId, optionIds) {
    try {
      const poll = await this.collection().findOne({ _id: new ObjectId(id) });
      if (!poll || poll.ended) return null;
      
      // Quitar votos anteriores
      poll.options.forEach(o => {
        o.votes = o.votes.filter(v => v !== userId);
      });
      
      // Añadir nuevos votos
      const maxVotes = poll.allow_multiple ? optionIds.length : 1;
      for (const oid of optionIds.slice(0, maxVotes)) {
        const opt = poll.options.find(o => o.id === oid);
        if (opt && !opt.votes.includes(userId)) {
          opt.votes.push(userId);
        }
      }
      
      await this.collection().replaceOne({ _id: poll._id }, poll);
      return poll;
    } catch (error) {
      logError("polls.vote", error, { id, userId });
      return null;
    }
  },

  async end(id) {
    try {
      await this.collection().updateOne(
        { _id: new ObjectId(id) },
        { $set: { ended: true, ended_at: now() } }
      );
      return true;
    } catch (error) {
      logError("polls.end", error, { id });
      return false;
    }
  },

  async getActive() {
    try {
      const now_ = new Date();
      return await this.collection()
        .find({ ended: false, ends_at: { $lte: now_ } })
        .toArray();
    } catch (error) {
      logError("polls.getActive", error);
      return [];
    }
  },

  async getByMessage(messageId) {
    try {
      return await this.collection().findOne({ message_id: messageId }) || null;
    } catch (error) {
      logError("polls.getByMessage", error, { messageId });
      return null;
    }
  },

  async getByGuild(guildId, includeEnded = false) {
    try {
      const query = { guild_id: guildId };
      if (!includeEnded) query.ended = false;
      
      return await this.collection()
        .find(query)
        .sort({ created_at: -1 })
        .toArray();
    } catch (error) {
      logError("polls.getByGuild", error, { guildId });
      return [];
    }
  },
};

// ─────────────────────────────────────────────────────
//   OTRAS COLECCIONES (simplificadas para compatibilidad)
// ─────────────────────────────────────────────────────

const tags = {
  collection() { return getDB().collection("tags"); },
  
  async create(guildId, name, content, createdBy) {
    try {
      const existing = await this.collection().findOne({ guild_id: guildId, name });
      if (existing) throw new Error("Ya existe");
      
      const tag = {
        _id: ObjectId(),
        guild_id: guildId,
        name: sanitizeString(name, 50),
        content: sanitizeString(content, 2000),
        created_by: createdBy,
        uses: 0,
        created_at: now()
      };
      
      await this.collection().insertOne(tag);
      return tag;
    } catch (error) {
      logError("tags.create", error, { guildId, name });
      throw error;
    }
  },

  async get(guildId, name) {
    try {
      return await this.collection().findOne({ guild_id: guildId, name }) || null;
    } catch (error) {
      return null;
    }
  },

  async getAll(guildId) {
    try {
      return await this.collection()
        .find({ guild_id: guildId })
        .sort({ uses: -1 })
        .toArray();
    } catch (error) {
      return [];
    }
  },

  async use(guildId, name) {
    try {
      await this.collection().updateOne(
        { guild_id: guildId, name },
        { $inc: { uses: 1 } }
      );
    } catch (error) {}
  },

  async update(guildId, name, content) {
    try {
      const result = await this.collection().findOneAndUpdate(
        { guild_id: guildId, name },
        { $set: { content: sanitizeString(content, 2000) } },
        { returnDocument: "after" }
      );
      return result;
    } catch (error) {
      return null;
    }
  },

  async delete(guildId, name) {
    try {
      await this.collection().deleteOne({ guild_id: guildId, name });
    } catch (error) {}
  },
};

const cooldowns = {
  collection() { return getDB().collection("cooldowns"); },
  
  async set(userId, guildId) {
    try {
      await this.collection().deleteMany({ user_id: userId, guild_id: guildId });
      await this.collection().insertOne({
        user_id: userId,
        guild_id: guildId,
        last_ticket_at: now()
      });
    } catch (error) {}
  },

  async check(userId, guildId, minutes) {
    try {
      const entry = await this.collection().findOne({ user_id: userId, guild_id: guildId });
      if (!entry) return null;
      
      const diff = (Date.now() - new Date(entry.last_ticket_at).getTime()) / 60000;
      if (diff < minutes) return Math.ceil(minutes - diff);
      return null;
    } catch (error) {
      return null;
    }
  },
};

const staffStatus = {
  collection() { return getDB().collection("staffStatus"); },
  
  _key(guildId, staffId) { return `${guildId}::${staffId}`; },
  
  async setAway(guildId, staffId, reason) {
    try {
      await this.collection().updateOne(
        { _id: this._key(guildId, staffId) },
        { 
          $set: { 
            guild_id: guildId, 
            staff_id: staffId, 
            is_away: true, 
            away_reason: sanitizeString(reason, 200), 
            away_since: now() 
          }
        },
        { upsert: true }
      );
    } catch (error) {}
  },

  async setOnline(guildId, staffId) {
    try {
      await this.collection().deleteOne({ _id: this._key(guildId, staffId) });
    } catch (error) {}
  },

  async isAway(guildId, staffId) {
    try {
      const e = await this.collection().findOne({ _id: this._key(guildId, staffId) });
      return e ? e.is_away : false;
    } catch (error) {
      return false;
    }
  },

  async getAway(guildId) {
    try {
      return await this.collection()
        .find({ guild_id: guildId, is_away: true })
        .toArray();
    } catch (error) {
      return [];
    }
  },
};

const verifSettings = {
  collection() { return getDB().collection("verifSettings"); },
  
  _default(guildId) {
    return {
      guild_id: guildId,
      enabled: false,
      mode: "button",
      channel: null,
      verified_role: null,
      unverified_role: null,
      log_channel: null,
      panel_message_id: null,
      panel_title: "✅ Verificación",
      panel_description: "Para acceder al servidor, debes verificarte.",
      panel_color: "57F287",
      panel_image: null,
      question: "¿Leíste las reglas del servidor?",
      question_answer: "si",
      antiraid_enabled: false,
      antiraid_joins: 10,
      antiraid_seconds: 10,
      antiraid_action: "pause",
      dm_on_verify: true,
      kick_unverified_hours: 0,
    };
  },

  async get(guildId) {
    try {
      let s = await this.collection().findOne({ guild_id: guildId });
      if (!s) {
        s = this._default(guildId);
        await this.collection().insertOne(s);
      }
      return s;
    } catch (error) {
      return this._default(guildId);
    }
  },

  async update(guildId, data) {
    try {
      await this.collection().updateOne(
        { guild_id: guildId },
        { $set: data },
        { upsert: true }
      );
      return this.get(guildId);
    } catch (error) {
      return null;
    }
  },
};

const verifCodes = {
  collection() { return getDB().collection("verifCodes"); },
  
  async generate(userId, guildId) {
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const expires_at = new Date(Date.now() + 10 * 60000);
      
      await this.collection().deleteMany({ user_id: userId, guild_id: guildId });
      await this.collection().insertOne({
        user_id: userId,
        guild_id: guildId,
        code,
        created_at: now(),
        expires_at: expires_at.toISOString()
      });
      
      return code;
    } catch (error) {
      logError("verifCodes.generate", error, { userId, guildId });
      throw error;
    }
  },

  async verify(userId, guildId, inputCode) {
    try {
      const entry = await this.collection().findOne({ user_id: userId, guild_id: guildId });
      if (!entry) return { valid: false, reason: "no_code" };
      
      if (new Date(entry.expires_at) < new Date()) {
        await this.collection().deleteOne({ _id: entry._id });
        return { valid: false, reason: "expired" };
      }
      
      if (entry.code !== inputCode.toUpperCase().trim()) {
        return { valid: false, reason: "wrong" };
      }
      
      await this.collection().deleteOne({ _id: entry._id });
      return { valid: true };
    } catch (error) {
      logError("verifCodes.verify", error, { userId, guildId });
      return { valid: false, reason: "error" };
    }
  },

  async getActive(userId, guildId) {
    try {
      const entry = await this.collection().findOne({ 
        user_id: userId, 
        guild_id: guildId,
        expires_at: { $gt: new Date() }
      });
      return entry ? entry.code : null;
    } catch (error) {
      return null;
    }
  },

  async cleanup() {
    try {
      await this.collection().deleteMany({
        expires_at: { $lt: new Date() }
      });
    } catch (error) {}
  },
};

const welcomeSettings = {
  collection() { return getDB().collection("welcomeSettings"); },
  
  _default(guildId) {
    return {
      guild_id: guildId,
      welcome_enabled: false,
      welcome_channel: null,
      welcome_message: "¡Bienvenido/a **{mention}** al servidor **{server}**! 🎉",
      welcome_color: "5865F2",
      welcome_title: "👋 ¡Bienvenido/a!",
      welcome_banner: null,
      welcome_thumbnail: true,
      welcome_footer: "¡Espero que disfrutes tu estadía!",
      welcome_dm: false,
      welcome_dm_message: "¡Hola **{user}**! Bienvenido/a a **{server}**.",
      welcome_autorole: null,
      goodbye_enabled: false,
      goodbye_channel: null,
      goodbye_message: "**{user}** ha abandonado el servidor.",
      goodbye_color: "ED4245",
      goodbye_title: "👋 Hasta luego",
      goodbye_thumbnail: true,
      goodbye_footer: "Espero verte de nuevo pronto.",
    };
  },

  async get(guildId) {
    try {
      let s = await this.collection().findOne({ guild_id: guildId });
      if (!s) {
        s = this._default(guildId);
        await this.collection().insertOne(s);
      }
      return s;
    } catch (error) {
      return this._default(guildId);
    }
  },

  async update(guildId, data) {
    try {
      await this.collection().updateOne(
        { guild_id: guildId },
        { $set: data },
        { upsert: true }
      );
      return this.get(guildId);
    } catch (error) {
      return null;
    }
  },
};

const modlogSettings = {
  collection() { return getDB().collection("modlogSettings"); },
  
  _default(guildId) {
    return {
      guild_id: guildId,
      enabled: false,
      channel: null,
      log_bans: true,
      log_unbans: true,
      log_kicks: true,
      log_msg_delete: true,
      log_msg_edit: true,
      log_role_add: true,
      log_role_remove: true,
      log_nickname: true,
      log_joins: false,
      log_leaves: false,
      log_voice: false,
    };
  },

  async get(guildId) {
    try {
      let s = await this.collection().findOne({ guild_id: guildId });
      if (!s) {
        s = this._default(guildId);
        await this.collection().insertOne(s);
      }
      return s;
    } catch (error) {
      return this._default(guildId);
    }
  },

  async update(guildId, data) {
    try {
      await this.collection().updateOne(
        { guild_id: guildId },
        { $set: data },
        { upsert: true }
      );
      return this.get(guildId);
    } catch (error) {
      return null;
    }
  },
};

const suggestSettings = {
  collection() { return getDB().collection("suggestSettings"); },
  
  _default(guildId) {
    return {
      guild_id: guildId,
      enabled: false,
      channel: null,
      log_channel: null,
      approved_channel: null,
      rejected_channel: null,
      dm_on_result: true,
      require_reason: false,
      cooldown_minutes: 5,
      anonymous: false,
    };
  },

  async get(guildId) {
    try {
      let s = await this.collection().findOne({ guild_id: guildId });
      if (!s) {
        s = this._default(guildId);
        await this.collection().insertOne(s);
      }
      return s;
    } catch (error) {
      return this._default(guildId);
    }
  },

  async update(guildId, data) {
    try {
      await this.collection().updateOne(
        { guild_id: guildId },
        { $set: data },
        { upsert: true }
      );
      return this.get(guildId);
    } catch (error) {
      return null;
    }
  },
};

const suggestions = {
  collection() { return getDB().collection("suggestions"); },
  
  async create(guildId, userId, text, messageId, channelId) {
    try {
      const count = await this.collection().countDocuments({ guild_id: guildId });
      
      const suggestion = {
        _id: ObjectId(),
        num: count + 1,
        guild_id: guildId,
        user_id: userId,
        text: sanitizeString(text, 1000),
        message_id: messageId,
        channel_id: channelId,
        status: "pending",
        upvotes: [],
        downvotes: [],
        staff_comment: null,
        reviewed_by: null,
        created_at: now()
      };
      
      await this.collection().insertOne(suggestion);
      return suggestion;
    } catch (error) {
      logError("suggestions.create", error, { guildId, userId });
      throw error;
    }
  },

  async getByMessage(messageId) {
    try {
      return await this.collection().findOne({ message_id: messageId }) || null;
    } catch (error) {
      return null;
    }
  },

  async vote(id, userId, type) {
    try {
      const suggestion = await this.collection().findOne({ _id: new ObjectId(id) });
      if (!suggestion) return null;
      
      const opposite = type === "up" ? "downvotes" : "upvotes";
      const current = type === "up" ? "upvotes" : "downvotes";
      
      suggestion[opposite] = suggestion[opposite].filter(v => v !== userId);
      
      if (suggestion[current].includes(userId)) {
        suggestion[current] = suggestion[current].filter(v => v !== userId);
      } else {
        suggestion[current].push(userId);
      }
      
      await this.collection().replaceOne({ _id: suggestion._id }, suggestion);
      return suggestion;
    } catch (error) {
      logError("suggestions.vote", error, { id, userId, type });
      return null;
    }
  },

  async setStatus(id, status, reviewedBy, comment = null) {
    try {
      await this.collection().updateOne(
        { _id: new ObjectId(id) },
        { 
          $set: { 
            status,
            reviewed_by: reviewedBy,
            staff_comment: sanitizeString(comment, 500),
            reviewed_at: now()
          }
        }
      );
      return true;
    } catch (error) {
      return false;
    }
  },

  async getStats(guildId) {
    try {
      const all = await this.collection()
        .find({ guild_id: guildId })
        .toArray();
      
      return {
        total: all.length,
        pending: all.filter(s => s.status === "pending").length,
        approved: all.filter(s => s.status === "approved").length,
        rejected: all.filter(s => s.status === "rejected").length
      };
    } catch (error) {
      return { total: 0, pending: 0, approved: 0, rejected: 0 };
    }
  },
};

// Exportar todo
module.exports = {
  connectDB,
  getDB,
  logError,
  validateInput,
  sanitizeString,
  sanitizeChannelName,
  tickets,
  notes,
  blacklist,
  settings,
  staffStats,
  staffRatings,
  tags,
  cooldowns,
  staffStatus,
  verifSettings,
  verifCodes,
  welcomeSettings,
  modlogSettings,
  levelSettings,
  levels,
  reminders,
  suggestSettings,
  suggestions,
  polls,
  autoResponses,
};
