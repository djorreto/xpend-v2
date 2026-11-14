import Link from 'next/link'
import { SOURCE_LABEL, hrefForSource, sourceExplain, type ClassificationSource } from '@/lib/spend-flow'

const TONE: Record<ClassificationSource, string> = {
  regla: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  taxonomia: 'bg-teal-50 text-teal-800 border-teal-200',
  modelo: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  llm: 'bg-sky-50 text-sky-800 border-sky-200',
  humano: 'bg-amber-50 text-amber-900 border-amber-200',
  pendiente: 'bg-gray-50 text-gray-600 border-gray-200',
}

export function ClassificationSourceBadge({
  source,
  href,
}: {
  source: ClassificationSource
  href?: string
}) {
  const target = href || hrefForSource(source)
  return (
    <Link
      href={target}
      title={sourceExplain(source)}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${TONE[source]}`}
    >
      {SOURCE_LABEL[source]}
    </Link>
  )
}
