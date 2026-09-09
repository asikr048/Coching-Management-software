"use client"
import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/utils"
import {
  BookOpen, Users, User, Clock, Calendar, CalendarDays, MapPin, Star,
  ArrowRight, Phone, Mail, ChevronRight, ChevronLeft, CheckCircle, TrendingUp,
  Shield, Bell, MessageSquare, Send, Loader2, Megaphone, ExternalLink,
  Landmark, Award, Check, ChevronDown, Sparkles, Share2, Eye, FileText, Trophy
} from "lucide-react"
import Link from "next/link"
import type { Branch } from "@/lib/supabase/types"
import { getUserEnrollments, getCachedUserEnrollments, type UserEnrollmentsState } from "@/lib/user-enrollments"

export default function HomePage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all")
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false)

  const [batches, setBatches] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [studentCount, setStudentCount] = useState<number>(0)
  const [slides, setSlides] = useState<any[]>([])
  const [currentSlide, setCurrentSlide] = useState(0)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userEnrollments, setUserEnrollments] = useState<UserEnrollmentsState>(() => {
    return getCachedUserEnrollments() || {
      enrolledBatchIds: new Set<string>(),
      pendingBatchIds: new Set<string>(),
      enrolledCourseIds: new Set<string>(),
      pendingCourseIds: new Set<string>(),
      isStaff: false,
      user: null,
    }
  })
  const [notices, setNotices] = useState<any[]>([])
  const [achievements, setAchievements] = useState<any[]>([])
  const [blogs, setBlogs] = useState<any[]>([])
  const [publicExams, setPublicExams] = useState<any[]>([])
  const [loadingExams, setLoadingExams] = useState(true)

  // Modal states for full view
  const [activeNoticeModal, setActiveNoticeModal] = useState<any | null>(null)
  const [activeBlogModal, setActiveBlogModal] = useState<any | null>(null)
  const [allNoticesModal, setAllNoticesModal] = useState(false)

  // Institutional Site Settings
  const [contactLink, setContactLink] = useState("https://wa.me/8801302201431")
  const [contactLabel, setContactLabel] = useState("WhatsApp Us")
  const [contactPhone, setContactPhone] = useState("01302201431")
  const [contactEmail, setContactEmail] = useState("info@medhashiree.com")
  const [contactAddress, setContactAddress] = useState("নাচোল, চাঁপাইনবাবগঞ্জ")
  const [footerAbout, setFooterAbout] = useState(
    "মেধাশিরী কোচিং সেন্টার - উত্তরবঙ্গের শীর্ষস্থানীয় শিক্ষাপ্রতিষ্ঠান। অভিজ্ঞ শিক্ষক ও মানসম্মত পাঠদানের মাধ্যমে প্রতিটি শিক্ষার্থীর উজ্জ্বল ভবিষ্যৎ নিশ্চিত করাই আমাদের লক্ষ্য।"
  )

  // Feedback form state
  const [fbName, setFbName] = useState("")
  const [fbEmail, setFbEmail] = useState("")
  const [fbPhone, setFbPhone] = useState("")
  const [fbMessage, setFbMessage] = useState("")
  const [fbRating, setFbRating] = useState(5)
  const [fbSubmitting, setFbSubmitting] = useState(false)
  const [fbDone, setFbDone] = useState(false)

  // Active Branch computation
  const currentBranch = selectedBranchId === "all"
    ? null
    : branches.find(b => b.id === selectedBranchId) || null

  // Dynamic Contact information based on branch
  const displayPhone = currentBranch?.contact_info?.phone || currentBranch?.director_phone || currentBranch?.manager_phone || contactPhone
  const displayEmail = currentBranch?.contact_info?.email || contactEmail
  const displayAddress = currentBranch?.location || contactAddress
  const displayEstablishedYear = currentBranch?.established_year || "২০০৮"

  useEffect(() => {
    const supabase = createClient()

    async function loadData() {
      const fetchAuth = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            setCurrentUser(user)
            const { data: staff } = await supabase.from("staff").select("role").eq("auth_user_id", user.id).maybeSingle()
            setUserRole(staff?.role || "student")
            getUserEnrollments().then(enrState => {
              setUserEnrollments(enrState)
            })
          }
        } catch {}
      }

      const fetchBranchesAndNotices = async () => {
        let loadedBranches: any[] = []
        try {
          const { data: bList } = await supabase.from("branches").select("*").eq("is_active", true).order("name")
          if (bList && bList.length > 0) {
            loadedBranches = bList
            setBranches(bList)
          }
        } catch {}

        try {
          const { data: n, error: nErr } = await supabase
            .from("notices")
            .select("*")
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(25)

          if (!nErr && Array.isArray(n)) {
            let noticeBranchesMap: Record<string, string[]> = {}
            try {
              const { data: nbSetting } = await supabase
                .from("site_settings")
                .select("value")
                .eq("key", "notice_branch_assignments")
                .maybeSingle()
              if (nbSetting?.value) {
                noticeBranchesMap = JSON.parse(nbSetting.value)
              }
            } catch {}

            const enriched = n.map((item: any) => {
              const extraBranchIds = noticeBranchesMap[item.id] || []
              const branchIds = Array.isArray(item.branch_ids) && item.branch_ids.length > 0
                ? item.branch_ids
                : (extraBranchIds.length > 0 ? extraBranchIds : (item.branch_id ? [item.branch_id] : []))
              const assignedBranches = (loadedBranches || []).filter((b: any) => branchIds.includes(b.id))
              const branchNames = assignedBranches.map((b: any) => b.name)
              return {
                ...item,
                branch_ids: branchIds,
                branch: branchNames.length > 0 ? { name: branchNames.join(", ") } : null,
              }
            })
            setNotices(enriched)
          }
        } catch {}
      }

      const fetchBatches = async () => {
        try {
          const { data: b } = await supabase
            .from("batches")
            .select("*, teacher:staff(name), branch:branches(name)")
            .eq("is_active", true)
            .order("created_at", { ascending: false })
          if (b) setBatches(b)
        } catch {}
      }

      const fetchCourses = async () => {
        try {
          const { data: c } = await supabase
            .from("courses")
            .select("*, teacher:staff(name)")
            .eq("status", "published")
            .order("total_sales", { ascending: false })
            .limit(8)
          if (c) setCourses(c)
        } catch {}
      }

      const fetchStudentCount = async () => {
        try {
          const { count } = await supabase.from("students").select("id", { count: "exact", head: true }).eq("is_active", true)
          if (count) setStudentCount(count)
        } catch {}
      }

      const fetchSlides = async () => {
        try {
          const { data: s } = await supabase.from("slider_images").select("*").eq("is_active", true).order("sort_order")
          if (s && s.length > 0) {
            setSlides(s)
          } else {
            setSlides([
              {
                id: "def1",
                title: "মেধাশিরী কোচিং সেন্টার",
                subtitle: "এইচএসসি ও এসএসসি স্পেশাল মডেল টেস্ট ব্যাচে ভর্তি চলছে",
                image_url: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop",
              },
              {
                id: "def2",
                title: "অভিজ্ঞ শিক্ষক মণ্ডলী ও আধুনিক ক্লাসরুম",
                subtitle: "পরীক্ষামূলক ক্লাস ও সাপ্তাহিক মূল্যায়নের মাধ্যমে নিশ্চিত সাফল্য",
                image_url: "https://images.unsplash.com/photo-1577896851231-70ef18881754?q=80&w=1200&auto=format&fit=crop",
              },
            ])
          }
        } catch {}
      }

      const fetchAchievements = async () => {
        try {
          const { data: a } = await supabase.from("achievements").select("*, branch:branches(name)").eq("is_active", true).order("sort_order", { ascending: true }).limit(8)
          if (a && a.length > 0) {
            setAchievements(a)
          } else {
            setAchievements([
              {
                id: "a1",
                student_name: "তানভীর আহমেদ",
                title: "রাজশাহী মেডিকেল কলেজ (চান্স প্রাপ্ত)",
                description: "মেধাশিরী কোচিংয়ের নিয়মিত ক্লাস ও বিশেষ মডেল টেস্ট আমার মেডিকেল প্রস্তুতিতে সর্বোচ্চ ভূমিকা রেখেছে।",
                exam_year: "২০২৫",
              },
              {
                id: "a2",
                student_name: "নুসরাত জাহান",
                title: "এইচএসসি পরীক্ষায় গোল্ডেন জিপিএ ৫.০০",
                description: "শিক্ষকদের আন্তরিক পাঠদান ও নিয়মিত পরীক্ষা ভীতি দূর করতে সাহায্য করেছে।",
                exam_year: "২০২৫",
              },
              {
                id: "a3",
                student_name: "মাহমুদুল হাসান",
                title: "রুয়েট (CSE) চান্স প্রাপ্ত",
                description: "গণিত ও পদার্থবিজ্ঞানের কনসেপ্ট ক্লিয়ারিং ক্লাসের মাধ্যমে ইঞ্জিনিয়ারিং ভর্তি পরীক্ষায় সাফল্য পেয়েছি।",
                exam_year: "২০২৪",
              },
            ])
          }
        } catch {}
      }

      const fetchBlogs = async () => {
        try {
          const { data: bl } = await supabase.from("blogs").select("*, branch:branches(name)").eq("is_published", true).order("published_at", { ascending: false }).limit(6)
          if (bl && bl.length > 0) {
            setBlogs(bl)
          } else {
            setBlogs([
              {
                id: "b1",
                title: "এইচএসসি পদার্থবিজ্ঞান পরীক্ষায় এ+ পাওয়ার সহজ কৌশল",
                excerpt: "পদার্থবিজ্ঞানে গাণিতিক সমস্যা সমাধান এবং সৃজনশীল অংশে সম্পূর্ণ নম্বর অর্জনের কার্যকর ফর্মুলা ও সময় বণ্টন গাইড।",
                content: "পদার্থবিজ্ঞানে ভালো করতে হলে মুখস্থ করার চেয়ে কনসেপ্ট ক্লিয়ার থাকা সবচেয়ে জরুরি। নিয়মিত গাণিতিক সূত্রাবলি অনুশীলন এবং বোর্ড প্রশ্নের ধরন বিশ্লেষণ শিক্ষার্থীদের পরীক্ষার জন্য আত্মবিশ্বাসী করে তোলে...",
                author_name: "মেধাশিরী একাডেমিক টিম",
                created_at: new Date().toISOString(),
                tags: ["এইচএসসি", "পদার্থবিজ্ঞান", "টিপস"],
              },
              {
                id: "b2",
                title: "মেডিকেল ভর্তি পরীক্ষার শেষ মুহূর্তের কার্যকর রিভিশন প্ল্যান",
                excerpt: "প্রতিদিনের বিষয়ভিত্তিক টার্গেট নির্ধারণ এবং নেগেটিভ মার্কিং এড়ানোর মোক্ষম কৌশল নিয়ে বিশেষজ্ঞদের পরামর্শ।",
                content: "মেডিকেল ভর্তি পরীক্ষার ক্ষেত্রে নির্ভুলতা অত্যন্ত গুরুত্বপূর্ণ। শেষ মাসগুলোতে নতুন কোনো টপিক পড়ার চেয়ে পূর্বে পড়া নোট এবং মডেল টেস্টের ভুলগুলো বারবার সংশোধন করা সবচেয়ে বেশি কাজে দেয়...",
                author_name: "ডাঃ তাসনিম আহমেদ (পরামর্শক)",
                created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
                tags: ["মেডিকেল", "অ্যাডমিশন", "পরামর্শ"],
              },
            ])
          }
        } catch {}
      }

      const fetchSettings = async () => {
        try {
          const { data: settings } = await supabase.from("site_settings").select("key, value")
          if (settings && settings.length > 0) {
            const getVal = (k: string) => settings.find((s: any) => s.key === k)?.value
            if (getVal("contact_link")) setContactLink(getVal("contact_link")!)
            if (getVal("contact_label")) setContactLabel(getVal("contact_label")!)
            if (getVal("contact_phone")) setContactPhone(getVal("contact_phone")!)
            if (getVal("contact_email")) setContactEmail(getVal("contact_email")!)
            if (getVal("contact_address")) setContactAddress(getVal("contact_address")!)
            if (getVal("footer_about")) setFooterAbout(getVal("footer_about")!)
          }
        } catch {}
      }

      const fetchPublicExams = async () => {
        try {
          const res = await fetch("/api/online-results")
          const json = await res.json()
          if (json.success && Array.isArray(json.exams)) {
            setPublicExams(json.exams)
          }
        } catch (err) {
          console.error("Error fetching online results for homepage:", err)
        } finally {
          setLoadingExams(false)
        }
      }

      await Promise.allSettled([
        fetchAuth(),
        fetchBranchesAndNotices(),
        fetchBatches(),
        fetchCourses(),
        fetchStudentCount(),
        fetchSlides(),
        fetchAchievements(),
        fetchBlogs(),
        fetchSettings(),
        fetchPublicExams(),
      ])
    }

    loadData()
  }, [])

  // Auto slide timer
  useEffect(() => {
    if (slides.length <= 1) return
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [slides.length])

  // Filtered lists based on branch selection
  const filteredBatches = batches.filter(b => {
    if (selectedBranchId === "all") return true
    return b.branch_id === selectedBranchId || !b.branch_id
  })

  const filteredNotices = notices.filter(n => {
    if (selectedBranchId === "all") return true
    const isGlobal = !n.branch_id && (!n.branch_ids || n.branch_ids.length === 0)
    if (isGlobal) return true
    if (n.branch_id === selectedBranchId) return true
    if (Array.isArray(n.branch_ids) && n.branch_ids.includes(selectedBranchId)) return true
    return false
  })

  const filteredAchievements = achievements.filter(a => {
    if (selectedBranchId === "all") return true
    return a.branch_id === selectedBranchId || !a.branch_id
  })

  const filteredBlogs = blogs.filter(b => {
    if (selectedBranchId === "all") return true
    return b.branch_id === selectedBranchId || !b.branch_id
  })

  // Handle smooth scroll to section on hash load
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash.substring(1)
      const timer = setTimeout(() => {
        const element = document.getElementById(hash)
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [loadingExams, batches.length, notices.length])

  const publicResultCards = useMemo(() => {
    const cards: Array<{
      id: string
      examId: string
      title: string
      badgeText: string
      badgeType: "weekly" | "one_time"
      subject?: string
      branchName?: string
      batchName?: string
      routineText: string
      totalMarks: number
      passMarks: number
      link: string
      buttonText: string
    }> = []

    for (const ex of publicExams) {
      if (selectedBranchId !== "all") {
        const matchesBranch = ex.branch?.id === selectedBranchId || ex.branch_id === selectedBranchId || !ex.branch_id
        if (!matchesBranch) continue
      }

      const isWeekly =
        ex.exam_schedule_type === "weekly" ||
        (Array.isArray(ex.recurring_days) && ex.recurring_days.length > 0) ||
        ex.is_weekly_published === true ||
        Boolean(ex.title?.includes("সাপ্তাহিক"))

      let totalMarks = ex.total_marks || 50
      let passMarks = ex.pass_marks || 20

      if (isWeekly && Array.isArray(ex.recurring_days) && ex.recurring_days.length > 0) {
        const sumTotal = ex.recurring_days.reduce((acc: number, d: any) => {
          const m = typeof d === "object" && d !== null ? Number(d.total_marks) : 0
          return acc + (m || 0)
        }, 0)
        const sumPass = ex.recurring_days.reduce((acc: number, d: any) => {
          const p = typeof d === "object" && d !== null ? Number(d.pass_marks) : 0
          return acc + (p || 0)
        }, 0)
        if (sumTotal > 0) totalMarks = sumTotal
        if (sumPass > 0) passMarks = sumPass
      }

      cards.push({
        id: ex.id,
        examId: ex.id,
        title: ex.title,
        badgeText: isWeekly ? "সাপ্তাহিক রেজাল্ট" : "পরীক্ষার রেজাল্ট",
        badgeType: isWeekly ? "weekly" : "one_time",
        subject: ex.subject,
        branchName: ex.branch?.name,
        batchName: ex.batch?.name,
        routineText: ex.exam_date 
          ? new Date(ex.exam_date).toLocaleDateString("en-GB") 
          : (isWeekly ? "সাপ্তাহিক মূল্যায়ন" : "চলমান"),
        totalMarks: totalMarks,
        passMarks: passMarks,
        link: `/online-result?exam_id=${ex.id}`,
        buttonText: "ফলাফল ও সম্পূর্ণ মেরিট লিস্ট দেখুন",
      })
    }

    return cards
  }, [publicExams, selectedBranchId])

  async function handleFeedbackSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFbSubmitting(true)
    try {
      const supabase = createClient()
      const payload: any = {
        name: fbName,
        email: fbEmail || null,
        phone: fbPhone || null,
        message: fbMessage,
        rating: fbRating,
      }
      if (selectedBranchId !== "all") {
        payload.branch_id = selectedBranchId
      }
      let { error } = await supabase.from("feedback").insert(payload)
      if (error && (error.message?.includes("branch_id") || error.code === "PGRST204" || error.code === "42703")) {
        delete payload.branch_id
        await supabase.from("feedback").insert(payload)
      }
      setFbDone(true)
    } catch {
      setFbDone(true)
    } finally {
      setFbSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-900 font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* ========================================================================= */}
      {/* 1. TOP UTILITY BAR (Exact Match to Asian School / Institutional Reference) */}
      {/* ========================================================================= */}
      <div className="bg-[#1e293b] text-white text-xs py-2 px-4 sm:px-8 border-b border-gray-700/50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
          {/* Contact Details Left */}
          <div className="flex items-center flex-wrap gap-4 sm:gap-6 text-gray-200">
            <a
              href={`tel:${displayPhone}`}
              className="flex items-center gap-1.5 hover:text-amber-400 transition-colors font-medium tracking-wide"
            >
              <Phone className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span>{displayPhone}</span>
              {currentBranch?.director_phone && currentBranch.director_phone !== displayPhone && (
                <span className="hidden sm:inline">, {currentBranch.director_phone}</span>
              )}
            </a>

            <a
              href={`mailto:${displayEmail}`}
              className="flex items-center gap-1.5 hover:text-amber-400 transition-colors hidden sm:flex"
            >
              <Mail className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span>{displayEmail}</span>
            </a>

            <div className="flex items-center gap-1.5 text-gray-300">
              <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="truncate max-w-[200px] sm:max-w-none">{displayAddress}</span>
            </div>
          </div>

          {/* Social Quick Links Right */}
          <div className="flex items-center gap-3 text-gray-300">
            <a
              href="#contact"
              className="hover:text-amber-300 transition-colors p-1 flex items-center gap-1.5 text-gray-300"
              title="Contact Us"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-semibold text-gray-200 hidden sm:inline hover:text-amber-300">
                Contact Us
              </span>
            </a>
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-400 transition-colors p-1"
              title="Facebook"
            >
              <Share2 className="w-3.5 h-3.5" />
            </a>
            <span className="h-3 w-px bg-gray-600 hidden sm:block"></span>
            <span className="text-[11px] text-amber-300 font-semibold hidden sm:inline">
              স্থাপিত: {displayEstablishedYear}ইং
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. INSTITUTIONAL BRANDING HEADER & INTERACTIVE BRANCH SELECTOR */}
      {/* ========================================================================= */}
      <header className="bg-white border-b border-gray-200 py-3.5 sm:py-5 px-4 sm:px-8 shadow-xs sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Typography */}
          <Link href="/" className="flex items-center gap-3 sm:gap-4 group min-w-0">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-indigo-700 p-0.5 shadow-md flex items-center justify-center bg-white flex-shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
              <img
                src="/logo.jpg"
                alt="MedhaShiree Logo"
                className="w-full h-full object-cover rounded-full"
              />
            </div>

            <div className="min-w-0">
              <h1 className="text-xl sm:text-3xl font-extrabold text-[#1e1b4b] tracking-tight leading-tight group-hover:text-indigo-700 transition-colors">
                MedhaShiree
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-gray-600 mt-0.5 truncate">
                {currentBranch ? currentBranch.name : "প্রধান ক্যাম্পাস ও সকল শাখা"} , {displayAddress}
              </p>
            </div>
          </Link>

          {/* Interactive Branch Dropdown & Quick Login */}
          <div className="flex items-center gap-3">
            {branches.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-indigo-50 to-amber-50/50 hover:from-indigo-100 hover:to-amber-100/70 border border-indigo-200 rounded-xl text-xs sm:text-sm font-bold text-indigo-950 transition-all shadow-xs"
                >
                  <Landmark className="w-4 h-4 text-indigo-700 flex-shrink-0" />
                  <span className="truncate max-w-[110px] sm:max-w-[170px]">
                    {selectedBranchId === "all" ? "সকল শাখা (All Branches)" : (currentBranch?.name || "শাখা নির্বাচন")}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                </button>

                {branchDropdownOpen && (
                  <div
                    className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden py-1"
                    onMouseLeave={() => setBranchDropdownOpen(false)}
                  >
                    <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center justify-between">
                      <span>শাখা নির্বাচন করুন (Select Branch)</span>
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded font-normal">
                        {branches.length} টি শাখা
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedBranchId("all")
                        setBranchDropdownOpen(false)
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs sm:text-sm font-medium transition-colors hover:bg-indigo-50/70 border-b border-gray-100 ${
                        selectedBranchId === "all" ? "bg-indigo-50/90 text-indigo-800 font-bold" : "text-gray-700"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Landmark className="w-4 h-4 text-indigo-600" />
                        <div>
                          <p className="font-semibold">সকল শাখা (All Branches)</p>
                          <p className="text-[10px] text-gray-500">কেন্দ্রীয় সার্বিক তথ্য</p>
                        </div>
                      </div>
                      {selectedBranchId === "all" && <Check className="w-4 h-4 text-indigo-600" />}
                    </button>

                    <div className="max-h-60 overflow-y-auto divide-y divide-gray-50">
                      {branches.map(branch => (
                        <button
                          key={branch.id}
                          onClick={() => {
                            setSelectedBranchId(branch.id)
                            setBranchDropdownOpen(false)
                          }}
                          className={`w-full flex items-center justify-between px-3.5 py-2 text-left text-xs sm:text-sm transition-colors hover:bg-indigo-50/70 ${
                            selectedBranchId === branch.id
                              ? "bg-indigo-50/90 text-indigo-800 font-bold"
                              : "text-gray-700"
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-semibold truncate">{branch.name}</p>
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

            {/* Online Result Quick Link */}
            <Link
              href="/online-result?exam_id=639d346a-bb1f-4b71-8715-b845872cc859"
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-200 rounded-xl text-xs sm:text-sm font-extrabold shadow-xs transition-all flex-shrink-0 cursor-pointer"
            >
              <Trophy className="w-4 h-4 text-amber-500" />
              <span className="hidden sm:inline">অনলাইন রেজাল্ট</span>
              <span className="sm:hidden">রেজাল্ট</span>
            </Link>

            {/* Student/Staff Login Portal Link */}
            <Link
              href={currentUser ? `/dashboard/${userRole || "owner"}` : "/login"}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all flex-shrink-0 cursor-pointer"
            >
              <User className="w-4 h-4" />
              <span>{currentUser ? "ড্যাশবোর্ড" : "লগইন"}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 3. ROYAL INSTITUTIONAL NAVIGATION BAR (Gold Highlight Border) */}
      {/* ========================================================================= */}
      <nav className="bg-[#4c1d95] text-white shadow-md border-b-2 border-amber-400 relative z-30 overflow-x-auto scrollbar-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center space-x-1 sm:space-x-2 py-1 text-xs sm:text-sm font-semibold whitespace-nowrap">
            <Link href="/" className="px-3 py-2.5 rounded-lg bg-white/10 text-amber-300 font-bold">
              মূল পাতা (Home)
            </Link>
            <Link 
              href="/online-result?exam_id=639d346a-bb1f-4b71-8715-b845872cc859" 
              className="px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black flex items-center gap-1.5 shadow-md shadow-amber-400/20 transition-all cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-slate-950" />
              <span>অনলাইন রেজাল্ট (Online Result)</span>
            </Link>
            <a href="#batches" className="px-3 py-2.5 rounded-lg hover:bg-white/10 text-white/90 hover:text-white transition-colors">
              ব্যাচসমূহ (Batches)
            </a>
            <Link 
              href="/online-result?exam_id=639d346a-bb1f-4b71-8715-b845872cc859" 
              className="px-3 py-2.5 rounded-lg hover:bg-white/10 text-amber-300 font-bold transition-colors flex items-center gap-1"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-300" />
              <span>পরীক্ষার রেজাল্ট (Results)</span>
            </Link>
            <a href="#courses" className="px-3 py-2.5 rounded-lg hover:bg-white/10 text-white/90 hover:text-white transition-colors">
              কোর্সসমূহ (Courses)
            </a>
            <a href="#notices" className="px-3 py-2.5 rounded-lg hover:bg-white/10 text-white/90 hover:text-white transition-colors">
              নোটিশ বোর্ড (Notices)
            </a>
            <a href="#achievements" className="px-3 py-2.5 rounded-lg hover:bg-white/10 text-white/90 hover:text-white transition-colors">
              সাফল্য (Achievements)
            </a>
            <a href="#blogs" className="px-3 py-2.5 rounded-lg hover:bg-white/10 text-white/90 hover:text-white transition-colors">
              শিক্ষামূলক ব্লগ (Blog)
            </a>
            <a href="#contact" className="px-3 py-2.5 rounded-lg hover:bg-white/10 text-white/90 hover:text-white transition-colors">
              যোগাযোগ (Contact)
            </a>
          </div>

          <div className="hidden lg:flex items-center gap-2 py-1">
            <Link
              href="/online-result?exam_id=639d346a-bb1f-4b71-8715-b845872cc859"
              className="text-xs text-slate-950 font-black bg-amber-400 hover:bg-amber-300 px-3 py-1 rounded-full flex items-center gap-1 shadow-xs transition-colors"
            >
              <Trophy className="w-3.5 h-3.5 text-slate-950" /> মেরিট লিস্ট
            </Link>
            <span className="text-xs text-amber-300 font-bold bg-white/10 px-2.5 py-1 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> ভর্তি চলছে
            </span>
          </div>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* 4. HERO SECTION: IMAGE SLIDER (65%) + NOTICE BOOK (35%) (Stacks on Mobile) */}
      {/* ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-5 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
          {/* Left: 65% Image Slider (8 columns on lg) */}
          <div className="lg:col-span-8 flex flex-col justify-between">
            <div className="relative aspect-[16/9] sm:aspect-[16/8.8] bg-gray-900 rounded-2xl overflow-hidden shadow-lg border border-gray-200 group">
              {slides.map((slide, index) => (
                <div
                  key={slide.id || index}
                  className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                    index === currentSlide ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slide.image_url}
                    alt={slide.title || "MedhaShiree Campus"}
                    className="w-full h-full object-cover"
                  />
                  {/* Gradient Overlay & Captions */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex flex-col justify-end p-5 sm:p-7 text-white">
                    {slide.title && (
                      <h3 className="text-lg sm:text-2xl font-bold tracking-tight text-white mb-1 drop-shadow-md">
                        {slide.title}
                      </h3>
                    )}
                    {slide.subtitle && (
                      <p className="text-xs sm:text-sm text-gray-200 font-medium max-w-xl line-clamp-2">
                        {slide.subtitle}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {/* Slider Controls */}
              {slides.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentSlide(prev => (prev === 0 ? slides.length - 1 : prev - 1))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-all opacity-80 group-hover:opacity-100"
                    aria-label="Previous slide"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setCurrentSlide(prev => (prev + 1) % slides.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-all opacity-80 group-hover:opacity-100"
                    aria-label="Next slide"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>

                  {/* Indicator Dots */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
                    {slides.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentSlide(idx)}
                        className={`h-2 rounded-full transition-all ${
                          idx === currentSlide ? "w-6 bg-amber-400" : "w-2 bg-white/60 hover:bg-white"
                        }`}
                        aria-label={`Go to slide ${idx + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right: 35% Notice Book / Notice Board ("সর্বশেষ নোটিশ :") (4 columns on lg) */}
          <div id="notices" className="lg:col-span-4 flex flex-col scroll-mt-20 sm:scroll-mt-24">
            <div className="bg-white rounded-2xl border border-gray-200/90 shadow-md overflow-hidden flex flex-col h-full">
              {/* Notice Book Header (Matches Reference Style with Dark Navy Ribbon) */}
              <div className="bg-[#1e3a5f] text-white px-5 py-3.5 border-l-4 border-amber-400 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <h3 className="font-bold text-base tracking-wide">সর্বশেষ নোটিশ :</h3>
                </div>
                {currentBranch && (
                  <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-amber-200 font-medium">
                    {currentBranch.name}
                  </span>
                )}
              </div>

              {/* Notice Items List */}
              <div className="p-4 flex-1 overflow-y-auto max-h-[340px] sm:max-h-[380px] divide-y divide-gray-100">
                {filteredNotices.slice(0, 5).map(notice => (
                  <div
                    key={notice.id}
                    onClick={() => setActiveNoticeModal(notice)}
                    className="py-3 first:pt-1 last:pb-1 group cursor-pointer hover:bg-indigo-50/40 px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-amber-600 font-bold text-base leading-tight flex-shrink-0 group-hover:translate-x-0.5 transition-transform">
                        »
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-semibold text-gray-800 group-hover:text-indigo-700 leading-snug">
                          {notice.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-gray-500 font-medium">
                            {notice.created_at
                              ? new Date(notice.created_at).toLocaleDateString("en-GB")
                              : ""}
                          </span>
                          {notice.branch?.name && (
                            <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded font-medium">
                              {notice.branch.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredNotices.length === 0 && (
                  <div className="py-12 text-center text-gray-400 text-xs">
                    বর্তমানে কোনো নতুন নোটিশ নেই।
                  </div>
                )}
              </div>

              {/* Notice Book Footer Button */}
              <div className="p-3 bg-gray-50/90 border-t border-gray-100 text-center">
                <button
                  onClick={() => setAllNoticesModal(true)}
                  className="text-xs font-bold text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1 transition-colors"
                >
                  সকল নোটিশ দেখুন <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. BATCHES SECTION ("চলমান ও আসন্ন ব্যাচসমূহ") */}
      {/* ========================================================================= */}
      <section id="batches" className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12 scroll-mt-20 sm:scroll-mt-24">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6 sm:mb-8 border-b border-gray-200/80 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                {currentBranch ? currentBranch.name : "সকল শাখা"}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1e1b4b] tracking-tight">
              চলমান ও আসন্ন ব্যাচসমূহ (Batches)
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              এইচএসসি, এসএসসি ও বিশ্ববিদ্যালয় ভর্তি পরীক্ষার স্পেশাল ব্যাচে ভর্তি চলছে
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 bg-white px-3 py-1.5 rounded-xl border border-gray-200">
            <Users className="w-4 h-4 text-indigo-600" />
            <span>মোট সক্রিয় শিক্ষার্থী: {studentCount}+</span>
          </div>
        </div>

        {filteredBatches.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center text-gray-500 text-sm">
            এই শাখায় বর্তমানে কোনো ব্যাচ যুক্ত করা হয়নি।
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredBatches.map(batch => {
              const isClosed = batch.status === "admission_closed" || batch.status === "finished"
              const isEnrolled = userEnrollments.enrolledBatchIds.has(batch.id)
              const isPending = userEnrollments.pendingBatchIds.has(batch.id)

              return (
                <div
                  key={batch.id}
                  className="bg-white rounded-2xl border border-gray-200/90 hover:border-indigo-300 transition-all p-5 shadow-xs hover:shadow-md flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Link href={`/batch/${batch.id}`}>
                        <h3 className="font-bold text-gray-900 text-base leading-snug hover:text-indigo-600 transition-colors cursor-pointer">{batch.name}</h3>
                      </Link>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${
                          isEnrolled
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : isPending
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : isClosed
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {isEnrolled ? "✓ ভর্তি সম্পন্ন (Enrolled)" : isPending ? "⏳ অপেক্ষমাণ (Pending)" : isClosed ? "ভর্তি বন্ধ (Closed)" : "ভর্তি চলছে (Open)"}
                      </span>
                    </div>

                    {batch.subject && (
                      <p className="text-xs font-semibold text-indigo-600 mb-2">{batch.subject}</p>
                    )}

                    <div className="space-y-1.5 text-xs text-gray-600 bg-gray-50/80 p-3 rounded-xl mb-4 border border-gray-100">
                      {batch.teacher?.name && (
                        <p className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          <span>প্রভাষক: <strong>{batch.teacher.name}</strong></span>
                        </p>
                      )}
                      {batch.schedule_days && (
                        <p className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>দিন: {batch.schedule_days}</span>
                        </p>
                      )}
                      {batch.start_time && (
                        <p className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span>সময়: {batch.start_time}</span>
                        </p>
                      )}
                      {batch.branch?.name && (
                        <p className="flex items-center gap-1.5 text-indigo-700 font-medium">
                          <Landmark className="w-3.5 h-3.5 text-indigo-500" />
                          <span> শাখা: {batch.branch.name}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-gray-400 font-medium">মাসিক ফি</p>
                      <p className="text-base font-bold text-indigo-700">
                        {batch.monthly_fee ? formatCurrency(batch.monthly_fee) : "যোগাযোগ করুন"}
                      </p>
                    </div>

                    {isEnrolled ? (
                      <Link
                        href={`/student/batch/${batch.id}`}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        ক্লাসরুমে যান
                      </Link>
                    ) : isPending ? (
                      <Link
                        href="/student/profile"
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition-colors shadow-xs flex items-center gap-1.5"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        অপেক্ষমাণ
                      </Link>
                    ) : isClosed ? (
                      <span className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gray-100 text-gray-400 cursor-not-allowed">
                        ভর্তি বন্ধ
                      </span>
                    ) : (
                      <Link
                        href={`/enroll?batchId=${batch.id}`}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-xs flex items-center gap-1.5"
                      >
                        ভর্তি হন (Enroll)
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* 5.5. PUBLISHED EXAMS & MERIT LIST SECTION ("পরীক্ষার ফলাফল ও মেরিট লিস্ট") */}
      {/* ========================================================================= */}
      <section id="results" className="bg-gradient-to-b from-slate-50 to-indigo-50/40 border-y border-gray-200/80 py-10 sm:py-16 scroll-mt-20 sm:scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 sm:mb-10 pb-4 border-b border-indigo-100">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                  <Trophy className="w-4 h-4 text-amber-600" />
                </span>
                <span className="text-xs font-black text-indigo-700 uppercase tracking-wider">
                  Academic Results & Merit List
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#1e1b4b] tracking-tight">
                প্রকাশিত পরীক্ষার ফলাফল ও মেধা তালিকা
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                শিক্ষার্থী ও অভিভাবকদের অবগতির জন্য প্রতিটি শাখার পরীক্ষার ফলাফল সরাসরি এই তালিকায় দেখতে পাবেন
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/online-result?exam_id=639d346a-bb1f-4b71-8715-b845872cc859"
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-amber-500/20 hover:scale-[1.01] transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer"
              >
                <Trophy className="w-4 h-4 text-amber-200" />
                <span>সকল অনলাইন রেজাল্ট দেখুন</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {loadingExams ? (
            <div className="py-12 text-center text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-2" />
              <p className="text-xs font-semibold">ফলাফল লোড হচ্ছে...</p>
            </div>
          ) : publicResultCards.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-indigo-200 p-10 text-center text-gray-500 shadow-xs max-w-xl mx-auto space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto">
                <Trophy className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-gray-800 text-base">
                বর্তমানে কোনো নতুন পরীক্ষার রেজাল্ট প্রকাশ হয়নি
              </h4>
              <p className="text-xs text-gray-500">
                পরীক্ষা সম্পন্ন হওয়ার পর শাখাভিত্তিক ফলাফল সরাসরি এখানে এবং অনলাইন রেজাল্ট পোর্টালে দৃশ্যমান হবে।
              </p>
              <Link
                href="/online-result?exam_id=639d346a-bb1f-4b71-8715-b845872cc859"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 pt-1"
              >
                <span>অনলাইন রেজাল্ট আর্কাইভ দেখুন</span> <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {publicResultCards.map((card) => {
                const isWeekly = card.badgeType === "weekly"

                return (
                  <div
                    key={card.id}
                    className={`rounded-2xl border p-5 flex flex-col justify-between group relative overflow-hidden transition-all shadow-md hover:shadow-xl ${
                      isWeekly
                        ? "bg-gradient-to-b from-purple-50/50 via-white to-white border-purple-200/90 hover:border-purple-400"
                        : "bg-white border-indigo-100/80 hover:border-amber-400/80"
                    }`}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-400/10 via-transparent to-transparent pointer-events-none"></div>

                    <div className="space-y-3 relative">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                            isWeekly
                              ? "bg-purple-100 text-purple-900 border border-purple-300"
                              : "bg-amber-100 text-amber-900 border border-amber-200"
                          }`}>
                            <Trophy className="w-3 h-3 text-amber-700" />
                            {card.badgeText}
                          </span>
                          {card.subject && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                              {card.subject}
                            </span>
                          )}
                        </div>
                        {card.branchName && (
                          <span className="text-[10px] font-semibold text-gray-500 flex items-center gap-1">
                            <Landmark className="w-3 h-3 text-indigo-500" />
                            {card.branchName}
                          </span>
                        )}
                      </div>

                      <div>
                        <h3 className="text-base font-extrabold text-gray-900 group-hover:text-indigo-700 transition-colors leading-snug">
                          {card.title}
                        </h3>
                        {card.batchName && (
                          <p className="text-xs text-gray-600 mt-1 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                            <span>ব্যাচ: <strong>{card.batchName}</strong></span>
                          </p>
                        )}
                      </div>

                      <div className={`grid grid-cols-2 gap-2 p-3 rounded-xl border text-xs ${
                        isWeekly ? "bg-purple-50/50 border-purple-100" : "bg-indigo-50/50 border-indigo-100/60"
                      }`}>
                        <div>
                          <span className="text-[10px] text-gray-500 font-medium block">তারিখ / সূচি</span>
                          <span className="font-bold text-gray-800 truncate block">
                            {card.routineText}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-500 font-medium block">পূর্ণমান ও পাস</span>
                          <span className="font-bold text-gray-800 block">
                            {card.totalMarks} নম্বর (পাস: {card.passMarks})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-gray-100">
                      <Link
                        href={card.link}
                        className="w-full py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer bg-gradient-to-r from-indigo-900 to-indigo-800 hover:from-amber-600 hover:to-amber-700 text-white"
                      >
                        <Trophy className="w-4 h-4 text-amber-400" />
                        <span>{card.buttonText}</span>
                        <ChevronRight className="w-4 h-4 text-white/70" />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. COURSES SECTION ("বিশেষ কোর্সসমূহ") */}
      {/* ========================================================================= */}
      {courses.length > 0 && (
        <section id="courses" className="bg-white border-y border-gray-200/80 py-10 sm:py-14 scroll-mt-20 sm:scroll-mt-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-8">
            <div className="mb-6 sm:mb-8 text-center max-w-2xl mx-auto">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                Specialized Programs
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1e1b4b] mt-1 tracking-tight">
                বিশেষ কোর্সসমূহ (Courses)
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                বিষয়ভিত্তিক গভীর জ্ঞান ও ভর্তি পরীক্ষার পূর্ণাঙ্গ প্রস্তুতির জন্য সাজানো কোর্স
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {courses.map(course => {
                const isCourseEnrolled = userEnrollments.enrolledCourseIds.has(course.id)
                const isCoursePending = userEnrollments.pendingCourseIds.has(course.id)

                return (
                  <div
                    key={course.id}
                    className="bg-gray-50/50 rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div className="aspect-video bg-gray-200 relative overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={course.thumbnail_url || "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=600&auto=format&fit=crop"}
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                      {course.subject && (
                        <span className="absolute top-2 left-2 text-[10px] font-bold bg-indigo-900/80 text-white px-2 py-0.5 rounded backdrop-blur-xs">
                          {course.subject}
                        </span>
                      )}
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm mb-1 line-clamp-2">{course.title}</h4>
                        {course.teacher?.name && (
                          <p className="text-xs text-gray-500 mb-2">প্রভাষক: {course.teacher.name}</p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-gray-200 flex items-center justify-between mt-2">
                        <span className="text-sm font-bold text-indigo-700">
                          {course.price ? formatCurrency(course.price) : "বিনামূল্যে"}
                        </span>
                        {isCourseEnrolled ? (
                          <Link
                            href={`/student/course/${course.id}`}
                            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200"
                          >
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> কোর্সে যান (Enrolled)
                          </Link>
                        ) : isCoursePending ? (
                          <Link
                            href="/student/profile"
                            className="text-xs font-bold text-amber-700 hover:text-amber-800 inline-flex items-center gap-1 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200"
                          >
                            <Clock className="w-3.5 h-3.5 text-amber-600" /> অপেক্ষমাণ (Pending)
                          </Link>
                        ) : (
                          <Link
                            href={`/enroll?courseId=${course.id}`}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                          >
                            ভর্তি হন (Enroll) <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 7. ACHIEVEMENTS SECTION ("আমাদের সাফল্য ও কৃতি শিক্ষার্থী") */}
      {/* ========================================================================= */}
      <section id="achievements" className="max-w-7xl mx-auto px-4 sm:px-8 py-10 sm:py-14 scroll-mt-20 sm:scroll-mt-24">
        <div className="mb-6 sm:mb-8 text-center max-w-2xl mx-auto">
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center justify-center gap-1">
            <Trophy className="w-4 h-4" /> Proven Track Record
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1e1b4b] mt-1 tracking-tight">
            কৃতি শিক্ষার্থীদের সাফল্য (Achievements)
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            মেধাশিরী পরিবারের অদম্য মেধাবীদের মেডিকেল, ইঞ্জিনিয়ারিং ও পাবলিক বিশ্ববিদ্যালয়ে অভাবনীয় সাফল্য
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAchievements.map(ach => (
            <div
              key={ach.id}
              className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start gap-3.5 mb-3">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 font-bold overflow-hidden border border-amber-200 shadow-xs">
                    {(ach.photo_url || ach.image_url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ach.photo_url || ach.image_url} alt={ach.student_name} className="w-full h-full object-cover" />
                    ) : (
                      <Award className="w-7 h-7" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-gray-900 text-sm truncate">{ach.student_name}</h4>
                      {(ach.exam_year || ach.year) && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                          {ach.exam_year || ach.year}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-indigo-700 leading-tight mt-0.5">
                      {ach.title}
                    </p>
                  </div>
                </div>

                {(ach.description || ach.result_details) && (
                  <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100 line-clamp-3 italic">
                    "{ach.description || ach.result_details}"
                  </p>
                )}
              </div>

              {ach.branch?.name && (
                <p className="text-[11px] text-gray-400 mt-3 pt-2 border-t border-gray-100 flex items-center gap-1">
                  <Landmark className="w-3 h-3 text-indigo-400" /> {ach.branch.name}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. EDUCATIONAL BLOGS SECTION ("ব্লগ ও শিক্ষামূলক পরামর্শ") */}
      {/* ========================================================================= */}
      <section id="blogs" className="bg-gray-50 border-t border-gray-200 py-10 sm:py-14 scroll-mt-20 sm:scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6 sm:mb-8 border-b border-gray-200 pb-4">
            <div>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                Knowledge Hub
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1e1b4b] mt-1 tracking-tight">
                শিক্ষামূলক প্রবন্ধ ও টিপস (Blog)
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                পরীক্ষার প্রস্তুতি, ক্যারিয়ার গাইডলাইন এবং বিষয়ভিত্তিক গুরুত্বপূর্ণ পরামর্শ
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredBlogs.map(blog => (
              <div
                key={blog.id}
                className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                      {blog.author_name || "মেধাশিরী টিম"}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {blog.created_at ? new Date(blog.created_at).toLocaleDateString("en-GB") : ""}
                    </span>
                  </div>

                  <h3
                    onClick={() => setActiveBlogModal(blog)}
                    className="font-bold text-gray-900 text-base mb-2 hover:text-indigo-600 transition-colors cursor-pointer leading-snug"
                  >
                    {blog.title}
                  </h3>

                  {(blog.excerpt || blog.summary) && (
                    <p className="text-xs text-gray-600 line-clamp-3 mb-3">{blog.excerpt || blog.summary}</p>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {Array.isArray(blog.tags) &&
                      blog.tags.slice(0, 3).map((tag: string, i: number) => (
                        <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          #{tag}
                        </span>
                      ))}
                  </div>

                  <button
                    onClick={() => setActiveBlogModal(blog)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                  >
                    পড়ুন <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 9. FEEDBACK & OPINION FORM */}
      {/* ========================================================================= */}
      <section className="max-w-4xl mx-auto px-4 sm:px-8 py-10 sm:py-14">
        <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-10 shadow-sm">
          <div className="text-center max-w-xl mx-auto mb-6">
            <h2 className="text-2xl font-bold text-[#1e1b4b]">অভিভাবক ও শিক্ষার্থীর মতামত</h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              আমাদের সেবার মান আরো উন্নত করতে আপনার মূল্যবান মতামত অথবা অভিযোগ জানান।
            </p>
          </div>

          {fbDone ? (
            <div className="text-center py-8 bg-emerald-50 rounded-2xl border border-emerald-200">
              <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
              <h4 className="font-bold text-emerald-900 text-base">আপনার মতামতের জন্য ধন্যবাদ!</h4>
              <p className="text-xs text-emerald-700 mt-1">
                মেধাশিরী কর্তৃপক্ষ আপনার বার্তা গুরুত্ব সহকারে বিবেচনা করবে।
              </p>
            </div>
          ) : (
            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">আপনার নাম *</label>
                  <input
                    type="text"
                    required
                    value={fbName}
                    onChange={e => setFbName(e.target.value)}
                    placeholder="পূর্ণ নাম"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">ফোন নম্বর</label>
                  <input
                    type="text"
                    value={fbPhone}
                    onChange={e => setFbPhone(e.target.value)}
                    placeholder="017xxxxxxxx"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">আপনার বার্তা / পরামর্শ *</label>
                <textarea
                  rows={3}
                  required
                  value={fbMessage}
                  onChange={e => setFbMessage(e.target.value)}
                  placeholder="আপনার সুনির্দিষ্ট মতামত লিখুন..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500 font-semibold mr-1">রেটিং:</span>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFbRating(star)}
                      className="p-1"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          star <= fbRating ? "text-amber-400 fill-amber-400" : "text-gray-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={fbSubmitting}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors shadow-xs"
                >
                  {fbSubmitting ? "পাঠানো হচ্ছে..." : "মতামত জমা দিন"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 10. INSTITUTIONAL FOOTER */}
      {/* ========================================================================= */}
      <footer id="contact" className="bg-[#0f172a] text-gray-300 text-xs pt-12 pb-6 border-t border-gray-800 scroll-mt-20 sm:scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-gray-800">
          {/* Col 1: About */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full border border-indigo-400/30 overflow-hidden flex items-center justify-center bg-white flex-shrink-0">
                <img src="/logo.jpg" alt="MedhaShiree Logo" className="w-full h-full object-cover rounded-full" />
              </div>
              <h3 className="font-bold text-white text-base">MedhaShiree</h3>
            </div>
            <p className="text-gray-400 leading-relaxed text-[11px] mb-3">{footerAbout}</p>
            <p className="text-amber-400 font-bold">স্থাপিত: {displayEstablishedYear}ইং</p>
          </div>

          {/* Col 2: Active Branch & Contacts */}
          <div>
            <h4 className="font-bold text-white text-sm mb-3">
              {currentBranch ? currentBranch.name : "প্রধান কার্যালয় ও যোগাযোগ"}
            </h4>
            <div className="space-y-2 text-[11px]">
              <p className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>{displayAddress}</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>{displayPhone}</span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>{displayEmail}</span>
              </p>
              {currentBranch?.branch_director && (
                <p className="pt-1 text-gray-400">
                  শাখা পরিচালক: <strong className="text-gray-200">{currentBranch.branch_director}</strong>
                </p>
              )}
            </div>
          </div>

          {/* Col 3: Branches Quick List */}
          <div>
            <h4 className="font-bold text-white text-sm mb-3">আমাদের শাখাসমূহ</h4>
            <div className="space-y-1.5 text-[11px]">
              {branches.map(b => (
                <button
                  key={b.id}
                  onClick={() => {
                    setSelectedBranchId(b.id)
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }}
                  className={`block text-left hover:text-amber-300 transition-colors ${
                    selectedBranchId === b.id ? "text-amber-400 font-bold" : "text-gray-400"
                  }`}
                >
                  • {b.name}
                </button>
              ))}
              {branches.length === 0 && <p className="text-gray-500">নাচোল প্রধান ক্যাম্পাস</p>}
            </div>
          </div>

          {/* Col 4: Quick Links & Login */}
          <div>
            <h4 className="font-bold text-white text-sm mb-3">গুরুত্বপূর্ণ লিংক</h4>
            <ul className="space-y-1.5 text-[11px]">
              <li>
                <Link href="/login" className="hover:text-amber-400 transition-colors">
                  • শিক্ষার্থী / শিক্ষক লগইন পোর্টাল
                </Link>
              </li>
              <li>
                <a href="#batches" className="hover:text-amber-400 transition-colors">
                  • ব্যাচ ও ক্লাসের সময়সূচি
                </a>
              </li>
              <li>
                <a href="#notices" className="hover:text-amber-400 transition-colors">
                  • সাম্প্রতিক নোটিশ ও পরীক্ষার ফলাফল
                </a>
              </li>
              <li>
                <a href={contactLink} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">
                  • সরাসরি WhatsApp হেল্পলাইন
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-gray-500 gap-2">
          <p>© {new Date().getFullYear()} MedhaShiree Coaching. সর্বস্বত্ব সংরক্ষিত।</p>
          <p>Designed with excellence for Bangladesh Academic Coaching.</p>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* 11. FULL NOTICE MODAL */}
      {/* ========================================================================= */}
      {activeNoticeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3 mb-4">
              <div>
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">নোটিশ বিস্তারিত</span>
                <h3 className="text-base font-bold text-gray-900 mt-0.5">{activeNoticeModal.title}</h3>
                <p className="text-xs text-gray-400 mt-1">
                  প্রকাশের তারিখ: {activeNoticeModal.created_at ? new Date(activeNoticeModal.created_at).toLocaleDateString("en-GB") : ""}
                </p>
              </div>
              <button
                onClick={() => setActiveNoticeModal(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto mb-5 p-3 bg-gray-50 rounded-xl">
              {activeNoticeModal.content || "কোনো অতিরিক্ত বিবরণ দেওয়া হয়নি।"}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setActiveNoticeModal(null)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 12. FULL BLOG ARTICLE MODAL */}
      {/* ========================================================================= */}
      {activeBlogModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 sm:p-8 shadow-2xl border border-gray-100 my-8">
            <div className="flex items-start justify-between gap-3 pb-3 mb-4 border-b border-gray-100">
              <div>
                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                  {activeBlogModal.author_name || "মেধাশিরী সম্পাদকীয়"}
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 mt-2">
                  {activeBlogModal.title}
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  {activeBlogModal.created_at ? new Date(activeBlogModal.created_at).toLocaleDateString("en-GB") : ""}
                </p>
              </div>
              <button
                onClick={() => setActiveBlogModal(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto pr-2 mb-6">
              {activeBlogModal.content}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setActiveBlogModal(null)}
                className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 13. ALL NOTICES LIST MODAL */}
      {/* ========================================================================= */}
      {allNoticesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-gray-900">নোটিশ বোর্ডের সকল বিজ্ঞপ্তি</h3>
              </div>
              <button
                onClick={() => setAllNoticesModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {filteredNotices.map(n => (
                <div
                  key={n.id}
                  onClick={() => {
                    setAllNoticesModal(false)
                    setActiveNoticeModal(n)
                  }}
                  className="py-3 px-2 hover:bg-indigo-50/50 rounded-xl cursor-pointer transition-colors"
                >
                  <h4 className="text-sm font-semibold text-gray-800">{n.title}</h4>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                    <span>{n.created_at ? new Date(n.created_at).toLocaleDateString("en-GB") : ""}</span>
                    {n.branch?.name && <span className="text-indigo-600 font-medium">({n.branch.name})</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
