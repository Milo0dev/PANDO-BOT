/**
 * Script para limpiar TODOS los comandos de aplicación de Discord
 * Uso: node cleanup-commands.js
 * 
 * Este script elimina:
 * - Comandos globales (client.application.commands)
 * - Comandos de un servidor específico (guild.commands)
 */

require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const chalk = require("chalk");

// ============================================
// CONFIGURACIÓN - Cambia estos valores aquí
// ============================================

// ID del servidor (guild) cuyos comandos quieres eliminar
// Deja en null o string vacío si solo quieres limpiar comandos globales
const GUILD_ID = "1214106731022655488"; // Ejemplo: "123456789012345678"

// ============================================

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

async function limpiarComandos() {
  try {
    console.log(chalk.yellow("\n🧹 INICIANDO LIMPIEZA DE COMANDOS...\n"));

    // ── Limpiar comandos globales ──
    console.log(chalk.cyan("📌 Limpiando comandos globales..."));
    const comandosGlobales = await client.application.commands.fetch();
    
    if (comandosGlobales.size > 0) {
      console.log(chalk.gray(`   Encontrados ${comandosGlobales.size} comandos globales`));
      
      // Eliminar cada comando individualmente
      for (const [id, cmd] of comandosGlobales) {
        await client.application.commands.delete(id);
        console.log(chalk.gray(`   ✓ Eliminado: /${cmd.name}`));
      }
      
      console.log(chalk.green(`   ✅ ${comandosGlobales.size} comandos globales eliminados`));
    } else {
      console.log(chalk.gray("   ✓ No hay comandos globales para eliminar"));
    }

    // ── Limpiar comandos del servidor (guild) ──
    if (GUILD_ID && GUILD_ID.trim() !== "") {
      console.log(chalk.cyan("\n📌 Limpiando comandos del servidor..."));
      
      try {
        // Primero verificar si el cliente tiene el guild en cache
        let guild = client.guilds.cache.get(GUILD_ID);
        
        if (!guild) {
          console.log(chalk.gray("   ℹ Guild no está en cache, intentando obtenerlo..."));
          // Intentar obtener el guild
          const fetched = await client.guilds.fetch().catch(() => null);
          if (fetched && fetched.has(GUILD_ID)) {
            guild = fetched.get(GUILD_ID);
          }
        }
        
        if (!guild) {
          // Guild no encontrado - puede que el bot no esté en ese servidor
          console.log(chalk.yellow("   ⚠️ No se encontró el servidor. Asegúrate de que el bot esté en el servidor."));
          console.log(chalk.gray("   ℹ️ Omitiendo limpieza de comandos del servidor."));
        } else {
          console.log(chalk.gray(`   Servidor: ${guild.name} (${guild.id})`));
          
          const comandosGuild = await guild.commands.fetch();
          
          if (comandosGuild.size > 0) {
            console.log(chalk.gray(`   Encontrados ${comandosGuild.size} comandos del servidor`));
            
            // Eliminar cada comando individualmente
            for (const [id, cmd] of comandosGuild) {
              await guild.commands.delete(id);
              console.log(chalk.gray(`   ✓ Eliminado: /${cmd.name}`));
            }
            
            console.log(chalk.green(`   ✅ ${comandosGuild.size} comandos del servidor eliminados`));
          } else {
            console.log(chalk.gray("   ✓ No hay comandos del servidor para eliminar"));
          }
        }
      } catch (error) {
        console.log(chalk.red(`   ❌ Error al procesar el servidor: ${error.message}`));
      }
    }

    // ── Verificación final ──
    console.log(chalk.cyan("\n📌 Verificando comandos restantes..."));
    
    const globalesRestantes = await client.application.commands.fetch();
    console.log(chalk.gray(`   Comandos globales restantes: ${globalesRestantes.size}`));

    console.log(chalk.green("\n✅ LIMPIEZA COMPLETADA CON ÉXITO!\n"));
    console.log(chalk.blue("🎉 Todos los comandos de aplicación han sido eliminados.\n"));
    
    client.destroy();
    process.exit(0);
    
  } catch (error) {
    console.error(chalk.red("\n❌ Error durante la limpieza:"), error.message);
    client.destroy();
    process.exit(1);
  }
}

// Iniciar el cliente
client.once("ready", async () => {
  console.log(chalk.blue(`✅ Conectado como ${client.user.tag}`));
  await limpiarComandos();
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error(chalk.red("❌ Error al iniciar sesión:"), err.message);
  process.exit(1);
});
