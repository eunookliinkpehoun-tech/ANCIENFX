"use client"

import { useState, useMemo } from "react"
import { useDashTheme } from "@/components/dashboard/app-shell"
import { useDashboard } from "@/components/dashboard/dashboard-context"

// Base de serveurs MT5 connus par broker.
// L'utilisateur peut toujours saisir un serveur manuellement — cette liste
// sert uniquement d'aide à la saisie (datalist).
const BROKER_SERVERS: Record<string, string[]> = {
  "Exness": [
    "Exness-MT5Trial9", "Exness-MT5Trial8",
    "Exness-MT5Real7", "Exness-MT5Real8", "Exness-MT5Real9",
  ],
  "XM": [
    "XMGlobal-MT5 9", "XMGlobal-MT5 5",
    "XMGlobal-MT5Demo 9", "XMGlobal-MT5Demo 5",
    "XM-MT5Demo",
  ],
  "ICMarkets": [
    "ICMarketsSC-Demo", "ICMarketsSC-Demo 3",
    "ICMarketsSC-Live", "ICMarketsSC-Live 2",
  ],
  "Pepperstone": [
    "Pepperstone-Demo", "Pepperstone-MT5Demo",
    "Pepperstone-Edge-Live", "Pepperstone-MT5Live",
  ],
  "FTMO": [
    "FTMO-Demo", "FTMO-Demo2",
    "FTMO-Server", "FTMO-Server2",
  ],
  "FBS": [
    "FBS-Demo", "FBS-MT5Demo",
    "FBS-Real", "FBS-MT5Live",
  ],
  "OctaFX": [
    "OctaFX-Demo", "OctaFX-MT5Demo",
    "OctaFX-Real", "OctaFX-MT5Live",
  ],
  "Tickmill": [
    "Tickmill-Demo", "Tickmill-MT5Demo",
    "Tickmill-Live", "Tickmill-MT5Live",
  ],
  "MetaQuotes": [
    "MetaQuotes-Demo",
  ],
  "HFM": [
    "HFM-Demo MT5", "HFM-Live MT5",
  ],
  "Autre": [],
}

const ALL_BROKERS = Object.keys(BROKER_SERVERS)

export function Mt5ConnectModal() {
  const { connectModalOpen, closeConnectModal, refresh, state } = useDashboard()
  const { notify } = useDashTheme()
  const [loading, setLoading] = useState(false)
  const [broker, setBroker] = useState("")
  const [server, setServer] = useState("")

  // Tous les hooks AVANT tout return conditionnel (règle des hooks React)
  const trialActive = state?.user.trialActive

  // Suggestions de serveurs selon le broker sélectionné
  const serverSuggestions = useMemo(() => {
    if (!broker) return Object.values(BROKER_SERVERS).flat()
    const exact = BROKER_SERVERS[broker]
    if (exact) return exact
    // Correspondance partielle si l'utilisateur tape un broker pas dans la liste
    const lower = broker.toLowerCase()
    const partial = Object.entries(BROKER_SERVERS)
      .filter(([k]) => k.toLowerCase().includes(lower))
      .flatMap(([, v]) => v)
    return partial.length > 0 ? partial : Object.values(BROKER_SERVERS).flat()
  }, [broker])

  // Return conditionnel uniquement après tous les hooks
  if (!connectModalOpen) return null

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const payload = {
      login: String(form.get("login") || "").trim(),
      password: String(form.get("password") || ""),
      server: String(form.get("server") || "").trim(),
      broker: String(form.get("broker") || broker || "").trim(),
    }

    if (!payload.server) {
      notify("error", "Le champ Serveur est obligatoire.")
      setLoading(false)
      return
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
      setBroker("")
      setServer("")
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
          {/* Broker */}
          <label>
            <span>Broker <span style={{ fontWeight: 400, opacity: 0.7 }}>(optionnel — aide au choix du serveur)</span></span>
            <input
              name="broker"
              type="text"
              placeholder="Ex: Exness, XM, ICMarkets…"
              list="mt5-brokers"
              value={broker}
              onChange={(e) => {
                setBroker(e.target.value)
                // Pré-remplir le serveur si on sélectionne un broker connu
                const suggestions = BROKER_SERVERS[e.target.value]
                if (suggestions && suggestions.length === 1) setServer(suggestions[0])
              }}
              autoComplete="off"
            />
            <datalist id="mt5-brokers">
              {ALL_BROKERS.map((b) => <option key={b} value={b} />)}
            </datalist>
          </label>

          {/* Numéro de compte */}
          <label>
            <span>Numéro de compte</span>
            <input name="login" type="text" required placeholder="52345678" autoComplete="username" />
          </label>

          {/* Mot de passe */}
          <label>
            <span>Mot de passe investisseur</span>
            <input name="password" type="password" required placeholder="••••••••" autoComplete="current-password" />
          </label>

          {/* Serveur */}
          <label>
            <span>Serveur <span style={{ fontWeight: 400, opacity: 0.7 }}>(exactement tel qu&apos;affiché dans MT5)</span></span>
            <input
              name="server"
              type="text"
              required
              placeholder={trialActive ? "Ex: XMGlobal-MT5 9" : "Ex: XMGlobal-MT5 9"}
              list="mt5-servers"
              value={server}
              onChange={(e) => setServer(e.target.value)}
              autoComplete="off"
            />
            <datalist id="mt5-servers">
              {serverSuggestions.map((s) => <option key={s} value={s} />)}
            </datalist>
          </label>

          <p className="mt5-modal-hint">
            Trouvez le nom exact du serveur dans MT5 : <strong>Fichier → Ouvrir un compte</strong> → liste des serveurs du broker.
            Le serveur doit exister et être joignable — une faute de frappe empêche la connexion.
          </p>

          <div className="mt5-modal-actions">
            <button type="button" className="dash-btn dash-btn-secondary" onClick={closeConnectModal}>
              Annuler
            </button>
            <button type="submit" className="dash-btn dash-btn-primary" disabled={loading}>
              {loading ? "Connexion en cours…" : "CONNECTER MT4/MT5"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
