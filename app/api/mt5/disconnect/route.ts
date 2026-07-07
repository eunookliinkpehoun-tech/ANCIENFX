import { NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import { getDashboardState, getSessionUser } from "@/lib/dashboard"
import { disconnectMt5Account } from "@/lib/mt5/service"
import { unsubscribeAccount } from "@/lib/mt5/copyfactory"

export async function POST() {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ ok: false, message: "Non authentifié." }, { status: 401 })
  }

  try {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT metaapi_account_id FROM mt5_accounts WHERE user_id = ? AND status = 'connected' LIMIT 1",
      [session.id],
    )

    if (rows[0]) {
      const metaApiAccountId = rows[0].metaapi_account_id
      if (metaApiAccountId) {
        // Retirer la copie de trades puis supprimer le compte MetaApi (libère les ressources).
        await unsubscribeAccount(metaApiAccountId)
        await disconnectMt5Account(metaApiAccountId)
      }
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
