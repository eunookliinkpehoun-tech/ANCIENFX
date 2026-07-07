/**
 * ANCIENFX — MT5 Service (via MetaApi.cloud)
 * ==========================================
 * Toute la logique MT4/MT5 passe désormais par MetaApi.cloud (fini le bridge Python).
 *
 * Principes :
 *  - Un compte utilisateur = un compte MetaTrader provisionné chez MetaApi.
 *  - On déploie le compte pour lire ses infos, puis on peut le laisser déployé
 *    (nécessaire pour la copie CopyFactory en temps réel).
 *  - Les comptes NON FONCTIONNELS (identifiants invalides, broker injoignable)
 *    sont supprimés immédiatement pour ne pas consommer de ressources MetaApi.
 *
 * Variable d'environnement requise : METAAPI_TOKEN
 */

import type MetatraderAccount from "metaapi.cloud-sdk/dist/metaApi/metatraderAccount"
import { getMetaApi, isMetaApiConfigured, DEFAULT_REGION, APPLICATION } from "./metaapi"

// ── Types publics ──────────────────────────────────────────────────────────────

export type Mt5Platform = "mt4" | "mt5"

export type Mt5ConnectPayload = {
  login: string
  password: string
  server: string
  platform?: Mt5Platform
}

export type Mt5AccountInfo = {
  /** Identifiant du compte chez MetaApi (à stocker en base pour les appels suivants). */
  metaApiAccountId: string
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
  configured: boolean
  provider: "metaapi"
  region: string
  timestamp: string
}

// ── Constantes de temporisation ─────────────────────────────────────────────

/** Délai max d'attente de connexion au broker avant de considérer le compte non fonctionnel. */
const CONNECT_TIMEOUT_SECONDS = 90
/** Délai max d'attente de synchronisation RPC. */
const SYNC_TIMEOUT_SECONDS = 60

// ── Helpers internes ───────────────────────────────────────────────────────────

function toBuySell(type: string): "BUY" | "SELL" {
  return /SELL/i.test(type) ? "SELL" : "BUY"
}

function isDemoAccountType(type: string | undefined): boolean {
  // ACCOUNT_TRADE_MODE_DEMO / ACCOUNT_TRADE_MODE_CONTEST => démo
  return /DEMO|CONTEST/i.test(type ?? "")
}

/** Supprime un compte MetaApi sans jamais lever d'exception (nettoyage best-effort). */
async function safeRemove(account: MetatraderAccount): Promise<void> {
  try {
    await account.remove()
  } catch (err) {
    console.error("[v0] safeRemove failed:", err instanceof Error ? err.message : err)
  }
}

/**
 * Récupère une connexion RPC synchronisée pour un compte donné.
 * S'assure que le compte est déployé et connecté au broker.
 * Lève une erreur si le compte est introuvable ou injoignable.
 */
async function getSyncedConnection(account: MetatraderAccount) {
  if (account.state !== "DEPLOYED") {
    await account.deploy()
  }
  await account.waitConnected(CONNECT_TIMEOUT_SECONDS)

  const connection = account.getRPCConnection()
  await connection.connect()
  await connection.waitSynchronized(SYNC_TIMEOUT_SECONDS)
  return connection
}

/** Somme des profits des deals clôturés depuis minuit (UTC) pour un profit journalier approximatif. */
async function computeDailyProfit(
  connection: Awaited<ReturnType<typeof getSyncedConnection>>,
): Promise<number> {
  try {
    const start = new Date()
    start.setUTCHours(0, 0, 0, 0)
    const end = new Date()
    const result = await connection.getDealsByTimeRange(start, end)
    const deals = result?.deals ?? []
    const total = deals.reduce((acc, d) => acc + (d.profit ?? 0) + (d.swap ?? 0) + (d.commission ?? 0), 0)
    return Math.round(total * 100) / 100
  } catch {
    return 0
  }
}

// ── API publique ───────────────────────────────────────────────────────────────

/**
 * Vérifie que MetaApi est configuré (token présent).
 */
export async function checkBridgeHealth(): Promise<BridgeHealth | null> {
  if (!isMetaApiConfigured()) return null
  return {
    configured: true,
    provider: "metaapi",
    region: DEFAULT_REGION,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Connecte (provisionne) un compte MT4/MT5 via MetaApi.
 * - Crée le compte chez MetaApi, le déploie et attend la connexion broker.
 * - En cas d'échec (identifiants invalides / broker injoignable), supprime le
 *   compte pour ne pas consommer de ressources, puis lève une erreur.
 */
export async function connectMt5Account(payload: Mt5ConnectPayload): Promise<Mt5AccountInfo> {
  const login = payload.login.trim()
  const server = payload.server.trim()
  const platform: Mt5Platform = payload.platform ?? "mt5"

  if (!login || !payload.password || !server) {
    throw new Error("Identifiants MT4/MT5 incomplets.")
  }
  if (!/^\d+$/.test(login)) {
    throw new Error("Le login MT4/MT5 doit être numérique.")
  }
  if (!isMetaApiConfigured()) {
    throw new Error("MetaApi n'est pas configuré (METAAPI_TOKEN manquant).")
  }

  const api = getMetaApi()

  // Créer le compte MetaApi
  let account: MetatraderAccount
  try {
    account = await api.metatraderAccountApi.createAccount({
      name: `ANCIENFX ${login}`,
      type: "cloud-g2",
      login,
      password: payload.password,
      server,
      platform,
      magic: 0,
      application: APPLICATION,
      region: DEFAULT_REGION,
      keywords: [],
      quoteStreamingIntervalInSeconds: 2.5,
      reliability: "regular",
      // Rôle SUBSCRIBER : permet de recevoir les trades copiés depuis le compte maître via CopyFactory.
      copyFactoryRoles: ["SUBSCRIBER"],
      metadata: { app: "ancienfx" },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Impossible de créer le compte chez MetaApi : ${msg}`)
  }

  // Déployer + attendre la connexion broker ; nettoyer si échec
  try {
    const connection = await getSyncedConnection(account)
    const info = await connection.getAccountInformation()
    const dailyProfit = await computeDailyProfit(connection)

    return {
      metaApiAccountId: account.id,
      login: String(info.login ?? login),
      server: info.server ?? server,
      broker: info.broker ?? "",
      accountType: isDemoAccountType(info.type) ? "DEMO" : "RÉEL",
      leverage: Number(info.leverage ?? 0),
      isDemo: isDemoAccountType(info.type),
      balance: Math.round(Number(info.balance ?? 0) * 100) / 100,
      equity: Math.round(Number(info.equity ?? 0) * 100) / 100,
      freeMargin: Math.round(Number(info.freeMargin ?? 0) * 100) / 100,
      dailyProfit,
      currency: info.currency ?? "USD",
    }
  } catch (err) {
    // Compte non fonctionnel → suppression pour économiser les ressources MetaApi
    await safeRemove(account)
    const isTimeout = err instanceof Error && /timeout/i.test(err.message)
    throw new Error(
      isTimeout
        ? "Connexion au broker impossible (identifiants ou serveur incorrects). Le compte a été retiré."
        : `Connexion MT4/MT5 impossible : ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

/**
 * Rafraîchit les infos d'un compte MetaApi existant (par son id MetaApi).
 * Retourne null si MetaApi n'est pas configuré ou si le compte est injoignable.
 */
export async function syncMt5Account(metaApiAccountId: string): Promise<Mt5AccountInfo | null> {
  if (!isMetaApiConfigured() || !metaApiAccountId) return null

  try {
    const api = getMetaApi()
    const account = await api.metatraderAccountApi.getAccount(metaApiAccountId)
    const connection = await getSyncedConnection(account)
    const info = await connection.getAccountInformation()
    const dailyProfit = await computeDailyProfit(connection)

    return {
      metaApiAccountId: account.id,
      login: String(info.login ?? account.login ?? ""),
      server: info.server ?? account.server ?? "",
      broker: info.broker ?? "",
      accountType: isDemoAccountType(info.type) ? "DEMO" : "RÉEL",
      leverage: Number(info.leverage ?? 0),
      isDemo: isDemoAccountType(info.type),
      balance: Math.round(Number(info.balance ?? 0) * 100) / 100,
      equity: Math.round(Number(info.equity ?? 0) * 100) / 100,
      freeMargin: Math.round(Number(info.freeMargin ?? 0) * 100) / 100,
      dailyProfit,
      currency: info.currency ?? "USD",
    }
  } catch (err) {
    console.error("[v0] syncMt5Account error:", err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Déconnecte un compte MetaApi.
 * - Par défaut supprime le compte (remove) pour libérer toutes les ressources.
 * - Passez { keep: true } pour seulement le mettre hors ligne (undeploy).
 */
export async function disconnectMt5Account(
  metaApiAccountId: string,
  options: { keep?: boolean } = {},
): Promise<void> {
  if (!isMetaApiConfigured() || !metaApiAccountId) return

  try {
    const api = getMetaApi()
    const account = await api.metatraderAccountApi.getAccount(metaApiAccountId)
    if (options.keep) {
      await account.undeploy()
    } else {
      await account.remove()
    }
  } catch (err) {
    console.error("[v0] disconnectMt5Account error:", err instanceof Error ? err.message : err)
  }
}

/**
 * Positions ouvertes d'un compte MetaApi. Tableau vide si indisponible.
 */
export async function getMt5Positions(metaApiAccountId: string): Promise<Mt5Position[]> {
  if (!isMetaApiConfigured() || !metaApiAccountId) return []

  try {
    const api = getMetaApi()
    const account = await api.metatraderAccountApi.getAccount(metaApiAccountId)
    const connection = await getSyncedConnection(account)
    const positions = await connection.getPositions()

    return positions.map((p) => ({
      ticket: Number(p.id),
      symbol: p.symbol,
      type: toBuySell(p.type),
      volume: Number(p.volume ?? 0),
      openPrice: Number(p.openPrice ?? 0),
      sl: Number(p.stopLoss ?? 0),
      tp: Number(p.takeProfit ?? 0),
      profit: Math.round(Number(p.profit ?? 0) * 100) / 100,
      swap: Math.round(Number(p.swap ?? 0) * 100) / 100,
      comment: p.comment ?? "",
      openTime: p.time instanceof Date ? p.time.toISOString() : String(p.time ?? ""),
    }))
  } catch (err) {
    console.error("[v0] getMt5Positions error:", err instanceof Error ? err.message : err)
    return []
  }
}

/**
 * Historique des trades clôturés sur N jours (défaut : 30). Tableau vide si indisponible.
 */
export async function getMt5History(metaApiAccountId: string, days = 30): Promise<Mt5Deal[]> {
  if (!isMetaApiConfigured() || !metaApiAccountId) return []

  try {
    const api = getMetaApi()
    const account = await api.metatraderAccountApi.getAccount(metaApiAccountId)
    const connection = await getSyncedConnection(account)

    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const end = new Date()
    const result = await connection.getDealsByTimeRange(start, end)
    const deals = result?.deals ?? []

    return deals
      // On garde seulement les vrais deals de trading (achat/vente), pas les mouvements de solde
      .filter((d) => /BUY|SELL/i.test(d.type) && d.symbol)
      .map((d) => ({
        ticket: Number(d.id),
        symbol: d.symbol ?? "",
        type: toBuySell(d.type),
        volume: Number(d.volume ?? 0),
        price: Number(d.price ?? 0),
        profit: Math.round(Number(d.profit ?? 0) * 100) / 100,
        commission: Math.round(Number(d.commission ?? 0) * 100) / 100,
        swap: Math.round(Number(d.swap ?? 0) * 100) / 100,
        comment: d.comment ?? "",
        time: d.time instanceof Date ? d.time.toISOString() : String(d.time ?? ""),
      }))
  } catch (err) {
    console.error("[v0] getMt5History error:", err instanceof Error ? err.message : err)
    return []
  }
}

/**
 * Résout un symbole disponible chez le broker (gère les suffixes type EURUSDm).
 * Retourne null si introuvable.
 */
export async function resolveSymbol(
  metaApiAccountId: string,
  symbol: string,
): Promise<{ original: string; resolved: string } | null> {
  if (!isMetaApiConfigured() || !metaApiAccountId) return null

  try {
    const api = getMetaApi()
    const account = await api.metatraderAccountApi.getAccount(metaApiAccountId)
    const connection = await getSyncedConnection(account)
    const symbols = await connection.getSymbols()

    if (symbols.includes(symbol)) return { original: symbol, resolved: symbol }
    const match = symbols.find((s) => s.toUpperCase().startsWith(symbol.toUpperCase()))
    return match ? { original: symbol, resolved: match } : null
  } catch (err) {
    console.error("[v0] resolveSymbol error:", err instanceof Error ? err.message : err)
    return null
  }
}
