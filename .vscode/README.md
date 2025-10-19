# VSCode Settings - Xpend V2

Esta carpeta contiene configuración compartida del equipo para VSCode.

## 📦 Extensiones Recomendadas

Al abrir el proyecto en VSCode, verás una notificación para instalar las extensiones recomendadas.

### Esenciales:
- **ESLint** - Linting de JavaScript/TypeScript
- **Prettier** - Formateo automático de código
- **Tailwind CSS IntelliSense** - Autocompletado de clases Tailwind

### Extras útiles:
- **Error Lens** - Muestra errores inline
- **Pretty TypeScript Errors** - Errores TS más legibles
- **GitLens** - Superpowers para Git
- **Path Intellisense** - Autocompletado de paths
- **Auto Rename Tag** - Renombra tags HTML automáticamente

## ⚙️ Configuración Automática

El archivo `settings.json` configura:
- ✅ **Formateo automático al guardar** (con Prettier)
- ✅ **Fix de ESLint automático** al guardar
- ✅ **Integración con Tailwind CSS**
- ✅ **TypeScript optimizado** para Next.js
- ✅ **Tabs de 2 espacios** (estándar del proyecto)

## 🚀 ¿Cómo usar?

1. **Instala las extensiones recomendadas**
2. **Guarda un archivo** → Se formateará automáticamente
3. **Si no quieres formato automático:**
   - En `settings.json` cambia `"editor.formatOnSave": false`

## 💡 Scripts disponibles

```bash
# Formatear todo el proyecto manualmente
npm run format

# Ver qué archivos necesitan formato (no modifica)
npm run format:check
```

## 🔧 Personalización

Si quieres cambiar algo:
- **Formato global**: Edita `.prettierrc`
- **VSCode específico**: Edita `.vscode/settings.json`
- **Tu configuración personal**: Configura en tu VSCode local (no commitees)

---

**Nota:** Estos settings son opcionales. VSCode funcionará sin ellos, pero tenerlos mejora la consistencia del equipo.

