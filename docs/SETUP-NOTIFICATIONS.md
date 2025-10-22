# 🔔 Sistema de Notificaciones en Tiempo Real - Xpend V2

## 📋 Descripción

Este documento describe el sistema de notificaciones en tiempo real de Xpend V2, que notifica automáticamente a todos los usuarios de una empresa cuando ocurren eventos importantes.

---

## 🎯 Eventos que Generan Notificaciones

El sistema genera notificaciones automáticamente cuando:

1. **Usuario Nuevo Invitado**
   - Un administrador invita a un nuevo usuario
   - Notifica a todos los usuarios de la empresa (excepto al nuevo usuario)

2. **Primer Ingreso de Usuario**
   - Un usuario nuevo completa su primer ingreso a la plataforma
   - Notifica a todos los usuarios de la empresa (excepto al que ingresó)

3. **Nueva Licitación Creada**
   - Se crea una nueva licitación
   - Notifica a todos los usuarios de la empresa (excepto al creador)

4. **Nuevo Proyecto Creado**
   - Se crea un nuevo proyecto
   - Notifica a todos los usuarios de la empresa (excepto al creador)

---

## 🚀 Instalación y Configuración

### **Paso 1: Ejecutar el Script SQL en Supabase**

1. Abre el **Dashboard de Supabase**: https://app.supabase.com
2. Selecciona tu proyecto Xpend
3. Ve a **SQL Editor**
4. Abre el archivo: `/database/migrations/create-notifications-system.sql`
5. Copia TODO el contenido del script
6. Pégalo en el SQL Editor de Supabase
7. Haz clic en **"Run"** o presiona `Ctrl+Enter`

Deberías ver un mensaje como:
```
Success. No rows returned
```

### **Paso 2: Habilitar Realtime para la Tabla `notifications`**

Las notificaciones aparecen en tiempo real gracias a Supabase Realtime.

1. En el Dashboard de Supabase, ve a **Database > Replication**
2. Busca la tabla `notifications` en la lista
3. Activa el toggle para habilitar Realtime
4. Haz clic en **"Save"**

![Supabase Realtime](https://supabase.com/docs/img/realtime-replication.png)

### **Paso 3: Verificar que RLS está Habilitado**

El script ya habilita RLS automáticamente, pero puedes verificarlo:

1. Ve a **Database > Tables**
2. Selecciona la tabla `notifications`
3. En la pestaña **"Policies"**, deberías ver:
   - ✅ `Users can view their own notifications` (SELECT)
   - ✅ `Users can update their own notifications` (UPDATE)
   - ✅ `Users can delete their own notifications` (DELETE)
   - ✅ `System can insert notifications` (INSERT - nadie puede insertar manualmente)

---

## 🧪 Testing del Sistema

### **Prueba 1: Invitar un Nuevo Usuario**

1. Como **Admin** o **Super Admin**, ve a `/users`
2. Haz clic en **"Invitar Usuario"**
3. Completa el formulario y envía
4. **Todos los usuarios de la misma empresa** deberían ver una notificación:
   ```
   🔵 Nuevo usuario invitado
   [Nombre Admin] ha invitado a [Nombre Nuevo Usuario] a unirse al equipo.
   ```

### **Prueba 2: Primer Ingreso de Usuario**

1. El nuevo usuario recibe su correo con contraseña temporal
2. Hace login por primera vez
3. Cambia su contraseña
4. **Todos los usuarios de la empresa** deberían ver:
   ```
   ✅ Nuevo usuario activado
   [Nombre Usuario] ha completado su primer ingreso a la plataforma.
   ```

### **Prueba 3: Crear una Licitación**

1. Como usuario autenticado, ve a `/licitaciones/new`
2. Crea una nueva licitación
3. **Todos los usuarios de la empresa** (excepto tú) deberían ver:
   ```
   🔵 Nueva licitación publicada
   [Tu Nombre] ha publicado la licitación "[Título]" con fecha límite DD/MM/YYYY.
   ```

### **Prueba 4: Crear un Proyecto**

1. Ve a `/projects/new`
2. Crea un nuevo proyecto
3. **Todos los usuarios de la empresa** (excepto tú) deberían ver:
   ```
   🔵 Nuevo proyecto creado
   [Tu Nombre] ha creado el proyecto "[Nombre Proyecto]" con fecha de término DD/MM/YYYY.
   ```

---

## 🔍 Verificación en Consola del Navegador

Abre las **Developer Tools** (F12) y ve a la pestaña **Console**. Deberías ver logs como:

```javascript
🔔 Notification change: {
  eventType: 'INSERT',
  new: { id: '...', title: 'Nueva licitación publicada', ... }
}
```

Esto confirma que Realtime está funcionando correctamente.

---

## 📊 Estructura de la Base de Datos

### **Tabla `notifications`**

| Columna       | Tipo      | Descripción                                           |
|---------------|-----------|-------------------------------------------------------|
| `id`          | UUID      | ID único de la notificación                           |
| `company_id`  | UUID      | ID de la empresa                                      |
| `user_id`     | UUID      | ID del usuario que recibe la notificación            |
| `type`        | TEXT      | Tipo: `info`, `warning`, `success`, `error`           |
| `title`       | TEXT      | Título de la notificación                             |
| `message`     | TEXT      | Mensaje descriptivo                                   |
| `action_url`  | TEXT      | URL opcional para redirección al hacer clic           |
| `read`        | BOOLEAN   | Si la notificación ha sido leída                      |
| `created_at`  | TIMESTAMP | Fecha y hora de creación                              |
| `updated_at`  | TIMESTAMP | Fecha y hora de última actualización                  |

---

## 🛠️ Funciones Disponibles

El sistema incluye las siguientes funciones SQL (llamadas desde TypeScript):

### **1. `create_company_notification()`**
Crea una notificación para todos los usuarios de una empresa.

```sql
SELECT create_company_notification(
  '[company_id]',
  'info',
  'Título de la notificación',
  'Mensaje de la notificación',
  '/url/de/accion',
  '[user_id_a_excluir]'  -- Opcional
);
```

### **2. `mark_notification_as_read()`**
Marca una notificación específica como leída.

```sql
SELECT mark_notification_as_read('[notification_id]');
```

### **3. `mark_all_notifications_as_read()`**
Marca todas las notificaciones del usuario actual como leídas.

```sql
SELECT mark_all_notifications_as_read();
```

### **4. `delete_notification()`**
Elimina una notificación del usuario actual.

```sql
SELECT delete_notification('[notification_id]');
```

---

## 🎨 Componente UI

El componente de notificaciones se encuentra en:
```
/src/components/ui/notifications.tsx
```

### **Características del Componente:**

- ✅ **Realtime Updates**: Se actualiza automáticamente cuando llega una nueva notificación
- ✅ **Badge de Contador**: Muestra el número de notificaciones no leídas
- ✅ **Click en Notificación**: Redirige a la URL de acción y marca como leída
- ✅ **Marcar como Leída**: Botón ✓ para marcar individualmente
- ✅ **Marcar Todas como Leídas**: Botón en el header del dropdown
- ✅ **Eliminar Notificación**: Botón ✕ para eliminar
- ✅ **Modo Mockup**: Usa datos de prueba cuando está en modo demo

---

## 🔐 Seguridad (RLS)

El sistema de notificaciones está protegido por Row Level Security (RLS):

- **SELECT**: Los usuarios solo pueden ver sus propias notificaciones (`user_id = auth.uid()`)
- **UPDATE**: Los usuarios solo pueden actualizar sus propias notificaciones
- **DELETE**: Los usuarios solo pueden eliminar sus propias notificaciones
- **INSERT**: Nadie puede insertar notificaciones manualmente (solo triggers)

---

## 📈 Escalabilidad

### **Rendimiento:**
- Índices optimizados en `user_id`, `company_id`, `read`, y `created_at`
- Queries limitadas a las últimas 20 notificaciones
- Realtime subscription filtrada por usuario

### **Limpieza Automática (Opcional):**
Puedes crear un cron job para eliminar notificaciones antiguas:

```sql
-- Eliminar notificaciones leídas con más de 30 días
DELETE FROM notifications
WHERE read = TRUE
  AND created_at < NOW() - INTERVAL '30 days';
```

---

## 🐛 Troubleshooting

### **Las notificaciones no aparecen:**
1. Verifica que Realtime esté habilitado en la tabla `notifications`
2. Revisa la consola del navegador para ver errores
3. Verifica que el usuario esté autenticado
4. Comprueba que el `company_id` del usuario sea correcto

### **Las notificaciones no son en tiempo real:**
1. Verifica que el canal de Realtime esté suscrito correctamente
2. Revisa si hay errores en la consola
3. Asegúrate de que no estés en modo mockup

### **No puedo marcar notificaciones como leídas:**
1. Verifica que las funciones RPC estén creadas en Supabase
2. Comprueba que el usuario tenga permisos RLS
3. Revisa la consola para ver errores específicos

---

## 🎯 Próximas Mejoras (Roadmap)

- [ ] Notificaciones push (web push notifications)
- [ ] Notificaciones por email
- [ ] Configuración de preferencias de notificaciones por usuario
- [ ] Filtros por tipo de notificación
- [ ] Historial completo de notificaciones (más de 20)
- [ ] Agrupación de notificaciones similares
- [ ] Notificaciones para más eventos (vencimientos, aprobaciones, etc.)

---

## 📞 Soporte

Si tienes problemas con el sistema de notificaciones, revisa:
1. La consola del navegador (F12)
2. Los logs de Supabase (Dashboard > Logs)
3. Las políticas RLS de la tabla `notifications`
4. La suscripción de Realtime

---

**¡Sistema de Notificaciones implementado exitosamente!** 🎉

