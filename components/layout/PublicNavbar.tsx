"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { GraduationCap, User } from "lucide-react"

export default function PublicNavbar() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUser(user)
        const { data: staff } = await supabase.from("staff").select("role").eq("auth_user_id", user.id).maybeSingle()
        setUserRole(staff?.role || null)
      }
      setLoaded(true)
    }
    checkAuth()
  }, [])

  const dashboardHref = ["owner", "super_manager", "manager"].includes(userRole || "")
    ? "/dashboard/owner"
    : userRole === "teacher" ? "/dashboard/teacher"
    : userRole === "receptionist" ? "/dashboard/reception"
    : userRole === "accountant" ? "/dashboard/accountant"
    : "/student/profile"

  const buttonLabel = ["owner", "super_manager", "manager"].includes(userRole || "") ? "Admin Panel" : "My Profile"

  return (
    <nav className="bg-white border-b border-gray-100 px-4 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">MedhaShiri</span>
        </Link>
        <div className="flex items-center gap-3">
          {loaded && currentUser ? (
            <Link href={dashboardHref} className="px-4 py-2 text-sm font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl transition-all flex items-center gap-1.5 border border-indigo-200/80">
              <User className="w-4 h-4" /> {buttonLabel}
            </Link>
          ) : loaded ? (
            <Link href="/login" className="px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg">Sign In</Link>
          ) : null}
          <Link href="/enroll" className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Enroll Now</Link>
        </div>
      </div>
    </nav>
  )
}
