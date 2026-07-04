import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { sessionCookieName, verifySessionToken } from "@/lib/auth"

export async function GET() {
  const token = (await cookies()).get(sessionCookieName())?.value
  const user = token ? verifySessionToken(token) : null
  return NextResponse.json({ ok: Boolean(user), user })
}
