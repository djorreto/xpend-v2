import { cn } from '@/lib/utils'
import Image from 'next/image'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'white' | 'dark'
  showSlogan?: boolean
}

export function Logo({ className, size = 'md', variant = 'default', showSlogan = false }: LogoProps) {
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

  // Tamaños de slogan proporcionales al logo
  const sloganSizes = {
    sm: 'text-[8px]',
    md: 'text-[10px]',
    lg: 'text-sm',
    xl: 'text-base'
  }

  const logoSrc = '/xpend-logo.png'

  // Colores del slogan según variante
  const sloganColors = {
    default: '#C6FF00', // Lima/amarillo vibrante
    white: '#C6FF00',   // Lima/amarillo vibrante
    dark: '#C6FF00'     // Lima/amarillo vibrante
  }

  return (
    <div className={cn('flex flex-col', className)}>
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
