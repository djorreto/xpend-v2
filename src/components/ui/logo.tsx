import { cn } from '@/lib/utils'
import Image from 'next/image'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'white' | 'dark'
}

export function Logo({ className, size = 'md', variant = 'default' }: LogoProps) {
  const heightClasses = {
    sm: 24,
    md: 32,
    lg: 48,
    xl: 64
  }

  const widthClasses = {
    sm: 96,
    md: 128,
    lg: 192,
    xl: 256
  }

  const logoSrc = '/xpend-logo.png'

  return (
    <div className={cn('flex items-center', className)}>
      <Image
        src={logoSrc}
        alt="Xpend"
        width={widthClasses[size]}
        height={heightClasses[size]}
        priority
        className="object-contain"
        style={variant === 'white' ? { 
          filter: 'brightness(0) saturate(100%) invert(100%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(100%) contrast(100%)'
        } : undefined}
      />
    </div>
  )
}

// Logo solo con icono (para espacios pequeños)
export function LogoIcon({ className, size = 'md' }: Omit<LogoProps, 'variant'>) {
  const sizeValues = {
    sm: 24,
    md: 32,
    lg: 48,
    xl: 64
  }

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <Image
        src="/xpend-logo.png"
        alt="X"
        width={sizeValues[size]}
        height={sizeValues[size]}
        priority
        className="object-contain"
      />
    </div>
  )
}
