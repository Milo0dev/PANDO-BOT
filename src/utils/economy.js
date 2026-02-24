const { getDB } = require("./database");
const { ObjectId } = require("mongodb");

// ══════════════════════════════════════════════════════════════
//   ECONOMÍA - Sistema de Monedas y Tienda
// ══════════════════════════════════════════════════════════════

const economy = {
  collection() { return getDB().collection("economy"); },
  
  _default(guildId, userId) {
    return {
      guild_id: guildId,
      user_id: userId,
      wallet: 0,
      bank: 0,
      total_earned: 0,
      total_spent: 0,
      daily_streak: 0,
      last_daily: null,
      job: null,
      work_cooldown: null,
      inventory: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  },

  async get(guildId, userId) {
    try {
      const key = `${guildId}::${userId}`;
      let eco = await this.collection().findOne({ key });
      
      if (!eco) {
        eco = { key, ...this._default(guildId, userId) };
        await this.collection().insertOne(eco);
      }
      
      return eco;
    } catch (error) {
      console.error("[ECONOMY GET]", error);
      return this._default(guildId, userId);
    }
  },

  async update(guildId, userId, data) {
    try {
      const key = `${guildId}::${userId}`;
      await this.collection().updateOne(
        { key },
        { 
          $set: { 
            ...data, 
            updated_at: new Date().toISOString() 
          } 
        },
        { upsert: true }
      );
      return this.get(guildId, userId);
    } catch (error) {
      console.error("[ECONOMY UPDATE]", error);
      return null;
    }
  },

  async addMoney(guildId, userId, amount, reason = "misc") {
    try {
      const eco = await this.get(guildId, userId);
      const newWallet = eco.wallet + amount;
      const newTotal = eco.total_earned + amount;
      
      return this.update(guildId, userId, { 
        wallet: newWallet, 
        total_earned: newTotal 
      });
    } catch (error) {
      console.error("[ECONOMY ADD MONEY]", error);
      return null;
    }
  },

  async removeMoney(guildId, userId, amount) {
    try {
      const eco = await this.get(guildId, userId);
      const newWallet = Math.max(0, eco.wallet - amount);
      const newSpent = eco.total_spent + amount;
      
      return this.update(guildId, userId, { 
        wallet: newWallet, 
        total_spent: newSpent 
      });
    } catch (error) {
      console.error("[ECONOMY REMOVE MONEY]", error);
      return null;
    }
  },

  async deposit(guildId, userId, amount) {
    try {
      const eco = await this.get(guildId, userId);
      
      if (amount > eco.wallet) {
        return { success: false, message: "No tienes suficientes monedas en tu wallet." };
      }
      
      const newWallet = eco.wallet - amount;
      const newBank = eco.bank + amount;
      
      await this.update(guildId, userId, { wallet: newWallet, bank: newBank });
      
      return { success: true, amount, newWallet, newBank };
    } catch (error) {
      console.error("[ECONOMY DEPOSIT]", error);
      return { success: false, message: "Error al depositar." };
    }
  },

  async withdraw(guildId, userId, amount) {
    try {
      const eco = await this.get(guildId, userId);
      
      if (amount > eco.bank) {
        return { success: false, message: "No tienes suficientes monedas en el banco." };
      }
      
      const newBank = eco.bank - amount;
      const newWallet = eco.wallet + amount;
      
      await this.update(guildId, userId, { wallet: newWallet, bank: newBank });
      
      return { success: true, amount, newWallet, newBank };
    } catch (error) {
      console.error("[ECONOMY WITHDRAW]", error);
      return { success: false, message: "Error al retirar." };
    }
  },

  async claimDaily(guildId, userId) {
    try {
      const eco = await this.get(guildId, userId);
      const now = new Date();
      const lastDaily = eco.last_daily ? new Date(eco.last_daily) : null;
      
      // Verificar si ya reclamó hoy
      if (lastDaily) {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const lastDay = new Date(lastDaily.getFullYear(), lastDaily.getMonth(), lastDaily.getDate());
        
        if (today <= lastDay) {
          return { 
            success: false, 
            message: "Ya reclamaste tus monedas diarias hoy.",
            nextClaim: this.getNextDailyTime(lastDaily)
          };
        }
        
        // Verificar rachas (consecutive days)
        const diffDays = Math.floor((today - lastDay) / (1000 * 60 * 60 * 24));
        let newStreak = diffDays === 1 ? eco.daily_streak + 1 : 1;
        if (newStreak > 30) newStreak = 30; // Max streak
      }
      
      // Calcular recompensa (base + bonus por racha)
      const baseReward = 100;
      const streakBonus = Math.min(eco.daily_streak * 10, 200); // Max 200 extra
      const totalReward = baseReward + streakBonus;
      
      const newWallet = eco.wallet + totalReward;
      const newTotal = eco.total_earned + totalReward;
      const newStreak = (eco.daily_streak || 0) + 1;
      
      await this.update(guildId, userId, {
        wallet: newWallet,
        total_earned: newTotal,
        daily_streak: newStreak,
        last_daily: now.toISOString()
      });
      
      return { 
        success: true, 
        reward: totalReward,
        streak: newStreak,
        streakBonus,
        newBalance: newWallet
      };
    } catch (error) {
      console.error("[ECONOMY DAILY]", error);
      return { success: false, message: "Error al reclamar diario." };
    }
  },

  getNextDailyTime(lastClaim) {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const diff = tomorrow - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  },

  async transfer(guildId, fromUserId, toUserId, amount) {
    try {
      if (fromUserId === toUserId) {
        return { success: false, message: "No puedes transferirte monedas a ti mismo." };
      }
      
      const fromEco = await this.get(guildId, fromUserId);
      
      if (amount > fromEco.wallet) {
        return { success: false, message: "No tienes suficientes monedas." };
      }
      
      // Deducir del remitente
      await this.update(guildId, fromUserId, {
        wallet: fromEco.wallet - amount,
        total_spent: fromEco.total_spent + (amount * 0.01) // 1% fee
      });
      
      // Añadir al destinatario
      const toEco = await this.get(guildId, toUserId);
      await this.update(guildId, toUserId, {
        wallet: toEco.wallet + amount
      });
      
      return { success: true, amount };
    } catch (error) {
      console.error("[ECONOMY TRANSFER]", error);
      return { success: false, message: "Error al transferir." };
    }
  },

  async addToInventory(guildId, userId, itemId, quantity = 1) {
    try {
      const eco = await this.get(guildId, userId);
      const inventory = [...(eco.inventory || [])];
      
      const existingItem = inventory.find(i => i.id === itemId);
      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        inventory.push({ id: itemId, quantity, bought_at: new Date().toISOString() });
      }
      
      return this.update(guildId, userId, { inventory });
    } catch (error) {
      console.error("[ECONOMY ADD INVENTORY]", error);
      return null;
    }
  },

  async getLeaderboard(guildId, limit = 10) {
    try {
      return await this.collection()
        .find({ guild_id: guildId })
        .sort({ total_earned: -1 })
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error("[ECONOMY LEADERBOARD]", error);
      return [];
    }
  },

  async setJob(guildId, userId, job) {
    return this.update(guildId, userId, { job });
  },

  async work(guildId, userId) {
    try {
      const eco = await this.get(guildId, userId);
      
      if (!eco.job) {
        return { success: false, message: "No tienes un trabajo. Usa /work set para conseguir uno." };
      }
      
      // Verificar cooldown (1 hora)
      const now = new Date();
      if (eco.work_cooldown) {
        const lastWork = new Date(eco.work_cooldown);
        const diff = (now - lastWork) / (1000 * 60 * 60); // horas
        
        if (diff < 1) {
          const remaining = Math.ceil(60 - (diff * 60));
          return { success: false, message: `Espera ${remaining} minutos para trabajar de nuevo.` };
        }
      }
      
      // Calcular salario según trabajo
      const salaries = {
        none: 0,
        burger: 50,
        delivery: 75,
        developer: 150,
        doctor: 200,
        lawyer: 175,
        streamer: 250
      };
      
      const salary = salaries[eco.job] || 50;
      const bonus = Math.random() * salary * 0.5; // hasta 50% bonus
      const total = Math.floor(salary + bonus);
      
      await this.update(guildId, userId, {
        wallet: eco.wallet + total,
        total_earned: eco.total_earned + total,
        work_cooldown: now.toISOString()
      });
      
      return { success: true, amount: total, job: eco.job };
    } catch (error) {
      console.error("[ECONOMY WORK]", error);
      return { success: false, message: "Error al trabajar." };
    }
  }
};

// ══════════════════════════════════════════════════════════════
//   SHOP - Tienda de Items
// ══════════════════════════════════════════════════════════════

const shop = {
  collection() { return getDB().collection("shop"); },
  
  _default(guildId) {
    return {
      guild_id: guildId,
      items: [
        { id: "role_vip", name: "🎖️ Rol VIP", description: "Rol VIP por 30 días", price: 5000, type: "role", role_id: null, duration: 30 },
        { id: "role_premium", name: "💎 Rol Premium", description: "Rol Premium por 30 días", price: 10000, type: "role", role_id: null, duration: 30 },
        { id: "role_staff", name: "👔 Rol Staff", description: "Rol Staff temporal", price: 25000, type: "role", role_id: null, duration: 7 },
        { id: "boost_xp", name: "⚡ XP Boost", description: "2x XP por 1 día", price: 500, type: "boost", duration: 1 },
        { id: "boost_daily", name: "💰 Daily Boost", description: "2x recompensas diarias por 7 días", price: 2000, type: "boost", duration: 7 },
        { id: "ticket", name: "🎫 Ticket Extra", description: "Un ticket adicional", price: 300, type: "item", quantity: 1 },
        { id: "background", name: "🖼️ Background", description: "Fondo personalizado para profile", price: 1000, type: "item" },
        { id: "color", name: "🎨 Color de nombre", description: "Color personalizado en embed", price: 750, type: "item" },
        { id: "badge", name: "🏅 Insignia", description: "Insignia en tu perfil", price: 1500, type: "item" },
        { id: "crate_common", name: "📦 Caja Comun", description: "Suerte de 50-200 monedas", price: 200, type: "crate", min_reward: 50, max_reward: 200 },
        { id: "crate_rare", name: "✨ Caja Rara", description: "Suerte de 200-500 monedas", price: 500, type: "crate", min_reward: 200, max_reward: 500 },
        { id: "crate_epic", name: "💜 Caja Epica", description: "Suerte de 500-1500 monedas", price: 1500, type: "crate", min_reward: 500, max_reward: 1500 },
        { id: "crate_legendary", name: "🔥 Caja Legendaria", description: "Suerte de 1500-5000 monedas", price: 5000, type: "crate", min_reward: 1500, max_reward: 5000 },
      ]
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
      console.error("[SHOP GET]", error);
      return this._default(guildId);
    }
  },

  async addItem(guildId, item) {
    try {
      const s = await this.get(guildId);
      const existing = s.items.find(i => i.id === item.id);
      
      if (existing) {
        // Actualizar
        await this.collection().updateOne(
          { guild_id: guildId, "items.id": item.id },
          { $set: { "items.$": item } }
        );
      } else {
        // Añadir
        await this.collection().updateOne(
          { guild_id: guildId },
          { $push: { items: item } }
        );
      }
      
      return true;
    } catch (error) {
      console.error("[SHOP ADD ITEM]", error);
      return false;
    }
  },

  async removeItem(guildId, itemId) {
    try {
      await this.collection().updateOne(
        { guild_id: guildId },
        { $pull: { items: { id: itemId } } }
      );
      return true;
    } catch (error) {
      console.error("[SHOP REMOVE ITEM]", error);
      return false;
    }
  },

  async getItem(guildId, itemId) {
    try {
      const s = await this.get(guildId);
      return s.items.find(i => i.id === itemId) || null;
    } catch (error) {
      return null;
    }
  },

  async buy(guildId, userId, itemId) {
    try {
      const item = await this.getItem(guildId, itemId);
      if (!item) {
        return { success: false, message: "El item no existe en la tienda." };
      }
      
      const eco = await economy.get(guildId, userId);
      
      if (eco.wallet < item.price) {
        return { success: false, message: `Necesitas ${item.price} monedas. Tienes ${eco.wallet}.` };
      }
      
      // Deducir dinero
      await economy.removeMoney(guildId, userId, item.price);
      
      // Ejecutar efecto del item
      let result = { success: true, item };
      
      if (item.type === "crate") {
        const reward = Math.floor(Math.random() * (item.max_reward - item.min_reward + 1)) + item.min_reward;
        await economy.addMoney(guildId, userId, reward, "crate");
        result.reward = reward;
        result.message = `¡Ganaste ${reward} monedas de la caja!`;
      } else if (item.type === "item" || item.type === "role" || item.type === "boost") {
        await economy.addToInventory(guildId, userId, itemId, item.quantity || 1);
        result.message = `Compraste ${item.name}!`;
      }
      
      return result;
    } catch (error) {
      console.error("[SHOP BUY]", error);
      return { success: false, message: "Error al comprar." };
    }
  }
};

module.exports = {
  economy,
  shop
};
