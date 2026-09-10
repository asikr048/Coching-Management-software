"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { User } from "lucide-react"

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

  const dashboardHref = ["owner", "branch_director", "super_manager", "manager"].includes(userRole || "")
    ? "/dashboard/owner"
    : userRole === "teacher" ? "/dashboard/teacher"
    : userRole === "receptionist" ? "/dashboard/reception"
    : userRole === "accountant" ? "/dashboard/accountant"
    : "/student/profile"

  const buttonLabel = ["owner", "branch_director", "super_manager", "manager"].includes(userRole || "") ? "Admin Panel" : "My Profile"

  return (
    <nav className="bg-white border-b border-gray-100 px-3 sm:px-4 py-3 sm:py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full border border-indigo-200 overflow-hidden flex items-center justify-center bg-white shadow-xs flex-shrink-0">
            <img src="/logo.jpg" alt="MedhaShiree Logo" className="w-full h-full object-cover rounded-full" />
          </div>
          <span className="text-base sm:text-lg font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent truncate">MedhaShiree</span>
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {loaded && currentUser ? (
            <Link href={dashboardHref} className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl transition-all flex items-center gap-1.5 border border-indigo-200/80">
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {buttonLabel}
            </Link>
          ) : loaded ? (
            <Link href="/login" className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg">Sign In</Link>
          ) : null}
          <Link href="/#batches" className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">View Batches</Link>
        </div>
      </div>
    </nav>
  )
}
