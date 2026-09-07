"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { formatDate } from "@/lib/utils"
import {
  Trophy,
  Award,
  Search,
  Calendar,
  Clock,
  Landmark,
  BookOpen,
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  X,
  Printer,
  Sparkles,
  Users,
  Eye,
  CalendarDays,
  User,
  GraduationCap
} from "lucide-react"

interface PublicExam {
  id: string
  title: string
  subject?: string
  total_marks: number
  pass_marks?: number
  exam_date?: string
  exam_schedule_type?: "one_time" | "weekly"
  recurring_days?: string[] | null
  is_paused?: boolean
  is_public_result?: boolean
  is_published?: boolean
  branch?: { id: string; name: string } | null
  batch?: { id: string; name: string } | null
  batch_ids?: string[] | null
  created_at: string
}

interface StudentRank {
  id: string
  student_id: string
  student_name: string
  roll: string
  obtained_marks: number
  grade?: string
  rank: number
}

export default function OnlineResultPortalPage() {
  const [exams, setExams] = useState<PublicExam[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [activeTab, setActiveTab] = useState<"all" | "everyday" | "weekly">("everyday")
  const [selectedBranch, setSelectedBranch] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Active Exam for Full Merit List Modal
  const [selectedExam, setSelectedExam] = useState<PublicExam | null>(null)
  const [examResults, setExamResults] = useState<StudentRank[]>([])
  const [loadingResults, setLoadingResults] = useState(false)
  const [studentSearchInModal, setStudentSearchInModal] = useState("")

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      try {
        // 1. Load branches
        const { data: bList } = await supabase.from("branches").select("id, name").eq("is_active", true)
        if (bList) setBranches(bList)

        // 2. Load exams where is_public_result is true OR is_published is true
        const { data: exList } = await supabase
          .from("exams")
          .select("*, branch:branches(id, name), batch:batches(id, name)")
          .or("is_public_result.eq.true,is_published.eq.true")
          .order("exam_date", { ascending: false })

        if (exList) {
          setExams(exList)
        }
      } catch (err) {
        console.error("Error loading public online results:", err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Open Full Merit List
  async function handleOpenMeritList(exam: PublicExam) {
    setSelectedExam(exam)
    setLoadingResults(true)
    setStudentSearchInModal("")
    setExamResults([])

    const supabase = createClient()
    try {
      const { data: results } = await supabase
        .from("exam_results")
        .select("*, student:students(id, name, student_id)")
        .eq("exam_id", exam.id)
        .order("obtained_marks", { ascending: false })

      if (results && results.length > 0) {
        let curRank = 1
        const list: StudentRank[] = results.map((r, i) => {
          if (i > 0 && Number(r.obtained_marks) < Number(results[i - 1].obtained_marks)) {
            curRank = i + 1
          }
          return {
            id: r.id,
            student_id: r.student?.id || r.student_id,
            student_name: r.student?.name || "Student",
            roll: r.student?.student_id || "N/A",
            obtained_marks: Number(r.obtained_marks || 0),
            grade: r.grade || "",
            rank: r.rank || curRank,
          }
        })
        setExamResults(list)
      }
    } catch (err) {
      console.error("Error fetching exam results:", err)
    } finally {
      setLoadingResults(false)
    }
  }

  // Filter exams by tab, branch, and search
  const filteredExams = useMemo(() => {
    return exams.filter((ex) => {
      const isWeekly = ex.exam_schedule_type === "weekly" || (Array.isArray(ex.recurring_days) && ex.recurring_days.length > 0)
      if (activeTab === "everyday" && isWeekly) return false
      if (activeTab === "weekly" && !isWeekly) return false

      if (selectedBranch !== "all" && ex.branch?.id && ex.branch.id !== selectedBranch) {
        return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const titleMatch = ex.title?.toLowerCase().includes(q)
        const subMatch = ex.subject?.toLowerCase().includes(q)
        const batchMatch = ex.batch?.name?.toLowerCase().includes(q)
        if (!titleMatch && !subMatch && !batchMatch) return false
      }

      return true
    })
  }, [exams, activeTab, selectedBranch, searchQuery])

  // Filter results inside merit list modal
  const filteredModalResults = useMemo(() => {
    if (!studentSearchInModal.trim()) return examResults
    const q = studentSearchInModal.toLowerCase()
    return examResults.filter((r) => r.student_name.toLowerCase().includes(q) || r.roll.toLowerCase().includes(q))
  }, [examResults, studentSearchInModal])

  const top3 = examResults.slice(0, 3)

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans antialiased">
      {/* Top Utility Header */}
      <header className="bg-[#1e1b4b] text-white py-3.5 px-4 sm:px-8 border-b border-indigo-900/60 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-amber-300 transition-colors flex items-center gap-1 text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">মূল পাতা (Home)</span>
            </Link>
            <div className="h-4 w-px bg-white/20"></div>
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span className="font-extrabold text-base sm:text-lg tracking-tight">
                অনলাইন রেজাল্ট ও মেধাতালিকা
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1"
            >
              <User className="w-3.5 h-3.5" />
              <span>লগইন</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4338ca] text-white py-10 px-4 sm:px-8 border-b-4 border-amber-400">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              মেধাশিরী পরীক্ষার কেন্দ্রীয় ফলাফল পোর্টাল
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              দৈনিক ও সাপ্তাহিক পরীক্ষার রেজাল্ট এবং মেরিট লিস্ট
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100 font-medium leading-relaxed">
              শিক্ষার্থী ও অভিভাবকদের অবগতির জন্য কোচিংয়ের প্রতিটি শাখার দৈনিক ও সাপ্তাহিক পরীক্ষার ফলাফল সরাসরি এই পোর্টালে প্রকাশিত হয়। রোল নম্বর বা নাম দিয়ে ফলাফল খুঁজুন।
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/15">
              <p className="text-[11px] text-indigo-200 font-semibold">প্রকাশিত মোট পরীক্ষা</p>
              <p className="text-2xl font-black text-amber-400 mt-0.5">{exams.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/15">
              <p className="text-[11px] text-indigo-200 font-semibold">দৈনিক পরীক্ষা</p>
              <p className="text-2xl font-black text-white mt-0.5">
                {exams.filter(e => e.exam_schedule_type !== "weekly" && (!Array.isArray(e.recurring_days) || e.recurring_days.length === 0)).length}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/15">
              <p className="text-[11px] text-indigo-200 font-semibold">সাপ্তাহিক মডেল টেস্ট</p>
              <p className="text-2xl font-black text-purple-300 mt-0.5">
                {exams.filter(e => e.exam_schedule_type === "weekly" || (Array.isArray(e.recurring_days) && e.recurring_days.length > 0)).length}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/15">
              <p className="text-[11px] text-indigo-200 font-semibold">সক্রিয় শাখা</p>
              <p className="text-2xl font-black text-emerald-400 mt-0.5">{branches.length || 1}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        {/* Navigation Tabs & Filters Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Main Merit List Tabs */}
          <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto">
            <button
              onClick={() => setActiveTab("everyday")}
              className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTab === "everyday"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>দৈনিক পরীক্ষার মেরিট লিস্ট (Everyday)</span>
            </button>
            <button
              onClick={() => setActiveTab("weekly")}
              className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTab === "weekly"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>সাপ্তাহিক পরীক্ষার মেরিট লিস্ট (Weekly)</span>
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTab === "all"
                  ? "bg-indigo-700 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <span>সকল পরীক্ষা ({exams.length})</span>
            </button>
          </div>

          {/* Search and Branch Selector */}
          <div className="flex items-center gap-3 flex-wrap">
            {branches.length > 1 && (
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-500"
              >
                <option value="all">সকল শাখা (All Branches)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}

            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="পরীক্ষার নাম বা বিষয় দিয়ে খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Exams Grid */}
        {loading ? (
          <div className="py-20 text-center text-slate-500">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="font-semibold text-sm">ফলাফল ও মেরিট লিস্ট লোড হচ্ছে...</p>
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-500 shadow-xs space-y-2">
            <Trophy className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-base font-bold text-slate-700">এই বিভাগে কোনো ফলাফল পাওয়া যায়নি</p>
            <p className="text-xs text-slate-400">ফিল্টার পরিবর্তন করে পুনরায় চেষ্টা করুন।</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredExams.map((exam) => {
              const isWeekly = exam.exam_schedule_type === "weekly" || (Array.isArray(exam.recurring_days) && exam.recurring_days.length > 0)
              const daysText = Array.isArray(exam.recurring_days) && exam.recurring_days.length > 0
                ? exam.recurring_days.map((d: any) => typeof d === "object" && d !== null ? `${d.day_bn || d.day}: ${d.exam_name || "পরীক্ষা"} (${d.total_marks || ""} নম্বর)` : d).join(", ")
                : "সাপ্তাহিক দিন"

              return (
                <div
                  key={exam.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:border-amber-500/50 p-5 shadow-lg transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isWeekly ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 border border-purple-200">
                            <CalendarDays className="w-3 h-3" />
                            WEEKLY
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                            <Calendar className="w-3 h-3" />
                            ONE-TIME
                          </span>
                        )}
                        {exam.subject && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {exam.subject}
                          </span>
                        )}
                      </div>
                      {exam.branch?.name && (
                        <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                          <Landmark className="w-3 h-3 text-slate-400" />
                          {exam.branch.name}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-900 transition-colors">
                        {exam.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                        <span>{exam.batch?.name || "All Enrolled Batches"}</span>
                      </p>
                    </div>

                    {/* Metadata chips */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 font-medium block">তারিখ / সূচি</span>
                        <span className="font-bold text-slate-800 truncate block">
                          {isWeekly ? `প্রতি ${daysText}` : (exam.exam_date ? formatDate(exam.exam_date) : "TBD")}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-medium block">পূর্ণমান ও পাস</span>
                        <span className="font-bold text-slate-800 block">
                          {exam.total_marks} marks (Pass: {exam.pass_marks || 33})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleOpenMeritList(exam)}
                      className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-md shadow-amber-500/20 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Trophy className="w-4 h-4 text-amber-200" />
                      <span>সম্পূর্ণ মেরিট লিস্ট দেখুন (View Results)</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Full Merit List Modal */}
      {selectedExam && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl my-8 flex flex-col max-h-[90vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between p-5 border-b border-slate-200 bg-slate-50 rounded-t-3xl shrink-0">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {selectedExam.title} - মেধাতালিকা
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    বিষয়: {selectedExam.subject || "সাধারণ"} • পূর্ণমান: {selectedExam.total_marks} • পাস: {selectedExam.pass_marks || 33}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedExam(null)}
                className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Top 3 Podium Cards */}
              {top3.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {top3.map((r, idx) => {
                    const isGold = idx === 0
                    const isSilver = idx === 1

                    return (
                      <div
                        key={r.id}
                        className={`p-4 rounded-2xl border flex items-center gap-3.5 ${
                          isGold
                            ? "bg-gradient-to-br from-amber-50 to-amber-100/60 border-amber-300 shadow-sm"
                            : isSilver
                            ? "bg-gradient-to-br from-slate-50 to-slate-100 border-slate-300 shadow-sm"
                            : "bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-300 shadow-sm"
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-xs ${
                            isGold
                              ? "bg-amber-500 text-white"
                              : isSilver
                              ? "bg-slate-600 text-white"
                              : "bg-amber-700 text-white"
                          }`}
                        >
                          {isGold ? "১ম" : isSilver ? "২য়" : "৩য়"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">
                            {isGold ? "🥇 ১ম স্থান" : isSilver ? "🥈 ২য় স্থান" : "🥉 ৩য় স্থান"}
                          </p>
                          <p className="font-extrabold text-sm text-slate-900 truncate">{r.student_name}</p>
                          <p className="text-xs font-bold text-amber-700">
                            প্রাপ্ত নম্বর: {r.obtained_marks} / {selectedExam.total_marks}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Student Search & Stats in Modal */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="নিজের রোল বা নাম দিয়ে খুঁজুন..."
                    value={studentSearchInModal}
                    onChange={(e) => setStudentSearchInModal(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="text-xs text-slate-500 font-bold">
                  মোট পরীক্ষার্থী: <span className="text-slate-900">{examResults.length}</span> জন
                </div>
              </div>

              {/* Leaderboard Table */}
              {loadingResults ? (
                <div className="py-12 text-center text-slate-500">
                  <div className="w-6 h-6 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-xs font-semibold">মেধাতালিকা সাজানো হচ্ছে...</p>
                </div>
              ) : filteredModalResults.length === 0 ? (
                <div className="p-8 text-center text-slate-400 border border-dashed rounded-xl text-xs">
                  কোনো পরীক্ষার্থীর ফলাফল পাওয়া যায়নি।
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-center w-16">মেধা (Rank)</th>
                        <th className="px-4 py-3">শিক্ষার্থীর নাম</th>
                        <th className="px-4 py-3">রোল / Student ID</th>
                        <th className="px-4 py-3 text-center">প্রাপ্ত নম্বর</th>
                        <th className="px-4 py-3 text-center">গ্রেড</th>
                        <th className="px-4 py-3 text-center">ফলাফল</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredModalResults.map((r) => {
                        const pass = r.obtained_marks >= (selectedExam.pass_marks || 33)
                        return (
                          <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-center font-black">
                              <span
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] ${
                                  r.rank === 1
                                    ? "bg-amber-500 text-white font-bold"
                                    : r.rank === 2
                                    ? "bg-slate-500 text-white font-bold"
                                    : r.rank === 3
                                    ? "bg-amber-700 text-white font-bold"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {r.rank}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-900">{r.student_name}</td>
                            <td className="px-4 py-3 text-slate-600 font-mono font-medium">{r.roll}</td>
                            <td className="px-4 py-3 text-center font-black text-amber-700 text-sm">
                              {r.obtained_marks} / {selectedExam.total_marks}
                            </td>
                            <td className="px-4 py-3 text-center font-extrabold text-slate-800">
                              {r.grade || "-"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  pass
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                    : "bg-rose-100 text-rose-800 border border-rose-300"
                                }`}
                              >
                                {pass ? "উত্তীর্ণ" : "অনুত্তীর্ণ"}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50 rounded-b-3xl shrink-0">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-300"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>প্রিন্ট / ডাউনলোড</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedExam(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
