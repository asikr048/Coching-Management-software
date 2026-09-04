"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { 
  User, Mail, Phone, BookOpen, 
  Clock, CheckCircle, AlertCircle, Award, DollarSign, 
  ChevronRight, MapPin, Copy, ShieldCheck, Lock, Save, Loader2, Eye, EyeOff, Pencil,
  X, Hash, Send, CheckCircle2, GraduationCap, Video, PlayCircle, Sparkles, Users
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export default function StudentProfilePage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [studentData, setStudentData] = useState<any>(null)
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [dues, setDues] = useState<any[]>([])
  const [examResults, setExamResults] = useState<any[]>([])
  const [copied, setCopied] = useState(false)

  // Account settings
  const [editName, setEditName] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [saving, setSaving] = useState(false)

  // Password change
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  // Edit mode toggle for account settings
  const [isEditingProfile, setIsEditingProfile] = useState(false)

  // Analytics modals
  const [activeModal, setActiveModal] = useState<'attendance' | 'dues' | 'exams' | null>(null)
  // Pay due from profile
  const [payingDue, setPayingDue] = useState<any>(null)
  const [payMethod, setPayMethod] = useState('bkash')
  const [senderNumber, setSenderNumber] = useState('')
  const [transactionId, setTransactionId] = useState('')
  const [referralName, setReferralName] = useState('')
  const [referralReason, setReferralReason] = useState('')
  const [submittingPayment, setSubmittingPayment] = useState(false)
  const [paymentAccounts, setPaymentAccounts] = useState<any[]>([])
  const [copiedNum, setCopiedNum] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadStudentProfile() {
      try {
        setLoading(true)

        // 1. Fetch complete student profile data from server API (immune to client-side RLS)
        const res = await fetch("/api/student/profile")
        if (res.ok) {
          const data = await res.json()
          if (data.profile) {
            setProfile(data.profile)
            setEditName(data.profile.name || "")
            setEditPhone(data.profile.phone || "")
          }
          if (data.student) setStudentData(data.student)
          if (data.enrollments) setEnrollments(data.enrollments)
          if (data.courses) setCourses(data.courses)
          if (data.pendingSubmissions) setPendingSubmissions(data.pendingSubmissions)
          if (data.attendance) setAttendance(data.attendance)
          if (data.dues) setDues(data.dues)
          if (data.examResults) setExamResults(data.examResults)
        } else if (res.status === 401) {
          router.push("/login")
          return
        } else {
          // Fallback client query
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) {
            router.push("/login")
            return
          }

          const { data: byId } = await supabase.from("user_profiles").select("*").eq("auth_user_id", user.id).maybeSingle()
          const currentProfile = byId || {
            user_id: user.user_metadata?.user_id || "MS-" + user.id.slice(0, 5).toUpperCase(),
            name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Student",
            email: user.email,
            phone: user.user_metadata?.phone || "",
          }
          setProfile(currentProfile)
          setEditName(currentProfile.name || "")
          setEditPhone(currentProfile.phone || "")

          let studentRecord = null
          if (currentProfile.user_id) {
            const { data: sByCode } = await supabase.from("students").select("*").eq("student_id", currentProfile.user_id).maybeSingle()
            if (sByCode) studentRecord = sByCode
          }
          if (!studentRecord && currentProfile.email) {
            const { data: sByEmail } = await supabase.from("students").select("*").ilike("email", currentProfile.email).maybeSingle()
            if (sByEmail) studentRecord = sByEmail
          }
          if (studentRecord) setStudentData(studentRecord)
        }

        // Fetch payment accounts for pay-due modal
        const { data: acctData } = await supabase.from("payment_accounts").select("*").eq("is_active", true)
        if (acctData) setPaymentAccounts(acctData)
      } catch (err) {
        console.error("Failed to load student profile data:", err)
      } finally {
        setLoading(false)
      }
    }

    loadStudentProfile()
  }, [])

  function copyId() {
    if (!profile?.user_id) return
    navigator.clipboard.writeText(profile.user_id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSaveProfile() {
    if (!editName.trim()) { toast.error("Name is required"); return }
    setSaving(true)
    try {
      if (profile?.id) {
        await supabase.from("user_profiles").update({
          name: editName.trim(),
          phone: editPhone.trim(),
        }).eq("id", profile.id)
      }
      if (studentData?.id) {
        await supabase.from("students").update({
          name: editName.trim(),
          phone: editPhone.trim() || null,
        }).eq("id", studentData.id)
      }
      setProfile((p: any) => ({ ...p, name: editName.trim(), phone: editPhone.trim() }))
      toast.success("Profile updated successfully!")
      setIsEditingProfile(false)
    } catch (err) {
      toast.error("Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return }
    setChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast.success("Password changed successfully!")
      setNewPassword("")
      setConfirmPassword("")
      setShowPasswordSection(false)
    } catch (err: any) {
      toast.error(err?.message || "Failed to change password")
    } finally {
      setChangingPassword(false)
    }
  }

  function copyNumber(num: string) {
    navigator.clipboard.writeText(num)
    setCopiedNum(num)
    setTimeout(() => setCopiedNum(null), 2000)
  }

  async function handlePayDue() {
    if (payMethod === 'referral') {
      if (!referralName.trim()) { toast.error('Enter referral student name or ID'); return }
      if (!referralReason.trim()) { toast.error('Enter reason for referral payment'); return }
    } else {
      if (!senderNumber.trim()) { toast.error('Enter your bKash/Nagad number'); return }
      if (!transactionId.trim()) { toast.error('Enter the transaction ID'); return }
    }
    if (!payingDue || !studentData) return
    setSubmittingPayment(true)
    try {
      const amountDue = payingDue.due_amount - (payingDue.paid_amount || 0)
      const isRef = payMethod === 'referral'
      const { error } = await supabase.from('payment_submissions').insert({
        student_id: studentData.id,
        batch_id: payingDue.batch_id,
        fee_due_id: payingDue.id,
        amount: amountDue,
        total_fee: amountDue,
        due_amount: 0,
        payment_method: payMethod,
        sender_number: isRef ? referralName.trim() : senderNumber.trim(),
        transaction_id: isRef ? `REF-${Date.now().toString(36).toUpperCase()}` : transactionId.trim(),
        status: 'pending',
        notes: isRef 
          ? `Referral: ${referralName.trim()} | Reason: ${referralReason.trim()} (Due for ${payingDue.due_month || 'Fee'})`
          : `Due payment for ${payingDue.due_month}`,
      })
      if (error) throw error
      toast.success(isRef ? 'Referral payment submitted! Admin will verify and approve.' : 'Payment submitted! Admin will verify and update your dues.')
      setPayingDue(null)
      setSenderNumber('')
      setTransactionId('')
      setReferralName('')
      setReferralReason('')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit payment')
    } finally {
      setSubmittingPayment(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-gray-500 font-medium">Loading your profile...</p>
      </div>
    )
  }

  // Segregate pending submissions
  const pendingBatchSubmissions = pendingSubmissions.filter(s => s.batch_id || s.item_type !== "course")
  const pendingCourseSubmissions = pendingSubmissions.filter(s => s.course_id || s.item_type === "course")

  // Analytics
  const totalClasses = attendance.length
  const presentClasses = attendance.filter(a => a.status === "present").length
  const attendanceRate = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 100
  const totalPendingDue = dues.reduce((acc, d) => acc + (Number(d.due_amount || 0) - Number(d.paid_amount || 0)), 0)
  const avgScore = examResults.length > 0
    ? Math.round(examResults.reduce((acc, r) => {
        const total = Number(r.exam?.total_marks) || 100
        const rawObt = r.obtained_marks ?? r.marks_obtained
        const obtained = rawObt != null && rawObt !== "" ? Number(rawObt) : 0
        return acc + (total > 0 ? (obtained / total) * 100 : 0)
      }, 0) / examResults.length)
    : 0

  const inputClass = "w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"

  return (
    <>
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
                <button onClick={copyId} className="p-1 hover:bg-white/10 rounded transition-colors" title="Copy Student ID">
                  {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-indigo-200" />}
                </button>
              </div>
              <div className="flex items-center gap-4 text-xs sm:text-sm text-indigo-200/80 pt-1 flex-wrap">
                {profile?.email && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {profile.email}</span>}
                {profile?.phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {profile.phone}</span>}
              </div>
            </div>
          </div>
          <div className="hidden sm:block bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/15 text-center">
            <p className="text-xs text-indigo-300">MedhaShiree ID</p>
            <p className="text-lg font-mono font-bold text-white">{profile?.user_id}</p>
          </div>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        <a href="#my-batches" className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm space-y-1 hover:border-indigo-300 hover:shadow-md hover:bg-indigo-50/20 transition-all group cursor-pointer block">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Batches</span>
            <BookOpen className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-gray-900">{enrollments.length + pendingBatchSubmissions.length}</p>
          <p className="text-xs text-gray-500">
            {pendingBatchSubmissions.length > 0 ? `${enrollments.length} active, ${pendingBatchSubmissions.length} pending` : "Classroom batches"}
          </p>
          <p className="text-xs text-indigo-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">View batches →</p>
        </a>

        <a href="#my-courses" className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm space-y-1 hover:border-purple-300 hover:shadow-md hover:bg-purple-50/20 transition-all group cursor-pointer block">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Online Courses</span>
            <Video className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-purple-600">{courses.length + pendingCourseSubmissions.length}</p>
          <p className="text-xs text-gray-500">
            {pendingCourseSubmissions.length > 0 ? `${courses.length} active, ${pendingCourseSubmissions.length} pending` : "Video courses & materials"}
          </p>
          <p className="text-xs text-purple-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">View courses →</p>
        </a>

        <button onClick={() => setActiveModal('attendance')} className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm space-y-1 hover:border-emerald-300 hover:shadow-md hover:bg-emerald-50/20 transition-all group cursor-pointer text-left w-full">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Attendance</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600">{attendanceRate}%</p>
          <p className="text-xs text-gray-500">{presentClasses} of {totalClasses} classes attended</p>
          <p className="text-xs text-emerald-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">View details →</p>
        </button>

        <button onClick={() => setActiveModal('dues')} className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm space-y-1 hover:border-amber-300 hover:shadow-md hover:bg-amber-50/20 transition-all group cursor-pointer text-left w-full">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Pending Dues</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <p className={`text-2xl sm:text-3xl font-extrabold ${totalPendingDue > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            {formatCurrency(totalPendingDue)}
          </p>
          <p className="text-xs text-gray-500">{dues.length > 0 ? `${dues.length} pending months` : "All fees clear"}</p>
          <p className="text-xs text-amber-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">{dues.length > 0 ? 'Pay now →' : 'View history →'}</p>
        </button>

        <button onClick={() => setActiveModal('exams')} className="col-span-2 sm:col-span-1 bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm space-y-1 hover:border-violet-300 hover:shadow-md hover:bg-violet-50/20 transition-all group cursor-pointer text-left w-full">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Avg Score</span>
            <Award className="w-4 h-4 text-violet-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-violet-600">{examResults.length > 0 ? `${avgScore}%` : "—"}</p>
          <p className="text-xs text-gray-500">{examResults.length} exams taken</p>
          <p className="text-xs text-violet-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">View results →</p>
        </button>
      </div>

      {/* 1. My Online Courses Section */}
      <div id="my-courses" className="space-y-4 scroll-mt-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">My Online Courses</h2>
              <p className="text-xs text-gray-500">Video lectures, study materials, and curriculum access</p>
            </div>
          </div>
          <Link href="/marketplace" className="text-sm text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1">
            Browse Courses <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {courses.length === 0 && pendingCourseSubmissions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-10 text-center space-y-3">
            <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto text-purple-600">
              <Video className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-gray-900">No Online Courses Enrolled Yet</h3>
            <p className="text-gray-500 text-xs sm:text-sm max-w-md mx-auto">
              Enroll in expert-led recorded video courses and study materials anytime, anywhere.
            </p>
            <div className="pt-1">
              <Link href="/marketplace" className="px-5 py-2 bg-purple-600 text-white font-semibold rounded-xl text-xs sm:text-sm hover:bg-purple-700 transition-colors inline-flex items-center gap-1.5 shadow-xs">
                <PlayCircle className="w-4 h-4" /> Explore Courses
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pending Course Submissions */}
            {pendingCourseSubmissions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs sm:text-sm font-bold text-amber-700 uppercase tracking-wider">
                    Pending Course Verification ({pendingCourseSubmissions.length})
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingCourseSubmissions.map((sub, i) => {
                    const c = sub.course
                    return (
                      <div key={`pending-course-${i}`} className="bg-amber-50/50 rounded-2xl border-2 border-amber-200 border-dashed p-5 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 font-semibold rounded-lg border border-purple-100">
                              {c?.category || "Online Course"}
                            </span>
                            <h3 className="text-base font-bold text-gray-900 mt-1.5">{c?.title || "Online Course"}</h3>
                          </div>
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 bg-amber-100 text-amber-800 font-semibold rounded-full border border-amber-300 animate-pulse">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        </div>
                        <div className="bg-amber-100/70 rounded-xl p-2.5 border border-amber-200/50">
                          <p className="text-xs text-amber-800 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-amber-600" />
                            Payment verification in progress. Access granted immediately upon approval.
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Active Purchased Courses */}
            {courses.length > 0 && (
              <div className="space-y-3">
                {pendingCourseSubmissions.length > 0 && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-xs sm:text-sm font-bold text-emerald-700 uppercase tracking-wider">
                      Enrolled Courses ({courses.length})
                    </h3>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {courses.map((item, idx) => {
                    const c = item.course || {}
                    const teacherName = c.teacher?.name || "Senior Faculty"
                    return (
                      <Link
                        key={`course-${item.course_id || idx}`}
                        href={`/student/course/${item.course_id || c.id}`}
                        className="group bg-white rounded-2xl border border-gray-200 p-5 shadow-xs hover:shadow-lg hover:border-purple-300 transition-all space-y-3 flex flex-col justify-between cursor-pointer"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-100">
                              {c.category || "Online Course"}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </span>
                          </div>

                          <div>
                            <h3 className="text-base font-bold text-gray-900 group-hover:text-purple-700 transition-colors line-clamp-2">
                              {c.title || "Online Course"}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-gray-400" /> Instructor: {teacherName}
                            </p>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                          <span className="text-gray-400">
                            {item.amount_paid ? `Paid: ${formatCurrency(item.amount_paid)}` : "Enrolled"}
                          </span>
                          <span className="text-purple-600 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                            Start Learning <PlayCircle className="w-4 h-4 ml-0.5" />
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. My Classroom Batches */}
      <div id="my-batches" className="space-y-4 scroll-mt-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">My Classroom Batches</h2>
              <p className="text-xs text-gray-500">Live offline batches, room schedules, and teachers</p>
            </div>
          </div>
          <Link href="/marketplace" className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1">
            Browse Batches <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {enrollments.length === 0 && pendingBatchSubmissions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
              <BookOpen className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No Batches Enrolled Yet</h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              You are registered with ID <span className="font-semibold text-indigo-600">{profile?.user_id}</span>. Contact the coaching reception or visit the office to enroll into an active batch!
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link href="/marketplace" className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl text-sm hover:bg-indigo-700 transition-colors shadow-sm">View Available Batches</Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pending Batches */}
            {pendingBatchSubmissions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wider">Pending Batch Approval ({pendingBatchSubmissions.length})</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingBatchSubmissions.map((sub, i) => {
                    const b = sub.batch
                    return (
                      <div key={`pending-batch-${i}`} className="bg-amber-50/50 rounded-2xl border-2 border-amber-200 border-dashed p-5 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 font-semibold rounded-lg border border-indigo-100">{b?.subject || "Subject"}</span>
                            <h3 className="text-base font-bold text-gray-900 mt-1.5">{b?.name || "Batch"}</h3>
                          </div>
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-100 text-amber-700 font-semibold rounded-full border border-amber-300 animate-pulse">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        </div>
                        <div className="bg-amber-100/70 rounded-xl p-2.5 border border-amber-200/50">
                          <p className="text-xs text-amber-700 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            Payment is being verified. Access granted once approved.
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Active Batches */}
            {enrollments.length > 0 && (
              <div className="space-y-3">
                {pendingBatchSubmissions.length > 0 && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-sm font-bold text-emerald-700 uppercase tracking-wider">Active Batches ({enrollments.length})</h3>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {enrollments.map((enr, i) => {
                    const b = enr.batch
                    const targetBatchId = enr.batch_id || b?.id
                    const batchExamList = examResults.filter((r: any) => r.exam?.batch_id === targetBatchId || r.batch_id === targetBatchId)
                    const latestExam = batchExamList.length > 0 ? batchExamList[0] : null
                    const latestTotal = Number(latestExam?.exam?.total_marks) || 100
                    const latestRaw = latestExam ? (latestExam.obtained_marks ?? latestExam.marks_obtained) : null
                    const latestObt = latestRaw != null && latestRaw !== "" ? Number(latestRaw) : 0

                    return (
                      <Link key={i} href={`/student/batch/${targetBatchId}`}
                        className="group bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all space-y-3 cursor-pointer">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 font-semibold rounded-lg border border-indigo-100">{b?.subject || "Subject"}</span>
                            <h3 className="text-base font-bold text-gray-900 mt-1.5 group-hover:text-indigo-600 transition-colors">{b?.name || "Batch"}</h3>
                          </div>
                          <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 font-semibold rounded-full border border-emerald-200">{enr.status || "Active"}</span>
                        </div>
                        <div className="space-y-1.5 text-sm text-gray-500">
                          {b?.teacher?.name && <p className="flex items-center gap-2"><User className="w-3.5 h-3.5" /> {b.teacher.name}</p>}
                          {b?.schedule && <p className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {b.schedule}</p>}
                          {b?.monthly_fee != null && <p className="flex items-center gap-2"><DollarSign className="w-3.5 h-3.5" /> {formatCurrency(b.monthly_fee)}/mo</p>}
                        </div>

                        {batchExamList.length > 0 && (
                          <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                            <span className="text-violet-700 font-semibold flex items-center gap-1.5 bg-violet-50 px-2 py-1 rounded-lg border border-violet-100">
                              <Award className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                              <span className="truncate max-w-[120px]">{latestExam?.exam?.title || "Exam"}:</span>
                              <span className="font-bold text-violet-900">{latestObt}/{latestTotal}</span>
                              {latestExam?.grade && (
                                <span className="px-1.5 py-0.2 bg-white rounded text-[10px] font-bold border border-violet-200 text-violet-800">
                                  {latestExam.grade}
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] text-gray-400 font-medium">
                              {batchExamList.length} {batchExamList.length === 1 ? "exam" : "exams"}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-end text-xs text-indigo-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity pt-1">
                          View Details <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Account Settings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Pencil className="w-5 h-5 text-indigo-600" /> Account Settings
          </h2>
          {!isEditingProfile && (
            <button
              onClick={() => { setEditName(profile?.name || ""); setEditPhone(profile?.phone || ""); setIsEditingProfile(true) }}
              className="inline-flex items-center gap-2 px-4 py-2 border border-indigo-200 text-indigo-600 font-semibold rounded-xl text-sm hover:bg-indigo-50 transition-colors"
            >
              <Pencil className="w-4 h-4" /> Edit
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
          {/* VIEW MODE */}
          {!isEditingProfile ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { label: "Full Name", value: profile?.name || "—", icon: <User className="w-4 h-4 text-gray-400" /> },
                { label: "Phone Number", value: profile?.phone || "—", icon: <Phone className="w-4 h-4 text-gray-400" /> },
                { label: "Email Address", value: profile?.email || "—", icon: <Mail className="w-4 h-4 text-gray-400" />, note: "Cannot be changed" },
                { label: "Student ID", value: profile?.user_id || "—", icon: <ShieldCheck className="w-4 h-4 text-gray-400" />, mono: true, note: "Read-only" },
              ].map(field => (
                <div key={field.label}>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{field.label}</p>
                  <div className="flex items-center gap-2.5 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
                    {field.icon}
                    <span className={`text-sm font-semibold text-gray-800 ${field.mono ? 'font-mono' : ''}`}>{field.value}</span>
                  </div>
                  {field.note && <p className="text-xs text-gray-400 mt-1">{field.note}</p>}
                </div>
              ))}
            </div>
          ) : (
            /* EDIT MODE */
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input value={editName} onChange={e => setEditName(e.target.value)} className={`${inputClass} pl-10`} placeholder="Your name" autoFocus />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input value={editPhone} onChange={e => setEditPhone(e.target.value)} className={`${inputClass} pl-10`} placeholder="01XXXXXXXXX" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input value={profile?.email || ""} disabled className={`${inputClass} pl-10 bg-gray-50 text-gray-500 cursor-not-allowed`} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Email is linked to your login and cannot be changed here.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Student ID</label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input value={profile?.user_id || ""} disabled className={`${inputClass} pl-10 bg-gray-50 text-gray-500 cursor-not-allowed font-mono`} />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
                <button onClick={handleSaveProfile} disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
                </button>
                <button onClick={() => setIsEditingProfile(false)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* Change Password — always visible */}
          <div className="border-t border-gray-100 pt-4">
            <button onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors">
              <Lock className="w-4 h-4" /> {showPasswordSection ? "Cancel" : "Change Password"}
            </button>
          </div>

          {showPasswordSection && (
            <div className="border-t border-gray-100 pt-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Lock className="w-4 h-4 text-indigo-600" /> Change Password</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type={showPassword ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)} className={`${inputClass} pl-10 pr-10`} placeholder="Min 6 characters" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={`${inputClass} pl-10`} placeholder="Confirm new password" />
                  </div>
                </div>
              </div>
              <button onClick={handleChangePassword} disabled={changingPassword}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white font-semibold rounded-xl text-sm hover:bg-violet-700 transition-colors disabled:opacity-50 shadow-sm">
                {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Update Password
              </button>
            </div>
          )}
        </div>
      </div>
    </main>

    {/* Attendance Modal */}
    {activeModal === 'attendance' && (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setActiveModal(null)}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Attendance Overview</h2>
            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
          </div>
          <div className="p-6 overflow-y-auto">
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Present', count: attendance.filter(a => a.status === 'present').length, color: 'bg-emerald-100 text-emerald-700' },
                { label: 'Absent', count: attendance.filter(a => a.status === 'absent').length, color: 'bg-rose-100 text-rose-700' },
                { label: 'Late', count: attendance.filter(a => a.status === 'late').length, color: 'bg-amber-100 text-amber-700' },
              ].map(s => (
                <div key={s.label} className={`rounded-2xl p-4 text-center ${s.color}`}>
                  <p className="text-2xl font-extrabold">{s.count}</p>
                  <p className="text-xs font-semibold mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            {attendance.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {attendance.slice(0, 30).map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                    <span className="text-gray-600">{formatDate(a.date)}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${a.status === 'present' ? 'bg-emerald-100 text-emerald-700' : a.status === 'absent' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{a.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-400 py-8">No attendance records yet.</p>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Dues Modal */}
    {activeModal === 'dues' && (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setActiveModal(null)}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-amber-500" /> Pending Dues</h2>
            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
          </div>
          <div className="p-6 overflow-y-auto space-y-3">
            {dues.length > 0 ? dues.map((due: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-4 bg-rose-50 border border-rose-100 rounded-xl gap-4">
                <div>
                  <p className="font-semibold text-gray-900">{due.due_month ? new Date(due.due_month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'Unknown'}</p>
                  <p className="text-sm text-rose-600 font-bold mt-0.5">{formatCurrency(due.due_amount - (due.paid_amount || 0))} due</p>
                </div>
                <button
                  onClick={() => { setPayingDue(due); setActiveModal(null); setPayMethod('bkash'); setSenderNumber(''); setTransactionId(''); setReferralName(''); setReferralReason('') }}
                  className="flex-shrink-0 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  Pay Now
                </button>
              </div>
            )) : (
              <div className="text-center py-10">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="font-semibold text-emerald-700">All fees are clear!</p>
                <p className="text-sm text-gray-400 mt-1">No pending dues at the moment.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Exam Results Modal */}
    {activeModal === 'exams' && (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setActiveModal(null)}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><GraduationCap className="w-5 h-5 text-violet-500" /> Exam Results</h2>
            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
          </div>
          <div className="p-6 overflow-y-auto">
            {examResults.length > 0 ? (
              <div className="space-y-3">
                {examResults.map((r: any, i: number) => {
                  const total = Number(r.exam?.total_marks) || 100
                  const rawObt = r.obtained_marks ?? r.marks_obtained
                  const obtained = rawObt != null && rawObt !== "" ? Number(rawObt) : 0
                  const pct = total > 0 ? Math.round((obtained / total) * 100) : 0
                  const passed = obtained >= (Number(r.exam?.pass_marks) || 0)
                  const isPublic = r.exam?.show_all_results !== false && !r.exam?.result_note?.includes('[SHOW_ALL_RESULTS:false]')

                  return (
                    <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{r.exam?.title || 'Exam'}</p>
                          {r.exam?.subject && (
                            <span className="text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-semibold border border-indigo-100">
                              {r.exam.subject}
                            </span>
                          )}
                          {isPublic ? (
                            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              Batch Merit List Public
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              Private (Only You)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-1 flex-wrap">
                          {r.exam?.exam_date && <span>{formatDate(r.exam.exam_date)}</span>}
                          {r.rank && <span className="text-amber-600 font-semibold">• Rank #{r.rank}</span>}
                          {r.exam?.batch_id && (
                            <Link
                              href={`/student/batch/${r.exam.batch_id}`}
                              className="text-indigo-600 hover:text-indigo-700 font-semibold inline-flex items-center gap-0.5 hover:underline"
                            >
                              Go to Batch Page →
                            </Link>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-center">
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className={`text-xl font-extrabold ${passed ? 'text-emerald-600' : 'text-rose-600'}`}>{pct}%</span>
                            {r.grade && (
                              <span className="px-2 py-0.5 text-xs font-bold bg-white border border-gray-200 rounded-md text-gray-800 shadow-xs">
                                {r.grade}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{obtained} / {total}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-center text-gray-400 py-10">No exam results recorded yet.</p>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Pay Due Modal */}
    {payingDue && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Pay Due</h2>
                <p className="text-indigo-200 text-sm mt-0.5">{payingDue.due_month ? new Date(payingDue.due_month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'Fee Payment'}</p>
              </div>
              <button onClick={() => setPayingDue(null)} className="p-2 hover:bg-white/20 rounded-xl transition-colors"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 bg-white/10 rounded-2xl p-4 border border-white/20">
              <p className="text-xs text-indigo-200 uppercase tracking-wider font-semibold">Amount to Pay</p>
              <p className="text-3xl font-extrabold mt-1">{formatCurrency(payingDue.due_amount - (payingDue.paid_amount || 0))}</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Payment Method</label>
              <div className="grid grid-cols-4 gap-2">
                {['bkash', 'nagad', 'rocket', 'referral'].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPayMethod(m)}
                    className={`py-2 px-1.5 rounded-xl text-xs font-bold border-2 transition-all capitalize ${
                      payMethod === m
                        ? m === 'referral'
                          ? 'border-purple-600 bg-purple-50 text-purple-700'
                          : 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {m === 'referral' ? '🎁 Referral' : m}
                  </button>
                ))}
              </div>
            </div>

            {payMethod === 'referral' ? (
              <div className="space-y-3">
                <div className="bg-purple-50 rounded-2xl p-3.5 border border-purple-200">
                  <p className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-purple-600" /> Pay Due via Referral / Waiver
                  </p>
                  <p className="text-xs text-purple-700 mt-1 leading-relaxed">
                    Mention the student name or ID who referred you, and the reason. Admin will verify before approving your payment.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Referral Student Name / ID *</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-500" />
                    <input
                      value={referralName}
                      onChange={e => setReferralName(e.target.value)}
                      placeholder="e.g. SF (MS-98420) or Referrer Name"
                      className="w-full pl-10 pr-4 py-2.5 border border-purple-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-purple-50/20"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Reason / Note *</label>
                  <input
                    value={referralReason}
                    onChange={e => setReferralReason(e.target.value)}
                    placeholder="e.g. Friend referral discount / mutual admission"
                    className="w-full px-4 py-2.5 border border-purple-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-purple-50/20"
                  />
                </div>
              </div>
            ) : (
              <>
                {(() => {
                  const account = paymentAccounts.find((a: any) => a.method?.toLowerCase() === payMethod || a.type?.toLowerCase() === payMethod)
                  const num = account?.number || account?.account_number || null
                  return num ? (
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Send to this {payMethod} number</p>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xl font-mono font-bold text-slate-900">{num}</p>
                        <button onClick={() => copyNumber(num)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50">
                          {copiedNum === num ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedNum === num ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 rounded-2xl p-3 border border-amber-200">
                      <p className="text-sm text-amber-700 flex items-center gap-2"><AlertCircle className="h-4 w-4 flex-shrink-0" /> Contact admin for the {payMethod} payment number.</p>
                    </div>
                  )
                })()}
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input value={senderNumber} onChange={e => setSenderNumber(e.target.value)} placeholder={`Your ${payMethod} number`} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="relative">
                  <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input value={transactionId} onChange={e => setTransactionId(e.target.value)} placeholder="Transaction ID (TrxID)" className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </>
            )}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setPayingDue(null)} className="flex-1 py-3 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 text-sm">Cancel</button>
              <button onClick={handlePayDue} disabled={submittingPayment} className="flex-1 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {submittingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit Payment
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  )
}