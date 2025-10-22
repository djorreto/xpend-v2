# 💬 Juan Xpendo - Historial de Conversaciones

## 🎯 ¿Qué hace este setup?

Actualmente, las conversaciones con Juan Xpendo **se pierden al recargar la página**.
Este script crea una tabla `chat_history` en Supabase para **persistir el historial** de conversaciones.

---

## ⚡ APLICAR EN 2 PASOS

### **Paso 1: Ejecutar SQL en Supabase**

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. En el menú lateral → **SQL Editor**
3. Click en **"New Query"**
4. **Copia y pega** el contenido completo de:
   ```
   database/migrations/create-juan-xpendo-chat-history.sql
   ```
5. Click en **"Run"** (▶️)
6. Deberías ver:
   ```
   Success. No rows returned
   ```

---

### **Paso 2: Verificar que funciona**

Abre una nueva consulta en SQL Editor y ejecuta:

```sql
-- Ver la tabla creada
SELECT * FROM chat_history LIMIT 10;

-- Debería devolver 0 filas (aún no hay historial)
```

---

## 🔍 ¿Cómo funciona?

Una vez aplicado el script:

✅ **Cada conversación con Juan se guarda automáticamente**
✅ **Solo el usuario puede ver su propio historial** (RLS protegido)
✅ **Índices optimizados** para cargar rápido el historial
✅ **Función de limpieza** incluida (elimina chats > 30 días)

---

## 🧪 Probar el Historial

Después de aplicar el SQL:

1. Ve a `http://localhost:3000/dashboard`
2. Abre el chat de Juan Xpendo (botón flotante)
3. **Haz una pregunta a Juan**
4. **Recarga la página** (Cmd+R / Ctrl+R)
5. **Abre el chat de nuevo** → ✅ Tu conversación debería estar ahí

---

## 🗑️ Limpiar historial antiguo (opcional)

Para eliminar conversaciones mayores a 30 días, ejecuta en SQL Editor:

```sql
SELECT cleanup_old_chat_history();
```

O configura un **Database Webhook** o **Edge Function** para que se ejecute automáticamente cada mes.

---

## 📦 Tablas creadas

| Tabla          | Descripción                               |
|----------------|-------------------------------------------|
| `chat_history` | Historial de mensajes con Juan Xpendo    |

---

## 🔐 Seguridad (RLS)

- ✅ Usuarios solo ven **su propio historial**
- ✅ No pueden modificar mensajes de otros
- ✅ Pueden eliminar su propio historial

---

## 🚀 ¡Listo!

Una vez aplicado, **Juan Xpendo recordará tus conversaciones** entre sesiones.

---

**Última actualización:** 21 de octubre de 2025
**Versión Xpend:** v2.0.0

