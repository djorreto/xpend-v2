# 🧠 SOURCING INTELLIGENCE - Guía de Implementación Completa

**Versión:** 2.1.0
**Fecha:** 21 de Octubre de 2025
**Módulo:** Sourcing Intelligence con IA

---

## 📋 RESUMEN EJECUTIVO

Este módulo amplía Xpend con capacidades de **análisis inteligente de gasto** usando IA:

1. **Carga de archivos Excel/CSV** con órdenes de compra
2. **Clasificación automática por IA** (categorías con nivel de confianza)
3. **Revisión y corrección humana** (sistema de aprendizaje)
4. **Generación automática de Plan de Compras** con estrategias sugeridas
5. **Matriz de Kraljic interactiva** (impacto vs riesgo)
6. **Sistema de aprendizaje continuo** (reglas y patrones)

---

## 🎯 ARQUITECTURA DEL MÓDULO

```
/sourcing-intelligence
├── /upload           → Vista 1: Carga y mapeo de Excel/CSV
├── /[id]/classify    → Vista 2: Revisión de clasificaciones IA
├── /[id]/plan        → Vista 3: Plan de Compras preliminar
├── /[id]/kraljic     → Vista 4: Matriz de Kraljic
├── /learning-rules   → Vista 5: Reglas aprendidas

API Routes:
├── /api/si/upload              → Procesar archivo Excel/CSV
├── /api/si/classify            → Clasificar líneas con IA
├── /api/si/classify-batch      → Clasificar múltiples líneas
├── /api/si/generate-plan       → Generar plan de compras
├── /api/si/calculate-kraljic   → Calcular matriz Kraljic
├── /api/si/learning-rules      → CRUD de reglas
└── /api/si/update-classification → Guardar corrección humana
```

---

## 📦 DEPENDENCIAS NECESARIAS

Agregar a `package.json`:

```json
{
  "dependencies": {
    "xlsx": "^0.18.5",
    "papaparse": "^5.4.1",
    "recharts": "^2.10.3",
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/utilities": "^3.2.2"
  },
  "devDependencies": {
    "@types/papaparse": "^5.3.14"
  }
}
```

Instalar:
```bash
npm install xlsx papaparse recharts @dnd-kit/core @dnd-kit/utilities
npm install -D @types/papaparse
```

---

## 🗄️ FASE 1: BASE DE DATOS

### **1.1. Aplicar SQL en Supabase**

```bash
# Archivo: database/migrations/create-sourcing-intelligence.sql
```

Ya creado ✅. Aplicar en Supabase SQL Editor.

**Tablas creadas:**
- `si_uploads` - Archivos cargados
- `si_spend_lines` - Líneas de gasto
- `si_categories` - Categorías con Kraljic
- `si_learning_rules` - Reglas aprendidas
- `si_procurement_plans` - Planes generados
- `si_plan_items` - Líneas del plan

---

## 🔧 FASE 2: API ROUTES

### **2.1. API de Carga de Archivos**

`src/app/api/si/upload/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // 1. Autenticación
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // 2. Obtener perfil y company_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, company_id, role')
      .eq('id', session.user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    // 3. Obtener archivo del form
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }

    // 4. Leer archivo (Excel o CSV)
    const buffer = await file.arrayBuffer()
    let rows: any[] = []
    let columns: string[] = []

    if (file.name.endsWith('.csv')) {
      // Procesar CSV
      const text = new TextDecoder().decode(buffer)
      const parsed = Papa.parse(text, { header: true })
      rows = parsed.data
      columns = parsed.meta.fields || []
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      // Procesar Excel
      const workbook = XLSX.read(buffer)
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      rows = XLSX.utils.sheet_to_json(sheet)

      // Obtener nombres de columnas
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + '1'
        columns.push(sheet[address]?.v || `Column_${C}`)
      }
    } else {
      return NextResponse.json({ error: 'Formato no soportado. Use CSV o Excel.' }, { status: 400 })
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
    }

    // 5. Detectar columnas automáticamente
    const columnMapping = detectColumns(columns, rows[0])

    // 6. Crear registro de upload
    const { data: upload, error: uploadError } = await supabase
      .from('si_uploads')
      .insert({
        company_id: profile.company_id,
        user_id: profile.id,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        total_rows: rows.length,
        processed_rows: 0,
        status: 'uploaded',
        column_mapping: columnMapping
      })
      .select()
      .single()

    if (uploadError) throw uploadError

    // 7. Insertar líneas de gasto
    const spendLines = rows.slice(0, 5000).map((row, index) => ({ // Limitar a 5000 líneas
      upload_id: upload.id,
      company_id: profile.company_id,
      description: row[columnMapping.description] || '',
      supplier_name: row[columnMapping.supplier_name] || null,
      amount: parseFloat(row[columnMapping.amount]) || 0,
      currency: row[columnMapping.currency] || 'USD',
      purchase_order: row[columnMapping.purchase_order] || null,
      line_number: index + 1,
      cost_center: row[columnMapping.cost_center] || null,
      purchase_date: row[columnMapping.purchase_date] || null,
      needs_review: true,
      raw_data: row
    }))

    const { error: linesError } = await supabase
      .from('si_spend_lines')
      .insert(spendLines)

    if (linesError) throw linesError

    // 8. Actualizar status
    await supabase
      .from('si_uploads')
      .update({ processed_rows: spendLines.length, status: 'processing' })
      .eq('id', upload.id)

    return NextResponse.json({
      success: true,
      upload_id: upload.id,
      total_rows: rows.length,
      processed_rows: spendLines.length,
      column_mapping: columnMapping,
      columns
    })

  } catch (error: any) {
    console.error('Error in SI upload:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Función para detectar columnas automáticamente
function detectColumns(columns: string[], sampleRow: any): Record<string, string> {
  const mapping: Record<string, string> = {}

  columns.forEach(col => {
    const lowerCol = col.toLowerCase()

    // Detectar descripción
    if (lowerCol.includes('descri') || lowerCol.includes('detalle') || lowerCol.includes('item')) {
      mapping.description = col
    }
    // Detectar proveedor
    else if (lowerCol.includes('prove') || lowerCol.includes('supplier') || lowerCol.includes('vendor')) {
      mapping.supplier_name = col
    }
    // Detectar monto
    else if (lowerCol.includes('monto') || lowerCol.includes('amount') || lowerCol.includes('total') || lowerCol.includes('precio')) {
      mapping.amount = col
    }
    // Detectar OC
    else if (lowerCol.includes('oc') || lowerCol.includes('orden') || lowerCol.includes('po') || lowerCol.includes('purchase')) {
      mapping.purchase_order = col
    }
    // Detectar moneda
    else if (lowerCol.includes('moneda') || lowerCol.includes('currency')) {
      mapping.currency = col
    }
    // Detectar centro de costo
    else if (lowerCol.includes('centro') || lowerCol.includes('cost center') || lowerCol.includes('cc')) {
      mapping.cost_center = col
    }
    // Detectar fecha
    else if (lowerCol.includes('fecha') || lowerCol.includes('date')) {
      mapping.purchase_date = col
    }
  })

  // Asegurar que al menos descripción y monto estén mapeados
  if (!mapping.description && columns.length > 0) {
    mapping.description = columns[0]
  }
  if (!mapping.amount && columns.length > 1) {
    mapping.amount = columns[1]
  }

  return mapping
}
```

### **2.2. API de Clasificación con IA**

`src/app/api/si/classify/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

// Configurar Groq
function getGroqApiKey() {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.GROQ_API_KEY || ''
  }
  return ''
}

const groq = createOpenAI({
  apiKey: getGroqApiKey(),
  baseURL: 'https://api.groq.com/openai/v1',
})

const model = groq('llama-3.3-70b-versatile')

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // 1. Autenticación
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, company_id')
      .eq('id', session.user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    // 2. Obtener datos de la solicitud
    const { line_id, description, supplier_name, amount } = await request.json()

    if (!description) {
      return NextResponse.json({ error: 'Descripción requerida' }, { status: 400 })
    }

    // 3. Obtener reglas de aprendizaje existentes
    const { data: rules } = await supabase
      .from('si_learning_rules')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('success_rate', { ascending: false })
      .limit(10)

    // 4. Construir prompt para IA
    const rulesContext = rules && rules.length > 0
      ? `\n\nREGLAS APRENDIDAS (úsalas para mejorar la precisión):\n${rules.map(r => `- Si encuentra "${r.pattern}" → categoría "${r.category}" (confianza +${r.confidence_boost})`).join('\n')}`
      : ''

    const prompt = `Eres un experto en clasificación de gastos corporativos y Strategic Sourcing.

DATOS DE LA LÍNEA DE GASTO:
- Descripción: "${description}"
${supplier_name ? `- Proveedor: "${supplier_name}"` : ''}
${amount ? `- Monto: $${amount}` : ''}
${rulesContext}

INSTRUCCIONES:
1. Analiza la descripción y el proveedor para determinar la categoría de gasto más apropiada.
2. Asigna una categoría principal y una subcategoría si es posible.
3. Proporciona un nivel de confianza (0.0 a 1.0).
4. Justifica brevemente tu clasificación.
5. Sugiere una estrategia de sourcing si es evidente.

CATEGORÍAS COMUNES:
- Servicios de TI (Software, Hardware, Cloud, Soporte técnico)
- Servicios Profesionales (Consultoría, Legal, Auditoría, Marketing)
- Servicios Generales (Limpieza, Seguridad, Alimentación, Transporte)
- Suministros (Oficina, Operacionales, Industriales)
- Infraestructura (Obras civiles, Mantención, Equipamiento)
- Energía y Servicios Básicos (Electricidad, Agua, Gas, Telecomunicaciones)
- Logística y Transporte
- RRHH y Capacitación
- Equipos y Maquinaria
- Materias Primas

FORMATO DE RESPUESTA (JSON):
{
  "category": "Categoría principal",
  "subcategory": "Subcategoría (opcional)",
  "confidence": 0.85,
  "justification": "Breve explicación de la clasificación",
  "suggested_strategy": "licitar | consolidar | negociar_marco | monitorear"
}

Responde SOLO con el JSON, sin texto adicional.`

    // 5. Llamar a la IA
    const { text } = await generateText({
      model,
      prompt,
      temperature: 0.3,
    })

    // 6. Parsear respuesta
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Respuesta de IA en formato inválido')
    }

    const classification = JSON.parse(jsonMatch[0])

    // 7. Actualizar línea de gasto si se proporcionó line_id
    if (line_id) {
      const needs_review = classification.confidence < 0.8

      await supabase
        .from('si_spend_lines')
        .update({
          category: classification.category,
          subcategory: classification.subcategory,
          ai_confidence: classification.confidence,
          ai_justification: classification.justification,
          needs_review
        })
        .eq('id', line_id)
        .eq('company_id', profile.company_id)
    }

    return NextResponse.json({
      success: true,
      classification
    })

  } catch (error: any) {
    console.error('Error in SI classification:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

---

## 🎨 FASE 3: COMPONENTES UI

Debido a la extensión del código, se recomienda crear los componentes en el siguiente orden:

### **3.1. Vista de Carga (`/sourcing-intelligence/upload`)**

Componentes necesarios:
- Drag & drop para subir archivo
- Preview de columnas detectadas
- Mapeo manual de columnas
- Progreso de carga

### **3.2. Vista de Clasificación (`/sourcing-intelligence/[id]/classify`)**

Componentes necesarios:
- Tabla de líneas con confianza
- Filtro por confianza (alta/media/baja)
- Modal de corrección manual
- Botón "Aprobar" y "Corregir"
- Progreso de revisión

### **3.3. Vista de Plan (`/sourcing-intelligence/[id]/plan`)**

Componentes necesarios:
- Tabla editable de categorías
- Estrategias sugeridas por IA
- Campos editables (% ahorro, trimestre, prioridad)
- Botón "Generar Plan Completo"
- Exportar a Excel/PDF

### **3.4. Matriz de Kraljic (`/sourcing-intelligence/[id]/kraljic`)**

Componentes necesarios:
- Scatter plot interactivo (Recharts)
- Drag & drop con `@dnd-kit`
- 4 cuadrantes con colores
- Tooltips con detalles
- Actualización en tiempo real

### **3.5. Reglas Aprendidas (`/sourcing-intelligence/learning-rules`)**

Componentes necesarios:
- Tabla de reglas
- Filtros por tipo (keyword, supplier, correction)
- CRUD completo
- Estadísticas de uso y éxito

---

## 🧠 FASE 4: LÓGICA DE APRENDIZAJE

### **4.1. Sistema de Correcciones**

Cuando el usuario corrige una clasificación:

1. Guardar en `si_learning_rules` como `rule_type='correction'`
2. Extraer keywords de la descripción
3. Crear regla: `pattern="keyword" → category="nueva_categoría"`
4. Incrementar `confidence_boost=0.1` cada vez que se usa

### **4.2. Few-Shot Learning**

Para mejorar clasificaciones futuras:

- Guardar ejemplos de correcciones humanas
- Usar los primeros 5-10 ejemplos como contexto en el prompt
- Formato: "Descripción X → Categoría Y (corrección humana)"

---

## 📊 FASE 5: GENERACIÓN DE PLAN

### **5.1. Análisis Automático**

`src/app/api/si/generate-plan/route.ts`:

Lógica:

1. Agrupar líneas por categoría
2. Calcular:
   - Total spend por categoría
   - Número de proveedores
   - Proveedor principal y % concentración
   - Número de líneas

3. Determinar estrategia según heurísticas:
   ```typescript
   if (supplier_count >= 5 && concentration < 40%) {
     strategy = 'licitar' // Alta competencia
     savings = 5-8%
   } else if (supplier_count >= 3 && concentration < 60%) {
     strategy = 'consolidar'
     savings = 3-5%
   } else if (supplier_count <= 2 && concentration > 70%) {
     strategy = 'dual_sourcing' // Reducir riesgo
     savings = 2-4%
   } else {
     strategy = 'monitorear'
     savings = 1-2%
   }
   ```

4. Calcular Kraljic:
   ```typescript
   impact_score = (total_spend / max_spend) * 0.7 + (line_count / max_lines) * 0.3
   risk_score = (concentration / 100) * 0.6 + (1 - supplier_count / max_suppliers) * 0.4

   if (impact_score > 0.6 && risk_score > 0.6) quadrant = 'strategic'
   else if (impact_score > 0.6 && risk_score <= 0.6) quadrant = 'leverage'
   else if (impact_score <= 0.6 && risk_score > 0.6) quadrant = 'bottleneck'
   else quadrant = 'non_critical'
   ```

5. Insertar en `si_procurement_plans` y `si_plan_items`

---

## 🔄 FLUJO COMPLETO DEL USUARIO

```
1. Carga archivo Excel → /sourcing-intelligence/upload
   ↓
2. Sistema detecta columnas automáticamente
   ↓
3. Usuario confirma o ajusta mapeo
   ↓
4. Sistema procesa y clasifica con IA → /sourcing-intelligence/[id]/classify
   ↓
5. Usuario revisa clasificaciones (aprobar o corregir)
   ↓ (correcciones generan reglas de aprendizaje)
   ↓
6. Sistema genera plan preliminar → /sourcing-intelligence/[id]/plan
   ↓
7. Usuario revisa y edita estrategias
   ↓
8. Sistema calcula Kraljic → /sourcing-intelligence/[id]/kraljic
   ↓
9. Usuario ajusta posiciones manualmente (drag & drop)
   ↓
10. Exportar plan final (Excel/PDF)
```

---

## 🎯 PRÓXIMOS PASOS

**Prioridad Alta:**
1. ✅ Esquema de base de datos
2. ✅ Tipos TypeScript
3. ⏳ API de carga (upload)
4. ⏳ API de clasificación IA
5. ⏳ Vista de carga y mapeo

**Prioridad Media:**
6. API de generación de plan
7. Vista de clasificación y revisión
8. Vista de plan preliminar

**Prioridad Baja:**
9. Matriz de Kraljic interactiva
10. Vista de reglas aprendidas
11. Exportación avanzada

---

## 📝 NOTAS DE IMPLEMENTACIÓN

- **Performance**: Procesar máximo 5,000 líneas por archivo (limitar en UI)
- **Seguridad**: Validar siempre `company_id` en todas las queries
- **IA**: Usar `temperature=0.3` para clasificaciones más consistentes
- **UX**: Mostrar progreso en tiempo real (websockets o polling)
- **Testing**: Crear archivo Excel de prueba con 50-100 líneas

---

## 🚀 CÓMO CONTINUAR

1. **Aplicar SQL** en Supabase (`create-sourcing-intelligence.sql`)
2. **Instalar dependencias** (`npm install xlsx papaparse @dnd-kit/core`)
3. **Crear API routes** siguiendo el código de esta guía
4. **Crear componentes UI** paso a paso
5. **Probar con archivo Excel** de prueba

---

**¿Prefieres que continúe implementando el código completo paso a paso, o quieres revisar/ajustar algo de esta arquitectura primero?**

El módulo es extenso pero increíblemente potente. Una vez terminado, Xpend tendrá capacidades de IA de nivel enterprise. 🚀

