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
  X, Globe, Landmark, Sparkles, Bell, Calculator
} from "lucide-react"
import type { Role } from "@/lib/supabase/types"
import { useBranding } from "@/components/providers/BrandingContext"
import { useLanguage } from "@/components/providers/LanguageContext"

const navTranslations: Record<string, string> = {
  "/dashboard/owner": "nav_dashboard",
  "/dashboard/reception": "nav_dashboard",
  "/dashboard/teacher": "nav_dashboard",
  "/dashboard/accountant": "nav_dashboard",
  "/dashboard/owner/accountant": "nav_accountant_desk",
  "/dashboard/owner/branches": "nav_branches",
  "/dashboard/owner/students": "nav_students",
  "/dashboard/reception/students": "nav_students",
  "/dashboard/owner/batches": "nav_batches",
  "/dashboard/owner/payments": "nav_payments",
  "/dashboard/accountant/payments": "nav_payments",
  "/dashboard/owner/payment-approvals": "nav_payment_approvals",
  "/dashboard/owner/attendance": "nav_attendance",
  "/dashboard/reception/attendance": "nav_attendance",
  "/dashboard/teacher/attendance": "nav_attendance",
  "/dashboard/owner/fee-dues": "nav_fee_dues",
  "/dashboard/accountant/fee-dues": "nav_fee_dues",
  "/dashboard/owner/referrals": "nav_referrals",
  "/dashboard/owner/exams": "nav_exams",
  "/dashboard/teacher/exams": "nav_exams",
  "/dashboard/owner/materials": "nav_materials",
  "/dashboard/owner/notices": "nav_notices",
  "/dashboard/owner/staff": "nav_staff",
  "/dashboard/owner/sms": "nav_sms",
  "/dashboard/owner/slider": "nav_homepage_editor",
  "/dashboard/owner/marketplace": "nav_marketplace",
  "/dashboard/owner/analytics": "nav_analytics",
  "/dashboard/owner/expenses": "nav_expenses",
  "/dashboard/owner/settings": "nav_settings",
  "/dashboard/reception/enroll": "nav_new_enrollment",
  "/dashboard/reception/payments": "nav_collect_fee",
  "/dashboard/reception/biometric": "nav_biometric",
  "/dashboard/teacher/results": "nav_results",
  "/dashboard/teacher/courses": "nav_my_courses",
  "/dashboard/accountant/reports": "nav_reports",
}

const ownerNav = [
  { href: "/dashboard/owner", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/dashboard/owner/accountant", icon: Calculator, label: "Accountant Desk" },
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
  { href: "/dashboard/owner/accountant", icon: Calculator, label: "Student Accounts & Billing" },
  { href: "/dashboard/accountant/payments", icon: CreditCard, label: "Payments" },
  { href: "/dashboard/accountant/fee-dues", icon: DollarSign, label: "Fee Dues" },
  { href: "/dashboard/accountant/reports", icon: BarChart3, label: "Reports" },
]

const navByRole: Record<string, typeof ownerNav> = {
  owner: ownerNav,
  branch_director: ownerNav,
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
  const { branding, theme } = useBranding()
  const { t } = useLanguage()

  const sidebarContent = (isMobileView: boolean) => (
    <>
      {/* Brand Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-white border border-slate-700 shadow-md flex-shrink-0">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={`${branding.name} Logo`} className="w-full h-full object-cover rounded-full" />
            ) : (
              <GraduationCap className="w-4 h-4 text-amber-500" />
            )}
          </div>
          {(!collapsed || isMobileView) && (
            <div className="min-w-0">
              <span className="font-extrabold text-base text-white tracking-tight leading-none block truncate" title={branding.name}>
                {branding.name}
              </span>
              <span className={cn("text-[10px] font-bold tracking-wider uppercase mt-0.5 block truncate", theme.accentTextClass)}>
                {branding.tagline || "Coaching Portal"}
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
            <p className={cn("text-[10px] font-bold uppercase tracking-wider flex items-center gap-1", theme.accentTextClass)}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: theme.primaryHex }}></span>
              {role === "branch_director"
                ? t("role_branch_director", { bn: "শাখা পরিচালক", en: "Branch Director", mix: "Branch Director" })
                : role === "super_manager"
                ? t("role_super_manager", { bn: "সুপার ম্যানেজার", en: "Super Manager", mix: "Super Manager" })
                : role === "course_teacher"
                ? t("role_course_teacher", { bn: "কোর্স শিক্ষক", en: "Course Teacher", mix: "Course Teacher" })
                : role === "owner"
                ? t("role_owner", { bn: "মালিক", en: "Owner", mix: "Owner" })
                : role === "accountant"
                ? t("role_accountant", { bn: "হিসাবরক্ষক", en: "Accountant", mix: "Accountant" })
                : role === "teacher"
                ? t("role_teacher", { bn: "শিক্ষক", en: "Teacher", mix: "Teacher" })
                : role === "receptionist"
                ? t("role_receptionist", { bn: "রিসেপশনিস্ট", en: "Receptionist", mix: "Receptionist" })
                : role.charAt(0).toUpperCase() + role.slice(1)}
            </p>
            <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono">
              Live
            </span>
          </div>
          <p className="font-bold text-white truncate text-xs sm:text-sm mt-0.5">{name}</p>
        </div>
      )}

      {/* Nav Items with Dynamic Brand Theme */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {nav.map(item => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          const translatedLabel = navTranslations[item.href] ? t(navTranslations[item.href]) : item.label
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
                  ? "brand-active-nav font-bold shadow-md"
                  : "text-slate-400 hover:bg-slate-800/70 hover:text-white"
              )}
            >
              <item.icon
                className={cn(
                  "w-4 h-4 flex-shrink-0 transition-colors",
                  isActive ? "text-brand-secondary" : "text-slate-400 group-hover:text-white"
                )}
                style={isActive ? { color: theme.secondaryHex } : undefined}
              />
              {(!collapsed || isMobileView) && <span className="truncate">{translatedLabel}</span>}
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
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all text-xs sm:text-sm font-semibold group"
        >
          <Home className="w-4 h-4 flex-shrink-0 text-brand-secondary" style={{ color: theme.secondaryHex }} />
          {(!collapsed || isMobileView) && <span>{t("public_homepage", { bn: "ওয়েবসাইট দেখুন", en: "Public Homepage", mix: "Public Homepage" })}</span>}
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
          "fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] md:hidden flex flex-col h-full bg-[#0a0f1d] border-r border-slate-800 text-white shadow-2xl transition-transform duration-300 ease-in-out",
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
