import { SYSTEM_TEMPLATES, validateDefinition } from '../../src/lib/methodology.ts'
const q = (s: string) => `'${s.replace(/'/g, "''")}'`
const out = ['-- Plantillas del sistema (generado por scripts/methodology/emit-system-templates.mts desde src/lib/methodology.ts)']
for (const t of SYSTEM_TEMPLATES) {
  const errors = validateDefinition(t.definition)
  if (errors.length) throw new Error(`${t.template_key}: ${errors.join('; ')}`)
  out.push(`insert into public.methodology_templates (company_id, template_key, kind, name, description, version, status, definition, published_at)
select null, ${q(t.template_key)}, ${q(t.kind)}, ${q(t.name)}, ${q(t.description)}, 1, 'published', ${q(JSON.stringify(t.definition))}::jsonb, now()
where not exists (select 1 from public.methodology_templates where company_id is null and template_key = ${q(t.template_key)} and version = 1);`)
}
console.log(out.join('\n'))
