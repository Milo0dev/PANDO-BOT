#!/bin/bash

# Script de despliegue para PANDO BOT
# Este script debe ser ejecutado en tu host

echo "🚀 Desplegando PANDO BOT..."

# Eliminar dependencias antiguas
echo "🗑️  Limpiando dependencias antiguas..."
rm -rf node_modules package-lock.json

# Instalar Discord.js versión específica (soluciona el error de compatibilidad)
echo "📦 Instalando Discord.js v14.14.1..."
npm install discord.js@14.14.1

# Instalar demás dependencias
echo "📦 Instalando dependencias..."
npm install

# Verificar instalación
echo "✅ Verificando instalación..."
node -e "console.log('Discord.js version:', require('discord.js/package.json').version)"

echo "🎉 Despliegue completado!"
echo "Para iniciar el bot, ejecuta: node index.js"