import { cookies } from "next/headers"
import type { RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import { sessionCookieName, verifySessionToken, type SessionUser } from "@/lib/auth"
import type { BotSessionRow, BotState, DashboardState, Mt5AccountRow } from "@/lib/dashboard-types"

export type { BotSessionRow, BotState, DashboardState, Mt5AccountRow } from "@/lib/dashboard-types"

const TRIAL_DAYS = 3
const PROFIT_THRESHOLD = 50
const PLATFORM_SHARE_RATE = 0.5
const REFERRAL_COMMISSION_RATE = 0.05

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(sessionCookieName())?.value
  return token ? verifySessionToken(token) : null
}

export function isTrialActive(trialEndsAt: Date | string | null): boolean {
  if (!trialEndsAt) return false
  return new Date(trialEndsAt).getTime() > Date.now()
}

/**
 * Heuristique "best-effort" sur le nom du serveur.
 * Ne retourne true QUE si le serveur contient explicitement "demo" ou "test".
 * Les comptes sans ce mot-clé sont traités comme "inconnus" jusqu'à confirmation
 * par le bridge (account.isDemo renvoyé par MT5 fait foi).
 */
export function isDemoServer(server: string): boolean {
  return /\b(demo|test)\b/i.test(server)
}

/**
 * Un serveur est accepté pendant la période d'essai si :
 * - son nom contient "demo" / "test" (heuristique), OU
 * - on ne peut pas le déterminer à l'avance (le bridge le vérifiera).
 * On ne bloque plus à l'entrée : la vérification définitive se fait
 * après retour du bridge (account.isDemo).
 */
export function serverAllowedDuringTrial(server: string): boolean {
  // Refuser seulement si le serveur mentionne explicitement "live", "real" ou "prod"
  return !/\b(live|real|prod)\b/i.test(server)
}

export function computePlatformShare(profit: number): number {
  if (profit <= PROFIT_THRESHOLD) return 0
  return Math.round(profit * PLATFORM_SHARE_RATE * 100) / 100
}

export function computeReferralCommission(platformShare: number): number {
  return Math.round(platformShare * REFERRAL_COMMISSION_RATE * 100) / 100
}

function mapMt5Row(row: RowDataPacket): Mt5AccountRow {
  return {
    id: row.id,
    userId: row.user_id,
    login: row.login,
    server: row.server,
    broker: row.broker,
    accountType: row.account_type,
    leverage: row.leverage,
    isDemo: Boolean(row.is_demo),
    status: row.status,
    balance: Number(row.balance),
    equity: Number(row.equity),
    freeMargin: Number(row.free_margin),
    dailyProfit: Number(row.daily_profit),
    currency: row.currency,
    connectedAt: row.connected_at,
    lastSyncAt: row.last_sync_at,
  }
}

function mapBotSession(row: RowDataPacket): BotSessionRow {
  return {
    id: row.id,
    status: row.status,
    startBalance: row.start_balance != null ? Number(row.start_balance) : null,
    endBalance: row.end_balance != null ? Number(row.end_balance) : null,
    profit: row.profit != null ? Number(row.profit) : null,
    platformShare: row.platform_share != null ? Number(row.platform_share) : null,
    amountDue: row.amount_due != null ? Number(row.amount_due) : null,
    startedAt: row.started_at,
    cycleEndsAt: row.cycle_ends_at,
  }
}

export async function resolveBotState(
  mt5: Mt5AccountRow | null,
  session: BotSessionRow | null,
): Promise<{ botState: BotState; copyTradeEnabled: boolean }> {
  if (!mt5 || mt5.status !== "connected") {
    return { botState: "offline", copyTradeEnabled: false }
  }
  if (session?.status === "payment_due") {
    return { botState: "payment_due", copyTradeEnabled: false }
  }
  if (session?.status === "running") {
    return { botState: "running", copyTradeEnabled: true }
  }
  return { botState: "active", copyTradeEnabled: true }
}

export async function processExpiredBotCycles(userId: number): Promise<void> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT bs.*, ma.balance AS current_balance
     FROM bot_sessions bs
     JOIN mt5_accounts ma ON ma.id = bs.mt5_account_id
     WHERE bs.user_id = ?
       AND bs.status = 'running'
       AND bs.cycle_ends_at IS NOT NULL
       AND bs.cycle_ends_at <= NOW()`,
    [userId],
  )

  for (const row of rows) {
    const startBalance = Number(row.start_balance)
    const endBalance = Number(row.current_balance)
    const profit = Math.round((endBalance - startBalance) * 100) / 100
    const platformShare = computePlatformShare(profit)
    const amountDue = platformShare

    if (amountDue > 0) {
      await db.execute(
        `UPDATE bot_sessions
         SET status = 'payment_due', end_balance = ?, profit = ?, platform_share = ?, amount_due = ?, resolved_at = NOW()
         WHERE id = ?`,
        [endBalance, profit, platformShare, amountDue, row.id],
      )
      await db.execute(
        `INSERT INTO payments (user_id, bot_session_id, amount, platform_share, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [userId, row.id, amountDue, platformShare],
      )
    } else {
      await db.execute(
        `UPDATE bot_sessions
         SET status = 'paid', end_balance = ?, profit = ?, platform_share = 0, amount_due = 0, resolved_at = NOW()
         WHERE id = ?`,
        [endBalance, profit, row.id],
      )
    }
  }
}

export async function expireTrialAccounts(userId: number): Promise<void> {
  const [userRows] = await db.execute<RowDataPacket[]>(
    "SELECT trial_ends_at, trial_used FROM users WHERE id = ? LIMIT 1",
    [userId],
  )
  const user = userRows[0]
  if (!user || isTrialActive(user.trial_ends_at)) return

  const [accounts] = await db.execute<RowDataPacket[]>(
    "SELECT id FROM mt5_accounts WHERE user_id = ? AND is_demo = 1 AND status = 'connected'",
    [userId],
  )
  if (accounts.length === 0) return

  await db.execute("UPDATE mt5_accounts SET status = 'expired' WHERE user_id = ? AND is_demo = 1", [userId])
  await db.execute(
    "UPDATE bot_sessions SET status = 'cancelled' WHERE user_id = ? AND status IN ('idle', 'running')",
    [userId],
  )
}

export async function getDashboardState(userId: number): Promise<DashboardState | null> {
  await expireTrialAccounts(userId)
  await processExpiredBotCycles(userId)

  const [userRows] = await db.execute<RowDataPacket[]>(
    `SELECT id, full_name, email, referral_code, trial_ends_at, trial_used
     FROM users WHERE id = ? LIMIT 1`,
    [userId],
  )
  const user = userRows[0]
  if (!user) return null

  const [mt5Rows] = await db.execute<RowDataPacket[]>(
    `SELECT * FROM mt5_accounts WHERE user_id = ? AND status = 'connected' LIMIT 1`,
    [userId],
  )
  const mt5 = mt5Rows[0] ? mapMt5Row(mt5Rows[0]) : null

  const [sessionRows] = await db.execute<RowDataPacket[]>(
    `SELECT * FROM bot_sessions
     WHERE user_id = ?
       AND status IN ('idle', 'running', 'payment_due')
     ORDER BY id DESC LIMIT 1`,
    [userId],
  )
  const botSession = sessionRows[0] ? mapBotSession(sessionRows[0]) : null

  const { botState, copyTradeEnabled } = await resolveBotState(mt5, botSession)

  return {
    user: {
      id: user.id,
      name: user.full_name,
      email: user.email,
      referralCode: user.referral_code,
      trialEndsAt: user.trial_ends_at,
      trialActive: isTrialActive(user.trial_ends_at),
      trialUsed: Boolean(user.trial_used),
    },
    mt5Account: mt5,
    botState,
    botSession,
    copyTradeEnabled,
  }
}

export async function ensureTrialPeriod(userId: number): Promise<void> {
  await db.execute(
    `UPDATE users SET trial_ends_at = DATE_ADD(NOW(), INTERVAL ? DAY) WHERE id = ? AND trial_ends_at IS NULL`,
    [TRIAL_DAYS, userId],
  )
}

export { TRIAL_DAYS, PROFIT_THRESHOLD, PLATFORM_SHARE_RATE, REFERRAL_COMMISSION_RATE }
