"use client"

import { useDashboard } from "./dashboard-context"
import { isMt5Connected } from "@/lib/dashboard-types"

const ops = [
  { date: "Auj. 14:15", pair: "EUR/USD", type: "BUY", amount: "+€45.20", win: true },
  { date: "Auj. 11:30", pair: "GBP/JPY", type: "SELL", amount: "+€112.50", win: true },
  { date: "Hier 16:45", pair: "XAU/USD", type: "BUY", amount: "-€24.00", win: false },
  { date: "Hier 09:20", pair: "USD/JPY", type: "SELL", amount: "+€67.80", win: true },
]

export function Performance() {
  const { state, loading } = useDashboard()

  if (loading || !isMt5Connected(state?.mt5Account)) return null

  return (
    <section className="perf-grid reveal">
      <div className="glass-panel chart-card">
        <div className="chart-head">
          <h3 className="dash-section-title flush">Croissance du Capital</h3>
          <span className="chart-tag">+18.4% ce mois</span>
        </div>
        <div className="chart-body">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="chart-svg" aria-hidden="true">
            <defs>
              <linearGradient id="capFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--d-blue)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--d-blue)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,100 L0,82 Q18,72 34,80 T64,46 T84,30 T100,16 L100,100 Z" fill="url(#capFill)" />
            <path
              d="M0,82 Q18,72 34,80 T64,46 T84,30 T100,16"
              fill="none"
              stroke="var(--d-blue)"
              strokeWidth="1.6"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <span className="chart-dot" />
        </div>
      </div>

      <div className="glass-panel ops-card">
        <div className="ops-head">
          <h3 className="dash-section-title flush">Opérations Récentes</h3>
          <button className="ops-link">Voir tout</button>
        </div>
        <div className="ops-table">
          {ops.map((o) => (
            <div className="ops-row" key={o.date + o.pair}>
              <div className="ops-cell">
                <span className="ops-pair">{o.pair}</span>
                <span className="ops-date">{o.date}</span>
              </div>
              <span className={`ops-type ${o.type === "BUY" ? "buy" : "sell"}`}>{o.type}</span>
              <span className={`ops-amount ${o.win ? "win" : "loss"}`}>{o.amount}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
