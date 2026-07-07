import { NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import { getSessionUser } from "@/lib/dashboard"
import { getMt5Positions } from "@/lib/mt5/service"

/**
 * GET /api/mt5/positions
 * Retourne les positions ouvertes du compte MT5 connecté.
 */
export async function GET() {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ ok: false, message: "Non authentifié." }, { status: 401 })
  }

  try {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT metaapi_account_id FROM mt5_accounts WHERE user_id = ? AND status = 'connected' LIMIT 1",
      [session.id],
    )

    if (!rows[0] || !rows[0].metaapi_account_id) {
      return NextResponse.json({ ok: false, message: "Aucun compte MT5 connecté." }, { status: 400 })
    }

    const positions = await getMt5Positions(rows[0].metaapi_account_id)
    return NextResponse.json({ ok: true, positions })
  } catch (error) {
    console.error("mt5 positions error", error)
    return NextResponse.json({ ok: false, message: "Impossible de récupérer les positions." }, { status: 500 })
  }
}
