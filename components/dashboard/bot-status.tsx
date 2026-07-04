"use client"

import { useState } from "react"
import { useDashTheme } from "./app-shell"
import { useDashboard } from "./dashboard-context"

function RobotIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="8" width="16" height="11" rx="3" />
      <path d="M12 8V4" />
      <circle cx="12" cy="3" r="1" />
      <circle cx="9" cy="13" r="1.4" />
      <circle cx="15" cy="13" r="1.4" />
      <path d="M9.5 16.5h5" />
      <path d="M2 12v3M22 12v3" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <line x1="10" y1="9" x2="10" y2="15" />
      <line x1="14" y1="9" x2="14" y2="15" />
    </svg>
  )
}

function OfflineRobotIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="8" width="16" height="11" rx="3" />
      <path d="M12 8V4" />
      <circle cx="12" cy="3" r="1" />
      <path d="M9 13l1.5 1.5M10.5 13L9 14.5" />
      <path d="M14 13l1.5 1.5M15.5 13L14 14.5" />
      <path d="M9.5 16.8c1.6-.8 3.4-.8 5 0" />
    </svg>
  )
}

export function BotStatus() {
  const { state, loading, refresh, openConnectModal } = useDashboard()
  const { notify } = useDashTheme()
  const [actionLoading, setActionLoading] = useState(false)

  if (loading) {
    return (
      <section className="reveal">
        <h3 className="dash-section-title">État du Bot Copieur</h3>
        <div className="bot-card glass-panel">Chargement...</div>
      </section>
    )
  }

  const botState = state?.botState ?? "offline"
  const botSession = state?.botSession ?? null
  const amountDue = botSession?.amountDue ?? 0

  async function handleStart() {
    setActionLoading(true)
    try {
      const res = await fetch("/api/bot/start", { method: "POST" })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        notify("error", data.message || "Impossible de démarrer le bot.")
        return
      }
      notify("success", data.message)
      await refresh()
    } finally {
      setActionLoading(false)
    }
  }

  async function handlePayment() {
    setActionLoading(true)
    try {
      const res = await fetch("/api/payments/settle", { method: "POST" })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        notify("error", data.message || "Paiement impossible.")
        return
      }
      notify("success", data.message)
      await refresh()
    } finally {
      setActionLoading(false)
    }
  }

  if (botState === "offline") {
    return (
      <section className="reveal">
        <h3 className="dash-section-title">État du Bot Copieur</h3>
        <div className="bot-grid bot-grid-single">
          <BotCard
            stateKey="offline"
            icon={<OfflineRobotIcon />}
            badge="BOT HORS LIGNE"
            title="Bot Hors Ligne"
            desc="Le compte MT4/MT5 n'est pas connecté. Veuillez reconnecter votre compte."
            btn="RECONNECTER MT4/MT5"
            onClick={openConnectModal}
            loading={actionLoading}
          />
        </div>
      </section>
    )
  }

  if (botState === "payment_due") {
    const btnLabel = `RÉGLER LE PAIEMENT ($${amountDue.toFixed(2)})`
    return (
      <section className="reveal">
        <h3 className="dash-section-title">État du Bot Copieur</h3>
        <div className="bot-grid bot-grid-single">
          <BotCard
            stateKey="pause"
            icon={<PauseIcon />}
            badge="BOT EN PAUSE"
            title="Bot en Pause"
            desc="Paiement en attente. La synchronisation est suspendue jusqu'au règlement (50/50 des gains)."
            btn={btnLabel}
            onClick={handlePayment}
            loading={actionLoading}
          />
        </div>
      </section>
    )
  }

  const isRunning = botState === "running"
  const profit = botSession?.profit
  const cycleEnds = botSession?.cycleEndsAt
    ? new Date(botSession.cycleEndsAt).toLocaleString("fr-FR")
    : null

  return (
    <section className="reveal">
      <h3 className="dash-section-title">État du Bot Copieur</h3>
      <div className="bot-grid bot-grid-single">
        <BotCard
          stateKey="active"
          icon={<RobotIcon />}
          badge={isRunning ? "BOT EN COURS" : "BOT ACTIF"}
          title={isRunning ? "Bot en cours d'exécution" : "Bot Actif"}
          desc={
            isRunning
              ? `Cycle 24h en cours. Fin prévue : ${cycleEnds}. Solde de départ : $${botSession?.startBalance?.toFixed(2) ?? "—"}.`
              : "Cliquez sur START pour enregistrer le solde actuel et démarrer le cycle de 24h."
          }
          btn={isRunning ? "EN COURS..." : "START"}
          locked={isRunning}
          onClick={isRunning ? undefined : handleStart}
          loading={actionLoading}
        />
      </div>
      {isRunning && profit != null && (
        <p className="bot-cycle-note">Profit provisoire : {profit >= 0 ? "+" : ""}{profit.toFixed(2)} USD</p>
      )}
    </section>
  )
}

function BotCard({
  stateKey,
  icon,
  badge,
  title,
  desc,
  btn,
  locked = false,
  onClick,
  loading = false,
}: {
  stateKey: "active" | "pause" | "offline"
  icon: React.ReactNode
  badge: string
  title: string
  desc: string
  btn: string
  locked?: boolean
  onClick?: () => void
  loading?: boolean
}) {
  return (
    <div className={`bot-card glass-panel state-${stateKey}`}>
      <div className="bot-card-head">
        <span className="bot-icon">
          <span className="bot-icon-ring" />
          {icon}
        </span>
        <span className="bot-badge">
          <span className="dot" />
          {badge}
        </span>
      </div>
      <h4 className="bot-title">{title}</h4>
      <p className="bot-desc">{desc}</p>
      <button
        className={`bot-btn${locked ? " locked" : ""}`}
        disabled={locked || loading}
        onClick={onClick}
        type="button"
      >
        {locked && <span className="lock">🔒</span>}
        {loading ? "..." : btn}
      </button>
    </div>
  )
}
