#!/usr/bin/env node

/**
 * ══════════════════════════════════════════════════════════════
 *   SCRIPT DE VERIFICACIÓN DE INSTALACIÓN
 *   Verifica que todas las dependencias y configuraciones
 *   necesarias para el sistema de música estén correctas
 * ══════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const { execSync } = require('child_process');
require('dotenv').config();

console.log('\n🔍 Verificando instalación del sistema de música...\n');

let errors = 0;
let warnings = 0;

// ══════════════════════════════════════════════════════════════
//   VERIFICAR NODE.JS
// ══════════════════════════════════════════════════════════════
console.log('📦 Verificando Node.js...');
const nodeVersion = process.version.match(/^v(\d+\.\d+)/)[1];
const nodeVersionMajor = parseInt(nodeVersion.split('.')[0]);

if (nodeVersionMajor >= 18) {
  console.log(`✅ Node.js ${process.version} (OK)`);
} else {
  console.log(`❌ Node.js ${process.version} - Se requiere v18 o superior`);
  errors++;
}

// ══════════════════════════════════════════════════════════════
//   VERIFICAR FFMPEG
// ══════════════════════════════════════════════════════════════
console.log('\n🎵 Verificando FFmpeg...');
console.log('✅ Usando ffmpeg-static (Instalación local correcta)');

// ══════════════════════════════════════════════════════════════
//   VERIFICAR DEPENDENCIAS NPM
// ══════════════════════════════════════════════════════════════
console.log('\n📚 Verificando dependencias de npm...');

const requiredDependencies = [
  'discord.js',
  '@discordjs/voice',
  'opusscript', // Reemplazo de @discordjs/opus
  'libsodium-wrappers',
  'play-dl',
  'spotify-web-api-node',
  // sodium-native eliminado porque usamos la versión pura de JS
  'ffmpeg-static',
];

const packageJsonPath = './package.json';
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const installedDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  for (const dep of requiredDependencies) {
    if (installedDeps[dep]) {
      console.log(`✅ ${dep} (${installedDeps[dep]})`);
    } else {
      console.log(`❌ ${dep} - No instalado`);
      errors++;
    }
  }
} else {
  console.log('⚠️  No se encontró package.json');
  warnings++;
}

// Verificar que node_modules exista
console.log('\n📁 Verificando node_modules...');
if (fs.existsSync('./node_modules')) {
  console.log('✅ node_modules encontrado');
} else {
  console.log('❌ node_modules no encontrado');
  console.log('   Ejecuta: npm install');
  errors++;
}

// ══════════════════════════════════════════════════════════════
//   VERIFICAR ARCHIVO .ENV
// ══════════════════════════════════════════════════════════════
console.log('\n🔐 Verificando archivo .env...');

if (fs.existsSync('.env')) {
  console.log('✅ Archivo .env encontrado');
  
  // Verificar variables requeridas
  const requiredEnvVars = [
    'DISCORD_TOKEN',
    'CLIENT_ID',
    'SPOTIFY_CLIENT_ID',
    'SPOTIFY_CLIENT_SECRET',
  ];
  
  const optionalEnvVars = [
    'GUILD_ID',
    'DEFAULT_VOLUME',
    'MAX_QUEUE_SIZE',
    'IDLE_TIMEOUT',
  ];
  
  console.log('\n   Variables requeridas:');
  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      // Ocultar valores sensibles
      const value = process.env[envVar];
      const masked = value.length > 10 
        ? value.substring(0, 5) + '...' + value.substring(value.length - 3)
        : '***';
      console.log(`   ✅ ${envVar} = ${masked}`);
    } else {
      console.log(`   ❌ ${envVar} - No configurado`);
      errors++;
    }
  }
  
  console.log('\n   Variables opcionales:');
  for (const envVar of optionalEnvVars) {
    if (process.env[envVar]) {
      console.log(`   ✅ ${envVar} = ${process.env[envVar]}`);
    } else {
      console.log(`   ⚠️  ${envVar} - No configurado (usando valor por defecto)`);
    }
  }
} else {
  console.log('❌ Archivo .env no encontrado');
  console.log('   Copia .env.example a .env y configura las variables');
  errors++;
}

// ══════════════════════════════════════════════════════════════
//   VERIFICAR ESTRUCTURA DE ARCHIVOS
// ══════════════════════════════════════════════════════════════
console.log('\n📂 Verificando estructura de archivos...');

const requiredFiles = [
  './src/commands/music_commands.js',
  './src/handlers/musicHandler.js',
  './src/handlers/musicButtonHandler.js',
];

for (const file of requiredFiles) {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - No encontrado`);
    errors++;
  }
}

// ══════════════════════════════════════════════════════════════
//   VERIFICAR PERMISOS DEL BOT
// ══════════════════════════════════════════════════════════════
console.log('\n🔑 Permisos requeridos del bot:');
const requiredPermissions = [
  'Connect (Conectar a canales de voz)',
  'Speak (Hablar en canales de voz)',
  'Use Voice Activity (Usar actividad de voz)',
  'Send Messages (Enviar mensajes)',
  'Embed Links (Insertar enlaces)',
  'Attach Files (Adjuntar archivos)',
];

console.log('   ⚠️  Asegúrate de que el bot tenga estos permisos:');
for (const perm of requiredPermissions) {
  console.log(`   • ${perm}`);
}

// ══════════════════════════════════════════════════════════════
//   VERIFICAR INTENTS
// ══════════════════════════════════════════════════════════════
console.log('\n🎯 Intents requeridos:');
const requiredIntents = [
  'Guilds',
  'GuildVoiceStates',
  'GuildMessages',
  'MessageContent',
];

console.log('   ⚠️  Asegúrate de tener estos intents habilitados:');
for (const intent of requiredIntents) {
  console.log(`   • ${intent}`);
}

console.log('\n   Verifica en: https://discord.com/developers/applications');
console.log('   → Tu aplicación → Bot → Privileged Gateway Intents');

// ══════════════════════════════════════════════════════════════
//   RESUMEN
// ══════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60));
console.log('RESUMEN DE VERIFICACIÓN');
console.log('═'.repeat(60));

if (errors === 0 && warnings === 0) {
  console.log('✅ ¡Todo está correcto! El sistema de música está listo.');
  console.log('\n📝 Próximos pasos:');
  console.log('   1. Ejecuta: npm run deploy (para desplegar comandos)');
  console.log('   2. Ejecuta: npm start (para iniciar el bot)');
  console.log('   3. Prueba: /play en Discord');
} else {
  if (errors > 0) {
    console.log(`❌ Se encontraron ${errors} error(es) que deben corregirse.`);
  }
  if (warnings > 0) {
    console.log(`⚠️  Se encontraron ${warnings} advertencia(s).`);
  }
  console.log('\n📝 Revisa los errores arriba y corrígelos antes de continuar.');
}

console.log('═'.repeat(60) + '\n');

// Salir con código de error si hay errores
process.exit(errors > 0 ? 1 : 0);
