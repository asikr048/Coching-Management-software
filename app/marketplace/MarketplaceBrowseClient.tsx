"use client"
import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils"
import {
  GraduationCap, BookOpen, Users, Clock, Calendar, Search, Filter,
  Star, ChevronRight, CheckCircle2, Phone, MessageSquare, PlayCircle,
  Sparkles, X, ArrowRight, ShieldCheck, AlertCircle
} from "lucide-react"
import { getUserEnrollments, getCachedUserEnrollments, type UserEnrollmentsState } from "@/lib/user-enrollments"

interface TeacherInfo {
  name?: string
  subject?: string
}

export interface BatchItem {
  id: string
  name: string
  subject?: string
  class_level?: string
  max_seats: number
  current_seats?: number
  monthly_fee: number
  admission_fee?: number
  schedule_days?: string
  schedule_time?: string
  description?: string
  status?: string
  teacher?: TeacherInfo | TeacherInfo[] | null
}

export interface CourseItem {
  id: string
  title: string
  description?: string
  price: number
  discount_price?: number
  status: string
  total_sales: number
  rating?: number
  rating_count?: number
  teacher?: TeacherInfo | TeacherInfo[] | null
}

function getTeacherName(t: TeacherInfo | TeacherInfo[] | null | undefined): string {
  if (!t) return "Senior Faculty"
  if (Array.isArray(t)) return t[0]?.name || "Senior Faculty"
  return t.name || "Senior Faculty"
}

function getTeacherSubject(t: TeacherInfo | TeacherInfo[] | null | undefined): string | undefined {
  if (!t) return undefined
  if (Array.isArray(t)) return t[0]?.subject
  return t.subject
}

interface Props {
  batches: BatchItem[]
  courses: CourseItem[]
  contactPhone?: string
  contactWhatsApp?: string
}

export default function MarketplaceBrowseClient({
  batches,
  courses,
  contactPhone = "01302201431",
  contactWhatsApp = "01302201431",
}: Props) {
  const [activeTab, setActiveTab] = useState<"all" | "batches" | "courses">("all")
  const [search, setSearch] = useState("")
  const [selectedSubject, setSelectedSubject] = useState("all")
  const [selectedClass, setSelectedClass] = useState("all")
  const [sortBy, setSortBy] = useState<"default" | "fee_asc" | "fee_desc" | "seats">("default")
  const [selectedCourse, setSelectedCourse] = useState<CourseItem | null>(null)
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

  useEffect(() => {
    getUserEnrollments().then(setUserEnrollments)
  }, [])

  // Extract unique subjects
  const allSubjects = useMemo(() => {
    const subs = new Set<string>()
    batches.forEach(b => { if (b.subject) subs.add(b.subject) })
    courses.forEach(c => {
      const s = getTeacherSubject(c.teacher)
      if (s) subs.add(s)
    })
    return Array.from(subs)
  }, [batches, courses])

  // Extract unique class levels
  const allClasses = useMemo(() => {
    const cls = new Set<string>()
    batches.forEach(b => { if (b.class_level) cls.add(b.class_level) })
    return Array.from(cls)
  }, [batches])

  // Filter batches
  const filteredBatches = useMemo(() => {
    let list = [...batches]
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter(b =>
        b.name.toLowerCase().includes(q) ||
        (b.subject && b.subject.toLowerCase().includes(q)) ||
        (b.class_level && b.class_level.toLowerCase().includes(q)) ||
        getTeacherName(b.teacher).toLowerCase().includes(q) ||
        (b.description && b.description.toLowerCase().includes(q))
      )
    }
    if (selectedSubject !== "all") {
      list = list.filter(b => b.subject?.toLowerCase() === selectedSubject.toLowerCase())
    }
    if (selectedClass !== "all") {
      list = list.filter(b => b.class_level?.toLowerCase() === selectedClass.toLowerCase())
    }

    if (sortBy === "fee_asc") {
      list.sort((a, b) => a.monthly_fee - b.monthly_fee)
    } else if (sortBy === "fee_desc") {
      list.sort((a, b) => b.monthly_fee - a.monthly_fee)
    } else if (sortBy === "seats") {
      list.sort((a, b) => {
        const leftA = a.max_seats - (a.current_seats || 0)
        const leftB = b.max_seats - (b.current_seats || 0)
        return leftA - leftB
      })
    }
    return list
  }, [batches, search, selectedSubject, selectedClass, sortBy])

  // Filter courses
  const filteredCourses = useMemo(() => {
    let list = [...courses]
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter(c =>
        c.title.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        getTeacherName(c.teacher).toLowerCase().includes(q)
      )
    }
    if (selectedSubject !== "all") {
      list = list.filter(c => getTeacherSubject(c.teacher)?.toLowerCase() === selectedSubject.toLowerCase() || c.title.toLowerCase().includes(selectedSubject.toLowerCase()))
    }
    if (sortBy === "fee_asc") {
      list.sort((a, b) => a.price - b.price)
    } else if (sortBy === "fee_desc") {
      list.sort((a, b) => b.price - a.price)
    }
    return list
  }, [courses, search, selectedSubject, sortBy])

  const totalResults = (activeTab === "all" ? filteredBatches.length + filteredCourses.length : activeTab === "batches" ? filteredBatches.length : filteredCourses.length)

  return (
    <div className="space-y-10 pb-16">
      {/* HERO BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 text-white p-8 md:p-12 shadow-xl shadow-indigo-950/10">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-indigo-200 border border-white/10">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Classroom Batches &amp; Online Courses
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Explore All Coaching Batches &amp; Video Courses
          </h1>
          <p className="text-indigo-200 text-base sm:text-lg leading-relaxed">
            Choose from active classroom batches with scheduled classes and attendance monitoring, or enroll in top online video courses.
          </p>
        </div>

        {/* SEARCH & FILTER CONTROLS */}
        <div className="relative z-10 mt-8 pt-6 border-t border-white/10 grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search bar */}
          <div className="md:col-span-6 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by batch name, subject, teacher..."
              className="w-full pl-11 pr-10 py-3.5 bg-white text-gray-900 placeholder:text-gray-400 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-md"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Subject filter */}
          <div className="md:col-span-3">
            <select
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
              className="w-full py-3.5 px-4 bg-white/10 backdrop-blur-md text-white border border-white/20 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 appearance-none cursor-pointer"
            >
              <option value="all" className="text-gray-900">All Subjects</option>
              {allSubjects.map(sub => (
                <option key={sub} value={sub} className="text-gray-900">{sub}</option>
              ))}
            </select>
          </div>

          {/* Class level filter */}
          <div className="md:col-span-3">
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="w-full py-3.5 px-4 bg-white/10 backdrop-blur-md text-white border border-white/20 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 appearance-none cursor-pointer"
            >
              <option value="all" className="text-gray-900">All Classes</option>
              {allClasses.map(cls => (
                <option key={cls} value={cls} className="text-gray-900">{cls}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS & SUMMARY */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        {/* Tab pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === "all"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            All Programs
            <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === "all" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"}`}>
              {filteredBatches.length + filteredCourses.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("batches")}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === "batches"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            <Users className="w-4 h-4" />
            Classroom Batches
            <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === "batches" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"}`}>
              {filteredBatches.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("courses")}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === "courses"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            <PlayCircle className="w-4 h-4" />
            Online Courses
            <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === "courses" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"}`}>
              {filteredCourses.length}
            </span>
          </button>
        </div>

        {/* Sorting options */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-gray-700">Sort by:</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-gray-800 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="default">Default</option>
            <option value="fee_asc">Fee: Low to High</option>
            <option value="fee_desc">Fee: High to Low</option>
            <option value="seats">Available Seats</option>
          </select>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: ALL BATCHES FIRST (WITH GOOD UI)                                */}
      {/* ========================================================================= */}
      {(activeTab === "all" || activeTab === "batches") && (
        <section id="batches-section" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                <Users className="w-3.5 h-3.5" /> Classroom Education
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                All Coaching Batches
              </h2>
              <p className="text-sm text-gray-500 max-w-2xl">
                Structured offline coaching with daily attendance, scheduled exams, and expert faculty mentorship.
              </p>
            </div>
            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg self-start sm:self-auto">
              Showing {filteredBatches.length} of {batches.length} batches
            </span>
          </div>

          {filteredBatches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBatches.map(batch => {
                const maxSeats = batch.max_seats || 30
                const currentSeats = batch.current_seats || 0
                const seatsLeft = Math.max(0, maxSeats - currentSeats)
                const percentFilled = Math.min(100, Math.round((currentSeats / maxSeats) * 100))
                const isFull = seatsLeft <= 0
                const isAlmostFull = seatsLeft > 0 && seatsLeft <= 5
                const isAdmissionClosed = batch.status === "admission_closed" || batch.status === "finished"
                const isBatchEnrolled = userEnrollments.enrolledBatchIds.has(batch.id)
                const isBatchPending = userEnrollments.pendingBatchIds.has(batch.id)

                return (
                  <div
                    key={batch.id}
                    className="group bg-white rounded-2xl border border-gray-200/90 hover:border-indigo-300 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-indigo-100/50 transition-all duration-300 flex flex-col"
                  >
                    {/* Top Accent Gradient Bar */}
                    <div className="h-2 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600" />

                    <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                      <div className="space-y-3">
                        {/* Tags & Seat Status */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-xs font-bold">
                              {batch.subject || "General"}
                            </span>
                            {batch.class_level && (
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold">
                                {batch.class_level}
                              </span>
                            )}
                          </div>

                          {isBatchEnrolled ? (
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Enrolled (ভর্তি সম্পন্ন)
                            </span>
                          ) : isBatchPending ? (
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              Pending Approval
                            </span>
                          ) : isAdmissionClosed ? (
                            <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200/90 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Admission Closed
                            </span>
                          ) : isFull ? (
                            <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold">
                              Batch Full
                            </span>
                          ) : isAlmostFull ? (
                            <span className="px-2.5 py-1 bg-red-50 text-red-600 border border-red-100 rounded-lg text-xs font-bold animate-pulse">
                              🔥 Only {seatsLeft} Left
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-xs font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                              Open
                            </span>
                          )}
                        </div>

                        {/* Batch Title */}
                        <Link href={`/batch/${batch.id}`}>
                          <h3 className="text-xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                            {batch.name}
                          </h3>
                        </Link>

                        {/* Teacher row */}
                        <div className="flex items-center gap-2.5 text-sm text-gray-700 pt-1">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
                            {getTeacherName(batch.teacher).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 leading-none">
                              {getTeacherName(batch.teacher)}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">Faculty Instructor</p>
                          </div>
                        </div>

                        {/* Timing & schedule */}
                        <div className="space-y-1.5 text-xs text-gray-600 pt-1">
                          {batch.schedule_days && (
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                              <span>{batch.schedule_days}</span>
                            </div>
                          )}
                          {batch.schedule_time && (
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                              <span>{batch.schedule_time}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                            <span>
                              {currentSeats} / {maxSeats} students enrolled
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Pricing & CTA */}
                      <div className="pt-4 border-t border-gray-100 space-y-3">
                        <div className="flex items-baseline justify-between">
                          <div>
                            <span className="text-2xl font-extrabold text-indigo-600">
                              {formatCurrency(batch.monthly_fee)}
                            </span>
                            <span className="text-xs text-gray-400 ml-1">/ month</span>
                          </div>
                          {batch.admission_fee && batch.admission_fee > 0 ? (
                            <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                              + {formatCurrency(batch.admission_fee)} adm.
                            </span>
                          ) : (
                            <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                              No adm fee
                            </span>
                          )}
                        </div>

                        {isBatchEnrolled ? (
                          <Link
                            href={`/student/batch/${batch.id}`}
                            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all duration-200 shadow-md shadow-emerald-200"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Go to Batch Classroom
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </Link>
                        ) : isBatchPending ? (
                          <Link
                            href="/student/profile"
                            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold transition-all duration-200 shadow-md shadow-amber-200"
                          >
                            <Clock className="w-4 h-4" />
                            Pending Approval (View Status)
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </Link>
                        ) : (
                          <Link
                            href={`/batch/${batch.id}`}
                            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-indigo-50 group-hover:bg-indigo-600 text-indigo-700 group-hover:text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm"
                          >
                            View Batch &amp; Schedule
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-gray-200 space-y-3">
              <Users className="w-12 h-12 text-gray-300 mx-auto" />
              <p className="text-base font-semibold text-gray-800">No matching batches found</p>
              <p className="text-xs text-gray-500">Try adjusting your search query or subject filters.</p>
              <button
                onClick={() => { setSearch(""); setSelectedSubject("all"); setSelectedClass("all") }}
                className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: ALL COURSES (ONLINE COURSES)                                    */}
      {/* ========================================================================= */}
      {(activeTab === "all" || activeTab === "courses") && (
        <section id="courses-section" className="space-y-6 pt-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-t border-gray-200/80 pt-8">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2.5 py-1 rounded-md">
                <PlayCircle className="w-3.5 h-3.5" /> Digital Learning
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                Online Courses &amp; Video Modules
              </h2>
              <p className="text-sm text-gray-500 max-w-2xl">
                Self-paced video courses, digital practice exams, and subject mastery series taught by top instructors.
              </p>
            </div>
            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg self-start sm:self-auto">
              Showing {filteredCourses.length} of {courses.length} courses
            </span>
          </div>

          {filteredCourses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCourses.map(course => {
                const isCourseEnrolled = userEnrollments.enrolledCourseIds.has(course.id)
                const isCoursePending = userEnrollments.pendingCourseIds.has(course.id)

                return (
                <div
                  key={course.id}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-xl hover:border-purple-300 transition-all duration-300 flex flex-col justify-between group"
                >
                  {/* Card Thumbnail / Header */}
                  <div>
                    <div className="h-44 bg-gradient-to-br from-purple-700 via-indigo-700 to-violet-800 relative flex items-center justify-center p-6 text-white overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-60" />

                      {/* Enrollment Badge */}
                      {isCourseEnrolled ? (
                        <div className="absolute top-3 left-3 z-20 flex items-center gap-1 bg-emerald-600/90 text-white backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-bold shadow-md">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Enrolled (ভর্তি সম্পন্ন)</span>
                        </div>
                      ) : isCoursePending ? (
                        <div className="absolute top-3 left-3 z-20 flex items-center gap-1 bg-amber-500/90 text-white backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-bold shadow-md">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Pending (অপেক্ষমাণ)</span>
                        </div>
                      ) : null}

                      <div className="relative z-10 flex flex-col items-center text-center space-y-2">
                        <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
                          <PlayCircle className="w-8 h-8 text-white" />
                        </div>
                        <span className="text-xs font-medium text-purple-200 tracking-wider uppercase">
                          Video Masterclass
                        </span>
                      </div>
                      {course.rating && course.rating > 0 ? (
                        <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-semibold text-amber-300">
                          <Star className="w-3.5 h-3.5 fill-amber-300" />
                          <span>{course.rating.toFixed(1)}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="p-6 space-y-3">
                      <h3 className="text-lg font-bold text-gray-900 group-hover:text-purple-700 transition-colors line-clamp-1">
                        {course.title}
                      </h3>
                      <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
                        {course.description || "Comprehensive online course including recorded video lessons, practice sheets, and mock tests."}
                      </p>

                      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-1.5">
                          <GraduationCap className="w-4 h-4 text-purple-600" />
                          <span className="font-medium text-gray-700">{getTeacherName(course.teacher)}</span>
                        </div>
                        <span className="bg-purple-50 text-purple-700 font-semibold px-2 py-0.5 rounded">
                          {course.total_sales || 0} enrolled
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pricing and Action */}
                  <div className="p-6 pt-0 space-y-3">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="text-2xl font-bold text-purple-700">
                          {formatCurrency(course.price)}
                        </span>
                        {course.discount_price && course.discount_price > 0 && (
                          <span className="text-xs text-gray-400 line-through ml-2">
                            {formatCurrency(course.discount_price)}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">Full Access</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedCourse(course)}
                        className="flex-1 py-2.5 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        Details
                      </button>
                      {isCourseEnrolled ? (
                        <Link
                          href={`/student/course/${course.id}`}
                          className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-md shadow-emerald-200"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Go to Course</span>
                        </Link>
                      ) : isCoursePending ? (
                        <Link
                          href="/student/profile"
                          className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-md shadow-amber-200"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Pending Approval</span>
                        </Link>
                      ) : (
                        <Link
                          href={`/enroll?courseId=${course.id}`}
                          className="flex-1 py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-md shadow-purple-200"
                        >
                          <span>Enroll Now</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-gray-200 space-y-3">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto" />
              <p className="text-base font-semibold text-gray-800">No matching courses found</p>
              <p className="text-xs text-gray-500">Check back soon or explore our classroom batches above.</p>
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* ADMISSION SUPPORT BANNER                                                  */}
      {/* ========================================================================= */}
      <div className="mt-12 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 sm:p-10 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Admissions Counseling &amp; Helpline
          </div>
          <h3 className="text-2xl font-bold tracking-tight text-white">
            Need Help Choosing the Right Batch?
          </h3>
          <p className="text-sm text-gray-300 max-w-xl">
            Our admissions office is available to answer all questions regarding batch timings, teachers, subjects, and seat booking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`tel:${contactPhone}`}
            className="inline-flex items-center gap-2 px-5 py-3 bg-white text-gray-900 hover:bg-gray-100 rounded-xl font-semibold text-sm transition-all shadow-md"
          >
            <Phone className="w-4 h-4 text-indigo-600" />
            Call: {contactPhone}
          </a>
          <a
            href={`https://wa.me/88${contactWhatsApp.replace(/[^0-9]/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-emerald-900/30"
          >
            <MessageSquare className="w-4 h-4" />
            WhatsApp
          </a>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COURSE DETAILS MODAL                                                      */}
      {/* ========================================================================= */}
      {selectedCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl space-y-6">
            <div className="relative h-44 bg-gradient-to-br from-indigo-700 to-purple-800 p-6 flex flex-col justify-between text-white">
              <button
                onClick={() => setSelectedCourse(null)}
                className="absolute top-4 right-4 p-2 bg-black/30 hover:bg-black/50 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
              <span className="text-xs font-semibold px-2.5 py-1 bg-white/20 rounded-full self-start backdrop-blur-sm">
                Online Course
              </span>
              <div>
                <h3 className="text-xl font-bold text-white">{selectedCourse.title}</h3>
                <p className="text-xs text-indigo-200 mt-1">Instructor: {getTeacherName(selectedCourse.teacher)}</p>
              </div>
            </div>

            <div className="p-6 pt-0 space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Course Overview</p>
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                  {selectedCourse.description || "Get unlimited access to recorded video sessions, class notes, topic-wise practice assignments, and solution discussion."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
                <div>
                  <span className="text-gray-400 block">Total Enrolled</span>
                  <span className="font-bold text-gray-900 text-sm">{selectedCourse.total_sales || 0} Students</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Course Price</span>
                  <span className="font-bold text-indigo-600 text-base">{formatCurrency(selectedCourse.price)}</span>
                </div>
              </div>

              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  Direct Online Enrollment:
                </p>
                <p className="text-indigo-700">
                  You can enroll and pay directly online via bKash, Nagad, Rocket, or Upay. Instant confirmation!
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setSelectedCourse(null)}
                  className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-colors"
                >
                  Close
                </button>
                {selectedCourse && userEnrollments.enrolledCourseIds.has(selectedCourse.id) ? (
                  <Link
                    href={`/student/course/${selectedCourse.id}`}
                    className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold text-center transition-all shadow-md shadow-emerald-200 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Enrolled • Go to Course</span>
                  </Link>
                ) : selectedCourse && userEnrollments.pendingCourseIds.has(selectedCourse.id) ? (
                  <Link
                    href="/student/profile"
                    className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold text-center transition-all shadow-md shadow-amber-200 flex items-center justify-center gap-2"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Enrollment Pending • View Status</span>
                  </Link>
                ) : (
                  <Link
                    href={`/enroll?courseId=${selectedCourse.id}`}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-sm font-bold text-center transition-all shadow-md shadow-purple-300 flex items-center justify-center gap-2"
                  >
                    <span>Enroll / Buy Course Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
