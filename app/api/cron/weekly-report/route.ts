import { NextResponse } from "next/server"
import { sendWeeklyReportsToAllUsers } from "@/lib/email"

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret")
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, message: "Non autorisé." }, { status: 401 })
  }

  try {
    const result = await sendWeeklyReportsToAllUsers()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("weekly email cron error", error)
    return NextResponse.json({ ok: false, message: "Erreur envoi emails." }, { status: 500 })
  }
}
