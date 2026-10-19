import { NextRequest, NextResponse } from "next/server"
import { generateMonthlyDues } from "@/lib/billing/generate-monthly"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const maxDuration = 60

/**
 * Vercel Cron entrypoint for monthly fee generation.
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically when the
 * CRON_SECRET environment variable is configured on the project.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET

  if (!secret) {
    return NextResponse.json(
      { error: "Cron is not configured: CRON_SECRET environment variable is missing." },
      { status: 503 }
    )
  }

  const authorization = req.headers.get("authorization") || ""
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : ""

  if (token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return generateMonthlyDues(req)
}
