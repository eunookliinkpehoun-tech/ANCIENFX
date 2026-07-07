"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw, Trash2, Users, Wifi, WifiOff } from "lucide-react"
import { AppShell, PageHeader, useDashTheme } from "@/components/dashboard/app-shell"

type MasterState = {
  login?: string
  server?: string
  platform?: string
  broker?: string
  balance?: number
  equity?: number
  currency?: string
  strategyId?: string
  state?: string
  connectionStatus?: string
  connected?: boolean
  subscribersCount?: number
}

function AdminMasterPanel() {
  const { notify } = useDashTheme()
  const [access, setAccess] = useState<"loading" | "granted" | "denied">("loading")
  const [configured, setConfigured] = useState(false)
  const [master, setMaster] = useState<MasterState | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [platform, setPlatform] = useState<"mt5" | "mt4">("mt5")

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch("/api/admin/master", { cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setAccess("denied")
        return
      }
      const data = await res.json()
      setAccess("granted")
      setConfigured(Boolean(data.configured))
      setMaster(data.master ?? null)
    } catch {
      notify("error", "Impossible de charger la configuration du compte maître.")
    } finally {
      setRefreshing(false)
    }
  }, [notify])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    const form = new FormData(e.currentTarget)
    const payload = {
      login: String(form.get("login") || "").trim(),
      password: String(form.get("password") || ""),
      server: String(form.get("server") || "").trim(),
      platform,
    }
    if (!payload.login || !payload.password || !payload.server) {
      notify("error", "Tous les champs sont obligatoires.")
      setSubmitting(false)
      return
    }
    try {
      const res = await fetch("/api/admin/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        notify("error", data.message || "Connexion du compte maître impossible.")
        return
      }
      notify("success", data.message || "Compte maître configuré.")
      ;(e.target as HTMLFormElement).reset()
      await load()
    } catch {
      notify("error", "Erreur réseau lors de la configuration.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemove() {
    if (!confirm("Retirer le compte maître et arrêter la copie de trades ? Cette action libère les ressources MetaApi.")) {
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/master", { method: "DELETE" })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        notify("error", data.message || "Retrait impossible.")
        return
      }
      notify("success", "Compte maître retiré.")
      await load()
    } catch {
      notify("error", "Erreur réseau lors du retrait.")
    } finally {
      setSubmitting(false)
    }
  }

  if (access === "loading") {
    return (
      <section className="glass-panel reveal" style={{ padding: 28 }}>
        <p style={{ color: "var(--d-muted)" }}>Chargement…</p>
      </section>
    )
  }

  if (access === "denied") {
    return (
      <section className="glass-panel reveal" style={{ padding: 28 }}>
        <h3 style={{ margin: "0 0 8px" }}>Accès refusé</h3>
        <p style={{ color: "var(--d-muted)", fontSize: ".92rem" }}>
          Cette page est réservée aux administrateurs.
        </p>
      </section>
    )
  }

  return (
    <div className="admin-grid">
      {/* Statut du compte maître */}
      <section className="glass-panel reveal" style={{ padding: 28 }}>
        <div className="admin-card-head">
          <div>
            <h3 style={{ margin: 0 }}>Compte maître (Provider)</h3>
            <p style={{ color: "var(--d-muted)", fontSize: ".88rem", margin: "4px 0 0" }}>
              Les trades de ce compte sont copiés en temps réel vers tous les comptes utilisateurs.
            </p>
          </div>
          <button
            type="button"
            className="dash-btn dash-btn-secondary"
            onClick={load}
            disabled={refreshing}
            aria-label="Rafraîchir le statut"
          >
            <RefreshCw size={16} className={refreshing ? "admin-spin" : ""} />
            Actualiser
          </button>
        </div>

        {configured && master ? (
          <div className="admin-status">
            <div className={`admin-badge ${master.connected ? "online" : "offline"}`}>
              {master.connected ? <Wifi size={15} /> : <WifiOff size={15} />}
              {master.connected ? "Connecté au broker" : master.connectionStatus || "Hors ligne"}
            </div>
            <dl className="admin-kv">
              <div><dt>Login</dt><dd>{master.login || "—"}</dd></div>
              <div><dt>Serveur</dt><dd>{master.server || "—"}</dd></div>
              <div><dt>Broker</dt><dd>{master.broker || "—"}</dd></div>
              <div><dt>Plateforme</dt><dd>{(master.platform || "mt5").toUpperCase()}</dd></div>
              <div>
                <dt>Solde</dt>
                <dd>{master.balance != null ? `${master.balance} ${master.currency || ""}` : "—"}</dd>
              </div>
              <div>
                <dt>Equity</dt>
                <dd>{master.equity != null ? `${master.equity} ${master.currency || ""}` : "—"}</dd>
              </div>
              <div>
                <dt><Users size={13} style={{ verticalAlign: "-2px" }} /> Abonnés</dt>
                <dd>{master.subscribersCount ?? 0}</dd>
              </div>
              <div><dt>Stratégie</dt><dd style={{ fontFamily: "monospace", fontSize: ".8rem" }}>{master.strategyId || "—"}</dd></div>
            </dl>
            <button
              type="button"
              className="dash-btn dash-btn-danger"
              onClick={handleRemove}
              disabled={submitting}
            >
              <Trash2 size={16} />
              Retirer le compte maître
            </button>
          </div>
        ) : (
          <p style={{ color: "var(--d-muted)", fontSize: ".92rem" }}>
            Aucun compte maître configuré. Renseignez ses identifiants ci-contre pour activer la copie de trades.
          </p>
        )}
      </section>

      {/* Formulaire de configuration */}
      <section className="glass-panel reveal" style={{ padding: 28 }}>
        <h3 style={{ margin: "0 0 4px" }}>{configured ? "Remplacer le compte maître" : "Configurer le compte maître"}</h3>
        <p style={{ color: "var(--d-muted)", fontSize: ".88rem", margin: "0 0 18px" }}>
          Saisissez les identifiants MT4/MT5 du compte dont les trades seront copiés.
        </p>

        <form className="mt5-modal-form" onSubmit={handleSubmit}>
          <label>
            <span>Plateforme</span>
            <div className="admin-platform-toggle">
              <button
                type="button"
                className={`admin-seg${platform === "mt5" ? " active" : ""}`}
                onClick={() => setPlatform("mt5")}
              >
                MT5
              </button>
              <button
                type="button"
                className={`admin-seg${platform === "mt4" ? " active" : ""}`}
                onClick={() => setPlatform("mt4")}
              >
                MT4
              </button>
            </div>
          </label>

          <label>
            <span>Numéro de compte</span>
            <input name="login" type="text" required placeholder="52345678" autoComplete="off" />
          </label>

          <label>
            <span>Mot de passe (maître / trader)</span>
            <input name="password" type="password" required placeholder="••••••••" autoComplete="off" />
          </label>

          <label>
            <span>Serveur <span style={{ fontWeight: 400, opacity: 0.7 }}>(exactement tel qu&apos;affiché dans MT4/MT5)</span></span>
            <input name="server" type="text" required placeholder="Ex: ICMarketsSC-Live" autoComplete="off" />
          </label>

          <p className="mt5-modal-hint">
            Le compte maître doit être un compte de trading actif. Ses positions ouvertes seront répliquées
            proportionnellement sur les comptes utilisateurs abonnés.
          </p>

          <div className="mt5-modal-actions">
            <button type="submit" className="dash-btn dash-btn-primary" disabled={submitting}>
              {submitting ? "Traitement…" : configured ? "REMPLACER LE MAÎTRE" : "CONNECTER LE MAÎTRE"}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

const adminStyles = `
.admin-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
@media (min-width: 960px) { .admin-grid { grid-template-columns: 1fr 1fr; align-items: start; } }
.admin-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
.admin-status { display: flex; flex-direction: column; gap: 16px; }
.admin-badge { display: inline-flex; align-items: center; gap: 7px; align-self: flex-start; padding: 6px 12px; border-radius: 999px; font-size: .8rem; font-weight: 600; }
.admin-badge.online { background: color-mix(in srgb, var(--d-accent) 16%, transparent); color: var(--d-accent); }
.admin-badge.offline { background: color-mix(in srgb, #e0574f 16%, transparent); color: #e0574f; }
.admin-kv { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 20px; margin: 0; }
.admin-kv > div { display: flex; flex-direction: column; gap: 2px; }
.admin-kv dt { font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; color: var(--d-muted); }
.admin-kv dd { margin: 0; font-size: .95rem; font-weight: 600; color: var(--d-text); }
.admin-platform-toggle { display: inline-flex; gap: 8px; }
.admin-seg { flex: 1; padding: 10px 16px; border-radius: 10px; border: 1px solid var(--d-border); background: transparent; color: var(--d-muted); font-weight: 600; cursor: pointer; transition: all .18s ease; }
.admin-seg.active { background: var(--d-accent); color: #fff; border-color: var(--d-accent); }
.dash-btn-danger { background: #e0574f; color: #fff; border: 1px solid #e0574f; align-self: flex-start; }
.dash-btn-danger:hover { background: #cf4a42; }
.admin-spin { animation: admin-spin 1s linear infinite; }
@keyframes admin-spin { to { transform: rotate(360deg); } }
`

export default function AdminPage() {
  return (
    <AppShell extraStyles={adminStyles}>
      <PageHeader
        title="Administration"
        subtitle="Configurez le compte maître dont les trades sont copiés vers les comptes utilisateurs."
      />
      <AdminMasterPanel />
    </AppShell>
  )
}
