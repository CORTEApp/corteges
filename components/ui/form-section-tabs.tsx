"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

export type FormSectionTab = {
  id: string
  label: string
  description?: string
  icon?: ReactNode
}

type FormSectionTabsContextValue = {
  activeTab: string
  setActiveTab: (tabId: string) => void
  tabs: FormSectionTab[]
}

const FormSectionTabsContext = createContext<FormSectionTabsContextValue | null>(null)
const TAB_SYNC_EVENT = "skynet:form-section-tabs-sync"

function useFormSectionTabs() {
  const context = useContext(FormSectionTabsContext)
  if (!context) {
    throw new Error("FormSection tabs must be used inside FormSectionTabsProvider.")
  }
  return context
}

function hashValue() {
  if (typeof window === "undefined") {
    return ""
  }
  return window.location.hash.replace(/^#/, "")
}

export function FormSectionTabsProvider({
  tabs,
  defaultTab,
  hashSync = true,
  children,
}: {
  tabs: FormSectionTab[]
  defaultTab?: string
  hashSync?: boolean
  children: ReactNode
}) {
  const validTabIds = useMemo(() => new Set(tabs.map((tab) => tab.id)), [tabs])
  const firstTab = defaultTab && validTabIds.has(defaultTab) ? defaultTab : tabs[0]?.id
  const [activeTab, setActiveTabState] = useState(firstTab ?? "")

  useEffect(() => {
    if (!hashSync) {
      return
    }

    let initialSyncFrame: number | null = null
    const nextHash = hashValue()
    if (validTabIds.has(nextHash)) {
      initialSyncFrame = window.requestAnimationFrame(() => setActiveTabState(nextHash))
    }

    function handleHashChange() {
      const hash = hashValue()
      if (validTabIds.has(hash)) {
        setActiveTabState(hash)
      }
    }

    function handleSync(event: Event) {
      const detail = (event as CustomEvent<{ tabId?: string }>).detail
      if (detail?.tabId && validTabIds.has(detail.tabId)) {
        setActiveTabState(detail.tabId)
      }
    }

    window.addEventListener("hashchange", handleHashChange)
    window.addEventListener(TAB_SYNC_EVENT, handleSync)
    return () => {
      window.removeEventListener("hashchange", handleHashChange)
      window.removeEventListener(TAB_SYNC_EVENT, handleSync)
      if (initialSyncFrame != null) {
        window.cancelAnimationFrame(initialSyncFrame)
      }
    }
  }, [hashSync, validTabIds])

  function setActiveTab(tabId: string) {
    if (!validTabIds.has(tabId)) {
      return
    }
    setActiveTabState(tabId)
    if (hashSync) {
      window.history.replaceState(null, "", `#${tabId}`)
      window.dispatchEvent(new CustomEvent(TAB_SYNC_EVENT, { detail: { tabId } }))
    }
  }

  return (
    <FormSectionTabsContext.Provider value={{ activeTab, setActiveTab, tabs }}>
      {children}
    </FormSectionTabsContext.Provider>
  )
}

export function FormSectionTabList({ className }: { className?: string }) {
  const { activeTab, setActiveTab, tabs } = useFormSectionTabs()

  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto rounded-[var(--radius-shell)] border border-border/80 bg-[color:var(--surface-1)] p-2 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.22)]",
        className,
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const selected = activeTab === tab.id
        return (
          <button
            aria-controls={`${tab.id}-panel`}
            aria-selected={selected}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[var(--radius-control)] border px-3.5 py-2 text-sm font-semibold transition",
              selected
                ? "border-primary/20 bg-primary text-white shadow-sm shadow-primary/20"
                : "border-transparent bg-transparent text-foreground/75 hover:border-border hover:bg-accent/60 hover:text-foreground",
            )}
            id={`${tab.id}-tab`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function FormSectionTabPanel({
  tabId,
  children,
  className,
}: {
  tabId: string
  children: ReactNode
  className?: string
}) {
  const { activeTab } = useFormSectionTabs()
  const selected = activeTab === tabId

  return (
    <div
      aria-labelledby={`${tabId}-tab`}
      className={cn(selected ? "grid gap-6" : "hidden", className)}
      id={`${tabId}-panel`}
      role="tabpanel"
    >
      {children}
    </div>
  )
}
