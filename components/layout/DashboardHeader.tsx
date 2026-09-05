"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Bell, LogOut, User, ChevronDown, Menu } from "lucide-react"
import type { Staff } from "@/lib/supabase/types"

interface Props {
  user: Staff
  onMenuToggle?: () => void
}

export default function DashboardHeader({ user, onMenuToggle }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const roleLabel: Record<string, string> = {
    owner: "Owner",
    super_manager: "Super Manager",
    manager: "Manager",
    receptionist: "Receptionist",
    teacher: "Teacher",
    accountant: "Accountant",
    course_teacher: "Course Teacher",
  }

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-xs z-20 flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Button */}
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="md:hidden p-2 -ml-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div>
          <h1 className="text-base sm:text-lg font-bold text-gray-800 truncate">
            {roleLabel[user.role] || user.role} Panel
          </h1>
          <p className="text-[11px] sm:text-xs text-gray-500 hidden xs:block">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 p-1.5 sm:p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-full flex items-center justify-center text-white shadow-xs font-bold text-xs">
              {user.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
            </div>
            <div className="text-left hidden md:block">
              <p className="text-sm font-semibold text-gray-800 truncate max-w-[120px]">
                {user.name}
              </p>
              <p className="text-[11px] text-gray-500">{roleLabel[user.role] || user.role}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
              <div className="p-3.5 border-b border-gray-100 bg-gray-50/50">
                <p className="font-bold text-sm text-gray-800 truncate">{user.name}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
              <div className="p-1.5">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl font-medium transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
