/**
 * ANCIENFX — MT5 Service (Next.js side)
 * ======================================
 * Toute communication avec le bridge Python passe par ce module.
 * Le bridge tourne sur le VPS Windows (mt5_bridge/bridge.py).
 *
 * Variable d'environnement requise (côté Vercel / .env) :
 *   MT5_BRIDGE_URL=http://127.0.0.1:8765   (ou URL du tunnel Cloudflare)
 *
 * Variable optionnelle :
 *   BRIDGE_SECRET=votre_secret_ici   (header X-Bridge-Secret)
 */

// ── Types publics ──────────────────────────────────────────────────────────────

export type Mt5ConnectPayload = {
  login: string
  password: string
  server: string
}

export type Mt5AccountInfo = {
  login: string
  server: string
  broker: string
  accountType: string
  leverage: number
  isDemo: boolean
  balance: number
  equity: number
  freeMargin: number
  dailyProfit: number
  currency: string
}

export type Mt5Position = {
  ticket: number
  symbol: string
  type: "BUY" | "SELL"
  volume: number
  openPrice: number
  sl: number
  tp: number
  profit: number
  swap: number
  comment: string
  openTime: string
}

export type Mt5Deal = {
  ticket: number
  symbol: string
  type: "BUY" | "SELL"
  volume: number
  price: number
  profit: number
  commission: number
  swap: number
  comment: string
  time: string
}

export type BridgeHealth = {
  mt5Available: boolean
  terminalConnected: boolean
  activeSessions: number
  timestamp: string
}

// ── Helpers internes ───────────────────────────────────────────────────────────

function bridgeUrl(): string | null {
  return process.env.MT5_BRIDGE_URL?.replace(/\/$/, "") ?? null
}

function bridgeHeaders(): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const secret = process.env.BRIDGE_SECRET
  if (secret) headers["X-Bridge-Secret"] = secret
  return headers
}

/** fetch avec timeout de 10 secondes */
async function bridgeFetch(path: string, body?: object): Promise<Response> {
  const url = bridgeUrl()
  if (!url) throw new Error("MT5_BRIDGE_URL non configuré.")

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 10_000)

  try {
    return await fetch(`${url}${path}`, {
      method: body !== undefined ? "POST" : "GET",
      headers: bridgeHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

// ── Mock de développement (quand le bridge n'est pas actif) ───────────────────

function mockAccount(payload: Mt5ConnectPayload): Mt5AccountInfo {
  const isDemo = /demo/i.test(payload.server)
  const seed = Number(payload.login.slice(-4)) || 1000
  const balance = 10000 + seed * 1.27

  return {
    login: payload.login,
    server: payload.server,
    broker: isDemo ? "Exness (Demo)" : "Exness",
    accountType: isDemo ? "DEMO" : "RÉEL",
    leverage: 500,
    isDemo,
    balance: Math.round(balance * 100) / 100,
    equity: Math.round((balance + 42.15) * 100) / 100,
    freeMargin: Math.round((balance - 120) * 100) / 100,
    dailyProfit: Math.round((seed % 300) * 100) / 100,
    currency: "USD",
  }
}

// ── API publique ───────────────────────────────────────────────────────────────

/**
 * Vérifie si le bridge est joignable et si le terminal MT5 est connecté.
 */
export async function checkBridgeHealth(): Promise<BridgeHealth | null> {
  const url = bridgeUrl()
  if (!url) return null

  try {
    const res = await bridgeFetch("/health")
    if (!res.ok) return null
    const data = await res.json()
    return {
      mt5Available: data.mt5_available,
      terminalConnected: data.terminal_connected,
      activeSessions: data.active_sessions,
      timestamp: data.timestamp,
    }
  } catch {
    return null
  }
}

/**
 * Connecte un compte MT5 via le bridge.
 * Si le bridge est absent (dev local), retourne un compte mocké.
 */
export async function connectMt5Account(payload: Mt5ConnectPayload): Promise<Mt5AccountInfo> {
  const url = bridgeUrl()

  if (url) {
    let res: Response
    try {
      res = await bridgeFetch("/connect", payload)
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.name === "AbortError"
      throw new Error(
        isTimeout
          ? "Le bridge MT5 ne répond pas (timeout). Vérifiez que start.bat est lancé sur le VPS."
          : `Impossible de joindre le bridge MT5 : ${err instanceof Error ? err.message : String(err)}`
      )
    }

    const data = await res.json()
    if (!res.ok || !data.ok) {
      throw new Error(data.message || "Connexion MT5 impossible.")
    }
    return data.account as Mt5AccountInfo
  }

  // Dev fallback — aucun bridge disponible
  if (!payload.login || !payload.password || !payload.server) {
    throw new Error("Identifiants MT5 incomplets.")
  }
  if (payload.password.length < 4) {
    throw new Error("Mot de passe MT5 invalide.")
  }
  return mockAccount(payload)
}

/**
 * Rafraîchit les données d'un compte MT5 existant.
 * Retourne null si le bridge est absent ou si la session a expiré.
 */
export async function syncMt5Account(login: string, server: string): Promise<Mt5AccountInfo | null> {
  const url = bridgeUrl()
  if (!url) return null

  try {
    const res = await bridgeFetch("/sync", { login, server })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.ok) return null
    return data.account as Mt5AccountInfo
  } catch {
    return null
  }
}

/**
 * Supprime la session MT5 du bridge (ne déconnecte pas MT5 globalement).
 */
export async function disconnectMt5Account(login: string, server: string): Promise<void> {
  const url = bridgeUrl()
  if (!url) return

  try {
    await bridgeFetch("/disconnect", { login, server })
  } catch {
    // On ignore les erreurs de déconnexion (ex: bridge éteint)
  }
}

/**
 * Récupère les positions ouvertes du compte.
 * Retourne un tableau vide si le bridge est absent.
 */
export async function getMt5Positions(login: string, server: string): Promise<Mt5Position[]> {
  const url = bridgeUrl()
  if (!url) return []

  try {
    const res = await bridgeFetch("/positions", { login, server })
    if (!res.ok) return []
    const data = await res.json()
    return (data.positions ?? []) as Mt5Position[]
  } catch {
    return []
  }
}

/**
 * Récupère l'historique des trades sur N jours (défaut : 30).
 * Retourne un tableau vide si le bridge est absent.
 */
export async function getMt5History(login: string, server: string, days = 30): Promise<Mt5Deal[]> {
  const url = bridgeUrl()
  if (!url) return []

  try {
    const res = await bridgeFetch("/history", { login, server, days })
    if (!res.ok) return []
    const data = await res.json()
    return (data.deals ?? []) as Mt5Deal[]
  } catch {
    return []
  }
}

// ── Copy trading (maître → slaves) ───────────────────────────────────────────

export type CopyMode = "balance" | "multiplier" | "fixed"

export type CopyStatus = {
  enabled: boolean
  master: { login: string; server: string; connected: boolean }
  slavesCount: number
  trackedMasterPositions: number
  stats: { opens: number; closes: number; modifies: number; errors: number; lastCycle: number }
  config: Record<string, unknown>
}

export type CopyConfigPatch = {
  enabled?: boolean
  masterLogin?: string
  masterServer?: string
  mode?: CopyMode
  multiplier?: number
  copySltp?: boolean
  minVolume?: number
  maxVolume?: number
  magic?: number
  pollInterval?: number
  slaveOverrides?: Record<string, { mode?: CopyMode; multiplier?: number }>
}

function mapCopyStatus(data: Record<string, unknown>): CopyStatus {
  const master = (data.master ?? {}) as Record<string, unknown>
  const stats = (data.stats ?? {}) as Record<string, unknown>
  return {
    enabled: Boolean(data.enabled),
    master: {
      login: String(master.login ?? ""),
      server: String(master.server ?? ""),
      connected: Boolean(master.connected),
    },
    slavesCount: Number(data.slaves_count ?? 0),
    trackedMasterPositions: Number(data.tracked_master_positions ?? 0),
    stats: {
      opens: Number(stats.opens ?? 0),
      closes: Number(stats.closes ?? 0),
      modifies: Number(stats.modifies ?? 0),
      errors: Number(stats.errors ?? 0),
      lastCycle: Number(stats.last_cycle ?? 0),
    },
    config: (data.config ?? {}) as Record<string, unknown>,
  }
}

/** État courant du moteur de copie. Null si le bridge est absent. */
export async function getCopyStatus(): Promise<CopyStatus | null> {
  const url = bridgeUrl()
  if (!url) return null
  try {
    const res = await bridgeFetch("/copy/status")
    if (!res.ok) return null
    const data = await res.json()
    if (!data.ok) return null
    return mapCopyStatus(data)
  } catch {
    return null
  }
}

/** Met à jour la config du moteur de copie (camelCase → snake_case pour le bridge). */
export async function updateCopyConfig(patch: CopyConfigPatch): Promise<CopyStatus | null> {
  const url = bridgeUrl()
  if (!url) return null
  const body: Record<string, unknown> = {}
  if (patch.enabled !== undefined) body.enabled = patch.enabled
  if (patch.masterLogin !== undefined) body.master_login = patch.masterLogin
  if (patch.masterServer !== undefined) body.master_server = patch.masterServer
  if (patch.mode !== undefined) body.mode = patch.mode
  if (patch.multiplier !== undefined) body.multiplier = patch.multiplier
  if (patch.copySltp !== undefined) body.copy_sltp = patch.copySltp
  if (patch.minVolume !== undefined) body.min_volume = patch.minVolume
  if (patch.maxVolume !== undefined) body.max_volume = patch.maxVolume
  if (patch.magic !== undefined) body.magic = patch.magic
  if (patch.pollInterval !== undefined) body.poll_interval = patch.pollInterval
  if (patch.slaveOverrides !== undefined) body.slave_overrides = patch.slaveOverrides

  try {
    const res = await bridgeFetch("/copy/config", body)
    if (!res.ok) return null
    const data = await res.json()
    if (!data.ok) return null
    return mapCopyStatus(data)
  } catch {
    return null
  }
}

/** Active la copie, en définissant optionnellement le compte maître. */
export async function enableCopy(master?: { login: string; server?: string }): Promise<CopyStatus | null> {
  const url = bridgeUrl()
  if (!url) return null
  const body: Record<string, unknown> = {}
  if (master?.login) body.master_login = master.login
  if (master?.server) body.master_server = master.server
  try {
    const res = await bridgeFetch("/copy/enable", body)
    if (!res.ok) return null
    const data = await res.json()
    if (!data.ok) return null
    return mapCopyStatus(data)
  } catch {
    return null
  }
}

/** Désactive la copie (les positions ouvertes restent en place). */
export async function disableCopy(): Promise<CopyStatus | null> {
  const url = bridgeUrl()
  if (!url) return null
  try {
    const res = await bridgeFetch("/copy/disable", {})
    if (!res.ok) return null
    const data = await res.json()
    if (!data.ok) return null
    return mapCopyStatus(data)
  } catch {
    return null
  }
}

/**
 * Résout un symbole avec suffixe automatique (EURUSDm → EURUSD, etc.)
 * Retourne null si le bridge est absent ou le symbole introuvable.
 */
export async function resolveSymbol(
  symbol: string
): Promise<{ original: string; resolved: string } | null> {
  const url = bridgeUrl()
  if (!url) return null

  try {
    const res = await bridgeFetch("/symbol_info", { symbol })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.ok) return null
    return { original: data.original, resolved: data.resolved }
  } catch {
    return null
  }
}
