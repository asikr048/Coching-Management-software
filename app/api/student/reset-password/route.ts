import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = createAdminClient()

    // Verify requesting user is staff
    let { data: staff } = await admin
      .from("staff")
      .select("id, role, email")
      .eq("auth_user_id", user.id)
      .maybeSingle()

    if (!staff && user.email) {
      const { data: staffByEmail } = await admin
        .from("staff")
        .select("id, role, email")
        .ilike("email", user.email)
        .maybeSingle()
      staff = staffByEmail
    }

    if (!staff) {
      return NextResponse.json({ error: "Forbidden: Staff credentials required" }, { status: 403 })
    }

    const { studentId, newPassword } = await req.json()

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    // Lookup student in database
    const { data: student, error: stErr } = await admin
      .from("students")
      .select("id, student_id, name, email, phone")
      .eq("id", studentId)
      .maybeSingle()

    if (stErr || !student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const cleanCode = student.student_id.toUpperCase()
    const syntheticEmail = `${cleanCode.toLowerCase()}@medhashiree.local`
    const targetEmail = student.email && !student.email.toLowerCase().endsWith("@medhashiree.local")
      ? student.email.toLowerCase()
      : syntheticEmail

    // Find auth user
    const { data: userList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const candidateEmails = [targetEmail, syntheticEmail, student.email?.toLowerCase()].filter(Boolean)

    const existingAuthUser = userList?.users?.find(
      (u) =>
        candidateEmails.includes(u.email?.toLowerCase() || "") ||
        u.user_metadata?.user_id?.toString().toUpperCase() === cleanCode
    )

    let finalAuthId: string

    if (existingAuthUser) {
      finalAuthId = existingAuthUser.id
      const { error: updateErr } = await admin.auth.admin.updateUserById(existingAuthUser.id, {
        password: newPassword,
        user_metadata: {
          ...existingAuthUser.user_metadata,
          full_name: student.name,
          user_id: cleanCode,
          phone: student.phone || null,
          initial_password: newPassword,
        },
      })

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 400 })
      }
    } else {
      // Create fresh auth user for this student
      const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
        email: syntheticEmail,
        password: newPassword,
        email_confirm: true,
        user_metadata: {
          full_name: student.name,
          user_id: cleanCode,
          phone: student.phone || null,
          initial_password: newPassword,
        },
      })

      if (createErr || !createdUser.user) {
        return NextResponse.json({ error: createErr?.message || "Failed to create login user" }, { status: 400 })
      }

      finalAuthId = createdUser.user.id

      // Update student's email to synthetic if needed
      if (!student.email) {
        await admin.from("students").update({ email: syntheticEmail }).eq("id", student.id)
      }
    }

    // Sync user_profiles
    try {
      await admin.from("user_profiles").upsert({
        user_id: cleanCode,
        email: targetEmail,
        name: student.name,
        phone: student.phone || "",
        auth_user_id: finalAuthId,
      })
    } catch {}

    return NextResponse.json({
      success: true,
      message: "Student password updated successfully",
      studentId: student.id,
      studentCode: cleanCode,
      newPassword,
    })
  } catch (err: unknown) {
    console.error("Reset password error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
