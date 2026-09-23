import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export interface AuthResult {
  user: { id: string; email?: string }
  supabase: Awaited<ReturnType<typeof createClient>>
}

export interface StaffAuthResult extends AuthResult {
  staff: { id: string; role: string; auth_user_id: string }
}

/**
 * Require a valid authenticated user session.
 * Returns { user, supabase } or a NextResponse with 401 status.
 */
export async function requireAuth(): Promise<AuthResult | NextResponse> {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json(
        { error: "Unauthorized — please log in (অনুগ্রহ করে লগইন করুন)" },
        { status: 401 }
      )
    }

    return { user, supabase }
  } catch {
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 401 }
    )
  }
}

/**
 * Require a valid authenticated staff member with one of the specified roles.
 * Returns { user, staff, supabase } or a NextResponse with 401/403 status.
 */
export async function requireStaffRole(
  roles: string[]
): Promise<StaffAuthResult | NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const { user, supabase } = authResult

  try {
    let staffData: { id: string; role: string; auth_user_id: string } | null = null
    const { data: staff } = await supabase
      .from("staff")
      .select("id, role, auth_user_id")
      .eq("auth_user_id", user.id)
      .maybeSingle()

    staffData = staff
    if (!staffData) {
      try {
        const admin = createAdminClient()
        const { data: adminStaff } = await admin
          .from("staff")
          .select("id, role, auth_user_id")
          .eq("auth_user_id", user.id)
          .maybeSingle()
        if (adminStaff) staffData = adminStaff
      } catch {}
    }

    if (!staffData) {
      return NextResponse.json(
        { error: "Forbidden — staff access required (শুধুমাত্র কর্মীদের জন্য)" },
        { status: 403 }
      )
    }

    if (!roles.includes(staffData.role)) {
      return NextResponse.json(
        { error: `Forbidden — requires one of: ${roles.join(", ")} (অনুমতি নেই)` },
        { status: 403 }
      )
    }

    return { user, staff: staffData, supabase }
  } catch {
    return NextResponse.json(
      { error: "Authorization check failed" },
      { status: 403 }
    )
  }
}

/**
 * Require the authenticated user is either a staff member OR the student themselves.
 * For student-facing API routes where the student should only access their own data.
 */
export async function requireAuthOrSelf(
  studentAuthUserId?: string
): Promise<AuthResult | NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const { user, supabase } = authResult

  // Check if they're staff (any role)
  let staffData = null
  const { data: staff } = await supabase
    .from("staff")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  staffData = staff
  if (!staffData) {
    try {
      const admin = createAdminClient()
      const { data: adminStaff } = await admin
        .from("staff")
        .select("id, role")
        .eq("auth_user_id", user.id)
        .maybeSingle()
      if (adminStaff) staffData = adminStaff
    } catch {}
  }

  if (staffData) {
    return { user, supabase }
  }

  // If not staff, they must be accessing their own data
  if (studentAuthUserId && user.id !== studentAuthUserId) {
    return NextResponse.json(
      { error: "Forbidden — you can only access your own data" },
      { status: 403 }
    )
  }

  return { user, supabase }
}

/**
 * Helper to check if a result from requireAuth / requireStaffRole is an error response.
 */
export function isAuthError(result: AuthResult | StaffAuthResult | NextResponse): result is NextResponse {
  return result instanceof NextResponse
}
