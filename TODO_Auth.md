# Plan: Implementación de Discord OAuth2

## Información Recopilada:
- **index.js**: Servidor Express básico con rutas `/` y `/health`
- **config.js**: Configuración del sistema de tickets (sin OAuth)
- **package.json**: Express, discord.js, ejs instalados (faltan paquetes de sesión)
- **views/dashboard.ejs**: Dashboard simple con estadísticas del bot

## Plan de Implementación:

### 1. Dependencias a instalar:
- [x] `express-session` - Para gestión de sesiones
- [x] `axios` - Para llamadas a la API de Discord

### 2. Configuración (.env):
- [ ] Añadir variables: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI, DISCORD_OWNER_ID, SESSION_SECRET

### 3. Actualizar config.js:
- [x] Añadir objeto de configuración OAuth

### 4. Crear middleware de autenticación:
- [x] `src/middleware/auth.js` - Configuración de sesiones
- [x] Ruta `/login` - Redirigir a Discord OAuth
- [x] Ruta `/callback` - Procesar código de Discord
- [x] Ruta `/logout` - Destruir sesión
- [x] Middleware `checkAuth` - Verificar sesión activa
- [x] Middleware `checkOwner` - Verificar si es el dueño

### 5. Actualizar index.js:
- [x] Importar y usar el middleware de auth
- [x] Proteger ruta `/` con checkAuth y checkOwner
- [x] Añadir datos del usuario a las vistas

### 6. Actualizar frontend:
- [x] `views/dashboard.ejs` - Mostrar info del usuario logueado

## Archivos editados:
- `.env` (configuración manual requerida)
- `config.js`
- `index.js`
- `views/dashboard.ejs`

## Archivos creados:
- `src/middleware/auth.js`

## Pendiente:
- Configurar variables de entorno en .env
- Obtener credenciales de Discord Developer Portal
