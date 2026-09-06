"use client"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  GraduationCap, LayoutDashboard, Users, BookOpen, CreditCard,
  BarChart3, UserCheck, MessageSquare, Settings, ChevronLeft,
  ChevronRight, Package, Trophy, Fingerprint, ShoppingBag,
  DollarSign, GitMerge, Home, FileText, ImageIcon, Shield, ClipboardList,
  X, Globe, Landmark, Sparkles, Bell
} from "lucide-react"
import type { Role } from "@/lib/supabase/types"

const ownerNav = [
  { href: "/dashboard/owner", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/dashboard/owner/branches", icon: Landmark, label: "Branches (শাখা)" },
  { href: "/dashboard/owner/students", icon: Users, label: "Students" },
  { href: "/dashboard/owner/batches", icon: BookOpen, label: "Batches" },
  { href: "/dashboard/owner/payments", icon: CreditCard, label: "Payments" },
  { href: "/dashboard/owner/payment-approvals", icon: Shield, label: "Payment Approvals" },
  { href: "/dashboard/owner/attendance", icon: ClipboardList, label: "Attendance" },
  { href: "/dashboard/owner/fee-dues", icon: DollarSign, label: "Fee Dues" },
  { href: "/dashboard/owner/referrals", icon: GitMerge, label: "Referrals" },
  { href: "/dashboard/owner/exams", icon: FileText, label: "Exams" },
  { href: "/dashboard/owner/materials", icon: Package, label: "Materials" },
  { href: "/dashboard/owner/notices", icon: Bell, label: "Notice Board (নোটিশ)" },
  { href: "/dashboard/owner/staff", icon: UserCheck, label: "Staff" },
  { href: "/dashboard/owner/sms", icon: MessageSquare, label: "Bulk SMS" },
  { href: "/dashboard/owner/slider", icon: Globe, label: "Homepage Editor" },
  { href: "/dashboard/owner/marketplace", icon: ShoppingBag, label: "Marketplace" },
  { href: "/dashboard/owner/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/dashboard/owner/expenses", icon: DollarSign, label: "Expenses" },
  { href: "/dashboard/owner/settings", icon: Settings, label: "Settings" },
]

const receptionNav = [
  { href: "/dashboard/reception", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/dashboard/reception/students", icon: Users, label: "Students" },
  { href: "/dashboard/reception/enroll", icon: GraduationCap, label: "New Enrollment" },
  { href: "/dashboard/reception/payments", icon: CreditCard, label: "Collect Fee" },
  { href: "/dashboard/reception/attendance", icon: UserCheck, label: "Attendance" },
  { href: "/dashboard/reception/biometric", icon: Fingerprint, label: "Biometric Entry" },
]

const teacherNav = [
  { href: "/dashboard/teacher", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/dashboard/teacher/attendance", icon: UserCheck, label: "Attendance" },
  { href: "/dashboard/teacher/exams", icon: FileText, label: "Exams" },
  { href: "/dashboard/teacher/results", icon: Trophy, label: "Results" },
  { href: "/dashboard/teacher/courses", icon: ShoppingBag, label: "My Courses" },
]

const accountantNav = [
  { href: "/dashboard/accountant", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/dashboard/accountant/payments", icon: CreditCard, label: "Payments" },
  { href: "/dashboard/accountant/fee-dues", icon: DollarSign, label: "Fee Dues" },
  { href: "/dashboard/accountant/reports", icon: BarChart3, label: "Reports" },
]

const navByRole: Record<string, typeof ownerNav> = {
  owner: ownerNav,
  super_manager: ownerNav,
  manager: ownerNav,
  receptionist: receptionNav,
  teacher: teacherNav,
  accountant: accountantNav,
  course_teacher: teacherNav,
}

interface Props {
  role: Role
  name: string
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export default function DashboardSidebar({ role, name, mobileOpen = false, onMobileClose }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const nav = navByRole[role] || ownerNav

  const sidebarContent = (isMobileView: boolean) => (
    <>
      {/* Brand Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-white border border-amber-400/40 shadow-md shadow-amber-500/20 flex-shrink-0">
            <img src="/logo.jpg" alt="MedhaShiree Logo" className="w-full h-full object-cover rounded-full" />
          </div>
          {(!collapsed || isMobileView) && (
            <div className="min-w-0">
              <span className="font-extrabold text-base text-white tracking-tight leading-none block">
                MedhaShiree
              </span>
              <span className="text-[10px] font-bold text-amber-400 tracking-wider uppercase mt-0.5 block">
                Coaching Portal
              </span>
            </div>
          )}
        </div>

        {isMobileView ? (
          <button
            onClick={onMobileClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors ml-auto flex-shrink-0 text-slate-400 hover:text-amber-400"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* User Mini Profile */}
      {(!collapsed || isMobileView) && (
        <div className="p-3 mx-2 my-2.5 bg-slate-900/80 rounded-xl border border-slate-800/90 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              {role === "super_manager"
                ? "Super Manager"
                : role === "course_teacher"
                ? "Course Teacher"
                : role.charAt(0).toUpperCase() + role.slice(1)}
            </p>
            <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono">
              Live
            </span>
          </div>
          <p className="font-bold text-white truncate text-xs sm:text-sm mt-0.5">{name}</p>
        </div>
      )}

      {/* Nav Items with Gold Accents */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {nav.map(item => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                if (isMobileView && onMobileClose) onMobileClose()
              }}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-xs sm:text-sm font-medium",
                isActive
                  ? "bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border-l-4 border-amber-400 text-amber-300 font-bold shadow-md shadow-amber-500/5"
                  : "text-slate-400 hover:bg-slate-800/70 hover:text-white"
              )}
            >
              <item.icon
                className={cn(
                  "w-4 h-4 flex-shrink-0 transition-colors",
                  isActive ? "text-amber-400" : "text-slate-400 group-hover:text-white"
                )}
              />
              {(!collapsed || isMobileView) && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom Home Button */}
      <div className="p-2 border-t border-slate-800/80 bg-slate-950/40">
        <Link
          href="/"
          onClick={() => {
            if (isMobileView && onMobileClose) onMobileClose()
          }}
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-amber-300 transition-all text-xs sm:text-sm font-semibold"
        >
          <Home className="w-4 h-4 flex-shrink-0 text-amber-400" />
          {(!collapsed || isMobileView) && <span>Public Homepage</span>}
        </Link>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 md:hidden flex flex-col h-full bg-[#0a0f1d] border-r border-slate-800 text-white shadow-2xl transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent(true)}
      </aside>

      {/* Desktop Persistent Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col h-full transition-all duration-300 bg-[#0a0f1d] border-r border-slate-800 text-white shadow-xl flex-shrink-0",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {sidebarContent(false)}
      </aside>
    </>
  )
}
