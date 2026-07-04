import { NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import { getSessionUser } from "@/lib/dashboard"

function toNumber(value: unknown) {
  return value == null ? 0 : Number(value)
}

function toIso(value: unknown) {
  return value ? new Date(value as string | Date).toISOString() : null
}

export async function GET() {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ ok: false, message: "Non authentifié." }, { status: 401 })
  }

  try {
    const [tradeRows] = await db.execute<RowDataPacket[]>(
      `SELECT ticket, symbol, trade_type, volume, open_price, close_price, profit, commission, swap, open_time, close_time
       FROM mt5_trades
       WHERE user_id = ?
       ORDER BY COALESCE(close_time, open_time, created_at) DESC
       LIMIT 100`,
      [session.id],
    )

    const [paymentRows] = await db.execute<RowDataPacket[]>(
      `SELECT id, amount, platform_share, currency, status, payment_method, paid_at, created_at
       FROM payments
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      [session.id],
    )

    const [withdrawalRows] = await db.execute<RowDataPacket[]>(
      `SELECT id, amount, status, paid_at, updated_at, created_at
       FROM referral_commissions
       WHERE referrer_user_id = ? AND status = 'paid'
       ORDER BY COALESCE(paid_at, updated_at, created_at) DESC
       LIMIT 100`,
      [session.id],
    )

    return NextResponse.json({
      ok: true,
      trades: tradeRows.map((row) => ({
        id: String(row.ticket),
        asset: row.symbol,
        type: row.trade_type,
        volume: toNumber(row.volume),
        openPrice: row.open_price == null ? null : toNumber(row.open_price),
        closePrice: row.close_price == null ? null : toNumber(row.close_price),
        profit: toNumber(row.profit),
        commission: toNumber(row.commission),
        swap: toNumber(row.swap),
        openedAt: toIso(row.open_time),
        closedAt: toIso(row.close_time),
      })),
      depots: paymentRows.map((row) => ({
        id: String(row.id),
        asset: "Paiement plateforme",
        type: row.status,
        amount: toNumber(row.amount),
        platformShare: toNumber(row.platform_share),
        currency: row.currency || "USD",
        method: row.payment_method,
        createdAt: toIso(row.created_at),
        paidAt: toIso(row.paid_at),
      })),
      retraits: withdrawalRows.map((row) => ({
        id: String(row.id),
        asset: "Commission parrainage",
        type: row.status,
        amount: toNumber(row.amount),
        currency: "USD",
        createdAt: toIso(row.created_at),
        paidAt: toIso(row.paid_at || row.updated_at),
      })),
    })
  } catch (error) {
    console.error("historique error", error)
    return NextResponse.json({ ok: false, message: "Impossible de charger l'historique." }, { status: 500 })
  }
}
