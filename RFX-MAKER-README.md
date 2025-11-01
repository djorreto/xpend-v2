# 📄 RFx MAKER - Guía Rápida

## ¿Qué es RFx Maker?

**RFx Maker** es el módulo de XPEND que te permite crear automáticamente **Bases Administrativas** y **Bases Técnicas** para tus procesos de licitación (RFP, RFQ, RFI).

### ✨ Beneficios:

- ⚡ **Ahorra tiempo**: Genera bases en minutos, no en días
- 🤖 **IA integrada**: La misma IA de XPEND genera bases técnicas contextualizadas
- 📋 **Estandarización**: Usa plantillas consistentes en toda la empresa
- 🔄 **Versionado**: Mantén historial completo de cambios
- 👥 **Colaboración**: Comparte y comenta con tu equipo

---

## 🚀 INICIO RÁPIDO

### 1. Primera vez (Solo Admin)

#### a) Crear Plantilla Administrativa

1. Ve a **RFx Maker** en el sidebar
2. Click en **"Administrar Plantillas"**
3. Click en **"Nueva Plantilla"**
4. Completa:
   - Nombre: "Plantilla Base Administrativa Estándar"
   - Estructura: Escribe tu base administrativa usando variables `{{ nombre_variable }}`

   **Ejemplo**:
   ```
   BASES ADMINISTRATIVAS

   1. ANTECEDENTES GENERALES
      - Moneda: {{ currency }}
      - Plazo de entrega: {{ delivery_timeline }}

   2. GARANTÍAS
      - Garantía de seriedad: {{ performance_bond_percent }}%
      - Vigencia de propuesta: {{ proposal_validity_days }} días

   3. CONDICIONES DE PAGO
      - {{ payment_terms }}
   ```

5. Define las variables:
   - Click en **"Agregar Variable"**
   - Para cada variable:
     - **field_key**: `currency` (debe coincidir con {{currency}})
     - **Etiqueta**: "Moneda"
     - **Tipo**: Texto
     - **Valor por defecto**: "CLP"
     - **Grupo**: "Moneda y Reajuste"

6. **Guardar** y luego **Activar** la plantilla

#### b) Configurar Política de Empresa

1. Ve a **"Políticas de Empresa"**
2. Verás los campos automáticamente cargados desde tu plantilla activa
3. Completa los valores por defecto para tu empresa:
   - Moneda: `CLP`
   - Garantía de seriedad: `10`
   - Vigencia de propuesta: `90`
   - Condiciones de pago: `30 días término de mes factura`
   - etc.
4. **Guardar**

✅ **Ya estás listo para crear proyectos!**

---

### 2. Crear un Proyecto RFx

1. Ve a **RFx Maker**
2. Click en **"Nuevo Proyecto"**
3. Completa:
   - **Tipo**: RFP (Request for Proposal)
   - **Título**: "Licitación Servicios de Mantenimiento 2025"
   - **Descripción**: Breve descripción del proyecto
   - **Plantilla**: (se selecciona automáticamente la activa)
   - **Contexto** (ayuda a la IA):
     - Industria: "Minería"
     - Presupuesto: "50000000" (50M CLP)
     - Plazo: "12 meses"
4. **Crear Proyecto**

---

### 3. Editar Parámetros Administrativos

1. En la vista del proyecto, tab **"Base Administrativa"**
2. Verás todos los parámetros cargados desde la política
3. Edítalos según este proyecto específico:
   - Cambiar garantía a 15% si es proyecto crítico
   - Ajustar plazos específicos
   - etc.
4. **Guardar**

⚠️ **Nota**: Si cambias parámetros después de generar la base técnica, esta se invalidará automáticamente.

---

### 4. Generar Base Técnica con IA

1. Ve al tab **"Base Técnica (IA)"**
2. Click en **"Generar Base Técnica"**
3. La IA de XPEND generará:
   - Introducción y antecedentes
   - Objeto de la contratación
   - Alcance del servicio/producto
   - Requisitos técnicos detallados
   - Criterios de evaluación
   - Requisitos de documentación
   - Condiciones de ejecución
   - Anexos técnicos

4. **Espera 10-30 segundos** (la IA está trabajando)
5. Revisa el contenido generado
6. Si quieres regenerar: Click en **"Regenerar con IA"**

---

### 5. Marcar como Listo

1. Una vez satisfecho con ambas bases (administrativa y técnica)
2. Click en **"Marcar como Listo"**
3. El proyecto cambia de estado `draft` → `ready`
4. Ahora está listo para descargar (cuando esté disponible)

---

## 📚 CONCEPTOS CLAVE

### Plantilla Administrativa
- Define la **estructura** de todas tus bases administrativas
- Usa **variables** (placeholders) para campos dinámicos
- Solo puede haber **una plantilla activa** a la vez
- Solo **admins** pueden crear/editar plantillas

### Variables (Placeholders)
- Se escriben como: `{{ nombre_variable }}`
- Tipos: texto, número, fecha, booleano, opciones
- Cada variable tiene:
  - **field_key**: identificador único
  - **Etiqueta**: nombre visible
  - **Valor por defecto**: se carga desde política
  - **Grupo**: categoría para organizar

### Política de Empresa
- Define **valores por defecto** para todas las variables
- Se aplica automáticamente a nuevos proyectos
- Los usuarios pueden modificar estos valores por proyecto
- Solo **admins** pueden editar la política

### Proyecto RFx
- Es una **instancia** de una licitación específica
- Tiene 4 estados:
  - `draft`: En construcción
  - `ready`: Listo para publicar
  - `closed`: Cerrado
  - `archived`: Archivado
- Contiene:
  - Base Administrativa (con parámetros personalizados)
  - Base Técnica (generada por IA)
  - Contexto del proyecto

### Invalidación Automática
- Si **cambias parámetros administrativos** después de generar la base técnica
- El sistema **invalida automáticamente** la base técnica
- Te muestra un **banner naranja** para que regeneres
- Esto garantiza **consistencia** entre ambas bases

---

## 🎯 CASOS DE USO

### Caso 1: Licitación Estándar
```
1. Crear proyecto "Servicios de Limpieza 2025"
2. Usar valores por defecto de política
3. Generar base técnica con IA
4. Marcar como listo
5. Descargar documentos (cuando esté disponible)
```

### Caso 2: Licitación Compleja
```
1. Crear proyecto "Implementación ERP"
2. Ajustar garantías (20% en vez de 10%)
3. Agregar requisitos especiales en contexto
4. Generar base técnica con IA
5. Revisar y regenerar si es necesario
6. Agregar comentarios (cuando esté disponible)
7. Marcar como listo
```

### Caso 3: Múltiples Licitaciones Similares
```
1. Crear proyecto base "Servicios TI - Plantilla"
2. Configurar todos los parámetros
3. Generar base técnica
4. Para cada nueva licitación similar:
   - Duplicar proyecto base (cuando esté disponible)
   - Ajustar solo lo necesario
   - Listo!
```

---

## ⚡ TIPS Y MEJORES PRÁCTICAS

### Para Admins:

1. **Plantilla robusta**:
   - Incluye todas las secciones comunes
   - Usa grupos para organizar variables (ej: "Garantías", "Plazos", "Montos")
   - Agrega textos de ayuda a variables complejas

2. **Política realista**:
   - Define valores que realmente usas en el 80% de los casos
   - Revisa y actualiza trimestralmente

3. **Versionado**:
   - Cuando cambies la plantilla, crea una **nueva versión**
   - Los proyectos existentes siguen usando su snapshot

### Para Usuarios:

1. **Contexto rico**:
   - Llena bien los campos de contexto (industria, presupuesto, plazo)
   - Más contexto = mejor base técnica generada por IA

2. **Revisa la IA**:
   - La IA es muy buena, pero siempre revisa el contenido
   - Regenera si no te convence

3. **Consistencia**:
   - Si cambias parámetros admin, regenera la base técnica
   - No ignores el banner naranja de invalidación

4. **Guarda frecuentemente**:
   - El sistema no tiene auto-guardado todavía
   - Usa el botón "Guardar" regularmente

---

## ❓ PREGUNTAS FRECUENTES

### ¿Puedo tener múltiples plantillas activas?
No, solo puede haber una plantilla activa a la vez por empresa. Pero puedes tener múltiples plantillas en estado "draft" o "archived".

### ¿Qué pasa si cambio la plantilla activa?
Los proyectos existentes NO se afectan (usan un snapshot). Solo los nuevos proyectos usarán la nueva plantilla.

### ¿La IA siempre genera el mismo contenido?
No, la IA contextualiza según:
- Tipo de RFx (RFP/RFQ/RFI)
- Industria
- Presupuesto
- Parámetros administrativos
- Contexto específico del proyecto

### ¿Puedo editar manualmente la base técnica?
Por ahora no hay editor manual, pero está en el roadmap. Por ahora, regenera con la IA ajustando el contexto.

### ¿Cuándo estará disponible la descarga de documentos?
Está en desarrollo. Prioridad alta.

### ¿Puedo usar RFx Maker sin ser admin?
Sí! Los usuarios normales pueden:
- Ver todas las páginas
- Crear proyectos
- Editar parámetros
- Generar bases técnicas
- Descargar documentos

Solo NO pueden:
- Crear/editar plantillas
- Modificar políticas de empresa

### ¿Se puede usar en mobile?
La UI es responsive, pero para mejor experiencia recomendamos desktop/laptop.

---

## 🔧 TROUBLESHOOTING

### "No hay plantillas disponibles"
**Problema**: Intentas crear un proyecto pero no hay plantillas activas.
**Solución**: Un admin debe crear y activar una plantilla primero.

### "Base técnica invalidada"
**Problema**: Ves un banner naranja que dice "Base Técnica Invalidada".
**Solución**: Cambiaste parámetros administrativos. Click en "Regenerar Base Técnica".

### "No se pudo generar base técnica"
**Problema**: Error al generar con IA.
**Soluciones**:
- Verifica que tengas conexión a internet
- Revisa que el proyecto tenga contexto mínimo
- Intenta de nuevo (puede ser falla temporal de la API)

### "Acceso denegado" en Plantillas
**Problema**: No puedes acceder a administración de plantillas.
**Solución**: Solo admins/super_admins tienen acceso. Pide a un admin que te otorgue el rol.

---

## 📞 SOPORTE

¿Necesitas ayuda?

1. **ANA Chat**: Pregúntale a ANA sobre sourcing y RFx
2. **Documentación**: Revisa este README y el STATUS.md
3. **Equipo**: Contacta a tu admin de XPEND

---

## 🚀 ROADMAP

### Próximas funcionalidades:

- ✅ **Sistema de descargas** (DOCX/PDF)
- ✅ **Editor manual** de base técnica
- ✅ **Versionado** de proyectos
- ✅ **Duplicar** proyectos
- ✅ **Comentarios** colaborativos
- ✅ **Filtros avanzados** en listado
- ✅ **Comparación** entre versiones

---

**¡Disfruta RFx Maker!** 🎉

*Para más detalles técnicos, ver: RFX-MAKER-STATUS.md*

