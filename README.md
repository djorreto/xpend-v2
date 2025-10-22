# Xpend V2 - Strategic Sourcing Platform

**Versión:** 2.0.0
**Website:** [xpend.cl](https://xpend.cl)

Una plataforma colaborativa de próxima generación para planificación de Strategic Sourcing y gestión de Spend, construida con Next.js 14, TypeScript, TailwindCSS y Supabase.

---

## 🎨 Identidad de Marca

### Colores Corporativos
- **Petrol Blue** (`#2D3E3D`) - Color principal
- **Turquoise** (`#2AD4D2`) - Acentos primarios
- **Mint** (`#3BE7AE`) - Llamados a la acción
- **Lime** (`#C6FF00`) - Highlights y énfasis

### Logo
Disponibles en `/public`:
- `xpend-logo.png` / `xpend-logo.svg`
- `xpend-logo-white.png` / `xpend-logo-white.svg`

---

## ✨ Características Principales

### 🤖 **NUEVO: Juan Xpendo - Asistente de IA** ⭐
- **Experto en Strategic Sourcing** con IA (Groq + Llama 3.1 70B)
- Chat flotante siempre disponible
- Análisis de documentos técnicos (Word, TXT)
- Asesoría en tiempo real sobre:
  - Estrategia de categorías
  - Cálculo de líneas base
  - Especificaciones técnicas
  - Negociación con proveedores
  - RFP/RFQ/RFI
  - Total Cost of Ownership (TCO)
- **📖 Setup:** Ver `JUAN-XPENDO-QUICK-START.md`

### 🔐 Multi-tenant & Autenticación
- Soporte para múltiples empresas aisladas
- Roles: Admin, Manager, Analyst, Viewer, Super Admin, Demo
- Row Level Security (RLS) en todas las tablas
- Autenticación con Supabase Auth

### 📊 Dashboard Interactivo
- Métricas en tiempo real
- 5 tipos de gráficos (Recharts)
- Spend por categoría, proveedor y período
- Próximos hitos y proyectos activos

### 🏆 Gestión de Licitaciones
- Estados: Planificado → Revisión → Publicada → Evaluación → Adjudicada → Contrato
- Tipos: RFP, RFQ, RFI
- Cálculo automático de ahorros (Baseline vs Adjudicado)
- Gestión de documentos versionados
- Asignación de departamentos y responsables

### 🏢 Gestión de Proveedores (⭐ Feature Destacado)
- **Evaluación Administrativa** (3 criterios: Documentación, Financiera, Experiencia)
- **Evaluación Técnica por Licitación** (Prevención riesgos, Propuesta técnica)
- **Sistema de Semáforo Visual**:
  - 🟢 Verde: >80 puntos (vigente)
  - 🟡 Amarillo: 60-79 puntos (vigente)
  - 🔴 Rojo: <60 puntos o expirada
  - ⚪ Gris: Sin evaluación
- Ponderación configurable por licitación
- Gestión de NDA (upload y tracking)
- Historial de participaciones

### 📁 Proyectos de Sourcing
- Fases configurables con dependencias
- Hitos y seguimiento de progreso
- Sistema de comentarios colaborativo
- Gestión de archivos adjuntos

### 💰 Análisis de Spend
- Importar datos desde CSV/XLSX
- Análisis por categoría, proveedor, período
- Visualizaciones interactivas
- Exportación de reportes

### 📈 Reportes
- Generación de reportes configurables
- Filtros avanzados
- Exportación múltiples formatos

---

## 🛠️ Stack Tecnológico

### Frontend
- **Next.js 14.0.4** - App Router
- **React 18** - UI Framework
- **TypeScript 5** - Tipado estático
- **TailwindCSS 3.3** - Styling
- **Lucide React** - Iconografía

### UI Components
- **Radix UI** - Componentes accesibles primitivos
- **Recharts** - Gráficos y visualizaciones
- **React Hook Form** - Manejo de formularios
- **Zod** - Validación de schemas
- **React Dropzone** - Upload de archivos

### Backend & Database
- **Supabase**
  - PostgreSQL Database
  - Authentication
  - Storage (documentos y archivos)
  - Row Level Security
  - Realtime subscriptions

### Utilidades
- **PapaParse** - Parsing de CSV
- **XLSX** - Manejo de Excel
- **date-fns** - Manejo de fechas
- **clsx + tailwind-merge** - Gestión de clases CSS

---

## 📁 Estructura del Proyecto

```
xpend-v2/
├── database/               # Scripts SQL organizados
│   ├── schemas/           # Schemas principales
│   │   ├── supabase-schema.sql
│   │   ├── suppliers-schema.sql
│   │   ├── reports-schema.sql
│   │   └── setup-*.sql
│   ├── migrations/        # Migraciones de datos
│   │   ├── migracion-licitaciones-supabase.sql
│   │   └── verificar-migracion.sql
│   └── seeds/            # Datos de prueba
│       └── seed-departments.sql
│
├── docs/                  # Documentación técnica
│   ├── CONFIGURAR-SUPABASE.md
│   ├── CONFIGURAR-REPORTES.md
│   ├── MIGRACION-LICITACIONES.md
│   └── SETUP-REPORTS.md
│
├── public/               # Archivos estáticos
│   └── xpend-logo*.{png,svg}
│
├── src/
│   ├── app/             # Next.js App Router
│   │   ├── auth/       # Autenticación
│   │   ├── dashboard/  # Dashboard principal
│   │   ├── licitaciones/  # Gestión de licitaciones
│   │   ├── suppliers/  # Gestión de proveedores
│   │   ├── projects/   # Proyectos de sourcing
│   │   ├── spend/      # Análisis de gastos
│   │   ├── reports/    # Reportes
│   │   ├── users/      # Gestión de usuarios
│   │   ├── settings/   # Configuración
│   │   ├── login/      # Login page
│   │   ├── signup/     # Registro
│   │   └── home/       # Landing page
│   │
│   ├── components/
│   │   ├── auth/       # Auth components
│   │   ├── layout/     # Layout (Sidebar, Topbar)
│   │   └── ui/         # UI components base
│   │
│   ├── contexts/       # React Contexts
│   ├── hooks/          # Custom hooks
│   ├── lib/            # Utilidades y configuración
│   └── types/          # TypeScript types
│
├── .env.local          # Variables de entorno (no en git)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

---

## 🚀 Instalación y Setup

### Prerrequisitos
- Node.js 18+
- npm o yarn
- Cuenta de Supabase

### 1. Clonar e instalar

```bash
git clone <repository-url>
cd xpend-v2
npm install
```

### 2. Configurar variables de entorno

Crea `.env.local` en la raíz:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Configurar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com)
2. Ejecuta los schemas en orden:
   ```sql
   -- En SQL Editor de Supabase:
   database/schemas/supabase-schema.sql
   database/schemas/suppliers-schema.sql
   database/schemas/reports-schema.sql
   ```
3. Crea los buckets de Storage:
   - `project-files`
   - `licitacion-documents`
   - `spend-data`
   - `supplier-documents`

4. (Opcional) Carga datos de prueba:
   ```sql
   database/seeds/seed-departments.sql
   ```

### 4. Ejecutar el proyecto

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 📖 Documentación

Toda la documentación técnica está en la carpeta `/docs`:

- **[CONFIGURAR-SUPABASE.md](docs/CONFIGURAR-SUPABASE.md)** - Setup completo de Supabase
- **[CONFIGURAR-REPORTES.md](docs/CONFIGURAR-REPORTES.md)** - Configuración del módulo de reportes
- **[MIGRACION-LICITACIONES.md](docs/MIGRACION-LICITACIONES.md)** - Guía de migración de licitaciones
- **[SETUP-REPORTS.md](docs/SETUP-REPORTS.md)** - Setup del sistema de reportes

---

## 🗄️ Base de Datos

### Tablas Principales

#### Core
- `companies` - Empresas (multi-tenant)
- `profiles` - Usuarios con roles
- `departments` - Departamentos por empresa

#### Licitaciones
- `licitaciones` - Licitaciones y procesos de compra
- `licitacion_documents` - Documentos versionados
- `licitacion_suppliers` - Relación licitación-proveedor
- `licitacion_weightings` - Ponderaciones admin/técnica

#### Proveedores
- `suppliers` - Proveedores
- `administrative_evaluations` - Evaluaciones administrativas
- `technical_evaluations` - Evaluaciones técnicas por licitación

#### Proyectos
- `projects` - Proyectos de sourcing
- `project_phases` - Fases de proyectos
- `project_milestones` - Hitos
- `project_files` - Archivos adjuntos
- `project_comments` - Comentarios

#### Spend
- `spend_data` - Datos de gastos
- `spend_categories` - Categorías de gastos

---

## 🎯 Características Destacadas

### Modo Dual: Mock / Funcional
El sistema incluye un **VersionContext** que permite:
- **Modo Mock**: Datos de demostración sin Supabase
- **Modo Funcional**: Conexión con Supabase real
- Detección automática de configuración

### Cálculo Automático de Ahorros
```
Ahorro = Baseline - Monto Adjudicado
% Ahorro = (Ahorro / Baseline) × 100
```

### Sistema de Evaluación de Proveedores
- Evaluación administrativa (3 criterios, 0-100 pts c/u)
- Evaluación técnica por licitación (2 criterios)
- Ponderación configurable (ej: 60% admin, 40% técnica)
- Cálculo automático de score final ponderado
- Sistema de semáforo visual intuitivo
- Control de vigencia de evaluaciones

---

## 🚀 Despliegue

### Vercel (Recomendado)

1. Conecta tu repositorio a Vercel
2. Configura las variables de entorno
3. Despliega automáticamente

### Otras plataformas

Compatible con:
- Netlify
- Railway
- DigitalOcean App Platform
- Cualquier plataforma con soporte Next.js

---

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 📝 Licencia

Este proyecto está bajo la Licencia MIT.

---

## 📞 Soporte

- **Website**: [xpend.cl](https://xpend.cl)
- **Email**: soporte@xpend.cl

---

## 🗺️ Roadmap V2

- [ ] Integración con APIs de proveedores
- [ ] Notificaciones en tiempo real (Supabase Realtime)
- [ ] Módulo de contratos
- [ ] Análisis predictivo con IA
- [ ] Mobile app (React Native)
- [ ] Integración con ERPs (SAP, Oracle)
- [ ] Marketplace de proveedores
- [ ] Workflow de aprobaciones configurable

---

**Construido con ❤️ para equipos de Strategic Sourcing**
