"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { AppShell, PageHeader } from "@/components/dashboard/app-shell"

export default function ParametresPage() {
  const router = useRouter()

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      router.push("/")
      router.refresh()
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Paramètres"
        subtitle="Gérez votre compte, vos notifications et vos préférences MT4/MT5."
        actions={
          <button
            type="button"
            className="dash-btn dash-btn-secondary"
            onClick={handleLogout}
            aria-label="Se déconnecter"
            title="Se déconnecter"
          >
            <LogOut size={18} />
            Déconnexion
          </button>
        }
      />
      <section className="glass-panel reveal" style={{ padding: 28 }}>
        <p style={{ color: "var(--d-muted)", fontSize: ".92rem" }}>
          Cette section sera bientôt disponible. Vous pourrez y configurer votre profil, la sécurité et les préférences de synchronisation MT4/MT5.
        </p>
      </section>
    </AppShell>
  )
}
