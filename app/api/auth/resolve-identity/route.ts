import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  try {
    const { identifier } = await req.json()
    const raw = (identifier || "").trim()

    if (!raw) {
      return NextResponse.json({ error: "Identifier is required" }, { status: 400 })
    }

    const admin = createAdminClient()
    const candidates: string[] = []

    if (raw.includes("@")) {
      // Input is an Email
      const cleanEmail = raw.toLowerCase()
      candidates.push(cleanEmail)

      // Look up in students table to see if student has a synthetic email in auth
      const { data: student } = await admin
        .from("students")
        .select("student_id")
        .ilike("email", cleanEmail)
        .limit(1)
        .maybeSingle()

      if (student?.student_id) {
        candidates.push(`${student.student_id.toLowerCase()}@medhashiree.local`)
      }

      // Look up in user_profiles table as well
      const { data: profile } = await admin
        .from("user_profiles")
        .select("user_id")
        .ilike("email", cleanEmail)
        .limit(1)
        .maybeSingle()

      if (profile?.user_id) {
        candidates.push(`${profile.user_id.toLowerCase()}@medhashiree.local`)
      }

      // Auto-confirm matching auth user if unconfirmed
      try {
        const { data: userList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const targetAuthUsers = userList?.users?.filter(
          (u) => candidates.includes(u.email?.toLowerCase() || "")
        )
        if (targetAuthUsers && targetAuthUsers.length > 0) {
          for (const u of targetAuthUsers) {
            if (!u.email_confirmed_at) {
              await admin.auth.admin.updateUserById(u.id, { email_confirm: true })
            }
          }
        }
      } catch {
        // Continue if listUsers fails
      }
    } else {
      // Input is a User ID / Student ID (e.g. MS-10001, 10001, ms-10001)
      const cleanId = raw.toUpperCase().startsWith("MS-")
        ? raw.toUpperCase()
        : `MS-${raw.toUpperCase()}`

      // Fetch all staff emails to guarantee a Student ID NEVER resolves to a staff/admin email
      const { data: staffList } = await admin
        .from("staff")
        .select("email")
      const staffEmails = new Set(
        staffList?.map((s) => s.email?.toLowerCase()).filter(Boolean) || []
      )

      // Fallback synthetic email (unique to this student)
      const synthetic = `${cleanId.toLowerCase()}@medhashiree.local`

      // Check user_profiles
      const { data: profile } = await admin
        .from("user_profiles")
        .select("email")
        .ilike("user_id", cleanId)
        .limit(1)
        .maybeSingle()

      if (profile?.email && !staffEmails.has(profile.email.toLowerCase())) {
        candidates.push(profile.email.toLowerCase())
      }

      // Check students table
      const { data: student } = await admin
        .from("students")
        .select("email")
        .ilike("student_id", cleanId)
        .limit(1)
        .maybeSingle()

      if (
        student?.email &&
        !staffEmails.has(student.email.toLowerCase()) &&
        !candidates.includes(student.email.toLowerCase())
      ) {
        candidates.push(student.email.toLowerCase())
      }

      // If student was mistakenly given a staff email in the database, sanitize it to synthetic
      if (student?.email && staffEmails.has(student.email.toLowerCase())) {
        try {
          await admin.from("students").update({ email: synthetic }).eq("student_id", cleanId)
          await admin.from("user_profiles").update({ email: synthetic }).eq("user_id", cleanId)
        } catch {}
      }

      if (!candidates.includes(synthetic)) {
        candidates.push(synthetic)
      }

      // Auto-confirm matching auth user if unconfirmed
      try {
        const { data: userList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const targetAuthUsers = userList?.users?.filter(
          (u) =>
            candidates.includes(u.email?.toLowerCase() || "") ||
            u.user_metadata?.user_id?.toString().toUpperCase() === cleanId
        )
        if (targetAuthUsers && targetAuthUsers.length > 0) {
          for (const u of targetAuthUsers) {
            if (!u.email_confirmed_at) {
              await admin.auth.admin.updateUserById(u.id, { email_confirm: true })
            }
          }
        }
      } catch {
        // Continue if listUsers fails
      }
    }

    const uniqueCandidates = Array.from(new Set(candidates.filter(Boolean)))

    return NextResponse.json({
      success: true,
      candidateEmails: uniqueCandidates,
    })
  } catch (err: unknown) {
    console.error("Resolve identity error:", err)
    const errorMsg = err instanceof Error ? err.message : "Failed to resolve identity"
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
