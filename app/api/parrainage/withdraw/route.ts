import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import { getSessionUser } from "@/lib/dashboard"

export async function POST() {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ ok: false, message: "Non authentifié." }, { status: 401 })
  }

  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()

    const [balanceRows] = await connection.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(amount), 0) AS available_balance
       FROM referral_commissions
       WHERE referrer_user_id = ? AND status = 'pending'
       FOR UPDATE`,
      [session.id],
    )
    const availableBalance = Number(balanceRows[0]?.available_balance || 0)

    if (availableBalance <= 0) {
      await connection.rollback()
      return NextResponse.json({ ok: false, message: "Aucune commission disponible au retrait." }, { status: 400 })
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE referral_commissions
       SET status = 'paid', paid_at = NOW()
       WHERE referrer_user_id = ? AND status = 'pending'`,
      [session.id],
    )

    await connection.commit()
    return NextResponse.json({
      ok: true,
      message: "Retrait de commission enregistré.",
      amount: availableBalance,
      updatedCount: result.affectedRows,
    })
  } catch (error) {
    await connection.rollback()
    console.error("parrainage withdraw error", error)
    return NextResponse.json({ ok: false, message: "Impossible d'enregistrer le retrait." }, { status: 500 })
  } finally {
    connection.release()
  }
}
