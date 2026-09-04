import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, password } = await req.json()

    // 1. Validation
    const cleanName = (name || "").trim()
    const cleanEmail = (email || "").trim().toLowerCase()
    const cleanPhone = (phone || "").trim()

    if (!cleanName) {
      return NextResponse.json({ error: "Full name is required" }, { status: 400 })
    }
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required" }, { status: 400 })
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    const admin = createAdminClient()

    // 2. Check if email is already taken across user_profiles, students, staff, and Supabase Auth
    // Check user_profiles
    const { data: existingProfile } = await admin
      .from("user_profiles")
      .select("id, user_id, email")
      .ilike("email", cleanEmail)
      .limit(1)
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json(
        {
          error: `This email (${cleanEmail}) is already registered. Please sign in instead.`,
          email: cleanEmail,
          alreadyExists: true,
          existingUserId: existingProfile.user_id,
        },
        { status: 409 }
      )
    }

    // Check students table
    const { data: existingStudent } = await admin
      .from("students")
      .select("id, student_id, email")
      .ilike("email", cleanEmail)
      .limit(1)
      .maybeSingle()

    if (existingStudent) {
      return NextResponse.json(
        {
          error: `This email (${cleanEmail}) is already registered. Please sign in instead.`,
          email: cleanEmail,
          alreadyExists: true,
          existingUserId: existingStudent.student_id,
        },
        { status: 409 }
      )
    }

    // Check staff table
    const { data: existingStaff } = await admin
      .from("staff")
      .select("id, email")
      .ilike("email", cleanEmail)
      .limit(1)
      .maybeSingle()

    if (existingStaff) {
      return NextResponse.json(
        {
          error: `This email (${cleanEmail}) is already registered as a staff account. Please sign in instead.`,
          email: cleanEmail,
          alreadyExists: true,
        },
        { status: 409 }
      )
    }

    // Check Supabase Auth users directly
    try {
      const { data: userList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const matchingAuthUser = userList?.users?.find(
        (u) => u.email?.toLowerCase() === cleanEmail
      )
      if (matchingAuthUser) {
        const foundUserId = matchingAuthUser.user_metadata?.user_id || null
        return NextResponse.json(
          {
            error: `This email (${cleanEmail}) is already registered. Please sign in instead.`,
            email: cleanEmail,
            alreadyExists: true,
            existingUserId: foundUserId,
          },
          { status: 409 }
        )
      }
    } catch {
      // If listUsers fails or rate limits, createUser below will still enforce auth uniqueness
    }

    // 3. Generate sequential unique student ID (MS-10001, MS-10002, etc.)
    let maxSeq = 10000
    try {
      const { data: lastStudents } = await admin
        .from("students")
        .select("student_id")
        .order("created_at", { ascending: false })
        .limit(50)

      if (lastStudents && lastStudents.length > 0) {
        for (const s of lastStudents) {
          if (s.student_id) {
            const numPart = parseInt(s.student_id.replace(/^MS-/i, ""), 10)
            if (!isNaN(numPart) && numPart > maxSeq) {
              maxSeq = numPart
            }
          }
        }
      }

      const { data: lastProfiles } = await admin
        .from("user_profiles")
        .select("user_id")
        .order("created_at", { ascending: false })
        .limit(50)

      if (lastProfiles && lastProfiles.length > 0) {
        for (const p of lastProfiles) {
          if (p.user_id) {
            const numPart = parseInt(p.user_id.replace(/^MS-/i, ""), 10)
            if (!isNaN(numPart) && numPart > maxSeq) {
              maxSeq = numPart
            }
          }
        }
      }
    } catch {
      // Fallback if order fails
    }

    const nextSeq = maxSeq + 1
    const studentIdStr = `MS-${String(nextSeq).padStart(5, "0")}`

    // 4. Create user in Supabase Auth via Admin client with email_confirm: true
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true, // Auto-confirm email so user can sign in immediately
      user_metadata: {
        full_name: cleanName,
        user_id: studentIdStr,
        phone: cleanPhone || null,
      },
    })

    if (authError) {
      const msg = authError.message.toLowerCase()
      if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("unique")) {
        return NextResponse.json(
          {
            error: `This email (${cleanEmail}) is already registered. Please sign in instead.`,
            email: cleanEmail,
            alreadyExists: true,
          },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const authUserId = authData.user?.id || null

    // 5. Insert into user_profiles
    const { error: profileError } = await admin.from("user_profiles").insert({
      user_id: studentIdStr,
      email: cleanEmail,
      name: cleanName,
      phone: cleanPhone || null,
      auth_user_id: authUserId,
    })

    if (profileError) {
      console.error("Failed to insert user_profiles:", profileError)
    }

    // 6. Insert into students
    const { error: studentError } = await admin.from("students").insert({
      student_id: studentIdStr,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone || null,
      guardian_phone: cleanPhone || "N/A",
      is_active: true,
    })

    if (studentError) {
      console.error("Failed to insert students:", studentError)
    }

    return NextResponse.json({
      success: true,
      userId: studentIdStr,
      email: cleanEmail,
    })
  } catch (err: unknown) {
    console.error("Signup API error:", err)
    const errorMsg = err instanceof Error ? err.message : "Registration failed. Please try again."
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
