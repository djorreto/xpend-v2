'use client'

import { PERSPECTIVE_LABEL, type Perspective } from '@/lib/perspective'

// Selector de perspectiva: cambia lo que se muestra, no la identidad ni los permisos.
export function PerspectiveSwitcher({ options, value, onChange }: { options: Perspective[]; value: Perspective; onChange: (next: Perspective) => void }) {
  if (options.length < 2) return null
  return (
    <div role="group" aria-label="Perspectiva" data-testid="selector-perspectiva" className="inline-flex rounded-full border border-petrol-blue/15 bg-white/70 p-1">
      {options.map(item => (
        <button
          key={item}
          type="button"
          data-testid={`perspectiva-${item}`}
          aria-pressed={value === item}
          onClick={() => onChange(item)}
          className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition ${value === item ? 'bg-petrol-blue text-white shadow-sm' : 'text-petrol-blue hover:bg-white'}`}
        >
          {PERSPECTIVE_LABEL[item]}
        </button>
      ))}
    </div>
  )
}
