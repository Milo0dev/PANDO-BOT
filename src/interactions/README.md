# Sistema de Interacciones

Este sistema permite manejar interacciones de Discord (botones, selects, modals) de forma modular y organizada.

## Estructura de Carpetas

```
src/interactions/
├── buttons/     # Manejadores de botones
├── selects/     # Manejadores de menús de selección
└── modals/      # Manejadores de modales
```

## Cómo Crear un Nuevo Manejador

Cada manejador debe exportar un objeto con las siguientes propiedades:

- `customId`: El ID personalizado del elemento de interacción. Puede terminar con `*` para manejar IDs dinámicos.
- `execute`: Función asíncrona que recibe los parámetros `interaction` y `client`.

### Ejemplo de Manejador de Botón

```js
module.exports = {
  customId: "mi_boton",
  async execute(interaction, client) {
    // Tu código aquí
    await interaction.reply({ content: "¡Botón presionado!", ephemeral: true });
  }
};
```

### Ejemplo con ID Dinámico

Para manejar IDs dinámicos (como "ticket_123", "ticket_456"), usa un wildcard:

```js
module.exports = {
  customId: "ticket_*", // Manejará cualquier ID que comience con "ticket_"
  async execute(interaction, client) {
    const ticketId = interaction.customId.replace("ticket_", "");
    // Tu código aquí
  }
};
```

## Carga Automática

Los manejadores se cargan automáticamente al iniciar el bot. No es necesario registrarlos manualmente.
