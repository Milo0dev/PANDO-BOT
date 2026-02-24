# TODO - Sistema de Entretenimiento - COMPLETADO

## Fase 1: Sistema de Economía 💰

### Completado
- [x] 1. Colección de economía en MongoDB (usuarios)
- [x] 2. Comando /balance - Ver saldo y banco
- [x] 3. Comando /daily - Monedas diarias
- [x] 4. Comando /pay - Transferir monedas
- [x] 5. Comando /shop - Tienda de items/roles
- [x] 6. Comando /buy - Comprar items
- [x] 7. Sistema de trabajo/empleos
- [x] 8. Sistema de apuesta/gamble
- [x] 9. Sistema de deposit/withdraw
- [x] 10. Leaderboard

---

## Fase 2: Juegos 🎮

### Completado
- [x] 1. Ahorcado (/ahorcado) - Palabras en español
- [x] 2. Tic-tac-toe (/ttt) - 3 en raya
- [x] 3. Trivia (/trivia) - Preguntas variadas

---

## Fase 3: Giveaways 🎁

### Completado
- [x] 1. Comando /giveaway create
- [x] 2. Sistema de timer automático
- [x] 3. Comando /giveaway reroll

---

## Comandos Nuevos

### Economía
- `/balance` - Ver saldo
- `/daily` - Reclamar monedas diarias  
- `/pay` - Transferir monedas
- `/deposit` - Depositar en banco
- `/withdraw` - Retirar del banco
- `/shop` - Ver tienda
- `/buy` - Comprar items
- `/work` - Trabajar y ganar
- `/gamble` - Apostar monedas
- `/leaderboard` - Ranking

### Juegos
- `/ahorcado` - Juego del ahorcado
- `/ttt` - 3 en raya
- `/trivia` - Preguntas de trivia

### Giveaway
- `/giveaway create` - Crear giveaway
- `/giveaway reroll` - Rerolar ganadores

---

## Archivos Creados/Modificados

| Archivo | Descripción |
|---------|-------------|
| `src/utils/economy.js` | Base de datos de economía y tienda |
| `src/commands/economy.js` | Comandos de economía |
| `src/commands/games.js` | Juegos (ahorcado, ttt, trivia) |
| `src/commands/giveaway.js` | Sistema de giveaways |
| `index.js` | Registro de nuevos comandos |
