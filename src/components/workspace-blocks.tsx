'use client'

import Link from 'next/link'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type BlockItem = { id: string; title: string; detail?: string; reason?: string; href?: string; cta?: string; note?: string }

export function BlockCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: { label: string; href: string }
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="text-[15px] font-medium tracking-tight text-petrol-blue">{title}</CardTitle>
          {description && <CardDescription className="mt-1 text-[12px]">{description}</CardDescription>}
        </div>
        {action && (
          <Link href={action.href} className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-petrol-blue/70 hover:text-petrol-blue hover:underline">
            {action.label}
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        )}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  )
}

export function ItemList({ items, empty, limit = 6 }: { items: BlockItem[]; empty: React.ReactNode; limit?: number }) {
  if (!items.length) return <EmptyHint>{empty}</EmptyHint>
  return (
    <ul className="divide-y divide-petrol-blue/[0.06]">
      {items.slice(0, limit).map(item => (
        <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            {item.href ? (
              <Link href={item.href} className="block truncate text-[14px] font-medium text-petrol-blue hover:underline">{item.title}</Link>
            ) : (
              <p className="truncate text-[14px] font-medium text-petrol-blue">{item.title}</p>
            )}
            {item.detail && <p className="truncate text-[12.5px] text-petrol-blue/75">{item.detail}</p>}
            {item.reason && <p className="text-[12.5px] text-petrol-blue"><span className="font-medium">Por qué: </span>{item.reason}</p>}
            {item.note && <p className="text-[12px] text-petrol-blue/75">{item.note}</p>}
          </div>
          {item.cta && item.href && (
            <Link
              href={item.href}
              className="shrink-0 rounded-full border border-petrol-blue/15 bg-white/70 px-3 py-1 text-[12px] font-medium text-petrol-blue transition-colors hover:bg-white"
            >
              {item.cta}
            </Link>
          )}
        </li>
      ))}
      {items.length > limit && <li className="pt-2 text-[12px] text-petrol-blue/75">Y {items.length - limit} más.</li>}
    </ul>
  )
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-petrol-blue/15 px-4 py-5 text-[12.5px] text-petrol-blue/75">{children}</div>
}

export function QuickAction({ href, icon: Icon, label, hint, primary }: { href: string; icon: LucideIcon; label: string; hint: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex flex-col items-start gap-2 rounded-2xl border p-3 transition-all hover:-translate-y-0.5 sm:flex-row sm:gap-3 sm:p-4',
        primary
          ? 'border-petrol-blue bg-petrol-blue text-white shadow-[0_16px_30px_-20px_rgba(45,62,61,0.8)]'
          : 'border-white/70 bg-white/60 text-petrol-blue hover:bg-white/85'
      )}
    >
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', primary ? 'bg-accent-mint text-petrol-blue' : 'bg-petrol-blue/[0.06] text-petrol-blue')}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span>
        <span className="block text-[13.5px] font-medium">{label}</span>
        <span className={cn('hidden text-[12px] sm:block', primary ? 'text-white/70' : 'text-petrol-blue/75')}>{hint}</span>
      </span>
    </Link>
  )
}

export function Metric({ label, value, hint, href }: { label: string; value: React.ReactNode; hint?: string; href?: string }) {
  const body = (
    <>
      <p className="text-[12px] font-medium tracking-wide text-petrol-blue/75">{label}</p>
      <div className="mt-2 text-[1.6rem] font-medium tracking-tight text-petrol-blue">{value}</div>
      {hint && <p className="mt-0.5 text-[12px] text-petrol-blue/75">{hint}</p>}
    </>
  )
  return href ? (
    <Link href={href} className="glass-card block p-4 hover:-translate-y-0.5">{body}</Link>
  ) : (
    <div className="glass-card p-4">{body}</div>
  )
}

export function ActivityTile({
  label,
  value,
  breakdown,
  definition,
  href,
}: {
  label: string
  value: number
  breakdown: string
  definition: string
  href: string
}) {
  return (
    <Link
      href={href}
      title={definition}
      aria-label={`${label}: ${value}. ${definition} Abrir los registros.`}
      className="glass-card flex flex-col p-4 hover:-translate-y-0.5"
    >
      <p className="text-[13px] font-medium text-petrol-blue">{label}</p>
      <p className="mt-1 text-[1.75rem] font-medium leading-none tracking-tight text-petrol-blue">{value}</p>
      <p className="mt-2 text-[12.5px] font-medium text-petrol-blue/80">{breakdown}</p>
      <p className="mt-1 text-[12px] leading-snug text-petrol-blue/75">{definition}</p>
      <span className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-petrol-blue underline-offset-2">
        Ver registros
        <ArrowRight className="h-3 w-3" aria-hidden />
      </span>
    </Link>
  )
}
