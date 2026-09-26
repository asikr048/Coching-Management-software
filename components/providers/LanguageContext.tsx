"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from "react"

export type AppLanguage = "bn" | "en" | "mix"

export interface LanguageContextType {
  language: AppLanguage
  setLanguage: (lang: AppLanguage) => void
  t: (key: string, custom?: { bn?: string; en?: string; mix?: string }) => string
  isBn: boolean
  isEn: boolean
  isMix: boolean
}

// Comprehensive dictionary for standard terms across the coaching management application
export const translations: Record<string, { bn: string; en: string; mix: string }> = {
  // Brand & General
  language: { bn: "ভাষা", en: "Language", mix: "Language (ভাষা)" },
  select_language: { bn: "ভাষা নির্বাচন করুন", en: "Select Language", mix: "Select Language (ভাষা নির্বাচন)" },
  bangla: { bn: "বাংলা", en: "Bangla", mix: "বাংলা" },
  english: { bn: "ইংরেজি", en: "English", mix: "English" },
  mix_lang: { bn: "বাংলা + English", en: "Bangla + English", mix: "বাংলা + English (Mix)" },
  like_now: { bn: "বর্তমান শৈলী", en: "Current Style", mix: "Like Now (বর্তমান)" },

  // Roles & Panels
  role_owner: { bn: "মালিক", en: "Owner", mix: "Owner" },
  role_branch_director: { bn: "শাখা পরিচালক", en: "Branch Director", mix: "Branch Director" },
  role_super_manager: { bn: "সুপার ম্যানেজার", en: "Super Manager", mix: "Super Manager" },
  role_manager: { bn: "ম্যানেজার", en: "Manager", mix: "Manager" },
  role_receptionist: { bn: "রিসেপশনিস্ট", en: "Receptionist", mix: "Receptionist" },
  role_teacher: { bn: "শিক্ষক", en: "Teacher", mix: "Teacher" },
  role_accountant: { bn: "হিসাবরক্ষক", en: "Accountant", mix: "Accountant" },
  role_course_teacher: { bn: "কোর্স শিক্ষক", en: "Course Teacher", mix: "Course Teacher" },
  role_student: { bn: "শিক্ষার্থী", en: "Student", mix: "Student" },

  panel: { bn: "প্যানেল", en: "Panel", mix: "Panel" },
  admin_panel: { bn: "অ্যাডমিন প্যানেল", en: "Admin Panel", mix: "Admin Panel" },
  student_portal: { bn: "শিক্ষার্থী পোর্টাল", en: "Student Portal", mix: "Student Portal" },
  dashboard: { bn: "ড্যাশবোর্ড", en: "Dashboard", mix: "Dashboard" },
  my_profile: { bn: "আমার প্রোফাইল", en: "My Profile", mix: "My Profile" },

  // Navigation Links
  nav_dashboard: { bn: "ড্যাশবোর্ড", en: "Dashboard", mix: "Dashboard" },
  nav_accountant_desk: { bn: "হিসাবরক্ষক ডেস্ক", en: "Accountant Desk", mix: "Accountant Desk" },
  nav_branches: { bn: "শাখাসমূহ", en: "Branches", mix: "Branches (শাখা)" },
  nav_students: { bn: "শিক্ষার্থীবৃন্দ", en: "Students", mix: "Students" },
  nav_batches: { bn: "ব্যাচসমূহ", en: "Batches", mix: "Batches" },
  nav_payments: { bn: "পেমেন্টসমূহ", en: "Payments", mix: "Payments" },
  nav_payment_approvals: { bn: "পেমেন্ট অনুমোদন", en: "Payment Approvals", mix: "Payment Approvals" },
  nav_attendance: { bn: "উপস্থিতি", en: "Attendance", mix: "Attendance" },
  nav_fee_dues: { bn: "বকেয়া ফি", en: "Fee Dues", mix: "Fee Dues" },
  nav_referrals: { bn: "রেফারেল", en: "Referrals", mix: "Referrals" },
  nav_exams: { bn: "পরীক্ষাসমূহ", en: "Exams", mix: "Exams" },
  nav_materials: { bn: "শিক্ষা উপকরণ", en: "Study Materials", mix: "Materials" },
  nav_notices: { bn: "নোটিশ বোর্ড", en: "Notice Board", mix: "Notice Board (নোটিশ)" },
  nav_staff: { bn: "কর্মকর্তা-কর্মচারী", en: "Staff Members", mix: "Staff" },
  nav_sms: { bn: "বাল্ক এসএমএস", en: "Bulk SMS", mix: "Bulk SMS" },
  nav_homepage_editor: { bn: "হোমপেজ এডিটর", en: "Homepage Editor", mix: "Homepage Editor" },
  nav_marketplace: { bn: "মার্কেটপ্লেস", en: "Marketplace", mix: "Marketplace" },
  nav_analytics: { bn: "পরিসংখ্যান ও বিশ্লেষণ", en: "Analytics", mix: "Analytics" },
  nav_expenses: { bn: "ব্যয় হিসাব", en: "Expenses", mix: "Expenses" },
  nav_settings: { bn: "সেটিংস", en: "Settings", mix: "Settings" },
  nav_new_enrollment: { bn: "নতুন ভর্তি", en: "New Enrollment", mix: "New Enrollment" },
  nav_collect_fee: { bn: "ফি আদায়", en: "Collect Fee", mix: "Collect Fee" },
  nav_biometric: { bn: "বায়োমেট্রিক উপস্থিতি", en: "Biometric Entry", mix: "Biometric Entry" },
  nav_results: { bn: "ফলাফল", en: "Results", mix: "Results" },
  nav_my_courses: { bn: "আমার কোর্সসমূহ", en: "My Courses", mix: "My Courses" },
  nav_reports: { bn: "রিপোর্টসমূহ", en: "Reports", mix: "Reports" },
  nav_student_billing: { bn: "শিক্ষার্থী হিসাব ও বিলিং", en: "Student Accounts & Billing", mix: "Student Accounts & Billing" },

  // Header & Public Actions
  all_branches: { bn: "সকল শাখা", en: "All Branches", mix: "All Branches (সকল শাখা)" },
  select_branch: { bn: "শাখা নির্বাচন করুন", en: "Select Branch", mix: "শাখা নির্বাচন করুন (Select Branch)" },
  branch_filter: { bn: "শাখা ফিল্টার", en: "Branch Filter", mix: "Branch Filter (শাখা ফিল্টার)" },
  global_overview: { bn: "সার্বিক পর্যবেক্ষণ", en: "Global multi-branch overview", mix: "Global multi-branch overview (কেন্দ্রীয় তথ্য)" },
  sign_in: { bn: "সাইন ইন", en: "Sign In", mix: "Sign In" },
  sign_out: { bn: "লগআউট", en: "Sign Out", mix: "Sign Out" },
  sign_up: { bn: "সাইন আপ", en: "Sign Up", mix: "Sign Up" },
  join_now: { bn: "যুক্ত হোন", en: "Join Now", mix: "Join Now" },
  view_batches: { bn: "ব্যাচসমূহ দেখুন", en: "View Batches", mix: "View Batches" },
  browse_courses: { bn: "কোর্সসমূহ দেখুন", en: "Browse Courses", mix: "Browse Courses" },
  courses: { bn: "কোর্সসমূহ", en: "Courses", mix: "Courses" },
  online_result: { bn: "অনলাইন রেজাল্ট", en: "Online Results", mix: "অনলাইন রেজাল্ট" },
  contact_us: { bn: "যোগাযোগ করুন", en: "Contact Us", mix: "Contact Us" },
  established: { bn: "স্থাপিত", en: "Established", mix: "স্থাপিত" },
  main_campus: { bn: "প্রধান ক্যাম্পাস ও সকল শাখা", en: "Main Campus & All Branches", mix: "প্রধান ক্যাম্পাস ও সকল শাখা" },
  notice_board_title: { bn: "নোটিশ বোর্ডের সকল বিজ্ঞপ্তি", en: "All Notices from Notice Board", mix: "নোটিশ বোর্ডের সকল বিজ্ঞপ্তি" },

  // Common UI Actions & Words
  search: { bn: "অনুসন্ধান...", en: "Search...", mix: "Search (অনুসন্ধান)..." },
  filter: { bn: "ফিল্টার", en: "Filter", mix: "Filter" },
  save: { bn: "সংরক্ষণ করুন", en: "Save", mix: "Save" },
  cancel: { bn: "বাতিল", en: "Cancel", mix: "Cancel" },
  delete: { bn: "মুছুন", en: "Delete", mix: "Delete" },
  edit: { bn: "সম্পাদনা", en: "Edit", mix: "Edit" },
  update: { bn: "আপডেট", en: "Update", mix: "Update" },
  submit: { bn: "জমা দিন", en: "Submit", mix: "Submit" },
  confirm: { bn: "নিশ্চিত করুন", en: "Confirm", mix: "Confirm" },
  back: { bn: "পেছনে", en: "Back", mix: "Back" },
  close: { bn: "বন্ধ করুন", en: "Close", mix: "Close" },
  view: { bn: "দেখুন", en: "View", mix: "View" },
  details: { bn: "বিস্তারিত", en: "Details", mix: "Details" },
  download: { bn: "ডাউনলোড", en: "Download", mix: "Download" },
  print: { bn: "প্রিন্ট", en: "Print", mix: "Print" },
  export: { bn: "রপ্তানি", en: "Export", mix: "Export" },
  loading: { bn: "লোড হচ্ছে...", en: "Loading...", mix: "Loading..." },
  active: { bn: "সক্রিয়", en: "Active", mix: "Active" },
  inactive: { bn: "নিষ্ক্রিয়", en: "Inactive", mix: "Inactive" },
  paid: { bn: "পরিশোধিত", en: "Paid", mix: "Paid" },
  due: { bn: "বকেয়া", en: "Due", mix: "Due" },
  total: { bn: "মোট", en: "Total", mix: "Total" },
  status: { bn: "অবস্থা", en: "Status", mix: "Status" },
  date: { bn: "তারিখ", en: "Date", mix: "Date" },
  action: { bn: "পদক্ষেপ", en: "Action", mix: "Action" },
  notifications: { bn: "বিজ্ঞপ্তি", en: "Notifications", mix: "Notifications" },
  no_data: { bn: "কোন তথ্য পাওয়া যায়নি", en: "No data found", mix: "No data found" },

  // Auth / Login Page
  welcome_back: { bn: "স্বাগতম", en: "Welcome back", mix: "Welcome back (স্বাগতম)" },
  sign_in_subtitle: { bn: "আপনার পোর্টালে প্রবেশ করুন", en: "Sign in to your portal", mix: "Sign in to your portal" },
  user_id_or_email: { bn: "ইউজার আইডি বা ইমেইল", en: "User ID or Email", mix: "User ID or Email" },
  password: { bn: "পাসওয়ার্ড", en: "Password", mix: "Password" },
  remember_me: { bn: "মনে রাখুন", en: "Remember me", mix: "Remember me" },
  forgot_password: { bn: "পাসওয়ার্ড ভুলে গেছেন?", en: "Forgot password?", mix: "Forgot password?" },
  logging_in: { bn: "প্রবেশ করা হচ্ছে...", en: "Signing in...", mix: "Signing in..." },
  dont_have_account: { bn: "অ্যাকাউন্ট নেই?", en: "Don't have an account?", mix: "Don't have an account?" },
}

const STORAGE_KEY = "app_language_preference"

const LanguageContext = createContext<LanguageContextType>({
  language: "mix",
  setLanguage: () => {},
  t: (key: string) => key,
  isBn: false,
  isEn: false,
  isMix: true,
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("mix")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as AppLanguage | null
      if (saved === "bn" || saved === "en" || saved === "mix") {
        setLanguageState(saved)
      }
    } catch {
      // LocalStorage not available or restricted
    }
    setMounted(true)
  }, [])

  const setLanguage = useCallback((lang: AppLanguage) => {
    setLanguageState(lang)
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {}
  }, [])

  const t = useCallback(
    (key: string, custom?: { bn?: string; en?: string; mix?: string }): string => {
      if (custom) {
        if (language === "bn" && custom.bn) return custom.bn
        if (language === "en" && custom.en) return custom.en
        if (language === "mix" && custom.mix) return custom.mix
        return custom.mix || custom.en || custom.bn || key
      }

      const entry = translations[key]
      if (entry) {
        return entry[language] || entry.mix || entry.en || entry.bn || key
      }
      return key
    },
    [language]
  )

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      isBn: language === "bn",
      isEn: language === "en",
      isMix: language === "mix",
    }),
    [language, setLanguage, t]
  )

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
