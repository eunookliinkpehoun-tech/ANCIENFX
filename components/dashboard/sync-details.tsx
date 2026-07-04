"use client"

import { useDashboard } from "./dashboard-context"
import { isMt5Connected } from "@/lib/dashboard-types"

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}
function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 4v5h-5" />
    </svg>
  )
}
function ExchangeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 10h12l-3-3" />
      <path d="M17 14H5l3 3" />
    </svg>
  )
}
function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h3l2 5 4-10 2 5h7" />
    </svg>
  )
}

const blocks = [
  { icon: <ClockIcon />, label: "Date de connexion", value: "12 Juin 2026", note: "09:14:22" },
  { icon: <RefreshIcon />, label: "Dernière synchronisation", value: "Il y a 3 sec", note: "14:32:05" },
  { icon: <ExchangeIcon />, label: "Dernière transaction copiée", value: "EUR/USD · BUY", note: "+€45.20" },
]

export function SyncDetails() {
  const { state, loading } = useDashboard()

  if (loading || !isMt5Connected(state?.mt5Account)) return null

  return (
    <section className="reveal">
      <h3 className="dash-section-title">Détails de Synchronisation</h3>
      <div className="sync-grid glass-panel">
        {blocks.map((b) => (
          <div className="sync-block" key={b.label}>
            <span className="sync-block-icon">{b.icon}</span>
            <div>
              <span className="sync-block-label">{b.label}</span>
              <span className="sync-block-value">{b.value}</span>
              <span className="sync-block-note">{b.note}</span>
            </div>
          </div>
        ))}
        <div className="sync-block health">
          <span className="sync-block-icon health-icon">
            <HeartIcon />
          </span>
          <div>
            <span className="sync-block-label">Santé de synchronisation</span>
            <span className="health-badge excellent">Excellent</span>
            <div className="health-bars" aria-hidden="true">
              <span className="on" />
              <span className="on" />
              <span className="on" />
              <span className="on" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
