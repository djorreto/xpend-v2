# Configuración de Supabase para Spendora

## 🚨 Problema Actual
El login no funciona porque Supabase no está configurado. Necesitas crear un proyecto de Supabase y configurar las variables de entorno.

## 📋 Pasos para Configurar Supabase

### 1. Crear Proyecto en Supabase
1. Ve a [https://supabase.com](https://supabase.com)
2. Haz clic en "Start your project"
3. Crea una cuenta o inicia sesión
4. Haz clic en "New Project"
5. Completa la información:
   - **Name**: `spendora-v1`
   - **Database Password**: (guarda esta contraseña)
   - **Region**: Elige la más cercana a ti
6. Haz clic en "Create new project"

### 2. Obtener las Variables de Entorno
1. En tu proyecto de Supabase, ve a **Settings** → **API**
2. Copia estos valores:
   - **Project URL** (NEXT_PUBLIC_SUPABASE_URL)
   - **anon public** key (NEXT_PUBLIC_SUPABASE_ANON_KEY)

### 3. Configurar Variables de Entorno
1. En la raíz del proyecto, crea un archivo `.env.local`
2. Agrega estas líneas:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_project_url_aqui
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

### 4. Configurar la Base de Datos
1. En Supabase, ve a **SQL Editor**
2. Copia y pega el contenido de `supabase-schema.sql`
3. Ejecuta el script para crear las tablas

### 5. Configurar Storage
1. En Supabase, ve a **Storage**
2. Ejecuta el script de `setup-supabase.sql` en el **SQL Editor**

## 🧪 Probar el Login

### Opción 1: Crear Usuario de Prueba
1. Ve a `localhost:3002/login`
2. Haz clic en "Crear Usuario de Prueba"
3. Usa las credenciales: `test@spendora.com` / `test123456`

### Opción 2: Registro Manual
1. Ve a `localhost:3002/signup`
2. Crea una cuenta nueva
3. Haz login con tus credenciales

## 🔧 Solución Rápida (Temporal)
Si quieres probar la aplicación sin configurar Supabase:

1. Ve a `src/app/login/page.tsx`
2. Comenta las líneas de verificación de Supabase
3. Usa el modo "Mock-up" en la aplicación

## 📞 ¿Necesitas Ayuda?
Si tienes problemas:
1. Revisa la consola del navegador (F12)
2. Verifica que las variables de entorno estén correctas
3. Asegúrate de que el proyecto de Supabase esté activo

