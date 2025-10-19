# Configuración de Reportes - Spendora

## 📋 Pasos para Configurar la Funcionalidad de Reportes

### 1. Ejecutar Scripts SQL en Supabase

Ejecuta los siguientes scripts en el SQL Editor de Supabase en este orden:

1. **Primero**: `reports-schema.sql` - Crea las tablas y políticas RLS
2. **Segundo**: `setup-supabase.sql` - Actualiza las políticas de storage

### 2. Crear Bucket de Storage

En el dashboard de Supabase, ve a Storage y crea un nuevo bucket:

- **Nombre**: `reports`
- **Público**: ❌ No (privado)
- **File size limit**: 50MB
- **Allowed MIME types**: `text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

### 3. Configurar Políticas de Storage

Las políticas ya están incluidas en `setup-supabase.sql`, pero asegúrate de que estén aplicadas:

```sql
-- Verificar que las políticas existan
SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%reports%';
```

### 4. Instalar Dependencias Adicionales (Opcional)

Para funcionalidad completa de Excel, instala:

```bash
npm install xlsx
```

## 🚀 Funcionalidades Implementadas

### ✅ Tipos de Reportes Disponibles:

1. **Análisis de Gastos** (`spend_analysis`)
   - Gastos por categoría
   - Gastos por proveedor
   - Tendencias temporales
   - Gráficos de distribución

2. **Estado de Proyectos** (`project_status`)
   - Proyectos por estado
   - Métricas de progreso
   - Hitos próximos
   - Presupuestos

3. **Rendimiento de Proveedores** (`vendor_performance`)
   - Volumen por proveedor
   - Métricas de rendimiento
   - Análisis de categorías
   - Rankings

4. **Seguimiento de Presupuesto** (`budget_tracking`)
   - Control de presupuestos
   - Varianzas
   - Proyecciones
   - Alertas

### ✅ Características:

- **Generación en tiempo real** de reportes
- **Descarga automática** en formato CSV
- **Almacenamiento seguro** en Supabase Storage
- **Historial de reportes** generados
- **Estados de progreso** (Generando, Completado, Error)
- **Filtros y parámetros** personalizables
- **Políticas RLS** para seguridad multi-tenant

## 🔧 Uso de la API

### Generar Reporte:

```typescript
import { ReportsService } from '@/lib/reports-service'

// Generar reporte de gastos
const reportData = await ReportsService.generateSpendAnalysisReport(
  companyId,
  userId,
  {
    dateFrom: '2024-01-01',
    dateTo: '2024-12-31',
    includeCharts: true,
    categories: ['IT', 'Marketing']
  }
)
```

### Descargar Reporte:

```typescript
// Descargar archivo generado
const fileBlob = await ReportsService.downloadReportFile(filePath)
```

## 📊 Estructura de Datos

### Tabla `reports`:
- `id`: UUID único
- `name`: Nombre del reporte
- `type`: Tipo de reporte
- `status`: Estado (draft, generating, completed, failed)
- `file_path`: Ruta del archivo en storage
- `parameters`: Parámetros JSON usados
- `company_id`: ID de la empresa
- `created_by`: ID del usuario creador

### Tabla `report_templates`:
- Templates predefinidos para cada tipo de reporte
- Configuración personalizable
- Templates por defecto y personalizados

## 🛡️ Seguridad

- **RLS habilitado** en todas las tablas
- **Acceso por empresa** - usuarios solo ven reportes de su empresa
- **Storage privado** - archivos solo accesibles por la empresa
- **Validación de parámetros** en la generación

## 🎯 Próximas Mejoras

- [ ] Soporte para PDF
- [ ] Reportes programados (cron jobs)
- [ ] Templates personalizables
- [ ] Gráficos interactivos
- [ ] Exportación a múltiples formatos
- [ ] Notificaciones por email
- [ ] Dashboard de métricas de reportes

