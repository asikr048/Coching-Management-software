"use client"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  GraduationCap, LayoutDashboard, Users, BookOpen, CreditCard,
  BarChart3, UserCheck, MessageSquare, Settings, ChevronLeft,
  ChevronRight, Package, Trophy, Fingerprint, ShoppingBag,
  DollarSign, GitMerge, Home, FileText, ImageIcon, Shield
} from "lucide-react"
import type { Role } from "@/lib/supabase/types"

const ownerNav = [
  { href: "/dashboard/owner", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/dashboard/owner/students", icon: Users, label: "Students" },
  { href: "/dashboard/owner/batches", icon: BookOpen, label: "Batches & Classes" },
  { href: "/dashboard/owner/payments", icon: CreditCard, label: "Payments" },
  { href: "/dashboard/owner/payment-approvals", icon: Shield, label: "Payment Approvals" },
  { href: "/dashboard/owner/fee-dues", icon: DollarSign, label: "Fee Dues" },
  { href: "/dashboard/owner/referrals", icon: GitMerge, label: "Referrals" },
  { href: "/dashboard/owner/exams", icon: FileText, label: "Exams & Results" },
  { href: "/dashboard/owner/materials", icon: Package, label: "Materials" },
  { href: "/dashboard/owner/staff", icon: UserCheck, label: "Staff" },
  { href: "/dashboard/owner/sms", icon: MessageSquare, label: "Bulk SMS" },
  { href: "/dashboard/owner/slider", icon: ImageIcon, label: "Homepage Slider" },
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

const roleColors: Record<string, string> = {
  owner: "from-indigo-900 to-indigo-800",
  super_manager: "from-amber-900 to-amber-800",
  manager: "from-teal-900 to-teal-800",
  receptionist: "from-emerald-900 to-emerald-800",
  teacher: "from-blue-900 to-blue-800",
  accountant: "from-purple-900 to-purple-800",
  course_teacher: "from-blue-900 to-blue-800",
}

export default function DashboardSidebar({ role, name }: { role: Role; name: string }) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const nav = navByRole[role] || ownerNav
  const gradient = roleColors[role] || "from-indigo-900 to-indigo-800"

  return (
    <aside className={cn("flex flex-col h-full transition-all duration-300 bg-gradient-to-b text-white shadow-xl", gradient, collapsed ? "w-16" : "w-64")}>
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-white flex-shrink-0" />
            <span className="font-bold text-base truncate">MedhaShiree</span>
          </div>
        )}
        {collapsed && <GraduationCap className="w-7 h-7 text-white mx-auto" />}
        <button onClick={() => setCollapsed(!collapsed)} className="p-1 rounded-lg hover:bg-white/10 transition-colors ml-auto flex-shrink-0">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
      {!collapsed && (
        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-xs text-white/50 uppercase tracking-wider">{role === "super_manager" ? "Super Manager" : role === "course_teacher" ? "Course Teacher" : role.charAt(0).toUpperCase() + role.slice(1)}</p>
          <p className="font-medium text-white truncate text-sm">{name}</p>
        </div>
      )}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {nav.map(item => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href}
              className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm",
                isActive ? "bg-white/20 text-white font-semibold" : "text-white/70 hover:bg-white/10 hover:text-white")}>
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>
      <div className="p-2 border-t border-white/10">
        <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-all text-sm">
          <Home className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Home</span>}
        </Link>
      </div>
    </aside>
  )
}
