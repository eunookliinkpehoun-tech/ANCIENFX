import { NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import { getDashboardState, getSessionUser } from "@/lib/dashboard"
import { syncMt5Account } from "@/lib/mt5/service"

/**
 * POST /api/mt5/sync
 * Rafraîchit le solde / equity du compte MT5 connecté depuis le bridge.
 */
export async function POST() {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ ok: false, message: "Non authentifié." }, { status: 401 })
  }

  try {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT login, server FROM mt5_accounts WHERE user_id = ? AND status = 'connected' LIMIT 1",
      [session.id],
    )

    if (!rows[0]) {
      return NextResponse.json({ ok: false, message: "Aucun compte MT5 connecté." }, { status: 400 })
    }

    const { login, server } = rows[0]
    const account = await syncMt5Account(login, server)

    if (!account) {
      // Bridge absent ou session expirée — on retourne l'état actuel sans erreur fatale
      const state = await getDashboardState(session.id)
      return NextResponse.json({ ok: true, synced: false, ...state })
    }

    // Mise à jour en base
    await db.execute(
      `UPDATE mt5_accounts
       SET balance = ?, equity = ?, free_margin = ?, daily_profit = ?, last_sync_at = NOW()
       WHERE user_id = ? AND status = 'connected'`,
      [account.balance, account.equity, account.freeMargin, account.dailyProfit, session.id],
    )

    const state = await getDashboardState(session.id)
    return NextResponse.json({ ok: true, synced: true, ...state })
  } catch (error) {
    console.error("mt5 sync error", error)
    return NextResponse.json({ ok: false, message: "Erreur lors du sync MT5." }, { status: 500 })
  }
}
