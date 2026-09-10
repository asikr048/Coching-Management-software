"use client"

import { ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { GraduationCap, BookOpen, LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function StudentLayout({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-indigo-200 overflow-hidden flex items-center justify-center bg-white shadow-sm flex-shrink-0">
              <img src="/logo.jpg" alt="MedhaShiree Logo" className="w-full h-full object-cover rounded-full" />
            </div>
            <div className="min-w-0">
              <span className="text-base sm:text-lg font-bold text-gray-900 tracking-tight truncate">
                Medha<span className="text-indigo-600">Shiree</span>
              </span>
              <span className="hidden xs:inline-block ml-1.5 sm:ml-2 text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 font-semibold rounded-full border border-indigo-100">
                Student Portal
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <Link
              href="/marketplace"
              className="px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 sm:gap-2 transition-colors shadow-2xs"
            >
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Browse Courses</span>
              <span className="sm:hidden">Courses</span>
            </Link>
            <button
              onClick={handleSignOut}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
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
