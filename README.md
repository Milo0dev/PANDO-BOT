# PANDO BOT - Guía de Despliegue

## Solución al Error de Compatibilidad

Si tu bot falla con el error:
```
TypeError: Cannot read properties of undefined (reading 'PNG')
```

Este error ocurre por incompatibilidad de versiones de Discord.js en tu host.

## Solución para Host sin Acceso a Comandos

### Opción 1: Archivos de Configuración

1. **Asegúrate de tener estos archivos en tu proyecto:**
   - `package.json` (con Discord.js v14.14.1)
   - `deploy.sh` (script de despliegue)
   - `.env` (variables de entorno)

2. **package.json debe contener:**
```json
{
  "dependencies": {
    "discord.js": "^14.14.1"
  }
}
```

### Opción 2: Contactar a tu Proveedor de Hosting

Envía este mensaje a tu proveedor de hosting:

```
Hola, necesito ayuda con mi bot de Discord.

Tengo un error de compatibilidad con Discord.js. Necesito que en mi proyecto se ejecute este comando:

npm install discord.js@14.14.1

O si no pueden ejecutar comandos, necesito que actualicen mi package.json para que tenga exactamente esta versión de Discord.js: ^14.14.1

El error que recibo es:
TypeError: Cannot read properties of undefined (reading 'PNG')

Gracias.
```

### Opción 3: Usar Archivo de Despliegue

Si tu hosting permite subir scripts de despliegue:

1. Sube el archivo `deploy.sh` a tu proyecto
2. Configura tu hosting para que ejecute este script al desplegar
3. El script se encargará de instalar la versión correcta

### Opción 4: Cambio Manual en package.json

Si puedes editar archivos en tu hosting:

1. Busca el archivo `package.json` en tu proyecto
2. Cambia la línea de Discord.js a:
```json
"discord.js": "^14.14.1"
```
3. Guarda el archivo
4. Reinicia tu proyecto

## Variables de Entorno Necesarias

Asegúrate de tener estas variables en tu entorno:

```env
TOKEN=tu_token_de_discord
MONGO_URI=tu_uri_de_mongodb
MONGO_DB=pando_bot
SPOTIFY_CLIENT_ID=tu_id_de_spotify
SPOTIFY_CLIENT_SECRET=tu_secreto_de_spotify
TICKET_PREFIX=ticket
```

## Comprobación Final

Después de aplicar la solución, tu bot debería iniciar sin errores y mostrar:
```
✅ Conectado a MongoDB
✅ Spotify autenticado correctamente
✅ Conectado como [Nombre del Bot]
🎫 Pando Bot v1.0 listo
```

## Soporte

Si el problema persiste, contacta a tu proveedor de hosting con este mensaje detallado o busca un hosting que permita ejecutar comandos npm.