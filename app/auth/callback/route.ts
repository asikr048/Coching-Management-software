import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/dashboard"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Check user role and redirect accordingly
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: staff } = await supabase.from("staff").select("role").eq("auth_user_id", user.id).single()
        const role = staff?.role
        if (role === "owner") return NextResponse.redirect(`${origin}/dashboard/owner`)
        if (role === "receptionist") return NextResponse.redirect(`${origin}/dashboard/reception`)
        if (role === "teacher") return NextResponse.redirect(`${origin}/dashboard/teacher`)
        if (role === "accountant") return NextResponse.redirect(`${origin}/dashboard/accountant`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // If something went wrong, redirect back to login
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}