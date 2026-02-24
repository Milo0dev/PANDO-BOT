# TODO - Mejoras del Bot Pando

## ✅ Completadas (Todas las prioridades)

### Alta Prioridad
- [x] 1. Sistema de XP en memoria con limpieza periódica
- [x] 2. Validación null en levelSettings.get()
- [x] 3. Dashboard con actualización automática (cada 30s)
- [x] 4. Limpieza de colas de música huérfanas (cada 5 min)
- [x] 5. Límite de notas en tickets (20 notas máx)

### Media Prioridad
- [x] 6. Sistema de aliases de comandos (/ayuda → /help, /soporte, etc.)
- [x] 7. Comando /debug oculto para admins

### Baja Prioridad
- [x] 8. Sistema de música con barra de progreso visual

---

## Mejoras Implementadas v1.2

### 1. Null Safety en Levels ✓
- Validación robusta cuando levelSettings.get() devuelve null
- Valores por defecto seguros

### 2. Dashboard Auto-Update ✓
- Actualización cada 30 segundos
- Inicialización automática al iniciar el bot
- Soporte para actualización forzada

### 3. Music Orphan Cleanup ✓
- Limpieza cada 5 minutos
- Detecta colas huérfanas (sin usuarios en voice channel)
- Desconexión automática después de 30 min de inactividad

### 4. Límite de Notas ✓
- Máximo 20 notas por ticket
- Contador visible en /note list

### 5. Alias de Comandos ✓
- `/ayuda` → /help
- `/soporte` → /help (sección tickets)
- `/estadisticas` → /stats
- `/verificar` → /verify
- `/bienvenida` → /welcome
- `/configurar` → /setup

### 6. Comando Debug (/debug) ✓
- `/debug status` - Estado del bot y métricas
- `/debug memory` - Uso de memoria
- `/debug cache` - Estado de caché
- `/debug guilds` - Lista de servidores
- Requiere ser owner del bot

---

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `index.js` | +debug, +auto-update, versión v1.2 |
| `src/commands/levels.js` | Null safety |
| `src/handlers/dashboardHandler.js` | Auto-actualización cada 30s |
| `src/handlers/musicHandler.js` | Limpieza de colas huérfanas |
| `src/commands/debug.js` | Nuevo comando debug |
| `src/events/interactionCreate.js` | Sistema de aliases |
| `TODO.md` | Actualizado |

---

## Dashboard Web v1.3

### Características ✓
- Servidor Express integrado en el mismo proceso que el bot
- Motor de plantillas EJS para renderizar HTML
- Puerto dinámico (process.env.PORT para Pterodactyl)
- Se inicia automáticamente cuando el bot se conecta
- Muestra información en tiempo real:
  - Nombre del bot
  - Avatar del bot
  - Cantidad de servidores
  - Usuarios totales
  - Ping del bot
  - Tiempo activo

### Archivos Creados/Modificados

| Archivo | Acción |
|---------|--------|
| `package.json` | +express, +ejs |
| `index.js` | +servidor Express + función iniciarServidorExpress |
| `views/dashboard.ejs` | Nueva plantilla HTML |
| `TODO.md` | Actualizado |

---

## Próximas mejoras potenciales

1. Sistema de sugerencias con votación anónima
2. Panel de tickets interactivo en tiempo real
3. Shortcuts de respuestas rápidas (tags)
4. Comandos de Economía/Juegos
5. Integración con APIs externas (twitch, twitter)
