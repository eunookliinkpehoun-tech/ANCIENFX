"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import type { DashboardState } from "@/lib/dashboard-types"

type DashboardContextValue = {
  state: DashboardState | null
  loading: boolean
  refresh: () => Promise<void>
  connectModalOpen: boolean
  openConnectModal: () => void
  closeConnectModal: () => void
}

export const DASHBOARD_STATE_EVENT = "fxmirror:dashboard-state"

function notifyDashboardState(mt5Connected: boolean) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(DASHBOARD_STATE_EVENT, { detail: { mt5Connected } }))
}

const DashboardContext = createContext<DashboardContextValue>({
  state: null,
  loading: true,
  refresh: async () => {},
  connectModalOpen: false,
  openConnectModal: () => {},
  closeConnectModal: () => {},
})

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DashboardState | null>(null)
  const [loading, setLoading] = useState(true)
  const [connectModalOpen, setConnectModalOpen] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" })
      if (res.status === 401) {
        window.location.href = "/"
        return
      }
      const data = await res.json()
      if (data.ok) {
        setState({
          user: data.user,
          mt5Account: data.mt5Account,
          botState: data.botState,
          botSession: data.botSession,
          copyTradeEnabled: data.copyTradeEnabled,
        })
        notifyDashboardState(data.mt5Account?.status === "connected")
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = window.setInterval(refresh, 30000)
    return () => window.clearInterval(interval)
  }, [refresh])

  return (
    <DashboardContext.Provider
      value={{
        state,
        loading,
        refresh,
        connectModalOpen,
        openConnectModal: () => setConnectModalOpen(true),
        closeConnectModal: () => setConnectModalOpen(false),
      }}
    >
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  return useContext(DashboardContext)
}
