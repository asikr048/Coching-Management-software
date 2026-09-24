import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Only bypass truly public API routes, static assets, and auth routes
  const bypassRoutes = [
    "/api/auth/signup", "/api/auth/resolve-identity",
    "/api/enroll/submit", "/api/online-results",
    "/auth/callback", "/auth/confirm", "/auth/",
    "/_next", "/favicon.ico",
  ]
  if (bypassRoutes.some(r => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  // API routes need auth — let the route handlers check via requireAuth/requireStaffRole
  if (pathname.startsWith("/api")) {
    return NextResponse.next()
  }

  // Public routes - no auth needed
  const publicRoutes = ["/login", "/signup", "/auth", "/enroll", "/marketplace", "/parent-portal", "/batch", "/courses", "/online-result", "/"]
  const isPublic = publicRoutes.some(r => pathname === r || (r !== "/" && pathname.startsWith(r)))
  if (isPublic) return NextResponse.next()

  // Check if Supabase is configured — fail closed if not
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes("placeholder")) {
    return NextResponse.redirect(new URL("/login", request.url))
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

    // Note: Staff accounts must be explicitly linked by admins.
    // Auto-linking by email was removed for security.

    if (!staff) {
      // Non-staff users (students/parents) trying to access /dashboard routes get redirected to student profile
      if (pathname.startsWith("/dashboard")) {
        return NextResponse.redirect(new URL("/student/profile", request.url))
      }
      return supabaseResponse
    }

    const role = staff.role

    // Redirect role-specific alias paths to canonical dashboard routes
    if (pathname === "/dashboard/super_manager" || pathname.startsWith("/dashboard/super_manager/")) {
      return NextResponse.redirect(new URL(pathname.replace("/dashboard/super_manager", "/dashboard/owner"), request.url))
    }
    if (pathname === "/dashboard/manager" || pathname.startsWith("/dashboard/manager/")) {
      return NextResponse.redirect(new URL(pathname.replace("/dashboard/manager", "/dashboard/owner"), request.url))
    }
    if (pathname === "/dashboard/branch_director" || pathname.startsWith("/dashboard/branch_director/")) {
      return NextResponse.redirect(new URL(pathname.replace("/dashboard/branch_director", "/dashboard/owner"), request.url))
    }
    if (pathname === "/dashboard/receptionist" || pathname.startsWith("/dashboard/receptionist/")) {
      return NextResponse.redirect(new URL(pathname.replace("/dashboard/receptionist", "/dashboard/reception"), request.url))
    }
    if (pathname === "/dashboard/student" || pathname.startsWith("/dashboard/student/")) {
      return NextResponse.redirect(new URL("/student/profile", request.url))
    }

    // Accountant desk can be accessed by owner, branch_director, super_manager, manager, and accountant
    if (pathname.startsWith("/dashboard/owner/accountant") && !["owner", "branch_director", "super_manager", "manager", "accountant"].includes(role)) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
    // Owner, Branch Director, Super Manager, and Manager can access /dashboard/owner
    if (pathname.startsWith("/dashboard/owner") && !pathname.startsWith("/dashboard/owner/accountant") && !["owner", "branch_director", "super_manager", "manager"].includes(role)) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
    if (pathname.startsWith("/dashboard/accountant") && !["owner", "branch_director", "super_manager", "manager", "accountant"].includes(role)) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  } catch {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}