# Sistema de Sugerencias Avanzado con Votación

## 📋 Resumen de Funcionalidades

El sistema de sugerencias ahora incluye:

1. **Comando `/suggest`** - Abre un Modal con dos campos:
   - Título de la sugerencia (opcional, hasta 200 caracteres)
   - Descripción detallada (requerida, hasta 2000 caracteres)

2. **Base de Datos MongoDB** - Colección `suggestions` con campos:
   - `title` - Título de la sugerencia
   - `description` - Descripción detallada
   - `upvotes` / `downvotes` - Arrays de userIds para evitar doble voto
   - `status` - "pending", "approved", o "rejected"
   - `thread_id` - ID del hilo de debate

3. **Embed Visual Atractivo** - Muestra:
   - Título en negrita
   - Descripción en formato cita
   - Barras de progreso de votación
   - Porcentaje de aprobación
   - Información del autor (anonimato opcional)

4. **Botones Interactivos**:
   - 👍 Votar a Favor (Success)
   - 👎 Votar en Contra (Danger)
   - ✅ Aprobar (Primary - Solo admin)
   - ❌ Rechazar (Secondary - Solo admin)

5. **Hilo de Debate Automático** - Se crea un hilo público vinculado al mensaje:
   - Nombre: "Debate: [Título]"
   - Mensaje inicial con la sugerencia
   - Se cierra automáticamente al aprobar/rechazar

## ⚙️ Configuración

Para activar el sistema, usa el comando de setup de sugerencias (debes crear uno) o configura manualmente en MongoDB:

```javascript
// En la colección suggestSettings
{
  guild_id: "ID_DEL_SERVIDOR",
  enabled: true,
  channel: "ID_DEL_CANAL_DE_SUGERENCIAS",
  anonymous: false, // true para ocultar el autor
  cooldown_minutes: 5,
  dm_on_result: true,
  approved_channel: "ID_CANAL_APROBADAS", // opcional
  rejected_channel: "ID_CANAL_RECHAZADAS" // opcional
}
```

## 📁 Archivos Modificados/Creados

| Archivo | Descripción |
|---------|-------------|
| `src/commands/suggest.js` | Comando slash con Modal |
| `src/interactions/modals/suggestModal.js` | Handler del modal |
| `src/interactions/buttons/suggestButtons.js` | Botones de vote/approve/reject |
| `src/utils/database.js` | Nueva función `createWithDetails` |

## 🔧 Permisos Necesarios

El bot necesita los siguientes permisos:
- `Send Messages`
- `Manage Threads` (para crear hilos de debate)
- `Embed Links`
- `Use External Emojis`

## 🎨 Colores del Embed

- **Pendiente**: 🔵 Azul (0x5865f2)
- **Aprobada**: 🟢 Verde (0x57f287)
- **Rechazada**: 🔴 Rojo (0xed4245)
