import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const maxDuration = 60

const MAX_ENTRIES = 500
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const ALLOWED_STATUS = new Set(["present", "absent", "late", "excused"])

interface SyncResult {
  client_id: string
  ok: boolean
  type?: string
  error?: string
}

/**
 * Receives queued actions recorded by the desktop app while offline.
 * Authentication uses a dedicated shared secret (VAULT_SYNC_TOKEN) because the
 * offline shell has no browser session. Attendance is idempotent thanks to the
 * UNIQUE(student_id, batch_id, date) constraint and an upsert.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.VAULT_SYNC_TOKEN
  if (!secret) {
    return NextResponse.json(
      { error: "Vault sync is not configured: VAULT_SYNC_TOKEN environment variable is missing." },
      { status: 503 }
    )
  }

  const authorization = req.headers.get("authorization") || ""
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : ""
  if (!token || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.entries)) {
    return NextResponse.json({ error: "entries must be an array" }, { status: 400 })
  }
  if (body.entries.length > MAX_ENTRIES) {
    return NextResponse.json({ error: `Too many entries (max ${MAX_ENTRIES})` }, { status: 400 })
  }

  const admin = createAdminClient()
  const results: SyncResult[] = []

  for (const entry of body.entries) {
    const clientId = typeof entry?.client_id === "string" ? entry.client_id : ""
    if (!clientId) {
      results.push({ client_id: "", ok: false, error: "Missing client_id" })
      continue
    }

    if (entry.type !== "attendance") {
      results.push({
        client_id: clientId,
        ok: false,
        type: String(entry.type || "unknown"),
        error: `Unsupported queue entry type: ${entry.type}`,
      })
      continue
    }

    const payload = entry.payload || {}
    const studentId = String(payload.student_uuid || payload.student_id || "")
    const batchId = String(payload.batch_id || "")
    const date = String(payload.date || "")
    const status = String(payload.status || "present")

    if (
      !UUID_RE.test(studentId) ||
      !UUID_RE.test(batchId) ||
      !DATE_RE.test(date) ||
      !ALLOWED_STATUS.has(status)
    ) {
      results.push({ client_id: clientId, ok: false, type: "attendance", error: "Invalid attendance payload" })
      continue
    }

    const checkedInAt =
      typeof payload.checked_in_at === "string" && !Number.isNaN(Date.parse(payload.checked_in_at))
        ? payload.checked_in_at
        : new Date().toISOString()

    const { error } = await admin.from("attendance").upsert(
      {
        student_id: studentId,
        batch_id: batchId,
        date,
        status,
        entry_method: "offline",
        checked_in_at: checkedInAt,
        note: typeof payload.note === "string" ? payload.note.slice(0, 500) : null,
      },
      { onConflict: "student_id,batch_id,date" }
    )

    if (error) {
      results.push({ client_id: clientId, ok: false, type: "attendance", error: error.message })
    } else {
      results.push({ client_id: clientId, ok: true, type: "attendance" })
    }
  }

  const succeeded = results.filter((r) => r.ok).length

  return NextResponse.json({
    success: true,
    processed: results.length,
    succeeded,
    failed: results.length - succeeded,
    results,
    message: `Synced ${succeeded} of ${results.length} queued action(s)`,
  })
}
