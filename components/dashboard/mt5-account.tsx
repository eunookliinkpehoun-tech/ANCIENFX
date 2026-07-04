"use client"

import { isMt5Connected } from "@/lib/dashboard-types"
import { AnimatedNumber } from "./animated-number"
import { useDashboard } from "./dashboard-context"

export function Mt5Account() {
  const { state, loading, openConnectModal } = useDashboard()
  const account = state?.mt5Account ?? null
  const connected = isMt5Connected(account)
  const trialActive = state?.user.trialActive

  if (loading) {
    return (
      <section className="mt5-card glass-panel reveal">
        <div className="mt5-loading">Chargement du compte MT4/MT5...</div>
      </section>
    )
  }

  if (!connected || !account) {
    return (
      <section className="mt5-card mt5-empty glass-panel reveal">
        <button type="button" className="mt5-add-btn" onClick={openConnectModal}>
          <span className="mt5-add-icon">+</span>
          <span className="mt5-add-label">AJOUTER UN COMPTE</span>
          <span className="mt5-add-hint">
            {trialActive
              ? "Essai 3 jours — compte DEMO uniquement"
              : "Connectez votre compte MetaTrader 4/5"}
          </span>
        </button>
      </section>
    )
  }

  const infoRows = [
    { label: "Courtier", value: account.broker || "—" },
    { label: "Serveur", value: account.server },
    { label: "Numéro de compte", value: account.login },
    { label: "Type de compte", value: account.accountType || "—" },
    { label: "Levier", value: account.leverage ? `1:${account.leverage}` : "—" },
  ]

  const profitPrefix = account.dailyProfit >= 0 ? "+" : ""

  return (
    <section className="mt5-card glass-panel reveal">
      <div className="mt5-left">
        <div className="holo-ring">
          <span className="holo-ring-spin" />
          <span className="holo-ring-spin slow" />
          <div className="holo-core">
            <span className="holo-mt">MT</span>
            <span className="holo-5">5</span>
          </div>
        </div>
        <span className="status-badge connected">
          <span className="dot" />
          COMPTE CONNECTÉ
        </span>
        {account.isDemo && (
          <span className="status-badge demo">ESSAI DEMO</span>
        )}
      </div>

      <div className="mt5-center">
        <h2 className="mt5-title">MetaTrader 4/5 Connecté</h2>
        <p className="mt5-sub">Synchronisation active avec le serveur MT4/MT5.</p>
        <div className="mt5-info-grid">
          {infoRows.map((r) => (
            <div className="mt5-info-item" key={r.label}>
              <span className="mt5-info-label">{r.label}</span>
              <span className="mt5-info-value">{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt5-balance">
        <div className="balance-main">
          <span className="balance-label">Solde actuel</span>
          <span className="balance-value">
            <AnimatedNumber value={account.balance} /> <small>{account.currency}</small>
          </span>
        </div>
        <div className="balance-sub">
          <div className="bal-stat">
            <span className="bal-stat-label">Équité</span>
            <span className="bal-stat-value equity">
              <AnimatedNumber value={account.equity} /> <small>{account.currency}</small>
            </span>
          </div>
          <div className="bal-stat">
            <span className="bal-stat-label">Marge libre</span>
            <span className="bal-stat-value margin">
              <AnimatedNumber value={account.freeMargin} /> <small>{account.currency}</small>
            </span>
          </div>
          <div className="bal-stat">
            <span className="bal-stat-label">Profit du jour</span>
            <span className="bal-stat-value profit">
              {profitPrefix}
              <AnimatedNumber value={Math.abs(account.dailyProfit)} /> <small>{account.currency}</small>
            </span>
          </div>
        </div>
      </div>

      <div className="sync-bar">
        <div className="sync-bar-left">
          <span className="sync-pulse" />
          <span className="sync-text">Synchronisation Temps Réel Active</span>
        </div>
        <svg className="sync-graph" viewBox="0 0 240 40" preserveAspectRatio="none" aria-hidden="true">
          <polyline
            points="0,30 20,26 40,28 60,18 80,22 100,12 120,20 140,8 160,16 180,6 200,14 220,4 240,10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </section>
  )
}
