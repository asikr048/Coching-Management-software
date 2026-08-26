import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  const publicRoutes = ["/login", "/enroll", "/marketplace", "/parent-portal"]
  const isPublic = publicRoutes.some(r => pathname.startsWith(r)) || pathname === "/"
  if (isPublic) return supabaseResponse

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const { data: staff } = await supabase
    .from("staff")
    .select("role")
    .eq("auth_user_id", user.id)
    .single()

  if (!staff) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const role = staff.role
  if (pathname.startsWith("/dashboard/owner") && role !== "owner") {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }
  if (pathname.startsWith("/dashboard/accountant") && !["owner", "accountant"].includes(role)) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
