/**
 * ANCIENFX — CopyFactory (compte maître → comptes utilisateurs)
 * =============================================================
 * Le compte MAÎTRE (provider) est configuré via la page admin. Ses trades sont
 * copiés en temps réel vers les comptes utilisateurs (subscribers) grâce à
 * CopyFactory de MetaApi.
 *
 * Flux :
 *  1. Admin renseigne les identifiants du maître  → provisionMaster()
 *     - crée un compte MetaApi (rôle PROVIDER), le déploie
 *     - crée une stratégie CopyFactory pointant sur ce compte
 *  2. Chaque compte utilisateur connecté (rôle SUBSCRIBER) est abonné
 *     à la stratégie du maître → subscribeAccount()
 *
 * Les identifiants (id de compte MetaApi + id de stratégie) sont stockés en base
 * dans la table app_settings.
 */

import type MetatraderAccount from "metaapi.cloud-sdk/dist/metaApi/metatraderAccount"
import { getMetaApi, getCopyFactory, isMetaApiConfigured, DEFAULT_REGION, APPLICATION } from "./metaapi"
import type { Mt5Platform } from "./service"

const CONNECT_TIMEOUT_SECONDS = 90

export type MasterProvisionPayload = {
  login: string
  password: string
  server: string
  platform?: Mt5Platform
}

export type MasterProvisionResult = {
  metaApiAccountId: string
  strategyId: string
  login: string
  server: string
  broker: string
  balance: number
  equity: number
  currency: string
}

export type MasterStatus = {
  metaApiAccountId: string
  strategyId: string
  login: string
  server: string
  broker: string
  balance: number
  equity: number
  currency: string
  state: string
  connectionStatus: string
  connected: boolean
  subscribersCount: number
}

async function ensureDeployed(account: MetatraderAccount): Promise<void> {
  if (account.state !== "DEPLOYED") {
    await account.deploy()
  }
  await account.waitConnected(CONNECT_TIMEOUT_SECONDS)
}

async function safeRemove(account: MetatraderAccount): Promise<void> {
  try {
    await account.remove()
  } catch (err) {
    console.error("[v0] copyfactory safeRemove failed:", err instanceof Error ? err.message : err)
  }
}

/**
 * Provisionne (ou re-provisionne) le compte maître et crée sa stratégie CopyFactory.
 * En cas d'échec de connexion, le compte est supprimé pour ne pas gaspiller de ressources.
 */
export async function provisionMaster(payload: MasterProvisionPayload): Promise<MasterProvisionResult> {
  const login = payload.login.trim()
  const server = payload.server.trim()
  const platform: Mt5Platform = payload.platform ?? "mt5"

  if (!login || !payload.password || !server) {
    throw new Error("Identifiants du compte maître incomplets.")
  }
  if (!/^\d+$/.test(login)) {
    throw new Error("Le login du compte maître doit être numérique.")
  }
  if (!isMetaApiConfigured()) {
    throw new Error("MetaApi n'est pas configuré (METAAPI_TOKEN manquant).")
  }

  const api = getMetaApi()

  let account: MetatraderAccount
  try {
    account = await api.metatraderAccountApi.createAccount({
      name: `ANCIENFX MASTER ${login}`,
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
      reliability: "high",
      // Rôle PROVIDER : ses trades seront copiés vers les subscribers.
      copyFactoryRoles: ["PROVIDER"],
      metadata: { app: "ancienfx", role: "master" },
    })
  } catch (err) {
    throw new Error(`Impossible de créer le compte maître : ${err instanceof Error ? err.message : String(err)}`)
  }

  let info
  try {
    await ensureDeployed(account)
    const connection = account.getRPCConnection()
    await connection.connect()
    await connection.waitSynchronized(60)
    info = await connection.getAccountInformation()
  } catch (err) {
    await safeRemove(account)
    const isTimeout = err instanceof Error && /timeout/i.test(err.message)
    throw new Error(
      isTimeout
        ? "Connexion au broker du compte maître impossible (identifiants/serveur incorrects)."
        : `Connexion du compte maître impossible : ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  // Créer la stratégie CopyFactory pointant sur le compte maître
  const copyFactory = getCopyFactory()
  const configurationApi = copyFactory.configurationApi
  const strategyId = await configurationApi.generateStrategyId()

  try {
    await configurationApi.updateStrategy(strategyId.id, {
      name: `ANCIENFX Master ${login}`,
      description: "Stratégie maître ANCIENFX copiée vers les comptes utilisateurs.",
      accountId: account.id,
    })
  } catch (err) {
    // La stratégie n'a pas pu être créée : on retire le compte pour ne rien gaspiller.
    await safeRemove(account)
    throw new Error(`Impossible de créer la stratégie CopyFactory : ${err instanceof Error ? err.message : String(err)}`)
  }

  return {
    metaApiAccountId: account.id,
    strategyId: strategyId.id,
    login: String(info.login ?? login),
    server: info.server ?? server,
    broker: info.broker ?? "",
    balance: Math.round(Number(info.balance ?? 0) * 100) / 100,
    equity: Math.round(Number(info.equity ?? 0) * 100) / 100,
    currency: info.currency ?? "USD",
  }
}

/**
 * Retourne l'état courant du compte maître et de sa stratégie.
 * Retourne null si MetaApi n'est pas configuré ou compte introuvable.
 */
export async function getMasterStatus(
  metaApiAccountId: string,
  strategyId: string,
): Promise<MasterStatus | null> {
  if (!isMetaApiConfigured() || !metaApiAccountId) return null

  try {
    const api = getMetaApi()
    const account = await api.metatraderAccountApi.getAccount(metaApiAccountId)

    let balance = 0
    let equity = 0
    let currency = "USD"
    let broker = ""
    const connected = account.connectionStatus === "CONNECTED"

    if (connected) {
      try {
        const connection = account.getRPCConnection()
        await connection.connect()
        await connection.waitSynchronized(30)
        const info = await connection.getAccountInformation()
        balance = Math.round(Number(info.balance ?? 0) * 100) / 100
        equity = Math.round(Number(info.equity ?? 0) * 100) / 100
        currency = info.currency ?? "USD"
        broker = info.broker ?? ""
      } catch {
        // pas grave : on renvoie l'état sans les chiffres live
      }
    }

    // Compter les subscribers abonnés à cette stratégie
    let subscribersCount = 0
    try {
      const copyFactory = getCopyFactory()
      const subscribers = await copyFactory.configurationApi.getSubscribersWithInfiniteScrollPagination()
      subscribersCount = subscribers.filter((s) =>
        (s.subscriptions ?? []).some((sub) => sub.strategyId === strategyId),
      ).length
    } catch {
      subscribersCount = 0
    }

    return {
      metaApiAccountId: account.id,
      strategyId,
      login: String(account.login ?? ""),
      server: account.server ?? "",
      broker,
      balance,
      equity,
      currency,
      state: account.state,
      connectionStatus: account.connectionStatus,
      connected,
      subscribersCount,
    }
  } catch (err) {
    console.error("[v0] getMasterStatus error:", err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Supprime le compte maître et sa stratégie CopyFactory (libère les ressources).
 */
export async function removeMaster(metaApiAccountId: string, strategyId: string): Promise<void> {
  if (!isMetaApiConfigured()) return

  if (strategyId) {
    try {
      await getCopyFactory().configurationApi.removeStrategy(strategyId)
    } catch (err) {
      console.error("[v0] removeStrategy error:", err instanceof Error ? err.message : err)
    }
  }
  if (metaApiAccountId) {
    try {
      const account = await getMetaApi().metatraderAccountApi.getAccount(metaApiAccountId)
      await account.remove()
    } catch (err) {
      console.error("[v0] removeMaster account error:", err instanceof Error ? err.message : err)
    }
  }
}

/**
 * Abonne un compte utilisateur (subscriber) à la stratégie du maître.
 * Le compte doit avoir été créé avec le rôle SUBSCRIBER (cf. connectMt5Account).
 */
export async function subscribeAccount(
  subscriberMetaApiAccountId: string,
  strategyId: string,
  multiplier = 1,
): Promise<boolean> {
  if (!isMetaApiConfigured() || !subscriberMetaApiAccountId || !strategyId) return false

  try {
    const configurationApi = getCopyFactory().configurationApi
    await configurationApi.updateSubscriber(subscriberMetaApiAccountId, {
      name: `ANCIENFX Subscriber ${subscriberMetaApiAccountId}`,
      subscriptions: [
        {
          strategyId,
          multiplier,
        },
      ],
    })
    return true
  } catch (err) {
    console.error("[v0] subscribeAccount error:", err instanceof Error ? err.message : err)
    return false
  }
}

/**
 * Désabonne un compte utilisateur de la copie (retire toutes ses souscriptions).
 */
export async function unsubscribeAccount(subscriberMetaApiAccountId: string): Promise<void> {
  if (!isMetaApiConfigured() || !subscriberMetaApiAccountId) return

  try {
    await getCopyFactory().configurationApi.removeSubscriber(subscriberMetaApiAccountId)
  } catch (err) {
    console.error("[v0] unsubscribeAccount error:", err instanceof Error ? err.message : err)
  }
}
