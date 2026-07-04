"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutGrid,
  History,
  Users,
  Settings,
  Download,
  FileText,
  Menu,
  X,
} from "lucide-react"
import { dashBaseStyles, dashDashboardStyles } from "@/lib/dash-styles"
import { FxMirrorLogo } from "@/components/fxmirror-logo"
import { DASHBOARD_STATE_EVENT } from "@/components/dashboard/dashboard-context"

export type DashPage = "dashboard" | "historique" | "parrainage" | "parametres"
type ToastKind = "success" | "error" | "warning"

const DashContext = createContext<{
  dark: boolean
  setDark: (v: boolean | ((d: boolean) => boolean)) => void
  notify: (kind: ToastKind, message: string) => void
}>({
  dark: false,
  setDark: () => {},
  notify: () => {},
})

export function useDashTheme() {
  return useContext(DashContext)
}

const navItems: { id: DashPage; href: string; label: string; icon: typeof LayoutGrid }[] = [
  { id: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { id: "historique", href: "/historique", label: "Historique", icon: History },
  { id: "parrainage", href: "/parrainage", label: "Parrainage", icon: Users },
  { id: "parametres", href: "/parametres", label: "Paramètres", icon: Settings },
]

function pageFromPath(path: string): DashPage {
  if (path.startsWith("/historique")) return "historique"
  if (path.startsWith("/parrainage")) return "parrainage"
  if (path.startsWith("/parametres")) return "parametres"
  return "dashboard"
}

export function AppShell({
  children,
  extraStyles = "",
}: {
  children: ReactNode
  extraStyles?: string
}) {
  const [dark, setDark] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)
  const [userName, setUserName] = useState("Utilisateur")
  const [mt5Connected, setMt5Connected] = useState(false)
  const pathname = usePathname()
  const active = pageFromPath(pathname)

  const userInitials = userName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "FX"

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.user?.name) setUserName(data.user.name)
      })
      .catch(() => {})

    fetch("/api/dashboard", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setMt5Connected(data.mt5Account?.status === "connected")
      })
      .catch(() => setMt5Connected(false))
  }, [pathname])

  useEffect(() => {
    function onDashboardState(event: Event) {
      const detail = (event as CustomEvent<{ mt5Connected: boolean }>).detail
      if (detail && typeof detail.mt5Connected === "boolean") {
        setMt5Connected(detail.mt5Connected)
      }
    }
    window.addEventListener(DASHBOARD_STATE_EVENT, onDashboardState)
    return () => window.removeEventListener(DASHBOARD_STATE_EVENT, onDashboardState)
  }, [])

  const notify = (kind: ToastKind, message: string) => {
    setToast({ kind, message })
    window.setTimeout(() => setToast(null), 3600)
  }

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [mobileNavOpen])

  return (
    <DashContext.Provider value={{ dark, setDark, notify }}>
      <div className={`dash-root${dark ? " dash-dark" : ""}`}>
        <style>{dashBaseStyles + dashDashboardStyles + extraStyles}</style>
        {toast && (
          <div className={`dash-action-toast ${toast.kind}`} role="status" aria-live="polite">
            {toast.message}
          </div>
        )}
        <div className="dash-bg-grid" />
        <div className="dash-orb dash-orb-1" />
        <div className="dash-orb dash-orb-2" />

        <header className="dash-header">
          <div className="dash-header-inner">
            <button
              className="icon-btn dash-menu-toggle"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Ouvrir le menu"
              aria-expanded={mobileNavOpen}
              aria-controls="dash-mobile-sidebar"
            >
              <Menu />
            </button>
            <Link href="/dashboard" className="dash-logo" aria-label="FXMIRROR — accueil">
              <FxMirrorLogo className="dash-logo-img" />
            </Link>
            <div className="dash-header-right">
              <span className={`mt5-pill${mt5Connected ? "" : " offline"}`}>
                <span className="dot" />
                {mt5Connected ? "MT4/MT5 CONNECTÉ" : "MT4/MT5 DÉCONNECTÉ"}
              </span>
              <button
                className="icon-btn"
                onClick={() => setDark((d) => !d)}
                aria-label={dark ? "Activer le mode clair" : "Activer le mode sombre"}
                title={dark ? "Mode clair" : "Mode sombre"}
              >
                {dark ? "☀" : "☾"}
              </button>
              <button className="icon-btn notif" aria-label="Notifications">
                <span className="notif-dot" />
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
              </button>
              <div className="dash-avatar" aria-label="Profil utilisateur">
                <span>{userInitials}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="dash-layout">
          <button
            className={`dash-sidebar-scrim${mobileNavOpen ? " show" : ""}`}
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside
            id="dash-mobile-sidebar"
            className={`dash-sidebar${mobileNavOpen ? " mobile-open" : ""}`}
            aria-label="Navigation principale"
          >
            <div className="dash-sidebar-mobile-head">
              <Link href="/dashboard" className="dash-logo" aria-label="FXMIRROR — accueil">
                <FxMirrorLogo className="dash-logo-img" />
              </Link>
              <button className="icon-btn" onClick={() => setMobileNavOpen(false)} aria-label="Fermer le menu">
                <X />
              </button>
            </div>
            <div className="dash-sidebar-user">
              <div className="dash-sidebar-avatar">{userInitials}</div>
              <div>
                <div className="dash-sidebar-name">{userName}</div>
                <div className="dash-sidebar-role">{mt5Connected ? "Compte Pro MT4/MT5" : "Aucun compte MT4/MT5"}</div>
              </div>
            </div>
            <ul className="dash-nav-list">
              {navItems.map(({ id, href, label, icon: Icon }) => (
                <li key={id}>
                  <Link
                    href={href}
                    className={`dash-nav-link${active === id ? " active" : ""}`}
                    onClick={() => setMobileNavOpen(false)}
                  >
                    <Icon strokeWidth={active === id ? 2.2 : 1.8} />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>

          <main className="dash-main has-mobile-nav">{children}</main>
        </div>
      </div>
    </DashContext.Provider>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="dash-page-head reveal">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>{actions}</div>}
    </div>
  )
}

export function ExportButtons() {
  const { notify } = useDashTheme()

  return (
    <>
      <button
        type="button"
        className="dash-btn dash-btn-secondary"
        onClick={() => notify("warning", "L'export CSV sera disponible après la connexion des données réelles.")}
      >
        <Download size={16} />
        Export CSV
      </button>
      <button
        type="button"
        className="dash-btn dash-btn-primary"
        onClick={() => notify("warning", "L'export PDF sera disponible après la connexion des données réelles.")}
      >
        <FileText size={16} />
        Export PDF
      </button>
    </>
  )
}
