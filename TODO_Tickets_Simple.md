# TODO — Sistema de Tickets Simple (/setup-tickets)

## Pasos del Plan

- [x] Analizar codebase existente (ticket.js, ticketHandler.js, interactionCreate.js, database.js, index.js)
- [x] CREAR `src/commands/setupTickets.js` — Slash command `/setup-tickets`
- [x] MODIFICAR `src/events/interactionCreate.js` — Handlers para `ticket_open_simple` y `ticket_close_simple`
- [x] MODIFICAR `index.js` — Importar y registrar el nuevo comando
- [x] Verificar que no hay conflictos con el sistema de tickets existente

## ✅ COMPLETADO

## Detalles

### Archivo 1: src/commands/setupTickets.js (NUEVO)
- Comando `/setup-tickets` (solo admins)
- Lee `panel_channel_id` y `support_role` de la DB
- Valida canal y permisos del bot
- Envía embed elegante con botón azul `🎫 Crear Ticket` (customId: ticket_open_simple)
- Guarda `panel_message_id` en settings

### Archivo 2: src/events/interactionCreate.js (MODIFICAR)
- Añadir `ChannelType` a imports de discord.js
- Handler `ticket_open_simple`:
  - Verifica mantenimiento, blacklist, ticket ya existente (por topic del canal)
  - Crea canal privado con permisos correctos
  - Envía embed de bienvenida + botón rojo `🔒 Cerrar Ticket` (customId: ticket_close_simple)
- Handler `ticket_close_simple`:
  - Permite cerrarlo al staff O al dueño del ticket
  - Elimina el canal en 5 segundos

### Archivo 3: index.js (MODIFICAR)
- Importar setupTickets
- Añadir a allCommands
