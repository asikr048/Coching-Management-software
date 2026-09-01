import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const error_param = searchParams.get("error")
  const error_description = searchParams.get("error_description")

  // Handle OAuth errors
  if (error_param) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error_description || error_param)}`)
  }

  // Implicit flow: token is in the URL hash (#access_token=...) 
  // The browser handles this automatically via detectSessionInUrl
  // We just need to redirect to a page that will pick up the session
  if (!code) {
    // Implicit flow - redirect to auth handler page that reads the hash
    return NextResponse.redirect(`${origin}/auth/handler`)
  }

  // PKCE flow: exchange code for session
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(`${origin}/login?error=no_user`)
    }

    // Auto-link staff record by email
    if (user.email) {
      const { data: matchingStaff } = await supabase.from("staff").select("*").eq("email", user.email).single()
      if (matchingStaff && matchingStaff.auth_user_id !== user.id) {
        await supabase.from("staff").update({ auth_user_id: user.id }).eq("id", matchingStaff.id)
      }
    }

    const { data: staff } = await supabase.from("staff").select("role").eq("auth_user_id", user.id).maybeSingle()
    const role = staff?.role
    if (role === "owner") return NextResponse.redirect(`${origin}/dashboard/owner`)
    if (role === "receptionist") return NextResponse.redirect(`${origin}/dashboard/reception`)
    if (role === "teacher") return NextResponse.redirect(`${origin}/dashboard/teacher`)
    if (role === "accountant") return NextResponse.redirect(`${origin}/dashboard/accountant`)

    return NextResponse.redirect(`${origin}/`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error"
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(msg)}`)
  }
}