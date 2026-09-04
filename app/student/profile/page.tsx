"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { 
  User, Mail, Phone, BookOpen, 
  Clock, CheckCircle, AlertCircle, Award, DollarSign, 
  ChevronRight, MapPin, Copy, ShieldCheck, Lock, Save, Loader2, Eye, EyeOff, Pencil,
  X, Hash, Send, CheckCircle2, GraduationCap
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export default function StudentProfilePage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [studentData, setStudentData] = useState<any>(null)
  const [enrollments, setEnrollments] = useState<any[]>([])
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
  const [submittingPayment, setSubmittingPayment] = useState(false)
  const [paymentAccounts, setPaymentAccounts] = useState<any[]>([])
  const [copiedNum, setCopiedNum] = useState<string | null>(null)

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
        let userProf: any = null
        const { data: byId } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("auth_user_id", user.id)
          .maybeSingle()
        userProf = byId

        if (!userProf && user.email) {
          const { data: byEmail } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("email", user.email)
            .maybeSingle()
          userProf = byEmail
        }

        const currentProfile = userProf || {
          user_id: user.user_metadata?.user_id || "MS-" + user.id.slice(0, 5).toUpperCase(),
          name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Student",
          email: user.email,
          phone: user.user_metadata?.phone || "",
        }
        setProfile(currentProfile)
        setEditName(currentProfile.name || "")
        setEditPhone(currentProfile.phone || "")

        // 2. Fetch linked student record
        let studentRecord = null
        if (currentProfile.email || currentProfile.user_id) {
          const { data: sData } = await supabase
            .from("students")
            .select("*")
            .or(`email.eq.${currentProfile.email},student_id.eq.${currentProfile.user_id}`)
            .maybeSingle()
          studentRecord = sData
        }

        // Keep profile name and ID in sync with the canonical student record if found
        if (studentRecord) {
          setProfile({
            user_id: studentRecord.student_id,
            name: studentRecord.name,
            email: studentRecord.email || user.email,
            phone: studentRecord.phone || "",
          })
          setEditName(studentRecord.name || "")
          setEditPhone(studentRecord.phone || "")
        }
        setStudentData(studentRecord)

        // 3. Load enrollments and stats
        if (studentRecord?.id) {
          const sid = studentRecord.id

          const [enrRes, attRes, dueRes, examRes, pendingRes] = await Promise.all([
            supabase
              .from("enrollments")
              .select("*, batch:batches(*, teacher:staff(name), room:rooms(name))")
              .eq("student_id", sid),
            supabase
              .from("attendance")
              .select("*")
              .eq("student_id", sid),
            supabase
              .from("fee_dues")
              .select("*, batch:batches(name)")
              .eq("student_id", sid)
              .in("status", ["pending", "partial"]),
            supabase
              .from("exam_results")
              .select("*, exam:exams(title, total_marks, pass_marks)")
              .eq("student_id", sid),
            supabase
              .from("payment_submissions")
              .select("*, batch:batches(*, teacher:staff(name), room:rooms(name))")
              .eq("student_id", sid)
              .eq("status", "pending")
              .order("created_at", { ascending: false }),
          ])

          if (enrRes.data) setEnrollments(enrRes.data)
          if (attRes.data) setAttendance(attRes.data)
          if (dueRes.data) setDues(dueRes.data)
          if (examRes.data) setExamResults(examRes.data)
          if (pendingRes.data) setPendingSubmissions(pendingRes.data)

          // Fetch payment accounts for pay-due modal
          const { data: acctData } = await supabase.from('payment_accounts').select('*').eq('is_active', true)
          if (acctData) setPaymentAccounts(acctData)
        }
      } catch (err) {
        console.error("Failed to load student data:", err)
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
    if (!senderNumber.trim()) { toast.error('Enter your bKash/Nagad number'); return }
    if (!transactionId.trim()) { toast.error('Enter the transaction ID'); return }
    if (!payingDue || !studentData) return
    setSubmittingPayment(true)
    try {
      const amountDue = payingDue.due_amount - (payingDue.paid_amount || 0)
      const { error } = await supabase.from('payment_submissions').insert({
        student_id: studentData.id,
        batch_id: payingDue.batch_id,
        fee_due_id: payingDue.id,
        amount: amountDue,
        total_fee: amountDue,
        due_amount: 0,
        payment_method: payMethod,
        sender_number: senderNumber.trim(),
        transaction_id: transactionId.trim(),
        status: 'pending',
        notes: `Due payment for ${payingDue.due_month}`,
      })
      if (error) throw error
      toast.success('Payment submitted! Admin will verify and update your dues.')
      setPayingDue(null)
      setSenderNumber('')
      setTransactionId('')
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

  // Analytics
  const totalClasses = attendance.length
  const presentClasses = attendance.filter(a => a.status === "present").length
  const attendanceRate = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 100
  const totalPendingDue = dues.reduce((acc, d) => acc + (Number(d.due_amount || 0) - Number(d.paid_amount || 0)), 0)
  const avgScore = examResults.length > 0
    ? Math.round(examResults.reduce((acc, r) => {
        const total = r.exam?.total_marks || 100
        const obtained = r.marks_obtained || r.obtained_marks || 0
        return acc + (obtained / total) * 100
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <a href="#my-batches" className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-1 hover:border-indigo-300 hover:shadow-md hover:bg-indigo-50/20 transition-all group cursor-pointer block">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Enrolled Batches</span>
            <BookOpen className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-gray-900">{enrollments.length + pendingSubmissions.length}</p>
          <p className="text-xs text-gray-500">
            {pendingSubmissions.length > 0 ? `${enrollments.length} active, ${pendingSubmissions.length} pending` : "Active subjects & classes"}
          </p>
          <p className="text-xs text-indigo-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">View batches →</p>
        </a>

        <button onClick={() => setActiveModal('attendance')} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-1 hover:border-emerald-300 hover:shadow-md hover:bg-emerald-50/20 transition-all group cursor-pointer text-left w-full">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Attendance</span>
            <Clock className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600">{attendanceRate}%</p>
          <p className="text-xs text-gray-500">{presentClasses} of {totalClasses} classes attended</p>
          <p className="text-xs text-emerald-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">View details →</p>
        </button>

        <button onClick={() => setActiveModal('dues')} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-1 hover:border-amber-300 hover:shadow-md hover:bg-amber-50/20 transition-all group cursor-pointer text-left w-full">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Dues</span>
            <DollarSign className="w-5 h-5 text-amber-600" />
          </div>
          <p className={`text-2xl sm:text-3xl font-extrabold ${totalPendingDue > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            {formatCurrency(totalPendingDue)}
          </p>
          <p className="text-xs text-gray-500">{dues.length > 0 ? `${dues.length} pending months` : "All fees clear"}</p>
          <p className="text-xs text-amber-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">{dues.length > 0 ? 'Pay now →' : 'View history →'}</p>
        </button>

        <button onClick={() => setActiveModal('exams')} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-1 hover:border-violet-300 hover:shadow-md hover:bg-violet-50/20 transition-all group cursor-pointer text-left w-full">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Score</span>
            <Award className="w-5 h-5 text-violet-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-violet-600">{examResults.length > 0 ? `${avgScore}%` : "—"}</p>
          <p className="text-xs text-gray-500">{examResults.length} exams taken</p>
          <p className="text-xs text-violet-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">View results →</p>
        </button>
      </div>

      {/* My Batches */}
      <div id="my-batches" className="space-y-4 scroll-mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" /> My Batches
          </h2>
          <Link href="/#batches" className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1">
            Browse Batches <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {enrollments.length === 0 && pendingSubmissions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
              <BookOpen className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No Batches Enrolled Yet</h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              You are registered with ID <span className="font-semibold text-indigo-600">{profile?.user_id}</span>. Contact the coaching reception or visit the office to enroll into an active batch!
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link href="/#batches" className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl text-sm hover:bg-indigo-700 transition-colors shadow-sm">View Available Batches</Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pending */}
            {pendingSubmissions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wider">Pending Approval ({pendingSubmissions.length})</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingSubmissions.map((sub, i) => {
                    const b = sub.batch
                    return (
                      <div key={`pending-${i}`} className="bg-amber-50/50 rounded-2xl border-2 border-amber-200 border-dashed p-5 space-y-3">
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

            {/* Active */}
            {enrollments.length > 0 && (
              <div className="space-y-3">
                {pendingSubmissions.length > 0 && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-sm font-bold text-emerald-700 uppercase tracking-wider">Active ({enrollments.length})</h3>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {enrollments.map((enr, i) => {
                    const b = enr.batch
                    return (
                      <Link key={i} href={`/student/batch/${enr.batch_id || b?.id}`}
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
                  onClick={() => { setPayingDue(due); setActiveModal(null); setPayMethod('bkash'); setSenderNumber(''); setTransactionId('') }}
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
                  const total = r.exam?.total_marks || 100
                  const obtained = r.marks_obtained || r.obtained_marks || 0
                  const pct = Math.round((obtained / total) * 100)
                  const passed = obtained >= (r.exam?.pass_marks || 0)
                  return (
                    <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div>
                        <p className="font-semibold text-gray-900">{r.exam?.title || 'Exam'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{r.exam?.exam_date ? formatDate(r.exam.exam_date) : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-extrabold ${passed ? 'text-emerald-600' : 'text-rose-600'}`}>{pct}%</p>
                        <p className="text-xs text-gray-400">{obtained}/{total}</p>
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
              <div className="grid grid-cols-3 gap-2">
                {['bkash', 'nagad', 'rocket'].map(m => (
                  <button key={m} onClick={() => setPayMethod(m)} className={`py-2.5 px-3 rounded-xl text-sm font-semibold border-2 transition-all capitalize ${payMethod === m ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>{m}</button>
                ))}
              </div>
            </div>
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