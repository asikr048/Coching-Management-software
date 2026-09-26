"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { User } from "lucide-react"
import { useBranding } from "@/components/providers/BrandingContext"
import { useLanguage } from "@/components/providers/LanguageContext"
import LanguageSelector from "@/components/ui/LanguageSelector"

export default function PublicNavbar() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const supabase = createClient()
  const { branding, theme } = useBranding()
  const { t } = useLanguage()

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
    : (userRole === "teacher" || userRole === "course_teacher") ? "/dashboard/teacher"
    : (userRole === "receptionist" || userRole === "reception") ? "/dashboard/reception"
    : userRole === "accountant" ? "/dashboard/accountant"
    : "/student/profile"

  const buttonLabel = ["owner", "branch_director", "super_manager", "manager"].includes(userRole || "")
    ? t("admin_panel", { bn: "অ্যাডমিন প্যানেল", en: "Admin Panel", mix: "Admin Panel" })
    : ["teacher", "course_teacher", "receptionist", "reception", "accountant"].includes(userRole || "")
    ? t("dashboard", { bn: "ড্যাশবোর্ড", en: "Dashboard", mix: "Dashboard" })
    : t("my_profile", { bn: "আমার প্রোফাইল", en: "My Profile", mix: "My Profile" })

  return (
    <nav className="bg-white border-b border-gray-100 px-3 sm:px-4 py-3 sm:py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full border border-slate-200 overflow-hidden flex items-center justify-center bg-white shadow-xs flex-shrink-0">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={`${branding.name} Logo`} className="w-full h-full object-cover rounded-full" />
            ) : null}
          </div>
          <span className="text-base sm:text-lg font-bold text-slate-900 truncate">{branding.name}</span>
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Language Selection Mini Logo */}
          <LanguageSelector variant="header" />

          {loaded && currentUser ? (
            <Link
              href={dashboardHref}
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-1.5 brand-badge shadow-2xs"
            >
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-primary" /> {buttonLabel}
            </Link>
          ) : loaded ? (
            <Link
              href="/login"
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-brand-primary hover:bg-brand-light rounded-xl transition-colors"
            >
              {t("sign_in", { bn: "সাইন ইন", en: "Sign In", mix: "Sign In" })}
            </Link>
          ) : null}
          <Link
            href="/#batches"
            className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold brand-btn-primary rounded-xl transition-all"
          >
            {t("view_batches", { bn: "ব্যাচসমূহ দেখুন", en: "View Batches", mix: "View Batches" })}
          </Link>
        </div>
      </div>
    </nav>
  )
}
