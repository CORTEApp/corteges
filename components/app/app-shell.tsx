"use client"

import { useState } from "react"

import { AppSidebar } from "@/components/app/app-sidebar"
import { cn } from "@/lib/utils"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div
      className={cn(
        "min-h-screen bg-background text-foreground lg:grid lg:transition-[grid-template-columns] lg:duration-200",
        sidebarCollapsed ? "lg:grid-cols-[6rem_1fr]" : "lg:grid-cols-[19rem_1fr]",
      )}
      data-page-shell="dashboard"
    >
      <AppSidebar
        brandLabel="CORTE.Ges"
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
      />
      <main className="min-w-0 pb-8">{children}</main>
    </div>
  )
}
