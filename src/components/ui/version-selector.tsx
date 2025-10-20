'use client'

import { useState } from 'react'
import { Database, Layers, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useVersion } from '@/contexts/version-context'
import { cn } from '@/lib/utils'

export function VersionSelector() {
  const { version, setVersion, isFunctional, isMockup, isDemo } = useVersion()
  const [isOpen, setIsOpen] = useState(false)

  // Hide version selector for demo users
  if (isDemo) {
    return null
  }

  const versions = [
    {
      id: 'functional' as const,
      name: 'Funcional',
      description: 'Datos reales de Supabase',
      icon: Database,
      color: 'text-[#2D3E3D] border-[#C6FF00]',
      bgColor: '#C6FF00',
      badge: 'LIVE'
    },
    {
      id: 'mockup' as const,
      name: 'Mock-up',
      description: 'Datos simulados para demo',
      icon: Layers,
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      bgColor: undefined,
      badge: 'DEMO'
    }
  ]

  const currentVersion = versions.find(v => v.id === version)

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="h-8 px-3 text-xs font-medium"
        >
          {currentVersion && (
            <>
              <currentVersion.icon className="h-3 w-3 mr-2" />
              <span className="hidden sm:inline">{currentVersion.name}</span>
              <Badge 
                variant="outline" 
                className={cn(
                  'ml-2 text-[10px] px-1.5 py-0.5',
                  currentVersion.color
                )}
                style={currentVersion.bgColor ? { backgroundColor: currentVersion.bgColor, borderColor: currentVersion.bgColor } : undefined}
              >
                {currentVersion.badge}
              </Badge>
              <ChevronDown className="h-3 w-3 ml-1" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {versions.map((versionOption) => {
          const Icon = versionOption.icon
          const isSelected = versionOption.id === version
          
          return (
            <DropdownMenuItem
              key={versionOption.id}
              onClick={() => {
                setVersion(versionOption.id)
                setIsOpen(false)
              }}
              className={cn(
                'flex items-center space-x-3 p-3 cursor-pointer',
                isSelected && 'bg-accent'
              )}
            >
              <div 
                className="p-2 rounded-lg"
                style={versionOption.bgColor ? { backgroundColor: versionOption.bgColor } : undefined}
              >
                <Icon className="h-4 w-4" style={versionOption.bgColor ? { color: '#2D3E3D' } : undefined} />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-sm">
                    {versionOption.name}
                  </span>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      'text-[10px] px-1.5 py-0.5',
                      versionOption.color
                    )}
                    style={versionOption.bgColor ? { backgroundColor: versionOption.bgColor, borderColor: versionOption.bgColor } : undefined}
                  >
                    {versionOption.badge}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {versionOption.description}
                </p>
              </div>
              
              {isSelected && (
                <div className="w-2 h-2 rounded-full bg-primary" />
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

