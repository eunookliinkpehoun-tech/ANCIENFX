"use client"

import { useState } from "react"
import { useDashTheme } from "@/components/dashboard/app-shell"
import { useDashboard } from "@/components/dashboard/dashboard-context"

export function Mt5ConnectModal() {
  const { connectModalOpen, closeConnectModal, refresh, state } = useDashboard()
  const { notify } = useDashTheme()
  const [loading, setLoading] = useState(false)

  if (!connectModalOpen) return null

  const trialActive = state?.user.trialActive

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const payload = {
      login: String(form.get("login") || ""),
      password: String(form.get("password") || ""),
      server: String(form.get("server") || ""),
    }

    try {
      const res = await fetch("/api/mt5/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        notify("error", data.message || "Connexion impossible.")
        return
      }
      notify("success", data.message || "Compte connecté.")
      closeConnectModal()
      await refresh()
    } catch {
        notify("error", "Erreur réseau lors de la connexion MT4/MT5.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt5-modal-scrim" onClick={closeConnectModal} role="presentation">
      <div
        className="mt5-modal glass-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="mt5-modal-title"
        aria-modal="true"
      >
        <div className="mt5-modal-head">
          <h3 id="mt5-modal-title">Connecter MetaTrader 4/5</h3>
          <button type="button" className="icon-btn" onClick={closeConnectModal} aria-label="Fermer">
            ✕
          </button>
        </div>

        {trialActive && (
          <div className="mt5-modal-alert">
            Période d&apos;essai active — connectez un compte <strong>DEMO</strong> uniquement (3 jours).
          </div>
        )}

        <p className="mt5-modal-sub">
          Saisissez vos identifiants MT4/MT5. La connexion se fait via le terminal MetaTrader 4/5 sur le serveur Windows.
        </p>

        <form className="mt5-modal-form" onSubmit={handleSubmit}>
          <label>
            <span>Numéro de compte</span>
            <input name="login" type="text" required placeholder="52345678" autoComplete="username" />
          </label>
          <label>
            <span>Mot de passe investisseur</span>
            <input name="password" type="password" required placeholder="••••••••" autoComplete="current-password" />
          </label>
          <label>
            <span>Serveur</span>
            <input
              name="server"
              type="text"
              required
              placeholder={trialActive ? "ICMarketsSC-Demo" : "ICMarketsSC-Live"}
              list="mt5-servers"
            />
            <datalist id="mt5-servers">
              <option value="ICMarketsSC-Demo" />
              <option value="ICMarketsSC-Live" />
              <option value="MetaQuotes-Demo" />
            </datalist>
          </label>

          <div className="mt5-modal-actions">
            <button type="button" className="dash-btn dash-btn-secondary" onClick={closeConnectModal}>
              Annuler
            </button>
            <button type="submit" className="dash-btn dash-btn-primary" disabled={loading}>
              {loading ? "Connexion..." : "CONNECTER MT4/MT5"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
