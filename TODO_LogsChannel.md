# TODO — Logs de Auditoría (messageDelete / messageUpdate)

## Tareas

- [x] Analizar `messageDelete.js`, `messageUpdate.js` y `database.js`
- [x] **messageDelete.js** — Eliminar import roto de `ticketLogs`
- [x] **messageDelete.js** — Consolidar `settings.get()` en una sola llamada al inicio
- [x] **messageDelete.js** — Añadir check `if (!s.log_deletes) return` en log global
- [x] **messageDelete.js** — Simplificar lógica: ticket → log ticket + return (sin doble log)
- [x] **messageDelete.js** — Embed profesional con 👤 Autor, 📍 Canal, 📝 Contenido, 🕒 Timestamp
- [x] **messageUpdate.js** — Eliminar import roto de `ticketLogs`
- [x] **messageUpdate.js** — Consolidar `settings.get()` en una sola llamada al inicio
- [x] **messageUpdate.js** — Añadir check `if (!s.log_edits) return` en log global
- [x] **messageUpdate.js** — Simplificar lógica: ticket → log ticket + return (sin doble log)
- [x] **messageUpdate.js** — Embed profesional con 👤 Autor, 📍 Canal, 📝 Antes/Después, 🕒 Timestamp
- [x] Verificar que no hay dependencias circulares
- [ ] Reiniciar el bot y confirmar funcionamiento
