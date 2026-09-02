"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { 
  GraduationCap, User, Mail, Phone, Calendar, BookOpen, 
  Clock, CheckCircle, XCircle, AlertCircle, Award, DollarSign, 
  LogOut, ChevronRight, Sparkles, School, MapPin, Copy, ExternalLink, ShieldCheck
} from "lucide-react"
import Link from "next/link"

export default function StudentProfilePage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [studentData, setStudentData] = useState<any>(null)
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [dues, setDues] = useState<any[]>([])
  const [examResults, setExamResults] = useState<any[]>([])
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<"batches" | "attendance" | "payments" | "exams">("batches")
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadStudentProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push("/login")
          return
        }

        // 1. Fetch user_profile
        let { data: userProf } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("auth_user_id", user.id)
          .maybeSingle()

        if (!userProf && user.email) {
          const { data: byEmail } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("email", user.email)
            .maybeSingle()
          userProf = byEmail
        }

        // Fallback user profile info from auth user
        const currentProfile = userProf || {
          user_id: user.user_metadata?.user_id || "MS-" + user.id.slice(0, 5).toUpperCase(),
          name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Student",
          email: user.email,
          phone: user.user_metadata?.phone || "",
        }
        setProfile(currentProfile)

        // 2. Fetch linked student record if available
        let studentRecord = null
        if (currentProfile.email || currentProfile.user_id) {
          const { data: sData } = await supabase
            .from("students")
            .select("*")
            .or(`email.eq.${currentProfile.email},student_id.eq.${currentProfile.user_id}`)
            .maybeSingle()
          studentRecord = sData
        }
        setStudentData(studentRecord)

        // If student record exists, load enrollments, attendance, payments, exam results
        if (studentRecord?.id) {
          const studentId = studentRecord.id

          const [enrRes, attRes, pmtRes, dueRes, examRes] = await Promise.all([
            supabase
              .from("enrollments")
              .select("*, batch:batches(*, teacher:staff(name), room:rooms(name))")
              .eq("student_id", studentId),
            supabase
              .from("attendance")
              .select("*, batch:batches(name, subject)")
              .eq("student_id", studentId)
              .order("date", { ascending: false })
              .limit(30),
            supabase
              .from("payments")
              .select("*, batch:batches(name)")
              .eq("student_id", studentId)
              .order("paid_at", { ascending: false })
              .limit(20),
            supabase
              .from("fee_dues")
              .select("*, batch:batches(name)")
              .eq("student_id", studentId)
              .in("status", ["pending", "partial"])
              .order("created_at", { ascending: false }),
            supabase
              .from("exam_results")
              .select("*, exam:exams(title, exam_date, total_marks, pass_marks, batch:batches(name))")
              .eq("student_id", studentId)
              .order("created_at", { ascending: false }),
          ])

          if (enrRes.data) setEnrollments(enrRes.data)
          if (attRes.data) setAttendance(attRes.data)
          if (pmtRes.data) setPayments(pmtRes.data)
          if (dueRes.data) setDues(dueRes.data)
          if (examRes.data) setExamResults(examRes.data)
        }
      } catch (err) {
        console.error("Failed to load student data:", err)
      } finally {
        setLoading(false)
      }
    }

    loadStudentProfile()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  function copyId() {
    if (!profile?.user_id) return
    navigator.clipboard.writeText(profile.user_id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center animate-pulse">
          <GraduationCap className="w-6 h-6 text-white" />
        </div>
        <p className="text-gray-600 font-medium">Loading your student profile...</p>
      </div>
    )
  }

  // Attendance stats
  const totalClasses = attendance.length
  const presentClasses = attendance.filter(a => a.status === "present").length
  const attendanceRate = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 100

  // Total pending dues
  const totalPendingDue = dues.reduce((acc, d) => acc + (Number(d.due_amount || 0) - Number(d.paid_amount || 0)), 0)

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold text-gray-900 tracking-tight">Medha<span className="text-indigo-600">Shiri</span></span>
              <span className="ml-2 text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 font-semibold rounded-full border border-indigo-100">Student Portal</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link 
              href="/marketplace" 
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-sm font-semibold transition-colors">
              <BookOpen className="w-4 h-4" /> Browse Courses
            </Link>
            <Link 
              href="/enroll" 
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:opacity-95 rounded-xl text-sm font-semibold shadow-sm transition-all">
              Enroll in Batch
            </Link>
            <button 
              onClick={handleSignOut} 
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors" 
              title="Sign Out">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Profile Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-0 right-1/4 w-48 h-48 bg-violet-400/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-400 to-violet-400 rounded-2xl flex items-center justify-center text-3xl font-extrabold text-white shadow-lg border-2 border-white/20">
                {profile?.name ? profile.name.charAt(0).toUpperCase() : "S"}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-bold">{profile?.name || "Student"}</h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-semibold rounded-full">
                    <ShieldCheck className="w-3.5 h-3.5" /> Active Student
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-indigo-200 text-sm">
                  <span className="font-mono bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/10 font-bold tracking-wider text-white">
                    {profile?.user_id || "N/A"}
                  </span>
                  <button 
                    onClick={copyId} 
                    className="p-1 hover:bg-white/10 rounded transition-colors" 
                    title="Copy Student ID">
                    {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-indigo-200" />}
                  </button>
                </div>

                <div className="flex items-center gap-4 text-xs sm:text-sm text-indigo-200/80 pt-1 flex-wrap">
                  {profile?.email && (
                    <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {profile.email}</span>
                  )}
                  {profile?.phone && (
                    <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {profile.phone}</span>
                  )}
                  {studentData?.class_level && (
                    <span className="flex items-center gap-1.5"><School className="w-3.5 h-3.5" /> Class: {studentData.class_level}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex sm:flex-col items-center sm:items-end gap-2 w-full sm:w-auto justify-between border-t sm:border-t-0 border-white/10 pt-4 sm:pt-0">
              <span className="text-xs text-indigo-200">Registered Coaching ID</span>
              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/15 text-center">
                <p className="text-xs text-indigo-300">MedhaShiree ID</p>
                <p className="text-lg font-mono font-bold text-white">{profile?.user_id}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-gray-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Enrolled Batches</span>
              <BookOpen className="w-5 h-5 text-indigo-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-gray-900">{enrollments.length}</p>
            <p className="text-xs text-gray-500">Active subjects &amp; classes</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-gray-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Attendance</span>
              <Clock className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600">{attendanceRate}%</p>
            <p className="text-xs text-gray-500">{presentClasses} of {totalClasses} classes attended</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-gray-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Pending Dues</span>
              <DollarSign className="w-5 h-5 text-amber-600" />
            </div>
            <p className={`text-2xl sm:text-3xl font-extrabold ${totalPendingDue > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              {formatCurrency(totalPendingDue)}
            </p>
            <p className="text-xs text-gray-500">{dues.length > 0 ? `${dues.length} pending months` : "All fees clear"}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-gray-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Exams Taken</span>
              <Award className="w-5 h-5 text-violet-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-violet-600">{examResults.length}</p>
            <p className="text-xs text-gray-500">Results published</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-gray-200 overflow-x-auto pb-2">
          {[
            { id: "batches", label: `My Batches (${enrollments.length})`, icon: BookOpen },
            { id: "attendance", label: `Attendance (${attendance.length})`, icon: Clock },
            { id: "payments", label: `Fees & Payments (${payments.length})`, icon: DollarSign },
            { id: "exams", label: `Exam Results (${examResults.length})`, icon: Award },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                  : "bg-white text-gray-600 hover:text-gray-900 border border-gray-200/80 hover:border-gray-300"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        {/* 1. Batches Tab */}
        {activeTab === "batches" && (
          <div className="space-y-4">
            {enrollments.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-4">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
                  <BookOpen className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">No Batches Enrolled Yet</h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto">
                  You are registered with ID <span className="font-semibold text-indigo-600">{profile?.user_id}</span>. Contact the coaching reception or enroll directly into an active batch!
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Link href="/enroll" className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl text-sm hover:bg-indigo-700 transition-colors shadow-sm">
                    Enroll Now
                  </Link>
                  <Link href="/#batches" className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors">
                    View Available Batches
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {enrollments.map((enr, i) => {
                  const b = enr.batch
                  return (
                    <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-700 font-semibold rounded-lg border border-indigo-100">
                            {b?.subject || "Subject"}
                          </span>
                          <h3 className="text-lg font-bold text-gray-900 mt-2">{b?.name || "Batch Name"}</h3>
                        </div>
                        <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 font-semibold rounded-full border border-emerald-200">
                          {enr.status || "Active"}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm text-gray-600 border-t border-gray-100 pt-3">
                        {b?.teacher?.name && (
                          <p className="flex items-center gap-2"><User className="w-4 h-4 text-gray-400" /> Teacher: <span className="font-medium text-gray-900">{b.teacher.name}</span></p>
                        )}
                        {b?.schedule && (
                          <p className="flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" /> Schedule: <span className="font-medium text-gray-900">{b.schedule}</span></p>
                        )}
                        {b?.room?.name && (
                          <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" /> Room: <span className="font-medium text-gray-900">{b.room.name}</span></p>
                        )}
                        {b?.monthly_fee != null && (
                          <p className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-gray-400" /> Fee: <span className="font-medium text-gray-900">{formatCurrency(b.monthly_fee)}/mo</span></p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 2. Attendance Tab */}
        {activeTab === "attendance" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Attendance Log</h3>
                <p className="text-xs text-gray-500 mt-0.5">Recent 30 class attendance records</p>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
                  Rate: {attendanceRate}%
                </span>
              </div>
            </div>

            {attendance.length === 0 ? (
              <div className="p-12 text-center text-gray-500 text-sm">
                No attendance records recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-gray-500 text-xs uppercase font-semibold border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-3.5">Date</th>
                      <th className="px-6 py-3.5">Batch / Subject</th>
                      <th className="px-6 py-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {attendance.map((att, i) => (
                      <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">{formatDate(att.date)}</td>
                        <td className="px-6 py-4 text-gray-600">{att.batch?.name || att.batch?.subject || "General Class"}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            att.status === "present"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : att.status === "late"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}>
                            {att.status === "present" && <CheckCircle className="w-3.5 h-3.5" />}
                            {att.status === "absent" && <XCircle className="w-3.5 h-3.5" />}
                            {att.status.charAt(0).toUpperCase() + att.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 3. Payments Tab */}
        {activeTab === "payments" && (
          <div className="space-y-6">
            {dues.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-amber-800 font-bold">
                  <AlertCircle className="w-5 h-5" /> Pending Fee Dues
                </div>
                <div className="divide-y divide-amber-200/60 text-sm">
                  {dues.map((d, i) => (
                    <div key={i} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{d.batch?.name || "Batch Fee"} - {d.month} {d.year}</p>
                        <p className="text-xs text-gray-500">Status: {d.status}</p>
                      </div>
                      <p className="font-bold text-amber-700">{formatCurrency(Number(d.due_amount) - Number(d.paid_amount || 0))}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900">Payment History</h3>
                <p className="text-xs text-gray-500 mt-0.5">Recent fee transactions &amp; receipts</p>
              </div>

              {payments.length === 0 ? (
                <div className="p-12 text-center text-gray-500 text-sm">
                  No payment records found yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-gray-500 text-xs uppercase font-semibold border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-3.5">Date</th>
                        <th className="px-6 py-3.5">Batch / Purpose</th>
                        <th className="px-6 py-3.5">Method</th>
                        <th className="px-6 py-3.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {payments.map((p, i) => (
                        <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-900">{formatDate(p.paid_at)}</td>
                          <td className="px-6 py-4 text-gray-600">{p.batch?.name || p.month_for || "Tuition Fee"}</td>
                          <td className="px-6 py-4 text-xs font-mono text-gray-500 uppercase">{p.payment_method || "Cash"}</td>
                          <td className="px-6 py-4 text-right font-bold text-emerald-600">{formatCurrency(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. Exams Tab */}
        {activeTab === "exams" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Exam Results</h3>
              <p className="text-xs text-gray-500 mt-0.5">Scorecards and performance reviews</p>
            </div>

            {examResults.length === 0 ? (
              <div className="p-12 text-center text-gray-500 text-sm">
                No exam results published yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-gray-500 text-xs uppercase font-semibold border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-3.5">Exam Title</th>
                      <th className="px-6 py-3.5">Date</th>
                      <th className="px-6 py-3.5">Marks Obtained</th>
                      <th className="px-6 py-3.5 text-right">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {examResults.map((res, i) => {
                      const total = res.exam?.total_marks || 100
                      const obtained = res.marks_obtained || 0
                      const percentage = Math.round((obtained / total) * 100)
                      return (
                        <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-bold text-gray-900">{res.exam?.title || "Exam"}</p>
                            <p className="text-xs text-gray-500">{res.exam?.batch?.name}</p>
                          </td>
                          <td className="px-6 py-4 text-gray-600">{formatDate(res.exam?.exam_date || res.created_at)}</td>
                          <td className="px-6 py-4 font-mono font-semibold text-gray-900">
                            {obtained} / {total} ({percentage}%)
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-bold rounded-lg border border-indigo-100 text-xs">
                              {res.grade || (percentage >= 80 ? "A+" : percentage >= 70 ? "A" : percentage >= 60 ? "A-" : percentage >= 50 ? "B" : "Pass")}
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
        )}
      </main>
    </div>
  )
}