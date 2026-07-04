"use client"

import { Mt5Account } from "@/components/dashboard/mt5-account"
import { BotStatus } from "@/components/dashboard/bot-status"
import { SyncDetails } from "@/components/dashboard/sync-details"
import { Performance } from "@/components/dashboard/performance"
import { AppShell } from "@/components/dashboard/app-shell"
import { DashboardProvider, useDashboard } from "@/components/dashboard/dashboard-context"
import { Mt5ConnectModal } from "@/components/dashboard/mt5-connect-modal"
import { isMt5Connected } from "@/lib/dashboard-types"

function DashboardContent() {
  const { state, loading } = useDashboard()
  const firstName = state?.user.name?.split(" ")[0] || "..."
  const connected = isMt5Connected(state?.mt5Account)

  return (
    <>
      <div className="dash-welcome reveal">
        <h1>Bonjour, {loading ? "..." : firstName} 👋</h1>
        <p>
          {connected
            ? "Voici un aperçu de vos performances MT4/MT5 aujourd'hui."
            : "Connectez votre compte MetaTrader 4/5 pour activer la synchronisation."}
        </p>
        {state?.user.trialActive && (
          <p className="dash-trial-banner">
            Essai gratuit — {state.user.trialEndsAt
              ? `expire le ${new Date(state.user.trialEndsAt).toLocaleDateString("fr-FR")}`
              : "3 jours"} (compte DEMO uniquement)
          </p>
        )}
      </div>

      <Mt5Account />
      <BotStatus />
      <SyncDetails />
      <Performance />
      <Mt5ConnectModal />
    </>
  )
}

export default function DashboardPage() {
  return (
    <DashboardProvider>
      <AppShell>
        <DashboardContent />
      </AppShell>
    </DashboardProvider>
  )
}
