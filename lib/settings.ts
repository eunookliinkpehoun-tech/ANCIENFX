import type { RowDataPacket } from "mysql2"
import { db } from "@/lib/db"

/**
 * Accès à la table app_settings (paramètres globaux clé/valeur)
 * + configuration du compte maître CopyFactory + vérification admin.
 */

export async function getSetting(key: string): Promise<string | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1",
    [key],
  )
  return rows[0]?.setting_value ?? null
}

export async function setSetting(key: string, value: string | null): Promise<void> {
  await db.execute(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [key, value],
  )
}

export async function deleteSetting(key: string): Promise<void> {
  await db.execute("DELETE FROM app_settings WHERE setting_key = ?", [key])
}

// ── Configuration du compte maître (CopyFactory) ─────────────────────────────

export const MASTER_KEYS = {
  accountId: "master_metaapi_account_id",
  strategyId: "master_strategy_id",
  login: "master_login",
  server: "master_server",
  platform: "master_platform",
} as const

export type MasterConfig = {
  metaApiAccountId: string
  strategyId: string
  login: string
  server: string
  platform: string
}

/** Retourne la config du maître si elle est complète, sinon null. */
export async function getMasterConfig(): Promise<MasterConfig | null> {
  const [accountId, strategyId, login, server, platform] = await Promise.all([
    getSetting(MASTER_KEYS.accountId),
    getSetting(MASTER_KEYS.strategyId),
    getSetting(MASTER_KEYS.login),
    getSetting(MASTER_KEYS.server),
    getSetting(MASTER_KEYS.platform),
  ])

  if (!accountId || !strategyId) return null

  return {
    metaApiAccountId: accountId,
    strategyId,
    login: login ?? "",
    server: server ?? "",
    platform: platform ?? "mt5",
  }
}

export async function saveMasterConfig(cfg: MasterConfig): Promise<void> {
  await Promise.all([
    setSetting(MASTER_KEYS.accountId, cfg.metaApiAccountId),
    setSetting(MASTER_KEYS.strategyId, cfg.strategyId),
    setSetting(MASTER_KEYS.login, cfg.login),
    setSetting(MASTER_KEYS.server, cfg.server),
    setSetting(MASTER_KEYS.platform, cfg.platform),
  ])
}

export async function clearMasterConfig(): Promise<void> {
  await Promise.all(Object.values(MASTER_KEYS).map((k) => deleteSetting(k)))
}

// ── Admin ────────────────────────────────────────────────────────────────────

export async function isAdminUser(userId: number): Promise<boolean> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT is_admin FROM users WHERE id = ? LIMIT 1",
    [userId],
  )
  return Boolean(rows[0]?.is_admin)
}
