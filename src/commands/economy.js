const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  StringSelectMenuBuilder 
} = require("discord.js");
const { economy, shop } = require("../utils/economy");

// ══════════════════════════════════════════════════════════════
//   COMANDO MAESTRO: /ECO - Sistema de Economía Unificado
// ══════════════════════════════════════════════════════════════

module.exports = {
  data: new SlashCommandBuilder()
    .setName("eco")
    .setDescription("💰 Sistema de economía")
    
    // SUBCOMANDO: BALANCE
    .addSubcommand(sub => sub
      .setName("balance")
      .setDescription("💰 Ver tu saldo de monedas")
      .addUserOption(o => o
        .setName("usuario")
        .setDescription("Usuario a consultar")
        .setRequired(false)))
    
    // SUBCOMANDO: DAILY
    .addSubcommand(sub => sub
      .setName("daily")
      .setDescription("🎁 Reclamar monedas gratuitas diarias"))
    
    // SUBCOMANDO: PAY
    .addSubcommand(sub => sub
      .setName("pay")
      .setDescription("💸 Transferir monedas a otro usuario")
      .addUserOption(o => o
        .setName("usuario")
        .setDescription("Usuario al que enviarás monedas")
        .setRequired(true))
      .addIntegerOption(o => o
        .setName("cantidad")
        .setDescription("Cantidad de monedas")
        .setRequired(true)
        .setMinValue(1)))
    
    // SUBCOMANDO: DEPOSIT
    .addSubcommand(sub => sub
      .setName("deposit")
      .setDescription("🏦 Depositar monedas en el banco")
      .addIntegerOption(o => o
        .setName("cantidad")
        .setDescription("Cantidad a depositar")
        .setRequired(true)))
    
    // SUBCOMANDO: WITHDRAW
    .addSubcommand(sub => sub
      .setName("withdraw")
      .setDescription("🏧 Retirar monedas del banco")
      .addIntegerOption(o => o
        .setName("cantidad")
        .setDescription("Cantidad a retirar")
        .setRequired(true)))
    
    // SUBCOMANDO: SHOP
    .addSubcommand(sub => sub
      .setName("shop")
      .setDescription("🛒 Ver la tienda de items")
      .addStringOption(o => o
        .setName("categoria")
        .setDescription("Filtrar por categoría")
        .setRequired(false)
        .addChoices(
          { name: "🎭 Roles", value: "role" },
          { name: "⚡ Boosts", value: "boost" },
          { name: "📦 Cajas", value: "crate" },
          { name: "🎁 Items", value: "item" },
        )))
    
    // SUBCOMANDO: BUY
    .addSubcommand(sub => sub
      .setName("buy")
      .setDescription("🛍️ Comprar un item de la tienda")
      .addStringOption(o => o
        .setName("item")
        .setDescription("ID del item a comprar")
        .setRequired(true)))
    
    // SUBCOMANDO: WORK
    .addSubcommand(sub => sub
      .setName("work")
      .setDescription("💼 Trabajar para ganar monedas")
      .addStringOption(o => o
        .setName("accion")
        .setDescription("Acción a realizar")
        .setRequired(false)
        .addChoices(
          { name: "📋 Ver trabajos disponibles", value: "jobs" },
          { name: "💼 Elegir trabajo", value: "set" },
          { name: "🔨 Trabajar", value: "do" },
        ))
      .addStringOption(o => o
        .setName("trabajo")
        .setDescription("Trabajo a elegir")
        .setRequired(false)
        .addChoices(
          { name: "🍔 Trabajador de Burgers", value: "burger" },
          { name: "🚚 Repartidor", value: "delivery" },
          { name: "💻 Desarrollador", value: "developer" },
          { name: "⚕️ Doctor", value: "doctor" },
          { name: "⚖️ Abogado", value: "lawyer" },
          { name: "📺 Streamer", value: "streamer" },
        )))
    
    // SUBCOMANDO: GAMBLE
    .addSubcommand(sub => sub
      .setName("gamble")
      .setDescription("🎰 Apostar monedas")
      .addIntegerOption(o => o
        .setName("cantidad")
        .setDescription("Cantidad a apostar")
        .setRequired(true)
        .setMinValue(10)))
    
    // SUBCOMANDO: LEADERBOARD
    .addSubcommand(sub => sub
      .setName("leaderboard")
      .setDescription("🏆 Ver ranking de economía")
      .addStringOption(o => o
        .setName("tipo")
        .setDescription("Tipo de ranking")
        .setRequired(false)
        .addChoices(
          { name: "💰 Riqueza total", value: "total" },
          { name: "📈 Más ganado", value: "earned" },
          { name: "💵 En wallet", value: "wallet" },
        ))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "balance":
        await this.handleBalance(interaction);
        break;
      
      case "daily":
        await this.handleDaily(interaction);
        break;
      
      case "pay":
        await this.handlePay(interaction);
        break;
      
      case "deposit":
        await this.handleDeposit(interaction);
        break;
      
      case "withdraw":
        await this.handleWithdraw(interaction);
        break;
      
      case "shop":
        await this.handleShop(interaction);
        break;
      
      case "buy":
        await this.handleBuy(interaction);
        break;
      
      case "work":
        await this.handleWork(interaction);
        break;
      
      case "gamble":
        await this.handleGamble(interaction);
        break;
      
      case "leaderboard":
        await this.handleLeaderboard(interaction);
        break;
      
      default:
        await interaction.reply({
          content: "❌ Subcomando no reconocido.",
          flags: 64
        });
    }
  },

  // ══════════════════════════════════════════════════════════════
  //   HANDLER: BALANCE
  // ══════════════════════════════════════════════════════════════
  async handleBalance(interaction) {
    const user = interaction.options.getUser("usuario") || interaction.user;
    const eco = await economy.get(interaction.guildId, user.id);

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle(`💰 Balance de ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "💵 Wallet", value: `\`${eco.wallet.toLocaleString()}\` monedas`, inline: true },
        { name: "🏦 Banco", value: `\`${eco.bank.toLocaleString()}\` monedas`, inline: true },
        { name: "📊 Total ganado", value: `\`${eco.total_earned.toLocaleString()}\` monedas`, inline: true },
        { name: "📈 Racha diaria", value: `${eco.daily_streak || 0} días`, inline: true },
        { name: "💼 Trabajo", value: eco.job ? eco.job.charAt(0).toUpperCase() + eco.job.slice(1) : "Sin trabajo", inline: true },
      )
      .setFooter({ text: "Usa /eco daily para reclamar monedas gratis!" })
      .setTimestamp();

    if (user.id === interaction.user.id) {
      embed.setDescription("💰 **Tu balance**");
    } else {
      embed.setDescription(`💰 **Balance de ${user.username}**`);
    }

    await interaction.reply({ embeds: [embed] });
  },

  // ══════════════════════════════════════════════════════════════
  //   HANDLER: DAILY
  // ══════════════════════════════════════════════════════════════
  async handleDaily(interaction) {
    const result = await economy.claimDaily(interaction.guildId, interaction.user.id);

    if (!result.success) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription(`❌ ${result.message}`)
        .setFooter({ text: `Próximo reclamo: ${result.nextClaim}` });

      return interaction.reply({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle("🎉 ¡Monedas reclamadas!")
      .setDescription(
        `Has recibido **${result.reward.toLocaleString()}** monedas!\n\n` +
        `📈 Racha: **${result.streak}** días${result.streakBonus > 0 ? ` (+${result.streakBonus} bonus)` : ""}\n` +
        `💰 Nuevo balance: **${result.newBalance.toLocaleString()}** monedas`
      )
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: "Vuelve mañana para más monedas!" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },

  // ══════════════════════════════════════════════════════════════
  //   HANDLER: PAY
  // ══════════════════════════════════════════════════════════════
  async handlePay(interaction) {
    const user = interaction.options.getUser("usuario");
    const amount = interaction.options.getInteger("cantidad");

    if (user.bot) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription("❌ No puedes enviar monedas a bots.")],
        flags: 64
      });
    }

    if (user.id === interaction.user.id) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription("❌ No puedes enviarte monedas a ti mismo.")],
        flags: 64
      });
    }

    const result = await economy.transfer(interaction.guildId, interaction.user.id, user.id, amount);

    if (!result.success) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription(`❌ ${result.message}`)],
        flags: 64
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setDescription(
        `✅ Has enviado **${amount.toLocaleString()}** monedas a ${user.username}!\n\n` +
        `Se aplicó una comisión del 1%.`
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // DM al receptor
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle("💰 ¡Recibiste monedas!")
        .setDescription(
          `**${interaction.user.username}** te ha enviado **${amount.toLocaleString()}** monedas!`
        )
        .setTimestamp();
      
      await user.send({ embeds: [dmEmbed] });
    } catch (e) {}
  },

  // ══════════════════════════════════════════════════════════════
  //   HANDLER: DEPOSIT
  // ══════════════════════════════════════════════════════════════
  async handleDeposit(interaction) {
    const amount = interaction.options.getInteger("cantidad");
    const eco = await economy.get(interaction.guildId, interaction.user.id);

    let depositAmount = amount;
    if (amount > eco.wallet) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription(`❌ Solo tienes ${eco.wallet} monedas en tu wallet.`)],
        flags: 64
      });
    }

    const result = await economy.deposit(interaction.guildId, interaction.user.id, depositAmount);

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setDescription(
        `✅ Has depositado **${depositAmount.toLocaleString()}** monedas en el banco!\n\n` +
        `💵 Wallet: ${result.newWallet.toLocaleString()}\n` +
        `🏦 Banco: ${result.newBank.toLocaleString()}`
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },

  // ══════════════════════════════════════════════════════════════
  //   HANDLER: WITHDRAW
  // ══════════════════════════════════════════════════════════════
  async handleWithdraw(interaction) {
    const amount = interaction.options.getInteger("cantidad");

    const result = await economy.withdraw(interaction.guildId, interaction.user.id, amount);

    if (!result.success) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription(`❌ ${result.message}`)],
        flags: 64
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setDescription(
        `✅ Has retirado **${amount.toLocaleString()}** monedas del banco!\n\n` +
        `💵 Wallet: ${result.newWallet.toLocaleString()}\n` +
        `🏦 Banco: ${result.newBank.toLocaleString()}`
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },

  // ══════════════════════════════════════════════════════════════
  //   HANDLER: SHOP
  // ══════════════════════════════════════════════════════════════
  async handleShop(interaction) {
    const category = interaction.options.getString("categoria");
    const shopData = await shop.get(interaction.guildId);
    
    let items = shopData.items;
    if (category) {
      items = items.filter(i => i.type === category);
    }

    if (!items.length) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription("No hay items en esta categoría.")],
        flags: 64
      });
    }

    // Categorías
    const categories = {
      role: "🎭 Roles",
      boost: "⚡ Boosts",
      crate: "📦 Cajas",
      item: "🎁 Items"
    };

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("🛒 Tienda")
      .setDescription("Usa `/eco buy <item>` para comprar un item")
      .setTimestamp();

    // Agrupar por categoría
    const grouped = {};
    for (const item of items) {
      if (!grouped[item.type]) grouped[item.type] = [];
      grouped[item.type].push(item);
    }

    for (const [type, typeItems] of Object.entries(grouped)) {
      const value = typeItems.map(i => 
        `**${i.name}** - \`${i.price.toLocaleString()}\` 💰\n` +
        `└ ${i.description}`
      ).join("\n\n");
      
      embed.addFields({ 
        name: `${categories[type] || type}`, 
        value: value.substring(0, 1024) 
      });
    }

    await interaction.reply({ embeds: [embed] });
  },

  // ══════════════════════════════════════════════════════════════
  //   HANDLER: BUY
  // ══════════════════════════════════════════════════════════════
  async handleBuy(interaction) {
    const itemId = interaction.options.getString("item");
    const shopData = await shop.get(interaction.guildId);
    
    const item = shopData.items.find(i => i.id === itemId);
    
    if (!item) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription("❌ Item no encontrado. Usa `/eco shop` para ver los items disponibles.")],
        flags: 64
      });
    }

    const result = await shop.buy(interaction.guildId, interaction.user.id, itemId);

    if (!result.success) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription(`❌ ${result.message}`)],
        flags: 64
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle("✅ ¡Compra exitosa!")
      .setDescription(
        `Has comprado **${item.name}** por ${item.price.toLocaleString()} monedas!\n\n` +
        (result.message || "")
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },

  // ══════════════════════════════════════════════════════════════
  //   HANDLER: WORK
  // ══════════════════════════════════════════════════════════════
  async handleWork(interaction) {
    const action = interaction.options.getString("accion") || "jobs";
    const job = interaction.options.getString("trabajo");
    const eco = await economy.get(interaction.guildId, interaction.user.id);

    if (action === "jobs") {
      const jobs = [
        { id: "burger", name: "🍔 Burgers", salary: "50-75", desc: "Trabajo rápido y fácil" },
        { id: "delivery", name: "🚚 Repartidor", salary: "75-112", desc: "Entrega a domicilio" },
        { id: "developer", name: "💻 Desarrollador", salary: "150-225", desc: "Trabaja desde casa" },
        { id: "doctor", name: "⚕️ Doctor", salary: "200-300", desc: "Sector sanitario" },
        { id: "lawyer", name: "⚖️ Abogado", salary: "175-262", desc: "Sector legal" },
        { id: "streamer", name: "📺 Streamer", salary: "250-375", desc: "Gana haciendo lo que amas" },
      ];

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("💼 Trabajos disponibles")
        .setDescription("Usa `/eco work set <trabajo>` para elegir un trabajo")
        .addFields(
          jobs.map(j => ({
            name: j.name,
            value: `💰 Salario: ${j.salary}\n📝 ${j.desc}`,
            inline: true
          }))
        )
        .setFooter({ text: `Tu trabajo actual: ${eco.job || "Ninguno"}` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (action === "set") {
      if (!job) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0xED4245)
            .setDescription("❌ Debes especificar un trabajo.")],
          flags: 64
        });
      }

      await economy.setJob(interaction.guildId, interaction.user.id, job);

      const jobNames = {
        burger: "🍔 Trabajador de Burgers",
        delivery: "🚚 Repartidor",
        developer: "💻 Desarrollador",
        doctor: "⚕️ Doctor",
        lawyer: "⚖️ Abogado",
        streamer: "📺 Streamer"
      };

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x57F287)
          .setDescription(`✅ Ahora trabajas como **${jobNames[job]}**!\nUsa \`/eco work do\` para trabajar.`)]
      });
    }

    if (action === "do") {
      const result = await economy.work(interaction.guildId, interaction.user.id);

      if (!result.success) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0xED4245)
            .setDescription(`❌ ${result.message}`)],
          flags: 64
        });
      }

      const jobNames = {
        burger: "🍔 Burgers",
        delivery: "🚚 Repartidor",
        developer: "💻 Desarrollador",
        doctor: "⚕️ Doctor",
        lawyer: "⚖️ Abogado",
        streamer: "📺 Streamer"
      };

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x57F287)
          .setDescription(`💰 Ganaste **${result.amount}** monedas trabajando como **${jobNames[result.job]}**!\n\nVuelve en 1 hora para trabajar de nuevo.`)]
      });
    }
  },

  // ══════════════════════════════════════════════════════════════
  //   HANDLER: GAMBLE
  // ══════════════════════════════════════════════════════════════
  async handleGamble(interaction) {
    const amount = interaction.options.getInteger("cantidad");
    const eco = await economy.get(interaction.guildId, interaction.user.id);

    if (amount > eco.wallet) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription(`❌ Solo tienes ${eco.wallet} monedas.`)],
        flags: 64
      });
    }

    if (amount < 10) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription("❌ Minimum bet is 10 coins.")],
        flags: 64
      });
    }

    // 50% chance de ganar
    const win = Math.random() > 0.5;
    let multiplier = 0;

    if (win) {
      // Multiplicador aleatorio entre 1.5x y 3x
      multiplier = 1.5 + Math.random() * 1.5;
      const won = Math.floor(amount * multiplier);
      await economy.addMoney(interaction.guildId, interaction.user.id, won, "gamble");
      
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle("🎰 ¡Ganaste!")
        .setDescription(
          `✅ Apostaste: **${amount}** 💰\n` +
          `📊 Multiplicador: **${multiplier.toFixed(2)}x**\n` +
          `💰 Ganaste: **${won}** 💰`
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } else {
      await economy.removeMoney(interaction.guildId, interaction.user.id, amount);
      
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle("💸 Perdiste")
        .setDescription(
          `❌ Apostaste: **${amount}** 💰\n` +
          `💸 Perdiste: **${amount}** 💰`
        )
        .setFooter({ text: "Mejor suerte next time!" })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  },

  // ══════════════════════════════════════════════════════════════
  //   HANDLER: LEADERBOARD
  // ══════════════════════════════════════════════════════════════
  async handleLeaderboard(interaction) {
    const type = interaction.options.getString("tipo") || "total";
    const top = await economy.getLeaderboard(interaction.guildId, 10);

    if (!top.length) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x5865F2)
          .setDescription("No hay datos todavía. ¡Gana monedas para aparecer en el ranking!")]
      });
    }

    const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
    const fieldName = {
      total: "📊 Riqueza total",
      earned: "📈 Total ganado",
      wallet: "💵 En wallet"
    };

    let description = "";
    for (let i = 0; i < top.length; i++) {
      const user = top[i];
      const value = type === "wallet" ? user.wallet : 
                    type === "earned" ? user.total_earned : 
                    user.wallet + user.bank;
      
      description += `${medals[i]} **${user.user_id === interaction.user.id ? "**⭐ TÚ**" : `Usuario`}**: \`${value.toLocaleString()}\` 💰\n`;
    }

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle("🏆 Ranking de Economía")
      .setDescription(description)
      .setFooter({ text: `Ordenado por: ${fieldName[type]}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
