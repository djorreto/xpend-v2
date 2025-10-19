# 📚 Índice de Documentación - Xpend V2

Esta carpeta contiene toda la documentación técnica del proyecto Xpend V2.

---

## 📋 Guías de Configuración

### [CONFIGURAR-SUPABASE.md](./CONFIGURAR-SUPABASE.md)
**Propósito:** Setup completo de la base de datos Supabase  
**Incluye:**
- Creación del proyecto
- Configuración de tablas y relaciones
- Row Level Security (RLS)
- Storage buckets
- Variables de entorno

**Cuándo usar:** Primera vez configurando el proyecto o al crear un nuevo environment.

---

### [CONFIGURAR-REPORTES.md](./CONFIGURAR-REPORTES.md)
**Propósito:** Configuración del módulo de reportes  
**Incluye:**
- Setup de tablas de reportes
- Configuración de permisos
- Tipos de reportes disponibles
- Personalización

**Cuándo usar:** Al activar o modificar el sistema de reportes.

---

### [SETUP-REPORTS.md](./SETUP-REPORTS.md)
**Propósito:** Guía técnica detallada del sistema de reportes  
**Incluye:**
- Arquitectura del módulo
- API endpoints
- Generación de reportes
- Filtros y parámetros

**Cuándo usar:** Para desarrollo o troubleshooting del módulo de reportes.

---

## 🔄 Migraciones

### [MIGRACION-LICITACIONES.md](./MIGRACION-LICITACIONES.md)
**Propósito:** Guía de migración de licitaciones desde sistemas legacy  
**Incluye:**
- Preparación de datos
- Scripts de migración
- Validación post-migración
- Rollback procedures

**Cuándo usar:** Al migrar datos de licitaciones desde otro sistema.

---

## 🗄️ Scripts SQL

Los scripts SQL están organizados en `/database`:

### Schemas (`/database/schemas/`)
- `supabase-schema.sql` - Schema completo principal
- `suppliers-schema.sql` - Tablas de proveedores
- `reports-schema.sql` - Tablas de reportes
- `setup-*.sql` - Scripts de setup iniciales

### Migraciones (`/database/migrations/`)
- `migracion-licitaciones-supabase.sql` - Migración de licitaciones
- `verificar-migracion.sql` - Verificación post-migración

### Seeds (`/database/seeds/`)
- `seed-departments.sql` - Datos de prueba de departamentos

---

## 🎯 Orden Recomendado de Setup

Para un nuevo deployment, sigue este orden:

1. **Configurar Supabase**  
   → Lee `CONFIGURAR-SUPABASE.md`  
   → Ejecuta `database/schemas/supabase-schema.sql`

2. **Configurar Módulos Adicionales**
   ```sql
   database/schemas/suppliers-schema.sql
   database/schemas/reports-schema.sql
   ```

3. **Cargar Datos de Prueba** (opcional)
   ```sql
   database/seeds/seed-departments.sql
   ```

4. **Configurar Reportes** (si se usa)  
   → Lee `CONFIGURAR-REPORTES.md` o `SETUP-REPORTS.md`

5. **Migrar Datos Legacy** (si aplica)  
   → Lee `MIGRACION-LICITACIONES.md`  
   → Ejecuta scripts en `/database/migrations/`

---

## 🆘 Troubleshooting

### Problema: Errores de permisos en queries
**Solución:** Verifica las políticas RLS en `CONFIGURAR-SUPABASE.md`

### Problema: Reportes no se generan
**Solución:** Revisa `SETUP-REPORTS.md` y verifica que las tablas existan

### Problema: Migraciones fallan
**Solución:** Usa `verificar-migracion.sql` para diagnosticar

---

## 📞 Necesitas Ayuda?

Si la documentación no responde tu pregunta:
1. Revisa el README.md principal
2. Busca en el código fuente (`/src`)
3. Contacta al equipo de desarrollo

---

**Última actualización:** Octubre 2025  
**Versión del proyecto:** 2.0.0

