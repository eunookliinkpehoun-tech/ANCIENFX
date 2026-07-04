"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, ArrowLeftRight, Bitcoin, ChevronLeft, ChevronRight } from "lucide-react"
import { AppShell, ExportButtons, PageHeader } from "@/components/dashboard/app-shell"

type Tab = "trade" | "depot" | "retrait"

type TradeRow = {
  id: string
  asset: string
  type: "buy" | "sell"
  volume: number
  profit: number
  closedAt: string | null
}

type CashRow = {
  id: string
  asset: string
  type: string
  amount: number
  currency: string
  createdAt: string | null
  paidAt?: string | null
}

type HistoryData = {
  trades: TradeRow[]
  depots: CashRow[]
  retraits: CashRow[]
}

const emptyHistory: HistoryData = { trades: [], depots: [], retraits: [] }

function AssetIcon({ kind }: { kind: string }) {
  return (
    <div className="asset-icon">
      {kind === "crypto" ? <Bitcoin /> : <ArrowLeftRight />}
    </div>
  )
}

function formatMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("fr-FR") : "-"
}

export default function HistoriquePage() {
  const [tab, setTab] = useState<Tab>("trade")
  const [search, setSearch] = useState("")
  const [data, setData] = useState<HistoryData>(emptyHistory)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    async function loadHistory() {
      try {
        const res = await fetch("/api/historique", { cache: "no-store" })
        if (res.status === 401) {
          window.location.href = "/"
          return
        }
        const payload = await res.json()
        if (!res.ok || !payload.ok) throw new Error(payload.message || "Chargement impossible.")
        if (active) {
          setData({
            trades: payload.trades || [],
            depots: payload.depots || [],
            retraits: payload.retraits || [],
          })
          setError("")
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Chargement impossible.")
      } finally {
        if (active) setLoading(false)
      }
    }

    loadHistory()
    return () => {
      active = false
    }
  }, [])

  const rows = useMemo(() => {
    const source = tab === "trade" ? data.trades : tab === "depot" ? data.depots : data.retraits
    return source.filter((row) => row.asset.toLowerCase().includes(search.toLowerCase()))
  }, [data, search, tab])

  const tabLabels: Record<Tab, string> = {
    trade: "trades",
    depot: "paiements",
    retrait: "retraits",
  }

  return (
    <AppShell>
      <PageHeader
        title="Historique"
        subtitle="Consultez vos performances de trading et flux financiers."
        actions={<ExportButtons />}
      />

      <div className="dash-tabs reveal">
        {(["trade", "depot", "retrait"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`dash-tab${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "trade" ? "Trade" : t === "depot" ? "Paiement" : "Retrait"}
          </button>
        ))}
      </div>

      <section className="glass-panel reveal" style={{ overflow: "hidden" }}>
        <div className="dash-filter-bar">
          <div className="dash-search-wrap">
            <Search />
            <input
              className="dash-input"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="dash-select" defaultValue="all">
            <option value="all">Tous les mois</option>
            <option value="7">Derniers 7 jours</option>
            <option value="30">Derniers 30 jours</option>
          </select>
        </div>

        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Nom de l&apos;actif</th>
                <th>Type</th>
                <th>Date</th>
                <th className="right">{tab === "trade" ? "P/L" : "Montant"}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="dash-empty-cell">Chargement de l&apos;historique...</td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={4} className="dash-empty-cell">{error}</td>
                </tr>
              )}
              {!loading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="dash-empty-cell">Aucune donnée trouvée en base.</td>
                </tr>
              )}
              {!loading && !error && rows.map((row) => {
                const isTrade = tab === "trade"
                const trade = row as TradeRow
                const cash = row as CashRow
                const amount = isTrade ? trade.profit : cash.amount
                const currency = isTrade ? "USD" : cash.currency

                return (
                  <tr key={`${tab}-${row.id}`}>
                    <td>
                      <div className="asset-cell">
                        <AssetIcon kind={row.asset.toUpperCase().includes("BTC") ? "crypto" : "forex"} />
                        <span className="asset-name">{row.asset}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`type-badge ${isTrade && trade.type === "sell" ? "sell" : "buy"}`}>
                        {isTrade ? trade.type.toUpperCase() : cash.type.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ color: "var(--d-muted)", fontFamily: "ui-monospace, monospace", fontSize: ".84rem" }}>
                      {formatDate(isTrade ? trade.closedAt : cash.paidAt || cash.createdAt)}
                    </td>
                    <td className={`right ${amount >= 0 ? "pl-win" : "pl-loss"}`}>
                      {formatMoney(Math.abs(amount), currency)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="dash-pagination">
          <p>
            Affichage {rows.length ? `1-${rows.length}` : "0"} sur {rows.length} {tabLabels[tab]}
          </p>
          <div className="dash-pager">
            <button type="button" className="dash-page-btn" disabled aria-label="Page précédente">
              <ChevronLeft size={18} />
            </button>
            <button type="button" className="dash-page-btn active">1</button>
            <button type="button" className="dash-page-btn" disabled aria-label="Page suivante">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>
    </AppShell>
  )
}
