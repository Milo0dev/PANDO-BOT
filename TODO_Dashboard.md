# TODO - Dashboard Server Configuration

## Completados ✅

### API Endpoints del Dashboard
- ✅ GET /api/servers - Obtener lista de servidores
- ✅ GET /api/settings/:guildId - Obtener configuración de un servidor
- ✅ POST /api/settings/:guildId - Actualizar configuración de un servidor

### Interfaz del Dashboard
- ✅ Selector de servidor (dropdown)
- ✅ Panel de configuración con pestañas/secciones
- ✅ Inputs de formulario para todos los ajustes
- ✅ Notificaciones toast para éxito/error
- ⚠️ Estados de carga necesitan pruebas en Windows

### Refactorización de Dropdowns Flotantes (IMPORTANTE)
- ✅ **COMPLETADO**: Los menús desplegables de canales (Dropdowns flotantes) y el selector de servidores YA ESTÁN COMPLETADOS Y FUNCIONANDO.
- ⚠️ **NO modificar la lógica ni el CSS de los custom dropdowns para no romper la UI**

---

## En Progreso 🔄

### Rediseño Visual del Dashboard
- Mejorar diseño de pestañas (tabs) con iconos más grandes y coloridos
- Efectos hover y activo más atractivos
- Indicador visual de pestaña activa

### Sección de Tickets - Reemplazar números con tarjetas visuales
- "Máximo de Tickets por Usuario" → Tarjeta con icono y selector visual
- "Límite Global de Tickets" → Tarjeta con icono
- "Cooldown" → Selector de tiempo visual (menú desplegable)
- "Días Mínimos" → Selector visual
- "Auto-cierre por Inactividad" → Menú desplegable con opciones
- "Alerta SLA" → Selector visual
- "Smart Ping" → Selector visual

### Canales - Mejorar visualización
- Cards visuales para cada canal en lugar de inputs simples
- Iconos de Discord para identificar tipo de canal

### Roles - Diseño de tarjetas
- Cards visuales con iconos para cada rol
- Selector visual de roles

### Automatización y DM - Mejores toggles
- Toggles más atractivos con iconos
- Efectos de activación más visibles

### Mantenimiento - Card destacada
- Diseño más prominente para el modo mantenimiento

**Archivo a modificar**: views/dashboard.ejs

---

## Pendientes 📋

### Refactorización Canal de Logs - Dropdown Personalizado
- [ ] Agregar CSS para el dropdown personalizado con animaciones
- [ ] Actualizar estructura HTML del canal de logs
- [ ] Actualizar estructura HTML de los demás canales
- [ ] Verificar funcionamiento del JavaScript
- [ ] Probar el resultado

**Detalles de implementación:**
- Reemplazar input de texto por dropdown moderno
- Mostrar nombres de canal en lugar de IDs
- Animaciones suaves (opacity + transform)
- Z-index alto (999) para evitar problemas de desbordamiento
- Chevron rotativo al abrir
- Estados hover visibles
