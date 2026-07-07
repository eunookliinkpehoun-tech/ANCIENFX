import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { sessionCookieName, verifySessionToken } from "@/lib/auth"
import { isAdminUser } from "@/lib/settings"

export async function GET() {
  const token = (await cookies()).get(sessionCookieName())?.value
  const user = token ? verifySessionToken(token) : null

  if (!user) {
    return NextResponse.json({ ok: false, user: null })
  }

  const isAdmin = await isAdminUser(user.id)
  return NextResponse.json({ ok: true, user: { ...user, isAdmin } })
}
