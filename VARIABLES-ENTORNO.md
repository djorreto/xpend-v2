# 🔐 Variables de Entorno - Xpend V2

## 📋 TODAS LAS VARIABLES NECESARIAS

Copia y pega estas variables en Vercel (o tu plataforma de deployment):

### 1️⃣ SUPABASE - Base de Datos (REQUERIDO)

```
NEXT_PUBLIC_SUPABASE_URL
```

**Valor:** `https://tu-proyecto.supabase.co`
**Dónde obtenerlo:** Supabase Dashboard → Settings → API → Project URL

---

```
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

**Valor:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (es MUY largo)
**Dónde obtenerlo:** Supabase Dashboard → Settings → API → Project API keys → `anon` `public`

---

```
SUPABASE_SERVICE_ROLE_KEY
```

**Valor:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (es MUY largo)
**Dónde obtenerlo:** Supabase Dashboard → Settings → API → Project API keys → `service_role` `secret`
⚠️ **IMPORTANTE:** Esta es una clave SECRETA. Solo úsala en el backend (API routes)

---

### 2️⃣ GROQ AI - Inteligencia Artificial (REQUERIDO)

```
GROQ_API_KEY
```

**Valor:** `gsk_xxxxxxxxxxxxxxxxxxxxx`
**Dónde obtenerlo:** https://console.groq.com/keys → Create API Key
**Para qué se usa:**

- Juan Xpendo (chat AI)
- Sourcing Intelligence (clasificación automática)
- RFx Maker (generación de base técnica)

---

## 🎯 RESUMEN RÁPIDO PARA COPIAR/PEGAR

Para Vercel, necesitas agregar estas **4 variables**:

| Key                             | ¿Público?       | ¿Dónde se usa?            |
| ------------------------------- | --------------- | ------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | ✅ Sí           | Frontend y Backend        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Sí           | Frontend y Backend        |
| `SUPABASE_SERVICE_ROLE_KEY`     | ❌ NO (Secreto) | Solo Backend (API routes) |
| `GROQ_API_KEY`                  | ❌ NO (Secreto) | Solo Backend (API routes) |

---

## 📸 CÓMO OBTENER LOS VALORES

### Supabase:

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Click en **Settings** (⚙️) en la barra lateral
4. Click en **API**
5. Copia:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ revela primero)

### Groq AI:

1. Ve a https://console.groq.com/keys
2. Click en **Create API Key**
3. Dale un nombre (ej: "Xpend Production")
4. Copia la key → `GROQ_API_KEY`

---

## 🚀 CÓMO AGREGAR EN VERCEL

1. Ve a tu proyecto en Vercel
2. Click en **Settings**
3. Click en **Environment Variables**
4. Para cada variable:
   - **Key:** Nombre de la variable (ej: `GROQ_API_KEY`)
   - **Value:** El valor correspondiente
   - **Environment:** Selecciona **Production, Preview, Development** (todas)
5. Click en **Add** o **Save**

---

## ✅ CHECKLIST

Antes de hacer deploy, verifica que tengas:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` configurada
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configurada
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurada
- [ ] `GROQ_API_KEY` configurada
- [ ] Base de datos de Supabase con todas las tablas (schema aplicado)
- [ ] RLS (Row Level Security) configurado en Supabase
- [ ] Dominio personalizado configurado (opcional)

---

## 🔧 PARA DESARROLLO LOCAL

Si quieres correr el proyecto localmente, crea un archivo `.env.local` en la raíz:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
GROQ_API_KEY=gsk_tu-groq-key
```

⚠️ **NUNCA subas el archivo `.env.local` a GitHub** (ya está en `.gitignore`)

---

## ❓ PREGUNTAS FRECUENTES

**P: ¿Son gratuitas estas cuentas?**
R: Sí, ambas tienen tier gratuito:

- Supabase: 500MB storage, 2GB bandwidth
- Groq: 14,400 requests/día (muy generoso)

**P: ¿Qué pasa si no configuro GROQ_API_KEY?**
R: Estas funcionalidades NO funcionarán:

- Juan Xpendo (chat AI)
- Sourcing Intelligence (clasificación)
- RFx Maker (generación técnica)

**P: ¿Puedo usar diferentes valores para development/production?**
R: Sí, en Vercel puedes especificar valores diferentes por ambiente.

---

**📅 Última actualización:** 1 de Noviembre, 2025
**📧 Soporte:** Consulta la documentación en `/docs`
