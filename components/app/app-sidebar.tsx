"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2,
  ChartColumnIncreasing,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ContactRound,
  Database,
  FileCheck2,
  FileClock,
  FileSearch,
  LockKeyhole,
  Menu,
  ReceiptText,
  RefreshCw,
  Settings2,
  Target,
  UserRound,
  UsersRound,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { AppRole } from "@/lib/users/roles"

type NavItemConfig = {
  href: string
  label: string
  icon: LucideIcon
  roles?: readonly AppRole[]
}

type NavGroupConfig = {
  label: string
  items: readonly NavItemConfig[]
}

function BrandMark({ collapsed }: { collapsed?: boolean }) {
  return (
    <span className="inline-flex items-center justify-center overflow-hidden rounded-[var(--radius-panel)] bg-transparent">
      <Image
        src="/brand/corteges/logo-mark.svg"
        alt=""
        aria-hidden="true"
        width="44"
        height="44"
        className={cn("object-contain", collapsed ? "h-9 w-9" : "h-10 w-10")}
      />
    </span>
  )
}

const navGroups: readonly NavGroupConfig[] = [
  {
    label: "Operaciones",
    items: [
      { href: "/clientes", label: "Clientes", icon: ContactRound },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/crm/oportunidades", label: "Oportunidades", icon: Target },
    ],
  },
  {
    label: "Gastos",
    items: [
      { href: "/gastos/recepcion", label: "Recepcion", icon: FileSearch, roles: ["master", "admin"] },
      { href: "/gastos/individuales", label: "Individuales", icon: WalletCards },
      { href: "/proveedores", label: "Proveedores", icon: Building2 },
    ],
  },
  {
    label: "Facturación",
    items: [
      { href: "/facturacion/proformas", label: "Proformas", icon: FileClock },
      { href: "/facturacion/facturas", label: "Facturas", icon: FileCheck2 },
      { href: "/facturacion/aprobacion", label: "Aprobacion", icon: ClipboardCheck, roles: ["master", "admin"] },
      { href: "/facturacion/facturables", label: "Facturables", icon: ReceiptText },
      { href: "/facturacion/suscripciones", label: "Suscripciones", icon: RefreshCw },
    ],
  },
  {
    label: "Estadísticas",
    items: [
      { href: "/estadisticas/facturacion", label: "Facturación", icon: ChartColumnIncreasing },
    ],
  },
  {
    label: "Administración",
    items: [
      { href: "/settings", label: "Configuración", icon: Settings2, roles: ["master", "admin"] },
      { href: "/usuarios", label: "Usuarios", icon: UsersRound },
    ],
  },
  {
    label: "Cuenta",
    items: [
      { href: "/perfil", label: "Mi perfil", icon: UserRound },
    ],
  },
] as const

function NavItem({
  item,
  collapsed,
  mobile = false,
}: {
  item: NavItemConfig
  collapsed?: boolean
  mobile?: boolean
}) {
  const pathname = usePathname() || "/clientes"
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      title={item.label}
      aria-label={item.label}
      className={cn(
        "group relative block cursor-pointer overflow-hidden transition duration-150",
        collapsed && !mobile
          ? "rounded-[var(--radius-panel)] px-2 py-2.5 text-center font-semibold"
          : "rounded-[var(--radius-panel)] px-3 py-2.5 text-sm",
        active
          ? "bg-[color:var(--surface-2)] text-sidebar-foreground shadow-sm ring-1 ring-primary/12"
          : "text-sidebar-foreground/78 hover:bg-sidebar-active/75 hover:text-sidebar-foreground hover:shadow-sm",
      )}
    >
      {active ? (
        <span
          className={cn(
            "absolute rounded-[var(--radius-round)] bg-[color:var(--sidebar-rail)]",
            collapsed && !mobile ? "inset-x-2 top-0 h-1" : "inset-y-2 left-0 w-1",
          )}
          aria-hidden="true"
        />
      ) : null}

      {collapsed && !mobile ? (
        <span className="flex items-center justify-center">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-panel)] border border-primary/15 bg-primary/12 text-primary">
            <Icon className="size-[1.9rem]" aria-hidden="true" />
          </span>
        </span>
      ) : (
        <span className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-panel)] border border-primary/15 bg-primary/12 text-primary">
            <Icon className="size-[1.9rem]" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium tracking-tight">{item.label}</span>
          </span>
        </span>
      )}
    </Link>
  )
}

function NavGroup({
  collapsed,
  mobile = false,
  roles = [],
}: {
  collapsed?: boolean
  mobile?: boolean
  roles?: AppRole[]
}) {
  return (
    <nav className={mobile ? "space-y-5 p-4" : "space-y-5 px-3 py-6"}>
      {navGroups.map((group) => {
        const visibleItems = group.items.filter((item) => {
          return !item.roles?.length || item.roles.some((role) => roles.includes(role))
        })

        if (!visibleItems.length) {
          return null
        }

        return (
        <div key={group.label} className="mb-6">
          {!collapsed || mobile ? (
            <div className="mb-3 flex items-center gap-2 px-2 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/55">
              <span className="h-px flex-1 bg-sidebar-border/70" />
              <span>{group.label}</span>
            </div>
          ) : (
            <div className="mb-4 border-t border-sidebar-border/70" />
          )}

          <div className="space-y-1.5">
            {visibleItems.map((item) => (
              <NavItem key={item.href} item={item} collapsed={collapsed} mobile={mobile} />
            ))}
          </div>
        </div>
        )
      })}
    </nav>
  )
}

export function AppSidebar({
  brandLabel = "CORTE.Ges",
  collapsed = false,
  onToggleCollapse,
  roles = [],
}: {
  brandLabel?: string
  collapsed?: boolean
  onToggleCollapse?: () => void
  roles?: AppRole[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <aside className="hidden border-r border-sidebar-border/85 bg-sidebar/95 text-sidebar-foreground backdrop-blur lg:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="px-4 py-5">
            <Link
              href="/clientes"
              aria-label="CORTE.Ges"
              className={cn(
                "relative overflow-hidden rounded-[var(--radius-shell)] border border-sidebar-border/70 bg-[color:var(--surface-1)]/80 shadow-sm",
                collapsed ? "flex justify-center px-2 py-3 text-center" : "flex px-3 py-3",
              )}
            >
              <div className="absolute -right-4 -top-5 h-16 w-16 rounded-[var(--radius-round)] bg-primary/12 blur-2xl" aria-hidden="true" />
              {collapsed ? (
                <BrandMark collapsed />
              ) : (
                <span className="relative flex min-w-0 items-center gap-3">
                  <BrandMark />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold tracking-tight text-sidebar-foreground">{brandLabel}</span>
                  </span>
                </span>
              )}
            </Link>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <NavGroup collapsed={collapsed} roles={roles} />
          </div>

          <div className={cn("border-t border-sidebar-border/80 px-3 py-3", collapsed ? "space-y-2" : "space-y-3")}>
            <div className={cn("grid gap-2 text-xs leading-5 text-sidebar-foreground/70", collapsed ? "justify-items-center" : "")}>
              <div className="flex items-center gap-2 rounded-[var(--radius-panel)] px-2 py-1.5" title="Acceso privado">
                <LockKeyhole className="size-3.5" aria-hidden="true" />
                {collapsed ? null : "Acceso privado"}
              </div>
              <div className="flex items-center gap-2 rounded-[var(--radius-panel)] px-2 py-1.5" title="Supabase">
                <Database className="size-3.5" aria-hidden="true" />
                {collapsed ? null : "Supabase"}
              </div>
            </div>
            <div className={cn("flex", collapsed ? "justify-center" : "justify-end")}>
              {onToggleCollapse ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onToggleCollapse}
                  aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
                  title={collapsed ? "Expandir menú" : "Colapsar menú"}
                >
                  {collapsed ? <ChevronRight className="size-4" aria-hidden="true" /> : <ChevronLeft className="size-4" aria-hidden="true" />}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </aside>

      <div className="border-b border-border bg-background px-4 py-3 lg:hidden">
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Menu className="size-4" aria-hidden="true" />
          Abrir menú
        </Button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/60 lg:hidden">
          <div className="flex h-full w-[18rem] max-w-[85vw] flex-col overflow-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <BrandMark />
                <div className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">{brandLabel}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Cerrar menú">
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto" onClick={() => setOpen(false)}>
              <NavGroup mobile roles={roles} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
