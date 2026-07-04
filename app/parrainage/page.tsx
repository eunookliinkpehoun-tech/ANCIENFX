"use client"

import { useEffect, useState } from "react"
import { Link2, Copy, MessageCircle, Send, Mail, Filter, Wallet } from "lucide-react"
import { AppShell, PageHeader, useDashTheme } from "@/components/dashboard/app-shell"

type Referral = {
  id: string
  name: string
  email: string
  date: string | null
  status: "pending" | "active" | "rewarded" | "cancelled"
  gain: number
}

type ReferralData = {
  referralCode: string
  referralLink: string
  stats: {
    referralCount: number
    recentCount: number
    availableBalance: number
    totalEarned: number
    totalWithdrawn: number
  }
  referrals: Referral[]
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value)
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("fr-FR") : "-"
}

export default function ParrainagePage() {
  return (
    <AppShell>
      <ParrainageContent />
    </AppShell>
  )
}

function ParrainageContent() {
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [withdrawing, setWithdrawing] = useState(false)
  const [error, setError] = useState("")
  const [data, setData] = useState<ReferralData | null>(null)
  const { notify } = useDashTheme()

  async function loadReferrals() {
    try {
      const res = await fetch("/api/parrainage", { cache: "no-store" })
      if (res.status === 401) {
        window.location.href = "/"
        return
      }
      const payload = await res.json()
      if (!res.ok || !payload.ok) throw new Error(payload.message || "Chargement impossible.")
      setData(payload)
      setError("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReferrals()
  }, [])

  async function copyLink() {
    const link = data?.referralLink || ""
    if (!link) return

    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      notify("success", "Lien de parrainage copié.")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
      notify("error", "Impossible de copier le lien.")
    }
  }

  async function requestWithdrawal() {
    setWithdrawing(true)
    try {
      const res = await fetch("/api/parrainage/withdraw", { method: "POST" })
      const payload = await res.json()
      if (!res.ok || !payload.ok) throw new Error(payload.message || "Retrait impossible.")
      notify("success", `${payload.message} Montant: ${formatMoney(Number(payload.amount || 0))}`)
      await loadReferrals()
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Retrait impossible.")
    } finally {
      setWithdrawing(false)
    }
  }

  const stats = data?.stats
  const referrals = data?.referrals || []
  const referralLink = data?.referralLink || ""
  const availableBalance = stats?.availableBalance || 0

  return (
    <>
      <PageHeader
        title="Parrainage"
        subtitle="Développez votre équipe et augmentez vos revenus FXMIRROR."
      />

      <div className="ref-grid reveal">
        <div className="glass-panel ref-link-card">
          <div className="ref-link-head">
            <Link2 />
            <h2>Lien de parrainage</h2>
          </div>
          <p style={{ color: "var(--d-muted)", fontSize: ".9rem", lineHeight: 1.6 }}>
            Partagez ce lien unique pour inviter de nouveaux traders et gagner des commissions sur leurs performances.
          </p>
          <div className="ref-link-box">
            <input
              className="ref-link-input"
              readOnly
              value={loading ? "Chargement..." : referralLink}
              aria-label="Lien de parrainage"
            />
            <button type="button" className="dash-btn dash-btn-primary" onClick={copyLink} disabled={!referralLink}>
              <Copy size={16} />
              {copied ? "Copié !" : "Copier"}
            </button>
          </div>
          <div className="ref-share-row">
            <p style={{ fontSize: ".72rem", fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--d-muted)", width: "100%", marginBottom: 4 }}>
              Partage rapide
            </p>
            <button type="button" className="ref-share-btn" aria-label="Partager par message">
              <MessageCircle />
            </button>
            <button type="button" className="ref-share-btn" aria-label="Partager par Telegram">
              <Send />
            </button>
            <button type="button" className="ref-share-btn" aria-label="Partager par email">
              <Mail />
            </button>
          </div>
        </div>

        <div className="ref-stats">
          <div className="glass-panel ref-stat-card">
            <p className="ref-stat-label">Nombre de filleuls</p>
            <div className="ref-stat-value">
              {loading ? "..." : stats?.referralCount || 0}
              {!loading && Boolean(stats?.recentCount) && (
                <span className="ref-stat-badge">+{stats?.recentCount} ce mois</span>
              )}
            </div>
          </div>
          <div className="glass-panel ref-stat-card">
            <p className="ref-stat-label">Solde disponible</p>
            <div className="ref-balance-row">
              <div>
                <div className="ref-stat-value">{loading ? "..." : formatMoney(availableBalance)}</div>
                <p className="ref-stat-note">Total gagné: {formatMoney(stats?.totalEarned || 0)}</p>
              </div>
              <button
                type="button"
                className="dash-btn dash-btn-primary ref-withdraw-btn"
                onClick={requestWithdrawal}
                disabled={withdrawing || availableBalance <= 0}
              >
                <Wallet size={16} />
                {withdrawing ? "Traitement..." : "Retrait"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <section className="glass-panel reveal" style={{ overflow: "hidden" }}>
        <div className="dash-section-head">
          <h2 className="dash-section-title" style={{ margin: 0 }}>Mes filleuls</h2>
          <button
            type="button"
            className="dash-btn dash-btn-secondary"
            style={{ padding: "8px 14px", fontSize: ".78rem" }}
          >
            Filtrer
            <Filter size={15} />
          </button>
        </div>

        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Nom / Email</th>
                <th>Date d&apos;inscription</th>
                <th>Statut</th>
                <th className="right">Gains générés</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="dash-empty-cell">Chargement des filleuls...</td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={4} className="dash-empty-cell">{error}</td>
                </tr>
              )}
              {!loading && !error && referrals.length === 0 && (
                <tr>
                  <td colSpan={4} className="dash-empty-cell">Aucun filleul trouvé en base.</td>
                </tr>
              )}
              {!loading && !error && referrals.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 800, fontSize: ".9rem" }}>{r.name}</div>
                    <div style={{ fontSize: ".75rem", color: "var(--d-muted)", fontFamily: "ui-monospace, monospace" }}>
                      {r.email}
                    </div>
                  </td>
                  <td style={{ color: "var(--d-muted)", fontFamily: "ui-monospace, monospace", fontSize: ".85rem" }}>
                    {formatDate(r.date)}
                  </td>
                  <td>
                    <span className={`status-pill ${r.status === "active" || r.status === "rewarded" ? "active" : "pending"}`}>
                      <span className="sdot" />
                      {r.status === "active" || r.status === "rewarded" ? "Actif" : "En attente"}
                    </span>
                  </td>
                  <td className="right" style={{ fontWeight: 800, fontFamily: "ui-monospace, monospace" }}>
                    {formatMoney(r.gain)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
