import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName, studentId, phone } = await req.json()

    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }
    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    const admin = createAdminClient()
    const cleanEmail = (email || "").trim().toLowerCase()

    if (cleanEmail) {
      const { data: staffMatch } = await admin
        .from("staff")
        .select("id, role, name")
        .ilike("email", cleanEmail)
        .maybeSingle()

      if (staffMatch) {
        return NextResponse.json(
          { error: `The email "${cleanEmail}" is already used by a staff member (${staffMatch.role}). Student accounts cannot use admin/staff emails. Please leave email blank to log in via Student ID, or use the student's personal email.` },
          { status: 400 }
        )
      }
    }

    const targetEmail = cleanEmail || `${studentId.toLowerCase()}@medhashiree.local`

    // Create user using Supabase Admin Auth without affecting current admin session
    const { data: userData, error: createError } = await admin.auth.admin.createUser({
      email: targetEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        user_id: studentId,
        phone: phone || null,
        initial_password: password,
      },
    })

    if (createError) {
      // If user already exists, update their password
      const errLower = createError.message.toLowerCase()
      if (errLower.includes("registered") || errLower.includes("exists") || errLower.includes("already")) {
        const { data: userList } = await admin.auth.admin.listUsers()
        const existing = userList?.users?.find(u => u.email?.toLowerCase() === targetEmail.toLowerCase())
        if (existing) {
          await admin.auth.admin.updateUserById(existing.id, { 
            password: password,
            user_metadata: {
              full_name: fullName,
              user_id: studentId,
              phone: phone || null,
              initial_password: password,
            }
          })
          return NextResponse.json({ success: true, userId: existing.id, email: targetEmail })
        }
      }
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    // Upsert into user_profiles
    await admin.from("user_profiles").upsert({
      user_id: studentId,
      email: targetEmail,
      name: fullName || "",
      phone: phone || "",
      auth_user_id: userData.user?.id || null,
    })

    return NextResponse.json({
      success: true,
      userId: userData.user?.id,
      email: targetEmail
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to create student account" }, { status: 500 })
  }
}
