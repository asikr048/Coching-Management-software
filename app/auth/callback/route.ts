import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const error_param = searchParams.get("error")
  const error_description = searchParams.get("error_description")

  if (error_param) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error_description || error_param)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code_received`)
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
    }

    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.redirect(`${origin}/login?error=no_user_after_exchange`)
    }

    // Check staff role for redirect
    const { data: staff, error: staffError } = await supabase.from("staff").select("role").eq("auth_user_id", user.id).maybeSingle()
    
    if (staffError) {
      return NextResponse.redirect(`${origin}/login?error=staff_query_error_${encodeURIComponent(staffError.message)}`)
    }

    const role = staff?.role
    if (role === "owner") return NextResponse.redirect(`${origin}/dashboard/owner`)
    if (role === "receptionist") return NextResponse.redirect(`${origin}/dashboard/reception`)
    if (role === "teacher") return NextResponse.redirect(`${origin}/dashboard/teacher`)
    if (role === "accountant") return NextResponse.redirect(`${origin}/dashboard/accountant`)

    // Non-staff user — go to homepage, but append error if staff record was missing
    return NextResponse.redirect(`${origin}/?no_staff_record=${user.id}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error"
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(msg)}`)
  }
}