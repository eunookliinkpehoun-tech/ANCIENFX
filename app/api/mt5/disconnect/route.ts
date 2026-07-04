import { NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import { getDashboardState, getSessionUser } from "@/lib/dashboard"
import { disconnectMt5Account } from "@/lib/mt5/service"

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

    if (rows[0]) {
      await disconnectMt5Account(rows[0].login, rows[0].server)
      await db.execute("UPDATE mt5_accounts SET status = 'disconnected' WHERE user_id = ?", [session.id])
      await db.execute(
        "UPDATE bot_sessions SET status = 'cancelled' WHERE user_id = ? AND status IN ('idle', 'running', 'payment_due')",
        [session.id],
      )
    }

    const state = await getDashboardState(session.id)
    return NextResponse.json({ ok: true, message: "Compte MT4/MT5 déconnecté.", ...state })
  } catch (error) {
    console.error("mt5 disconnect error", error)
    return NextResponse.json({ ok: false, message: "Impossible de déconnecter le compte." }, { status: 500 })
  }
}
