"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Bell, LogOut, User, ChevronDown, Menu, Landmark, Building2, Check } from "lucide-react"
import type { Staff } from "@/lib/supabase/types"
import { useBranch } from "@/components/providers/BranchContext"
import { cn } from "@/lib/utils"

interface Props {
  user: Staff
  onMenuToggle?: () => void
}

export default function DashboardHeader({ user, onMenuToggle }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [branchMenuOpen, setBranchMenuOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { selectedBranchId, setSelectedBranchId, branches, currentBranch, isAllBranchesPermitted, permittedBranchIds } = useBranch()

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

  const visibleBranches = branches.filter(b => isAllBranchesPermitted || permittedBranchIds.includes(b.id))

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

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Branch Selector Dropdown */}
        {branches.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setBranchMenuOpen(!branchMenuOpen)}
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-950 text-xs sm:text-sm font-semibold transition-all shadow-xs"
              title="Change active branch"
            >
              <Building2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <span className="truncate max-w-[120px] sm:max-w-[190px]">
                {selectedBranchId === "all"
                  ? "All Branches"
                  : (currentBranch?.name || "Select Branch")}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
            </button>

            {branchMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden py-1"
                onMouseLeave={() => setBranchMenuOpen(false)}
              >
                <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Branch Filter</span>
                  <span className="text-[10px] font-normal bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                    {visibleBranches.length} {visibleBranches.length === 1 ? "branch" : "branches"}
                  </span>
                </div>

                {isAllBranchesPermitted && (
                  <button
                    onClick={() => {
                      setSelectedBranchId("all")
                      setBranchMenuOpen(false)
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 text-left text-xs sm:text-sm font-medium transition-colors hover:bg-indigo-50/60 border-b border-gray-100",
                      selectedBranchId === "all" ? "text-indigo-700 font-bold bg-indigo-50/80" : "text-gray-700"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-xs sm:text-sm">All Branches (সকল শাখা)</p>
                        <p className="text-[10px] text-gray-500">Global multi-branch overview</p>
                      </div>
                    </div>
                    {selectedBranchId === "all" && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                  </button>
                )}

                <div className="max-h-60 overflow-y-auto divide-y divide-gray-50">
                  {visibleBranches.map(branch => (
                    <button
                      key={branch.id}
                      onClick={() => {
                        setSelectedBranchId(branch.id)
                        setBranchMenuOpen(false)
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-left text-xs sm:text-sm transition-colors hover:bg-indigo-50/60",
                        selectedBranchId === branch.id ? "text-indigo-700 font-bold bg-indigo-50/80" : "text-gray-700"
                      )}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="truncate font-semibold text-gray-900 text-xs sm:text-sm">{branch.name}</p>
                        {branch.location && (
                          <p className="text-[10px] text-gray-500 truncate">{branch.location}</p>
                        )}
                      </div>
                      {selectedBranchId === branch.id && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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

