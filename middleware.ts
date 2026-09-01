import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Always pass through static assets and auth routes untouched
  const bypassRoutes = ["/auth/callback", "/auth/confirm", "/_next", "/favicon.ico"]
  if (bypassRoutes.some(r => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  // Public routes - no auth needed
  const publicRoutes = ["/login", "/signup", "/auth", "/enroll", "/marketplace", "/parent-portal", "/batch", "/"]
  const isPublic = publicRoutes.some(r => pathname === r || (r !== "/" && pathname.startsWith(r)))
  if (isPublic) return NextResponse.next()

  // Check if Supabase is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes("placeholder")) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url))
    }

    let { data: staff } = await supabase
      .from("staff")
      .select("id, role, auth_user_id")
      .eq("auth_user_id", user.id)
      .maybeSingle()

    if (!staff && user.email) {
      const { data: staffByEmail } = await supabase
        .from("staff")
        .select("id, role, auth_user_id")
        .eq("email", user.email)
        .maybeSingle()
      if (staffByEmail) {
        await supabase.from("staff").update({ auth_user_id: user.id }).eq("id", staffByEmail.id)
        staff = staffByEmail
      }
    }

    if (!staff) {
      // Non-staff users (students/parents) trying to access /dashboard routes get redirected to student profile
      if (pathname.startsWith("/dashboard")) {
        return NextResponse.redirect(new URL("/student/profile", request.url))
      }
      return supabaseResponse
    }

    const role = staff.role
    if (pathname.startsWith("/dashboard/owner") && role !== "owner") {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
    if (pathname.startsWith("/dashboard/accountant") && !["owner", "accountant"].includes(role)) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  } catch {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}