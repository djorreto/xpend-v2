# 🤖 JUAN XPENDO - ASISTENTE DE IA

**Juan Xpendo** es el asistente experto en Strategic Sourcing integrado en Xpend. Utiliza **Vercel AI SDK + Groq (LLama 3.1 70B)** para proporcionar asesoría en tiempo real.

---

## ✨ FUNCIONALIDADES

### **1. Chat en Tiempo Real**
- ✅ Chat flotante siempre disponible (esquina inferior derecha)
- ✅ Respuestas en streaming (efecto de escritura en vivo)
- ✅ Contexto de conversación (recuerda los últimos 5 mensajes)
- ✅ Persistencia en Supabase (historial guardado)

### **2. Análisis de Documentos**
- ✅ Sube especificaciones técnicas (Word `.docx` o `.txt`)
- ✅ Análisis automático de completitud
- ✅ Detección de puntos fuertes y débiles
- ✅ Recomendaciones de mejora
- ✅ Evaluación de riesgo

### **3. Conocimiento Experto**
Juan Xpendo tiene conocimiento en:
- 📊 Estrategia de categorías (Category Management)
- 📈 Análisis de líneas base (baseline analysis)
- 💰 Cálculo de ahorros (savings tracking)
- 📝 Especificaciones técnicas de bienes y servicios
- 🔍 Procesos de RFP, RFQ, RFI
- 🤝 Negociación estratégica con proveedores
- 💲 Total Cost of Ownership (TCO)
- ⚠️ Gestión de riesgos en la cadena de suministro
- 📊 KPIs de sourcing y procurement

---

## 🚀 CONFIGURACIÓN (PASO A PASO)

### **PASO 1: Obtener API Key de Groq (GRATIS)**

1. **Ir a Groq Cloud:**
   - 🔗 https://console.groq.com

2. **Crear cuenta:**
   - Click en "Sign Up" (puedes usar tu email o GitHub)
   - Verifica tu email

3. **Generar API Key:**
   - Una vez dentro del dashboard, ve a **"API Keys"** en el menú lateral
   - Click en **"Create API Key"**
   - Dale un nombre (ej: "Xpend - Juan Xpendo")
   - Click en **"Create"**
   - **COPIA LA KEY** (solo se muestra una vez)
   - Formato: `gsk_...` (comienza con `gsk_`)

4. **Límites GRATIS de Groq:**
   ```
   ✅ 30 requests/minute
   ✅ 14,400 tokens/minute
   ✅ Sin límite de requests totales
   ✅ Sin tarjeta de crédito requerida
   ✅ Modelo: Llama 3.1 70B (ultra rápido)
   ```

---

### **PASO 2: Configurar Variables de Entorno**

1. **Abrir tu archivo `.env.local`:**
   ```bash
   # En la raíz del proyecto
   open .env.local
   ```

2. **Agregar la API Key de Groq:**
   ```env
   # Groq AI (Para Juan Xpendo - Asistente de Sourcing)
   GROQ_API_KEY=gsk_TU_API_KEY_AQUI
   ```

3. **Guardar el archivo**.

---

### **PASO 3: Crear Tabla en Supabase**

1. **Ir a Supabase Dashboard:**
   - 🔗 https://app.supabase.com
   - Selecciona tu proyecto Xpend

2. **Abrir SQL Editor:**
   - Click en **"SQL Editor"** en el menú lateral
   - Click en **"New query"**

3. **Copiar y pegar el siguiente script:**
   ```bash
   # Desde la terminal del proyecto:
   cat database/migrations/create-juan-xpendo-chat-history.sql | pbcopy
   ```

   O abre el archivo:
   ```
   database/migrations/create-juan-xpendo-chat-history.sql
   ```

4. **Ejecutar el script:**
   - Pega el contenido en el SQL Editor
   - Click en **"Run"** (o presiona `Cmd/Ctrl + Enter`)
   - Deberías ver: ✅ "Success. No rows returned"

5. **Verificar que la tabla se creó:**
   - Ve a **"Table Editor"**
   - Busca la tabla **`chat_history`**
   - Deberías ver las columnas: `id`, `user_id`, `user_message`, `assistant_message`, `created_at`

---

### **PASO 4: Reiniciar el servidor de desarrollo**

1. **Detener el servidor actual:**
   ```bash
   # Presiona Ctrl+C en la terminal donde corre npm run dev
   ```

2. **Reiniciar:**
   ```bash
   npm run dev
   ```

3. **Verificar que cargó la variable:**
   - Abre tu app: http://localhost:3000
   - Deberías ver el botón flotante de Juan Xpendo en la esquina inferior derecha

---

## 🧪 PROBAR JUAN XPENDO

### **Test 1: Chat Básico**

1. Click en el botón flotante (esquina inferior derecha)
2. Escribe: `"¿Qué es una línea base en sourcing?"`
3. Deberías ver la respuesta en tiempo real (streaming)

### **Test 2: Análisis de Documento**

1. Crea un archivo de texto `.txt` con este contenido:
   ```
   Especificación Técnica: Compra de Notebooks

   Cantidad: 50 unidades
   Procesador: Intel Core i7
   RAM: 16GB
   Almacenamiento: 512GB SSD
   ```

2. Click en "Subir Doc (.docx, .txt)"
3. Selecciona el archivo
4. Juan analizará el documento y te dirá qué falta (ej: garantía, plazo de entrega, criterios de evaluación, etc.)

### **Test 3: Pregunta Compleja**

1. Pregunta: `"¿Cómo calculo el TCO de un contrato de servicios?"`
2. Juan debería darte una respuesta detallada con pasos, ejemplos, y mejores prácticas

---

## 🔧 SOLUCIÓN DE PROBLEMAS

### **Problema 1: "No pude generar una respuesta"**

**Causa:** La API key de Groq no está configurada o es inválida.

**Solución:**
1. Verifica que `.env.local` tiene `GROQ_API_KEY=gsk_...`
2. Verifica que la key es válida (copiada correctamente)
3. Reinicia el servidor: `npm run dev`

---

### **Problema 2: "Error al analizar el documento"**

**Causa:** Formato de archivo no soportado o archivo vacío.

**Solución:**
- Solo se aceptan `.docx` (Word) y `.txt` (texto plano)
- El archivo debe tener al menos 50 caracteres
- Máximo 5MB de tamaño

---

### **Problema 3: El chat no aparece**

**Causa:** Error al importar el componente.

**Solución:**
1. Verifica que instalaste las dependencias:
   ```bash
   npm install ai @ai-sdk/openai mammoth pdf-parse
   ```
2. Verifica que `JuanXpendoChat` está importado en `MainLayout`
3. Revisa la consola del navegador (F12) por errores

---

## 💰 COSTOS Y LÍMITES

### **Groq (Gratis - Plan Actual)**
```
✅ GRATIS para siempre
✅ 30 requests/minuto
✅ 14,400 tokens/minuto
✅ Sin límite mensual
✅ Sin tarjeta de crédito

Estimación de uso:
- 1 mensaje de Juan Xpendo = ~500 tokens
- 30 mensajes por minuto = 15,000 tokens
- Capacidad: ~30 conversaciones/minuto
```

### **Cuando escalar (Futuro)**
Si necesitas más velocidad o features premium:
- **OpenAI GPT-4o:** $5/1M tokens (~$0.005 por mensaje)
- **Anthropic Claude 3.5:** $3/1M tokens (~$0.003 por mensaje)
- **Google Gemini Pro:** Gratis hasta 15 req/min, luego $0.50/1M tokens

**Para cambiar de provider (1 línea de código):**
```typescript
// En src/lib/ai.ts, cambiar:
const model = groq('llama-3.1-70b-versatile')

// Por:
const model = openai('gpt-4o') // o anthropic('claude-3-5-sonnet')
```

---

## 📊 MONITOREO DE USO

### **Ver historial de chat en Supabase:**

1. Ve a **Table Editor** → `chat_history`
2. Verás todos los mensajes guardados
3. Filtra por `user_id` para ver el historial de un usuario específico

### **Limpiar historial antiguo (opcional):**

```sql
-- Ejecutar en Supabase SQL Editor
SELECT cleanup_old_chat_history();
```

Esto elimina conversaciones de más de 30 días.

---

## 🎯 PRÓXIMAS MEJORAS

Ideas para el futuro:
- [ ] **RAG (Retrieval Augmented Generation):** Entrenar a Juan con documentos específicos de tu empresa
- [ ] **Generación de specs:** Juan puede redactar especificaciones técnicas completas
- [ ] **Análisis de proveedores:** Subir ofertas de proveedores y que Juan las compare
- [ ] **Recomendación de ahorros:** Juan analiza tu spend y sugiere oportunidades
- [ ] **Voice chat:** Hablar con Juan por voz
- [ ] **Integración con Licitaciones:** Juan puede sugerir proveedores para una licitación

---

## 📚 RECURSOS ADICIONALES

- **Groq Documentation:** https://console.groq.com/docs
- **Vercel AI SDK Docs:** https://sdk.vercel.ai/docs
- **Llama 3.1 70B Info:** https://www.llama.com/llama3-1/

---

## ✅ CHECKLIST DE SETUP

- [ ] Cuenta creada en Groq Cloud
- [ ] API Key de Groq obtenida
- [ ] `GROQ_API_KEY` agregada a `.env.local`
- [ ] Script SQL ejecutado en Supabase
- [ ] Tabla `chat_history` creada
- [ ] Dependencias instaladas (`npm install ai @ai-sdk/openai mammoth`)
- [ ] Servidor reiniciado
- [ ] Test de chat básico funcionando
- [ ] Test de análisis de documento funcionando

---

**¿Listo para conversar con Juan? 🚀**

¡Abre tu app y haz click en el botón flotante!

