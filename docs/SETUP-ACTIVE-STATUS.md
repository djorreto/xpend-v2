# Configuración del Sistema de Habilitación/Inhabilitación

## 📋 Resumen

Este documento describe cómo configurar el sistema de habilitación/inhabilitación de empresas y usuarios en Xpend V2.

---

## 🗄️ **1. Aplicar Migración SQL en Supabase**

### Pasos:

1. Ve a tu proyecto de Supabase: https://supabase.com/dashboard
2. Click en **SQL Editor** (barra lateral izquierda)
3. Click en **New Query**
4. Copia y pega el contenido del archivo: `/database/migrations/add-active-status-fields.sql`
5. Click en **RUN** (Cmd+Enter)

### Lo que hace el script:

- ✅ Agrega campo `is_active` (BOOLEAN) a la tabla `companies`
- ✅ Agrega campo `is_active` (BOOLEAN) a la tabla `profiles`
- ✅ Crea índices para optimización de consultas
- ✅ Crea función `can_user_access(user_id)` para verificar acceso
- ✅ Crea vista `user_access_status` para monitoreo

### Valores por defecto:

- Todas las empresas existentes: `is_active = TRUE`
- Todos los usuarios existentes: `is_active = TRUE`

---

## 🔒 **2. Lógica de Acceso**

### Reglas de Acceso:

Un usuario puede acceder a Xpend **SOLO SI**:

1. ✅ El usuario está activo (`profiles.is_active = TRUE`)
2. ✅ **Y** su empresa está activa (`companies.is_active = TRUE`)
3. ✅ **O** el usuario no tiene empresa asignada (solo verifica su estado)

### Función SQL `can_user_access(user_id)`:

```sql
SELECT can_user_access('user-uuid-here');
-- Retorna: TRUE si puede acceder, FALSE si está bloqueado
```

### Vista `user_access_status`:

```sql
SELECT * FROM user_access_status;
-- Muestra todos los usuarios con su estado compuesto
```

---

## 🎯 **3. Uso en Super Admin**

### Habilitar/Inhabilitar Empresas:

1. Ir a **Super Admin** → Tab **Empresas**
2. Click en el botón con ícono de prohibición (🚫) o check (✓)
3. Confirmar acción
4. **Efecto**: Todos los usuarios de esa empresa quedan bloqueados/desbloqueados

### Habilitar/Inhabilitar Usuarios:

1. Ir a **Super Admin** → Tab **Usuarios**
2. Click en el botón con ícono de prohibición (🚫) o check (✓)
3. Confirmar acción
4. **Efecto**: El usuario queda bloqueado/desbloqueado individualmente

### Visual:

- **Activo**: Badge verde con ícono de check ✓
- **Inactivo**: Badge rojo con ícono de prohibición 🚫, fondo gris claro

---

## 🔐 **4. Verificación en Login**

### En el cliente (`src/app/login/page.tsx` u otro):

Después del login exitoso, verifica el estado:

```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('is_active, company_id')
  .eq('id', user.id)
  .single()

if (!profile.is_active) {
  // Usuario inhabilitado
  await supabase.auth.signOut()
  throw new Error('Tu cuenta ha sido inhabilitada. Contacta al administrador.')
}

if (profile.company_id) {
  const { data: company } = await supabase
    .from('companies')
    .select('is_active')
    .eq('id', profile.company_id)
    .single()

  if (!company?.is_active) {
    // Empresa inhabilitada
    await supabase.auth.signOut()
    throw new Error('Tu empresa ha sido inhabilitada. Contacta al administrador.')
  }
}
```

### Usando la función SQL:

```typescript
const { data } = await supabase
  .rpc('can_user_access', { user_id: user.id })

if (!data) {
  await supabase.auth.signOut()
  throw new Error('No tienes acceso a Xpend en este momento.')
}
```

---

## 📊 **5. Monitoreo**

### Ver todos los usuarios y su estado de acceso:

```sql
SELECT
  full_name,
  email,
  role,
  user_is_active,
  company_name,
  company_is_active,
  can_access
FROM user_access_status
ORDER BY can_access DESC, full_name;
```

### Contar usuarios bloqueados:

```sql
SELECT
  COUNT(*) FILTER (WHERE NOT can_access) as blocked_users,
  COUNT(*) FILTER (WHERE can_access) as active_users
FROM user_access_status;
```

---

## ⚠️ **IMPORTANTE:**

1. **Super Admins**: Aunque estén inactivos, pueden tener acceso especial (opcional, configurable)
2. **Usuarios sin empresa**: Solo se verifica su estado individual
3. **RLS**: Asegúrate de que las políticas RLS respeten `is_active`
4. **Auditoría**: Considera agregar logs de cambios de estado

---

## 🐛 **Troubleshooting**

### Problema: Usuario no puede acceder pero debería

```sql
-- Verificar estado del usuario
SELECT id, email, is_active, company_id FROM profiles WHERE email = 'usuario@ejemplo.com';

-- Verificar estado de la empresa
SELECT id, name, is_active FROM companies WHERE id = 'company-uuid';

-- Usar función de verificación
SELECT can_user_access('user-uuid');
```

### Solución: Reactivar manualmente

```sql
-- Reactivar usuario
UPDATE profiles SET is_active = TRUE WHERE id = 'user-uuid';

-- Reactivar empresa
UPDATE companies SET is_active = TRUE WHERE id = 'company-uuid';
```

---

¡Configuración completada! 🎉

