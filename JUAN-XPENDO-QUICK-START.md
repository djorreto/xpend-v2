# 🚀 JUAN XPENDO - QUICK START

**Setup en 5 minutos** 🤖

---

## ✅ PASO 1: API KEY DE GROQ (1 min)

1. Ve a: **https://console.groq.com**
2. Click **"Sign Up"** (email o GitHub)
3. Ve a **"API Keys"** → **"Create API Key"**
4. Copia la key (formato: `gsk_...`)

**✅ Es GRATIS para siempre** (sin tarjeta de crédito)

---

## ✅ PASO 2: CONFIGURAR .ENV.LOCAL (30 seg)

Agrega al final de tu archivo `.env.local`:

```env
# Groq AI (Para Juan Xpendo - Asistente de Sourcing)
GROQ_API_KEY=gsk_TU_API_KEY_AQUI
```

**⚠️ Reemplaza `gsk_TU_API_KEY_AQUI` con tu key real**

---

## ✅ PASO 3: SUPABASE SQL (1 min)

1. Ve a: **https://app.supabase.com** → Tu proyecto
2. Click **"SQL Editor"** → **"New query"**
3. **Copia y pega esto:**

```bash
# Desde tu terminal (esto copia el SQL):
cat database/migrations/create-juan-xpendo-chat-history.sql | pbcopy
```

4. **Pega en Supabase SQL Editor** y presiona **"Run"**
5. Deberías ver: ✅ **"Success. No rows returned"**

---

## ✅ PASO 4: REINICIAR SERVIDOR (30 seg)

```bash
# En tu terminal:
# 1. Detener el servidor actual (Ctrl+C)
# 2. Reiniciar:
npm run dev
```

---

## ✅ PASO 5: PROBAR (30 seg)

1. Abre: **http://localhost:3000/dashboard**
2. Verás el botón flotante de Juan Xpendo (esquina inferior derecha)
3. **Click** en el botón
4. Escribe: `"¿Qué es una línea base en sourcing?"`
5. ✅ **Deberías ver la respuesta en tiempo real**

---

## 🎯 TEST DE ANÁLISIS DE DOCUMENTO

1. Crea un archivo `test-spec.txt` con:
   ```
   Especificación Técnica: Compra de Notebooks

   Cantidad: 50 unidades
   Procesador: Intel Core i7
   RAM: 16GB
   Almacenamiento: 512GB SSD
   ```

2. En el chat de Juan, click en **"Subir Doc"**
3. Selecciona el archivo
4. Juan analizará y dirá qué falta (garantía, plazo, criterios, etc.)

---

## ❌ PROBLEMAS?

### **"No pude generar una respuesta"**
→ Verifica que `GROQ_API_KEY` está en `.env.local` y reinicia el servidor

### **El chat no aparece**
→ Ejecuta: `npm install ai @ai-sdk/openai mammoth pdf-parse`

### **Error al analizar documento**
→ Solo acepta `.docx` (Word) y `.txt` (texto plano), máx 5MB

---

## 📖 DOCUMENTACIÓN COMPLETA

Ver: `docs/JUAN-XPENDO-SETUP.md`

---

**¡Listo para conversar con Juan! 🚀**

