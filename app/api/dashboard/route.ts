import { NextResponse } from "next/server"
import { getDashboardState, getSessionUser } from "@/lib/dashboard"

export async function GET() {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ ok: false, message: "Non authentifié." }, { status: 401 })
  }

  try {
    const state = await getDashboardState(session.id)
    if (!state) {
      return NextResponse.json({ ok: false, message: "Utilisateur introuvable." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, ...state })
  } catch (error) {
    console.error("dashboard error", error)
    return NextResponse.json({ ok: false, message: "Impossible de charger le dashboard." }, { status: 500 })
  }
}
