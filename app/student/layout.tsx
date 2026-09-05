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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
              <GraduationCap className="w-5 h-5 text-white" />
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
