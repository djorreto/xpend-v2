'use client'

import { Download } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function SpendDownloadButton({
  uploadId,
  label = 'Descargar Excel',
  variant = 'outline',
  size,
}: {
  uploadId?: string
  label?: string
  variant?: 'outline' | 'default' | 'ghost'
  size?: 'sm' | 'default' | 'lg'
}) {
  if (!uploadId) return null
  return (
    <a
      href={`/api/si/export?upload_id=${uploadId}`}
      className={cn(buttonVariants({ variant, size }))}
    >
      <Download className="h-4 w-4 mr-2" />
      {label}
    </a>
  )
}
