"use client"

import { ReactNode, useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { GraduationCap, BookOpen, LogOut, Shield } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function StudentLayout({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const router = useRouter()
  const [staffRole, setStaffRole] = useState<string | null>(null)

  useEffect(() => {
    async function checkStaff() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        
        let { data: staff } = await supabase
          .from("staff")
          .select("role")
          .eq("auth_user_id", user.id)
          .maybeSingle()

        if (!staff && user.email) {
          const { data: staffByEmail } = await supabase
            .from("staff")
            .select("role")
            .ilike("email", user.email)
            .maybeSingle()
          staff = staffByEmail
        }

        if (staff?.role) {
          setStaffRole(staff.role)
        }
      } catch (e) {
        console.error("Error checking staff role in student layout:", e)
      }
    }
    checkStaff()
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const getDashboardHref = (role: string) => {
    if (["owner", "branch_director", "super_manager", "manager"].includes(role)) {
      return "/dashboard/owner"
    }
    if (role === "receptionist") return "/dashboard/reception"
    if (role === "teacher") return "/dashboard/teacher"
    if (role === "accountant") return "/dashboard/accountant"
    return "/dashboard/owner"
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full border border-indigo-200 overflow-hidden flex items-center justify-center bg-white shadow-sm flex-shrink-0">
              <img src="/logo.jpg" alt="MedhaShiree Logo" className="w-full h-full object-cover rounded-full" />
            </div>
            <div>
              <span className="text-lg font-bold text-gray-900 tracking-tight">
                Medha<span className="text-indigo-600">Shiree</span>
              </span>
              <span className="ml-2 text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 font-semibold rounded-full border border-indigo-100">
                Student Portal
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            {staffRole && (
              <Link
                href={getDashboardHref(staffRole)}
                className="px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-300 rounded-lg hover:bg-amber-100 flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Shield className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline">Admin Dashboard</span>
                <span className="sm:hidden">Admin</span>
              </Link>
            )}
            <Link
              href="/marketplace"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              Browse Courses
            </Link>
            <button
              onClick={handleSignOut}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1"
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
