# Xpend - Strategic Sourcing Platform

Una plataforma colaborativa para planificación de Strategic Sourcing y gestión de Spend, construida con Next.js, TypeScript, TailwindCSS y Supabase.

**Website**: [xpend.cl](https://xpend.cl)

## 🚀 Características

- **Multi-tenant**: Soporte para múltiples usuarios y empresas con roles y permisos
- **Gestión de Proyectos**: Crear proyectos de sourcing con fases configurables, hitos y dependencias
- **Repositorio de Licitaciones**: Sistema centralizado con historial y versionado de documentos
- **Análisis de Spend**: Importar y analizar bases de gasto por categoría, proveedor y período
- **Dashboard Interactivo**: Métricas y visualizaciones en tiempo real
- **Chat por Proyecto**: Sistema de comentarios colaborativo
- **Gestión de Archivos**: Almacenamiento seguro con Supabase Storage

## 🛠️ Tecnologías

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: TailwindCSS, Lucide React Icons
- **Backend**: Supabase (Auth, Database, Storage, Realtime)
- **UI Components**: Radix UI, Custom Components
- **Charts**: Recharts
- **Forms**: React Hook Form, Zod validation
- **File Processing**: PapaParse, XLSX

## 📋 Prerrequisitos

- Node.js 18+ 
- npm o yarn
- Cuenta de Supabase

## 🚀 Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd xpend
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   # o
   yarn install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp env.example .env.local
   ```
   
   Edita `.env.local` con tus credenciales de Supabase:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=tu_supabase_service_role_key
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Configurar la base de datos**
   - Crea un nuevo proyecto en [Supabase](https://supabase.com)
   - Ejecuta el script SQL en `supabase-schema.sql` en el SQL Editor de Supabase
   - Configura las políticas RLS según tus necesidades

5. **Configurar Storage**
   - En Supabase Dashboard, ve a Storage
   - Crea buckets para:
     - `project-files` (archivos de proyectos)
     - `licitacion-documents` (documentos de licitaciones)
     - `spend-data` (archivos de datos de gasto)

6. **Ejecutar el proyecto**
   ```bash
   npm run dev
   # o
   yarn dev
   ```

7. **Abrir en el navegador**
   ```
   http://localhost:3000
   ```

## 📁 Estructura del Proyecto

```
src/
├── app/                    # App Router de Next.js
│   ├── auth/              # Páginas de autenticación
│   ├── dashboard/         # Dashboard principal
│   ├── projects/          # Gestión de proyectos
│   ├── licitaciones/      # Repositorio de licitaciones
│   ├── spend/             # Análisis de gastos
│   └── settings/          # Configuración
├── components/            # Componentes reutilizables
│   ├── ui/               # Componentes base (Button, Card, etc.)
│   ├── layout/           # Layout components (Sidebar, Topbar)
│   ├── forms/            # Formularios
│   └── charts/           # Componentes de gráficos
├── lib/                  # Utilidades y configuración
│   ├── supabase.ts       # Cliente de Supabase
│   └── utils.ts          # Funciones utilitarias
├── types/                # Definiciones de TypeScript
└── hooks/                # Custom React hooks
```

## 🗄️ Esquema de Base de Datos

### Tablas Principales

- **companies**: Información de empresas
- **users**: Usuarios del sistema con roles
- **projects**: Proyectos de sourcing
- **project_phases**: Fases de los proyectos
- **project_milestones**: Hitos de los proyectos
- **licitaciones**: Licitaciones y procesos de compra
- **spend_data**: Datos de gastos
- **spend_categories**: Categorías de gastos

### Roles de Usuario

- **admin**: Acceso completo al sistema
- **manager**: Gestión de proyectos y licitaciones
- **analyst**: Análisis de datos y reportes
- **viewer**: Solo lectura

## 🔐 Autenticación

El sistema utiliza Supabase Auth con:
- Registro e inicio de sesión
- Autenticación multi-tenant
- Roles y permisos por empresa
- Row Level Security (RLS)

## 📊 Funcionalidades

### Dashboard
- Métricas generales del sistema
- Proyectos activos y su progreso
- Próximos hitos
- Análisis de gastos por categoría

### Proyectos
- Crear y gestionar proyectos de sourcing
- Fases configurables con dependencias
- Hitos y seguimiento de progreso
- Sistema de comentarios colaborativo
- Gestión de archivos adjuntos

### Licitaciones
- Repositorio central de licitaciones
- Historial y versionado de documentos
- Seguimiento de propuestas
- Estados del proceso de licitación

### Spend Analysis
- Importar datos desde CSV/XLSX
- Análisis por categoría, proveedor y período
- Visualizaciones interactivas
- Exportación de reportes

## 🚀 Despliegue

### Vercel (Recomendado)

1. Conecta tu repositorio a Vercel
2. Configura las variables de entorno
3. Despliega automáticamente

### Otras plataformas

El proyecto es compatible con cualquier plataforma que soporte Next.js:
- Netlify
- Railway
- DigitalOcean App Platform

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 📞 Soporte

Para soporte técnico o preguntas:
- Email: soporte@xpend.cl
- Website: [xpend.cl](https://xpend.cl)

## 🗺️ Roadmap

- [ ] Integración con APIs de proveedores
- [ ] Notificaciones en tiempo real
- [ ] Módulo de contratos
- [ ] Análisis predictivo
- [ ] Mobile app
- [ ] Integración con ERPs

