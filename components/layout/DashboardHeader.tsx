"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Bell, LogOut, User, ChevronDown, Menu, Landmark, Building2, Check, Sparkles } from "lucide-react"
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
    <header className="bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between shadow-lg z-20 flex-shrink-0 text-white">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Button */}
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="md:hidden p-2 -ml-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-extrabold text-white tracking-tight truncate">
              {roleLabel[user.role] || user.role} Panel
            </h1>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Sparkles className="w-3 h-3 mr-1 text-amber-400" />
              MedhaShiree
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-amber-400/90 font-medium hidden xs:block">
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
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border border-amber-500/40 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 hover:border-amber-400 text-amber-300 text-xs sm:text-sm font-bold transition-all shadow-md shadow-amber-500/5"
              title="Change active branch"
            >
              <Building2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span className="truncate max-w-[120px] sm:max-w-[190px]">
                {selectedBranchId === "all"
                  ? "All Branches (সকল শাখা)"
                  : (currentBranch?.name || "Select Branch")}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            </button>

            {branchMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-68 bg-[#0f172a] border border-slate-700/80 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden py-1 backdrop-blur-xl text-slate-200"
                onMouseLeave={() => setBranchMenuOpen(false)}
              >
                <div className="px-3.5 py-2.5 border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Branch Filter (শাখা ফিল্টার)</span>
                  <span className="text-[10px] font-medium bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
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
                      "w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs sm:text-sm font-medium transition-colors hover:bg-slate-800 border-b border-slate-800",
                      selectedBranchId === "all" ? "text-amber-300 font-bold bg-amber-500/10 border-l-2 border-amber-400" : "text-slate-300"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <div>
                        <p className="font-bold text-xs sm:text-sm text-white">All Branches (সকল শাখা)</p>
                        <p className="text-[10px] text-slate-400">Global multi-branch overview</p>
                      </div>
                    </div>
                    {selectedBranchId === "all" && <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                  </button>
                )}

                <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/60">
                  {visibleBranches.map(branch => (
                    <button
                      key={branch.id}
                      onClick={() => {
                        setSelectedBranchId(branch.id)
                        setBranchMenuOpen(false)
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3.5 py-2 text-left text-xs sm:text-sm transition-colors hover:bg-slate-800",
                        selectedBranchId === branch.id ? "text-amber-300 font-bold bg-amber-500/10 border-l-2 border-amber-400" : "text-slate-300"
                      )}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="truncate font-bold text-white text-xs sm:text-sm">{branch.name}</p>
                        {branch.location && (
                          <p className="text-[10px] text-slate-400 truncate">{branch.location}</p>
                        )}
                      </div>
                      {selectedBranchId === branch.id && <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          className="relative p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5 text-amber-400/90" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-400 rounded-full animate-pulse shadow-xs shadow-amber-400"></span>
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 p-1.5 sm:p-2 hover:bg-slate-800 rounded-xl transition-colors border border-slate-700/60"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-amber-700 rounded-full flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 font-extrabold text-xs">
              {user.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
            </div>
            <div className="text-left hidden md:block">
              <p className="text-sm font-bold text-white truncate max-w-[120px]">
                {user.name}
              </p>
              <p className="text-[11px] text-amber-400 font-medium">{roleLabel[user.role] || user.role}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-56 bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden text-slate-200">
              <div className="p-3.5 border-b border-slate-800 bg-slate-950/80">
                <p className="font-bold text-sm text-white truncate">{user.name}</p>
                <p className="text-xs text-amber-400/90 truncate">{user.email}</p>
                <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {roleLabel[user.role] || user.role}
                </span>
              </div>
              <div className="p-1.5">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl font-medium transition-colors"
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
