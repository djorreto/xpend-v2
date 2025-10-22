# 🚀 Notificaciones - Quick Start

## ⚡ Setup Rápido (5 minutos)

### 1️⃣ Ejecutar SQL en Supabase
```
1. Abrir: https://app.supabase.com
2. Ir a: SQL Editor
3. Copiar: database/migrations/create-notifications-system.sql
4. Pegar y ejecutar (Run)
```

### 2️⃣ Habilitar Realtime
```
1. Ir a: Database > Replication
2. Buscar tabla: notifications
3. Activar toggle de Realtime
4. Guardar
```

### 3️⃣ ¡Listo! Prueba creando:
- ✅ Un nuevo usuario (en `/users`)
- ✅ Una licitación (en `/licitaciones/new`)
- ✅ Un proyecto (en `/projects/new`)

**Todos los usuarios de tu empresa recibirán una notificación instantánea** 🔔

---

## 📝 ¿Qué eventos generan notificaciones?

| Evento | ¿A quién notifica? | Tipo |
|--------|-------------------|------|
| **Nuevo usuario invitado** | Todos (excepto el nuevo usuario) | 🔵 Info |
| **Usuario hizo primer login** | Todos (excepto el usuario) | ✅ Success |
| **Nueva licitación creada** | Todos (excepto el creador) | 🔵 Info |
| **Nuevo proyecto creado** | Todos (excepto el creador) | 🔵 Info |

---

## 🔧 Funcionalidades

- ✅ **Tiempo Real**: Las notificaciones aparecen instantáneamente
- ✅ **Clickeables**: Haz clic para ir a la página relacionada
- ✅ **Marcar como leída**: Individual o todas a la vez
- ✅ **Eliminar**: Borra notificaciones individualmente
- ✅ **Contador**: Badge con el número de notificaciones no leídas
- ✅ **Modo Demo**: Funciona con datos mock en modo mockup

---

## 📚 Documentación Completa

Ver: `/docs/SETUP-NOTIFICATIONS.md`

---

## 🎯 Testing Rápido

1. Abre dos ventanas de navegador (o usa modo incógnito)
2. Inicia sesión con dos usuarios diferentes de la misma empresa
3. Crea un proyecto desde el Usuario 1
4. **¡El Usuario 2 verá la notificación aparecer instantáneamente!** 🎉

---

**¿Problemas?** Revisa la consola del navegador (F12) y verifica que Realtime esté habilitado.

