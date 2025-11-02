# 🚀 Guía de Deployment - Demo Privada

## Objetivo
Subir Xpend como demo para compartir, **SIN que aparezca en Google**.

---

## Paso 1️⃣: Preparar el proyecto

### 1.1 Crear archivo `.env.production`
Crea este archivo en la raíz del proyecto (mismo nivel que `package.json`):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# Groq (IA)
GROQ_API_KEY=tu_groq_api_key
```

### 1.2 Agregar `robots.txt` para bloquear indexación
Crea el archivo `public/robots.txt`:

```txt
User-agent: *
Disallow: /

# Bloquear todos los bots de búsqueda
User-agent: Googlebot
Disallow: /

User-agent: Bingbot
Disallow: /
```

### 1.3 Verificar `.gitignore`
Asegúrate de que `.env.production` esté en tu `.gitignore`:

```
.env
.env.local
.env.production
.env*.local
```

---

## Paso 2️⃣: Subir a GitHub

```bash
# Si aún no has hecho commit de los últimos cambios:
git add .
git commit -m "Preparar para deployment - versión demo"
git push origin main
```

---

## Paso 3️⃣: Deployment en Vercel (GRATIS)

### 3.1 Crear cuenta en Vercel
1. Ve a [vercel.com](https://vercel.com)
2. Haz clic en **"Sign Up"**
3. **Conecta con GitHub** (opción recomendada)

### 3.2 Importar proyecto
1. En el dashboard de Vercel, haz clic en **"Add New..."** → **"Project"**
2. Selecciona tu repositorio de GitHub (`Xpend V2 - Desarrollo`)
3. Vercel detectará automáticamente que es Next.js ✅

### 3.3 Configurar variables de entorno
**IMPORTANTE:** Antes de hacer deploy, agrega tus variables de entorno:

1. En la sección **"Environment Variables"**, agrega:
   - `NEXT_PUBLIC_SUPABASE_URL` = `tu_url`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `tu_key`
   - `SUPABASE_SERVICE_ROLE_KEY` = `tu_service_key`
   - `GROQ_API_KEY` = `tu_groq_key`

2. Asegúrate de que estén marcadas para **Production**, **Preview** y **Development**

### 3.4 Deploy
1. Haz clic en **"Deploy"**
2. Espera 2-3 minutos ⏱️
3. ¡Listo! Tu demo estará en: `https://tu-proyecto.vercel.app`

---

## Paso 4️⃣: Bloquear indexación (100% privado)

### Opción A: Agregar meta tags (Ya implementado)
Verifica que en `src/app/layout.tsx` tengas:

```tsx
export const metadata = {
  title: 'Xpend - ...',
  description: '...',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    }
  }
}
```

### Opción B: Protección con contraseña (RECOMENDADO para demo)
Vercel permite agregar **password protection** GRATIS:

1. Ve a tu proyecto en Vercel
2. **Settings** → **Deployment Protection**
3. Activa **"Password Protection"**
4. Crea una contraseña
5. Ahora solo quien tenga la contraseña puede ver tu demo 🔒

**Ventaja:** Puedes compartir el link + contraseña solo con quien quieras.

---

## Paso 5️⃣: Compartir tu demo

Tu demo estará en una URL tipo:
```
https://xpend-v2-desarrollo.vercel.app
```

**Si activaste password protection:**
- Comparte: `https://tu-demo.vercel.app`
- Contraseña: `tu_password_secreto`

---

## 🔄 Actualizaciones futuras

Cada vez que hagas `git push` a tu rama principal:
- Vercel **automáticamente** hará re-deploy
- En 2-3 minutos tu demo estará actualizada
- Sin hacer nada más 🚀

---

## ✅ Checklist Final

Antes de compartir tu demo, verifica:

- [ ] Variables de entorno configuradas en Vercel
- [ ] `robots.txt` en `public/robots.txt` bloqueando indexación
- [ ] (Opcional) Password protection activado
- [ ] Probaste que la demo funciona correctamente
- [ ] Base de datos Supabase tiene datos de ejemplo (seed data)

---

## 🆘 Solución de Problemas

### Error: "Module not found"
- Verifica que todas las dependencias estén en `package.json`
- Vercel hace `npm install` automáticamente

### Error: "Environment variable not found"
- Ve a Settings → Environment Variables en Vercel
- Agrega las variables que faltan
- Haz **Redeploy**

### La página se ve rota
- Revisa los logs en Vercel (pestaña "Deployments" → click en el deployment → "View Function Logs")
- Probablemente falta una variable de entorno

---

## 📊 Alternativas a Vercel

Si prefieres otra opción:

1. **Netlify** (también gratis, similar a Vercel)
2. **Railway** (si necesitas base de datos incluida)
3. **Render** (opción más completa)

Pero Vercel es la más rápida y optimizada para Next.js.

---

¡Listo! Con esto tendrás tu demo online en menos de 10 minutos. 🎉

