'use client'

import { useEffect, useState } from 'react'
import { Building2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/toast'
import { supabaseBrowser } from '@/lib/supabase'

type CompanyOption = {
  id: string
  name: string
}

type VersionSelectorProps = {
  tone?: 'default' | 'sidebar'
  fullWidth?: boolean
}

export function VersionSelector({ tone = 'default', fullWidth = false }: VersionSelectorProps) {
  const { addToast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [selectedCompany, setSelectedCompany] = useState<CompanyOption | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const supabase = supabaseBrowser()
        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user
        if (!user) throw new Error('Usuario no autenticado')

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, company_id')
          .eq('id', user.id)
          .single()

        if (profileError || !profile) throw new Error('Perfil no encontrado')
        if (!profile.company_id) {
          setCompanies([])
          setSelectedCompany(null)
          return
        }

        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('id, name')
          .in('id', [profile.company_id])

        if (companyError) throw companyError

        const opts = (companyData || []).map(c => ({ id: c.id, name: c.name }))
        setCompanies(opts)
        setSelectedCompany(opts[0] || null)
      } catch (err) {
        console.error('Error loading companies for selector:', err)
        addToast({
          type: 'error',
          title: 'Error',
          message: 'No se pudo cargar la empresa'
        })
      } finally {
        setLoading(false)
      }
    }

    loadCompanies()
  }, [addToast])

  const hasMultiple = companies.length > 1

  const buttonClasses =
    tone === 'sidebar'
      ? 'h-10 px-3 text-sm font-semibold bg-[#1f2f2e] text-white hover:bg-[#26403f] border border-[#2AD4D2]/40 justify-between w-full'
      : 'h-8 px-3 text-xs font-medium'

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={tone === 'sidebar' ? 'default' : 'outline'}
          className={buttonClasses}
          style={tone === 'sidebar' ? { boxShadow: '0 2px 6px rgba(0,0,0,0.15)' } : undefined}
        >
          <Building2 className="mr-2 h-3 w-3" />
          <span className="hidden sm:inline">
            {selectedCompany?.name || (loading ? 'Cargando...' : 'Sin empresa')}
          </span>
          <ChevronDown className="ml-1 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {hasMultiple ? (
          companies.map(company => (
            <DropdownMenuItem
              key={company.id}
              onClick={() => {
                setSelectedCompany(company)
                setIsOpen(false)
              }}
              className="flex items-center space-x-3 p-3 cursor-pointer"
            >
              <div className="p-2 rounded-lg bg-muted">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">{company.name}</div>
                <p className="text-xs text-muted-foreground">Seleccionar empresa</p>
              </div>
              {selectedCompany?.id === company.id && <div className="h-2 w-2 rounded-full bg-primary" />}
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem className="flex items-center space-x-3 p-3 text-xs text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span>{loading ? 'Cargando...' : 'No hay más empresas asociadas'}</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

