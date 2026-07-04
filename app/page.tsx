"use client"

import { useState, useEffect, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { FxMirrorLogo } from "@/components/fxmirror-logo"

const conceptCards = [
  { ic: "⚡", title: "Exécution automatique", text: "L'exécution automatique des positions de trading." },
  { ic: "🔄", title: "Synchronisation", text: "La synchronisation en temps réel avec un compte principal." },
  { ic: "📊", title: "Suivi continu", text: "Le suivi des performances en continu." },
  { ic: "📈", title: "Gestion simplifiée", text: "Une gestion simplifiée des résultats journaliers." },
]

const fonctionnementCards = [
  { ic: "1", title: "Connexion du compte MT4/MT5", text: "Vous connectez votre compte MetaTrader 4/5 à la plateforme." },
  { ic: "2", title: "Activation", text: "Votre compte est relié au système de trading principal." },
  { ic: "3", title: "Exécution automatique", text: "Les positions sont copiées et exécutées automatiquement sur votre compte." },
  { ic: "4", title: "Suivi des performances", text: "Vous consultez en temps réel vos résultats via votre espace personnel." },
]

const depotList = [
  "Une exécution optimale des positions",
  "Une gestion correcte du risque",
  "Une expérience de trading stable et cohérente",
  "Notre système vise une performance pouvant atteindre 2 % par jour selon les conditions de marché.",
]

const trialSteps = [
  "Ouvrez un compte démo MetaTrader 4/5.",
  "Déposez virtuellement 500 $ sur votre compte démo.",
  "Connectez votre compte à notre plateforme.",
  "Activez le bot gratuitement pendant 24 heures.",
  "Observez les résultats en conditions réelles de marché.",
]

const whyList = [
  "Test gratuit sans risque",
  "Capital réel non nécessaire",
  "Résultats visibles en temps réel",
  "Compatible MetaTrader 4/5",
  "Activation en quelques minutes",
  "Gestion automatisée complète",
]

const perfList = [
  "Les gains générés sont calculés automatiquement chaque jour",
  "Une répartition est appliquée selon les conditions du service",
  "Aucun frais fixe, uniquement basé sur les résultats",
]

const securityList = [
  "Données chiffrées",
  "Accès sécurisé client",
  "Synchronisation en temps réel",
  "Surveillance continue des opérations",
  "Historique complet des transactions",
]

const advantagesList = [
  "Gestion automatisée complète",
  "Aucun besoin d'intervention manuelle",
  "Exécution instantanée des trades",
  "Suivi transparent des performances",
  "Accès depuis n'importe quel appareil",
]

const faqs = [
  { q: "Est-ce que je contrôle mon compte ?", a: "Oui. Votre compte reste votre propriété et vous gardez l'accès complet à votre broker MT4/MT5." },
  { q: "Est-ce du trading automatique ?", a: "Oui. Les opérations sont exécutées automatiquement via un système de gestion synchronisée." },
  { q: "Dois-je surveiller les marchés ?", a: "Non. Le système fonctionne de manière autonome." },
  { q: "Puis-je arrêter le service ?", a: "Oui, la gestion automatisée peut être désactivée à tout moment depuis votre espace client." },
  { q: "Comment sont calculés les résultats ?", a: "Les profits et pertes sont calculés automatiquement à partir des performances de votre compte MT4/MT5." },
  { q: "Est-ce sécurisé ?", a: "Oui, les connexions sont sécurisées et les données sont protégées par chiffrement." },
]

type ToastKind = "success" | "error" | "warning"

export default function Page() {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [tab, setTab] = useState<"login" | "signup">("login")
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [referralCode, setReferralCode] = useState("")

  const open = (t: "login" | "signup") => {
    setTab(t)
    setModalOpen(true)
  }

  const notify = (kind: ToastKind, message: string) => {
    setToast({ kind, message })
    window.setTimeout(() => setToast(null), 3600)
  }

  const submitAuth = async (event: FormEvent<HTMLFormElement>, mode: "login" | "signup") => {
    event.preventDefault()
    setSubmitting(true)

    const form = new FormData(event.currentTarget)
    const payload =
      mode === "login"
        ? {
            email: String(form.get("email") || ""),
            password: String(form.get("password") || ""),
          }
        : {
            fullName: String(form.get("fullName") || ""),
            email: String(form.get("email") || ""),
            password: String(form.get("password") || ""),
            referralCode: String(form.get("referralCode") || ""),
          }

    try {
      const response = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json()

      if (!response.ok || !data.ok) {
        notify(response.status === 409 ? "warning" : "error", data.message || "Action impossible.")
        return
      }

      notify("success", data.message || (mode === "login" ? "Connexion réussie." : "Inscription réussie."))
      window.setTimeout(() => router.push("/dashboard"), 700)
    } catch {
      notify("error", "Connexion au serveur impossible. Réessayez dans un instant.")
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    document.body.style.overflow = modalOpen ? "hidden" : ""
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [modalOpen])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get("ref") || params.get("code")
    if (ref) {
      setReferralCode(ref.toUpperCase())
      setTab("signup")
      setModalOpen(true)
    }
  }, [])

  return (
    <div className="fx-root">
      <style>{css}</style>
      {toast && (
        <div className={`action-toast ${toast.kind}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}

      <div className="bg-grid" />
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />

      {/* Header */}
      <header>
        <div className="container nav">
          <a href="#" className="logo" aria-label="FXMIRROR — accueil">
            <FxMirrorLogo className="logo-img" />
          </a>
          <nav className="nav-links">
            <a href="#concept">Concept</a>
            <a href="#fonctionnement">Fonctionnement</a>
            <a href="#depot">Dépôt</a>
            <a href="#essai">Essai gratuit</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="auth-zone">
            <button className="btn btn-ghost" onClick={() => open("login")}>
              Login
            </button>
            <button className="btn btn-primary" onClick={() => open("signup")}>
              Sign up
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="container">
          <span className="badge">
            <span className="live" />
            Technologie MetaTrader 4/5 — Synchronisation en temps réel
          </span>
          <h1>FXMIRROR</h1>
          <p className="sub">Gestion automatisée de trading sur compte MetaTrader 4/5</p>
          <p className="lead">
            Optimisez votre capital grâce à une solution de gestion automatisée des opérations de trading basée sur la
            technologie MetaTrader 4/5. Notre système exécute et réplique automatiquement les stratégies d&apos;un compte
            principal vers votre compte personnel, tout en assurant un suivi complet des performances.
          </p>
          <div className="hero-cta">
            <button className="btn btn-primary" onClick={() => open("signup")}>
              Commencer maintenant
            </button>
            <button className="btn btn-ghost" onClick={() => open("login")}>
              Accéder à mon espace
            </button>
          </div>
          <div className="pills">
            <div className="pill">Aucun abonnement mensuel</div>
            <div className="pill">Aucun frais caché</div>
            <div className="pill">50 % des profits réalisés uniquement</div>
          </div>
        </div>
      </section>

      {/* Concept */}
      <section id="concept">
        <div className="container">
          <div className="section-title">
            <h2>Concept</h2>
            <p>FXmirror est une solution de gestion automatisée de trading qui permet :</p>
          </div>
          <div className="grid grid-4">
            {conceptCards.map((c) => (
              <div className="card" key={c.title}>
                <div className="ic">{c.ic}</div>
                <h3>{c.title}</h3>
                <p>{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fonctionnement */}
      <section id="fonctionnement">
        <div className="container">
          <div className="section-title">
            <h2>Fonctionnement</h2>
            <p>Quatre étapes simples pour activer la gestion automatisée.</p>
          </div>
          <div className="grid grid-4">
            {fonctionnementCards.map((c) => (
              <div className="card" key={c.title}>
                <div className="ic">{c.ic}</div>
                <h3>{c.title}</h3>
                <p>{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dépôt */}
      <section id="depot">
        <div className="container">
          <div className="deposit-wrap">
            <div className="deposit-amount">
              <div className="lbl">Dépôt minimum requis</div>
              <div className="num">500 $</div>
              <span className="perf-badge">Performance visée : jusqu&apos;à 2 % par jour</span>
            </div>
            <div>
              <div className="section-title section-title-left">
                <h2 className="h2-sm">Dépôt minimum</h2>
                <p className="p-flush">
                  Le dépôt minimum requis pour activer la gestion automatisée est de 500 $. Ce capital permet de
                  garantir :
                </p>
              </div>
              <ul className="clean">
                {depotList.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Essai gratuit */}
      <section id="essai">
        <div className="container">
          <div className="trial">
            <span className="free-tag">GRATUIT</span>
            <h2>Test Gratuit 24 Heures</h2>
            <p className="trial-lead">
              Vous souhaitez tester notre technologie avant de commencer ? Nous vous offrons 24 heures d&apos;essai
              gratuit. Aucun paiement requis pendant la période d&apos;essai.
            </p>
            <h3 className="trial-h3">Comment ça fonctionne ?</h3>
            <div className="steps">
              {trialSteps.map((s) => (
                <div className="step" key={s}>
                  {s}
                </div>
              ))}
            </div>
            <h3 className="trial-h3">Pourquoi essayer notre solution ?</h3>
            <div className="why-list">
              {whyList.map((w) => (
                <div key={w}>✅ {w}</div>
              ))}
            </div>
            <div className="trial-cta">
              <button className="btn btn-primary" onClick={() => open("signup")}>
                Démarrer l&apos;essai gratuit
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Performance & Paiement */}
      <section>
        <div className="container">
          <div className="grid grid-2">
            <div className="card">
              <div className="ic">%</div>
              <h3>Modèle de performance</h3>
              <p>Le service fonctionne selon un modèle basé sur la performance :</p>
              <ul className="clean clean-mt">
                {perfList.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <div className="card">
              <div className="ic">$</div>
              <h3>Paiement et règlement</h3>
              <p>
                Les résultats sont consolidés quotidiennement. Un récapitulatif est envoyé contenant : Profit réalisé,
                part à régulariser et détails de performance.
              </p>
              <p className="chip-label">Les paiements peuvent être effectués via :</p>
              <div className="chips">
                <span className="chip">USDT (TRC20 / ERC20)</span>
                <span className="chip">USDC (BEP20 / ERC20)</span>
                <span className="chip">Bitcoin</span>
                <span className="chip">Ethereum</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sécurité & Avantages */}
      <section>
        <div className="container">
          <div className="grid grid-2">
            <div className="card">
              <div className="ic">🔒</div>
              <h3>Sécurité et contrôle</h3>
              <ul className="clean clean-mt">
                {securityList.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <div className="card">
              <div className="ic">★</div>
              <h3>Avantages</h3>
              <ul className="clean clean-mt">
                {advantagesList.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq">
        <div className="container">
          <div className="section-title">
            <h2>FAQ</h2>
            <p>Les réponses aux questions les plus fréquentes.</p>
          </div>
          <div className="faq-wrap">
            {faqs.map((f, i) => (
              <div className={`faq-item${openFaq === i ? " open" : ""}`} key={f.q}>
                <div className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  {f.q}
                  <span className="arrow">▾</span>
                </div>
                <div className="faq-a">{f.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="container">
          <div className="logo">
            <FxMirrorLogo className="logo-img" />
          </div>
          <p>Gestion automatisée de trading sur compte MetaTrader 4/5.</p>
          <p className="copy">© 2026 FXMIRROR — Tous droits réservés.</p>
        </div>
      </footer>

      {/* Auth Modal */}
      <div
        className={`modal-overlay${modalOpen ? " active" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModalOpen(false)
        }}
      >
        <div className="modal">
          <button className="modal-close" onClick={() => setModalOpen(false)} aria-label="Fermer">
            &times;
          </button>

          <div className={`toggle-switch${tab === "signup" ? " signup" : ""}`}>
            <div className="toggle-slider" />
            <button className={tab === "login" ? "active" : ""} onClick={() => setTab("login")}>
              Connexion
            </button>
            <button className={tab === "signup" ? "active" : ""} onClick={() => setTab("signup")}>
              Inscription
            </button>
          </div>

          {tab === "login" ? (
            <form
              className="auth-form active"
              onSubmit={(event) => submitAuth(event, "login")}
            >
              <div className="form-title">Bon retour 👋</div>
              <p className="form-sub">Connectez-vous à votre espace personnel FXMIRROR.</p>
              <div className="field">
                <label htmlFor="li-email">Adresse e-mail</label>
                <input id="li-email" name="email" type="email" placeholder="vous@exemple.com" required />
              </div>
              <div className="field">
                <label htmlFor="li-pass">Mot de passe</label>
                <input id="li-pass" name="password" type="password" placeholder="••••••••" required />
              </div>
              <button className="submit-btn" type="submit" disabled={submitting}>
                {submitting ? "Connexion..." : "Se connecter"}
              </button>
              <p className="form-foot">
                Pas encore de compte ? <a onClick={() => setTab("signup")}>Créer un compte</a>
              </p>
            </form>
          ) : (
            <form
              className="auth-form active"
              onSubmit={(event) => submitAuth(event, "signup")}
            >
              <div className="form-title">Créer un compte 🚀</div>
              <p className="form-sub">Rejoignez FXMIRROR et activez la gestion automatisée.</p>
              <div className="field">
                <label htmlFor="su-name">Nom complet</label>
                <input id="su-name" name="fullName" type="text" placeholder="Votre nom" required />
              </div>
              <div className="field">
                <label htmlFor="su-email">Adresse e-mail</label>
                <input id="su-email" name="email" type="email" placeholder="vous@exemple.com" required />
              </div>
              <div className="field">
                <label htmlFor="su-pass">Mot de passe</label>
                <input id="su-pass" name="password" type="password" placeholder="••••••••" minLength={8} required />
              </div>
              <div className="field">
                <label htmlFor="su-ref">Code de parrainage</label>
                <input
                  id="su-ref"
                  name="referralCode"
                  type="text"
                  placeholder="Optionnel"
                  value={referralCode}
                  onChange={(event) => setReferralCode(event.target.value.toUpperCase())}
                />
              </div>
              <button className="submit-btn" type="submit" disabled={submitting}>
                {submitting ? "Inscription..." : "S'inscrire"}
              </button>
              <p className="form-foot">
                Déjà inscrit ? <a onClick={() => setTab("login")}>Se connecter</a>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

const css = `
  .fx-root {
    --blue-900: #06122e;
    --blue-800: #0a1f4d;
    --blue-700: #0d2c6b;
    --blue-600: #1546a0;
    --blue-500: #2563eb;
    --blue-400: #3b82f6;
    --blue-300: #60a5fa;
    --blue-200: #93c5fd;
    --cyan: #22d3ee;
    --offwhite: #f4f8ff;
    --ink: #0a1730;
    --muted: #5b6b8c;
    --glass: rgba(255, 255, 255, 0.55);
    --glass-border: rgba(255, 255, 255, 0.7);
    --shadow: 0 20px 60px rgba(21, 70, 160, 0.18);
    --radius: 20px;

    position: relative;
    min-height: 100vh;
    color: var(--ink);
    line-height: 1.6;
    overflow-x: hidden;
    background:
      radial-gradient(900px 500px at 85% -10%, rgba(59,130,246,0.18), transparent 60%),
      radial-gradient(700px 500px at -10% 20%, rgba(34,211,238,0.14), transparent 55%),
      var(--offwhite);
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  }
  .fx-root * { box-sizing: border-box; }
  .fx-root h1, .fx-root h2, .fx-root h3, .fx-root p, .fx-root ul { margin: 0; padding: 0; }

  .bg-grid {
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background-image:
      linear-gradient(rgba(37,99,235,0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(37,99,235,0.06) 1px, transparent 1px);
    background-size: 48px 48px;
    -webkit-mask-image: radial-gradient(circle at 50% 0%, black 0%, transparent 75%);
    mask-image: radial-gradient(circle at 50% 0%, black 0%, transparent 75%);
  }
  .bg-orb {
    position: fixed; border-radius: 50%; filter: blur(70px); z-index: 0;
    opacity: 0.5; animation: fxfloat 14s ease-in-out infinite; pointer-events: none;
  }
  .orb-1 { width: 420px; height: 420px; background: var(--blue-300); top: -120px; right: -80px; }
  .orb-2 { width: 360px; height: 360px; background: var(--cyan); bottom: 5%; left: -100px; animation-delay: -5s; }
  @keyframes fxfloat { 0%,100% { transform: translateY(0) translateX(0); } 50% { transform: translateY(40px) translateX(20px); } }
  .action-toast {
    position: fixed; top: 18px; right: 18px; z-index: 200;
    max-width: min(360px, calc(100vw - 32px)); padding: 13px 16px;
    border-radius: 14px; color: #fff; font-weight: 800; font-size: .9rem;
    box-shadow: 0 18px 45px rgba(6,18,46,0.26); animation: toastin .28s ease both;
  }
  .action-toast.success { background: linear-gradient(135deg, #059669, #10b981); }
  .action-toast.error { background: linear-gradient(135deg, #b91c1c, #ef4444); }
  .action-toast.warning { background: linear-gradient(135deg, #b45309, #f59e0b); color: #111827; }
  @keyframes toastin { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

  .fx-root .container { width: min(1140px, 92%); margin: 0 auto; position: relative; z-index: 1; }

  .fx-root header {
    position: sticky; top: 0; z-index: 50;
    backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    background: rgba(255,255,255,0.65);
    border-bottom: 1px solid rgba(37,99,235,0.12);
  }
  .nav { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 16px 0; }
  .logo { display: inline-flex; align-items: center; flex: 0 0 auto; min-width: 0; text-decoration: none; }
  .logo-img {
    display: block; height: 40px; width: 194px;
    max-width: 100%;
    --fx-logo-accent: var(--blue-600);
    --fx-logo-text: var(--ink);
  }
  .fx-root footer .logo-img { height: 46px; width: 222px; }
  .nav-links { display: flex; gap: 26px; align-items: center; }
  .nav-links a { text-decoration: none; color: var(--ink); font-weight: 500; font-size: .95rem; transition: color .2s; }
  .nav-links a:hover { color: var(--blue-500); }
  .auth-zone { display: flex; flex: 0 0 auto; gap: 12px; align-items: center; }

  .btn {
    cursor: pointer; border: none; font-weight: 600; font-size: .95rem;
    padding: 11px 22px; border-radius: 12px; font-family: inherit;
    transition: transform .2s, box-shadow .2s, background .2s;
  }
  .btn-ghost {
    background: rgba(255,255,255,0.5); border: 1px solid rgba(37,99,235,0.3);
    color: var(--blue-600); backdrop-filter: blur(8px);
  }
  .btn-ghost:hover { background: rgba(255,255,255,0.85); transform: translateY(-2px); }
  .btn-primary {
    background: linear-gradient(135deg, var(--blue-500), var(--blue-600)); color: #fff;
    box-shadow: 0 10px 24px rgba(37,99,235,0.35);
  }
  .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 14px 30px rgba(37,99,235,0.5); }

  .hero { padding: 90px 0 70px; text-align: center; position: relative; }
  .badge {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(37,99,235,0.08); color: var(--blue-600);
    border: 1px solid rgba(37,99,235,0.2);
    padding: 7px 16px; border-radius: 999px; font-size: .82rem; font-weight: 600;
    margin-bottom: 26px; backdrop-filter: blur(6px);
  }
  .badge .live { width: 8px; height: 8px; background: #16c784; border-radius: 50%; box-shadow: 0 0 8px #16c784; animation: fxpulse 1.4s infinite; }
  .hero h1 {
    font-size: clamp(2.4rem, 6vw, 4.4rem); font-weight: 800; line-height: 1.05; letter-spacing: 1px;
    background: linear-gradient(135deg, var(--blue-700), var(--blue-500) 50%, var(--cyan));
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .hero .sub { font-size: clamp(1.05rem, 2vw, 1.35rem); color: var(--blue-700); font-weight: 600; margin-top: 14px; }
  .hero .lead { max-width: 720px; margin: 22px auto 0; color: var(--muted); font-size: 1.05rem; }
  .hero-cta { display: flex; gap: 16px; justify-content: center; margin-top: 36px; flex-wrap: wrap; }
  .pills { display: flex; gap: 14px; justify-content: center; margin-top: 40px; flex-wrap: wrap; }
  .pill {
    background: var(--glass); border: 1px solid var(--glass-border); backdrop-filter: blur(14px);
    padding: 14px 22px; border-radius: 16px; font-weight: 600; color: var(--blue-700);
    box-shadow: var(--shadow); font-size: .92rem;
  }

  .fx-root section { padding: 70px 0; position: relative; z-index: 1; }
  .section-title { text-align: center; margin-bottom: 50px; }
  .section-title h2 { font-size: clamp(1.8rem, 4vw, 2.8rem); font-weight: 800; color: var(--blue-700); letter-spacing: .5px; }
  .section-title p { color: var(--muted); margin-top: 10px; max-width: 640px; margin-inline: auto; }
  .section-title-left { text-align: left; margin-bottom: 20px; }
  .section-title-left .h2-sm { font-size: 2rem; }
  .section-title-left .p-flush { margin-inline: 0; }

  .grid { display: grid; gap: 24px; }
  .grid-2 { grid-template-columns: repeat(2, 1fr); }
  .grid-4 { grid-template-columns: repeat(4, 1fr); }

  .card {
    padding: 30px; border-radius: var(--radius);
    background: var(--glass); border: 1px solid var(--glass-border);
    backdrop-filter: blur(16px); box-shadow: var(--shadow);
    transition: transform .3s, box-shadow .3s; position: relative; overflow: hidden;
  }
  .card:hover { transform: translateY(-8px); box-shadow: 0 28px 60px rgba(21,70,160,0.28); }
  .card .ic {
    width: 50px; height: 50px; border-radius: 14px; display: grid; place-items: center;
    background: linear-gradient(135deg, var(--blue-500), var(--blue-600));
    color: #fff; font-size: 1.3rem; font-weight: 800; margin-bottom: 18px;
    box-shadow: 0 8px 20px rgba(37,99,235,0.4);
  }
  .card h3 { color: var(--blue-700); font-size: 1.15rem; margin-bottom: 8px; }
  .card p { color: var(--muted); font-size: .96rem; }

  ul.clean { list-style: none; }
  ul.clean.clean-mt { margin-top: 12px; }
  ul.clean li { padding: 8px 0; color: var(--blue-800); display: flex; gap: 10px; align-items: flex-start; }
  ul.clean li::before { content: "▹"; color: var(--blue-500); font-weight: 800; }

  .deposit-wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; align-items: center; }
  .deposit-amount {
    text-align: center; padding: 50px 30px; border-radius: var(--radius);
    background: linear-gradient(135deg, var(--blue-600), var(--blue-800));
    color: #fff; box-shadow: 0 24px 60px rgba(13,44,107,0.45); position: relative; overflow: hidden;
  }
  .deposit-amount::after {
    content: ""; position: absolute; width: 200px; height: 200px; border-radius: 50%;
    background: rgba(34,211,238,0.35); filter: blur(60px); top: -40px; right: -40px;
  }
  .deposit-amount .num { font-size: 4rem; font-weight: 800; letter-spacing: 2px; }
  .deposit-amount .lbl { opacity: .85; letter-spacing: 1px; }
  .perf-badge {
    display: inline-block; margin-top: 16px; background: rgba(255,255,255,0.18);
    padding: 8px 18px; border-radius: 999px; font-weight: 700; backdrop-filter: blur(6px);
  }

  .trial {
    background:
      radial-gradient(600px 300px at 100% 0%, rgba(34,211,238,0.18), transparent 60%),
      linear-gradient(135deg, var(--blue-700), var(--blue-900));
    border-radius: 28px; padding: 56px 40px; color: #fff; box-shadow: 0 30px 70px rgba(6,18,46,0.5);
    position: relative; overflow-x: hidden; overflow-y: auto;
  }
  .trial h2 { font-size: clamp(1.8rem, 4vw, 2.6rem); }
  .trial .trial-lead { opacity: .9; margin-top: 10px; max-width: 680px; }
  .trial .trial-h3 { margin-top: 30px; color: var(--blue-200); }
  .trial .free-tag {
    display: inline-block; background: linear-gradient(135deg, var(--cyan), var(--blue-400));
    color: #04122e; font-weight: 800; padding: 6px 16px; border-radius: 999px; margin-bottom: 16px;
  }
  .steps { display: grid; gap: 14px; margin-top: 24px; counter-reset: step; }
  .step {
    display: flex; gap: 14px; align-items: center; counter-increment: step;
    background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
    padding: 14px 18px; border-radius: 14px; backdrop-filter: blur(8px);
  }
  .step::before {
    content: counter(step); flex: 0 0 34px; height: 34px; border-radius: 50%;
    background: linear-gradient(135deg, var(--cyan), var(--blue-400)); color: #04122e;
    display: grid; place-items: center; font-weight: 800;
  }
  .why-list { display: grid; grid-template-columns: repeat(2,1fr); gap: 12px; margin-top: 26px; }
  .why-list div {
    background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
    padding: 12px 16px; border-radius: 12px; font-weight: 600; font-size: .95rem;
  }
  .trial-cta { margin-top: 30px; }

  .chip-label { margin-top: 12px; font-weight: 600; color: var(--blue-700); }
  .chips { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 18px; }
  .chip {
    background: rgba(37,99,235,0.08); border: 1px solid rgba(37,99,235,0.2);
    color: var(--blue-700); padding: 10px 18px; border-radius: 999px; font-weight: 600;
  }

  .faq-wrap { max-width: 780px; margin: 0 auto; }
  .faq-item {
    background: var(--glass); border: 1px solid var(--glass-border); backdrop-filter: blur(14px);
    border-radius: 16px; margin-bottom: 14px; overflow: hidden; box-shadow: 0 10px 30px rgba(21,70,160,0.1);
  }
  .faq-q {
    cursor: pointer; padding: 20px 24px; font-weight: 700; color: var(--blue-700);
    display: flex; justify-content: space-between; align-items: center; user-select: none;
  }
  .faq-q .arrow { transition: transform .3s; color: var(--blue-500); }
  .faq-a { max-height: 0; overflow: hidden; transition: max-height .35s ease, padding .35s ease; padding: 0 24px; color: var(--muted); }
  .faq-item.open .faq-a { max-height: 220px; padding: 0 24px 20px; }
  .faq-item.open .arrow { transform: rotate(180deg); }

  .fx-root footer { padding: 50px 0 30px; text-align: center; color: var(--muted); border-top: 1px solid rgba(37,99,235,0.12); margin-top: 40px; position: relative; z-index: 1; }
  .fx-root footer .logo { justify-content: center; margin-bottom: 14px; }
  .fx-root footer .copy { margin-top: 8px; font-size: .85rem; }

  .modal-overlay {
    position: fixed; inset: 0; z-index: 100;
    background: rgba(6,18,46,0.55); backdrop-filter: blur(8px);
    display: none; align-items: center; justify-content: center; padding: 20px;
    opacity: 0; transition: opacity .3s;
  }
  .modal-overlay.active { display: flex; opacity: 1; }
  .modal {
    width: min(430px, 100%); max-width: 430px; max-height: calc(100dvh - 40px); overflow-y: auto;
    background: rgba(255,255,255,0.75); border: 1px solid rgba(255,255,255,0.8);
    backdrop-filter: blur(26px); border-radius: 24px; padding: 36px;
    box-shadow: 0 30px 80px rgba(6,18,46,0.4);
    transform: translateY(30px) scale(.96); opacity: 0;
    transition: transform .35s cubic-bezier(.2,.8,.2,1), opacity .35s;
    position: relative; overflow: hidden;
  }
  .modal-overlay.active .modal { transform: translateY(0) scale(1); opacity: 1; }
  .modal::before {
    content: ""; position: absolute; width: 180px; height: 180px; border-radius: 50%;
    background: rgba(34,211,238,0.25); filter: blur(50px); top: -50px; right: -50px; z-index: 0;
  }
  .modal-close {
    position: absolute; top: 16px; right: 18px; background: none; border: none;
    font-size: 1.5rem; color: var(--muted); cursor: pointer; line-height: 1; z-index: 2;
  }
  .modal-close:hover { color: var(--blue-600); }

  .toggle-switch {
    display: flex; background: rgba(37,99,235,0.08); border-radius: 14px; padding: 6px; margin-bottom: 28px;
    position: relative; border: 1px solid rgba(37,99,235,0.15);
  }
  .toggle-switch button {
    flex: 1; border: none; background: none; cursor: pointer; padding: 12px; font-weight: 700;
    color: var(--muted); border-radius: 10px; z-index: 2; transition: color .3s; font-family: inherit; font-size: .98rem;
  }
  .toggle-switch button.active { color: #fff; }
  .toggle-slider {
    position: absolute; top: 6px; bottom: 6px; width: calc(50% - 6px); left: 6px;
    background: linear-gradient(135deg, var(--blue-500), var(--blue-600));
    border-radius: 10px; transition: transform .35s cubic-bezier(.2,.8,.2,1);
    box-shadow: 0 8px 20px rgba(37,99,235,0.4); z-index: 1;
  }
  .toggle-switch.signup .toggle-slider { transform: translateX(100%); }

  .auth-form { display: flex; flex-direction: column; gap: 16px; animation: fxfadein .4s; position: relative; z-index: 1; }
  @keyframes fxfadein { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .form-title { font-size: 1.5rem; font-weight: 800; color: var(--blue-700); }
  .form-sub { color: var(--muted); font-size: .92rem; margin-top: -8px; margin-bottom: 6px; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field label { font-size: .85rem; font-weight: 600; color: var(--blue-800); }
  .field input {
    padding: 13px 16px; border-radius: 12px; border: 1px solid rgba(37,99,235,0.25);
    background: rgba(255,255,255,0.7); font-size: .95rem; font-family: inherit; outline: none;
    transition: border .2s, box-shadow .2s; color: var(--ink);
  }
  .field input:focus { border-color: var(--blue-500); box-shadow: 0 0 0 3px rgba(37,99,235,0.15); }
  .submit-btn {
    margin-top: 8px; padding: 14px; border: none; border-radius: 12px; cursor: pointer;
    background: linear-gradient(135deg, var(--blue-500), var(--blue-600)); color: #fff;
    font-weight: 700; font-size: 1rem; font-family: inherit;
    box-shadow: 0 12px 28px rgba(37,99,235,0.4); transition: transform .2s, box-shadow .2s;
  }
  .submit-btn:hover { transform: translateY(-2px); box-shadow: 0 16px 34px rgba(37,99,235,0.55); }
  .submit-btn:disabled { opacity: .65; cursor: wait; transform: none; }
  .form-foot { text-align: center; font-size: .88rem; color: var(--muted); }
  .form-foot a { color: var(--blue-600); font-weight: 600; text-decoration: none; cursor: pointer; }

  @media (max-width: 900px) {
    .grid-4 { grid-template-columns: repeat(2,1fr); }
    .deposit-wrap { grid-template-columns: 1fr; }
  }
  @media (max-width: 720px) {
    .action-toast {
      top: 18px; left: 50%; right: auto; width: 90vw; max-width: 90vw;
      text-align: center; animation: toastinmobile .28s ease both;
    }
    @keyframes toastinmobile {
      from { opacity: 0; transform: translate(-50%, -10px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }
    .fx-root .container { width: min(100% - 24px, 1140px); }
    .nav { gap: 8px; padding: 12px 0; }
    .nav-links { display: none; }
    .logo-img { width: 128px; height: 28px; }
    .auth-zone { gap: 6px; }
    .auth-zone .btn {
      min-width: 0; white-space: nowrap;
      padding: 8px 10px; border-radius: 10px; font-size: .78rem;
    }
    .grid-2, .grid-4 { grid-template-columns: 1fr; }
    .why-list { grid-template-columns: 1fr; }
    .hero { padding: 60px 0 40px; }
    .modal-overlay { padding: 0; align-items: center; justify-content: center; }
    .modal { width: 90vw; max-height: 90dvh; padding: 28px 20px 22px; border-radius: 18px; }
    .toggle-switch button { padding: 10px 6px; font-size: .9rem; }
  }
  @media (max-width: 380px) {
    .logo-img { width: 104px; height: 24px; }
    .auth-zone .btn { padding: 7px 8px; font-size: .73rem; }
  }
`
