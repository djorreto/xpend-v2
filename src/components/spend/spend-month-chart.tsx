'use client'

export function SpendMonthChart({
  months,
  currency,
}: {
  months: { month: string; amount: number }[]
  currency: string
}) {
  const max = Math.max(...months.map(item => item.amount), 1)
  if (!months.length) {
    return <p className="text-sm text-muted-foreground">No hay meses para graficar en esta ventana.</p>
  }
  return (
    <div className="space-y-1">
      {months.map(item => (
        <div key={item.month} className="flex items-center gap-2 text-xs">
          <span className="w-16 text-muted-foreground">{item.month}</span>
          <div className="h-3 flex-1 rounded bg-muted">
            <div className="h-3 rounded bg-[#2AD4D2]" style={{ width: `${Math.max(2, (item.amount / max) * 100)}%` }} />
          </div>
          <span className="w-32 text-right tabular-nums">{Math.round(item.amount).toLocaleString('es-CL')} {currency}</span>
        </div>
      ))}
    </div>
  )
}
