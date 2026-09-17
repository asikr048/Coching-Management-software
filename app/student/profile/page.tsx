"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { 
  User, Mail, Phone, BookOpen, 
  Clock, CheckCircle, AlertCircle, Award, DollarSign, 
  ChevronRight, MapPin, Copy, ShieldCheck, Lock, Save, Loader2, Eye, EyeOff, Pencil,
  X, Hash, Send, CheckCircle2, GraduationCap, Video, PlayCircle, Sparkles, Users,
  Calendar, Package, Layers, FileText, CalendarDays, Trophy
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { getExamMarksConfig } from "@/app/student/batch/[id]/page"
import StudentIdCardTrigger from "@/components/id-card/StudentIdCardTrigger"
import AdmissionSlipTrigger from "@/components/id-card/AdmissionSlipTrigger"

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
  const [batchExams, setBatchExams] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [materialIssues, setMaterialIssues] = useState<any[]>([])
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
  const [activeModal, setActiveModal] = useState<'attendance' | 'dues' | 'exams' | 'materials' | null>(null)
  const [examFilter, setExamFilter] = useState<'all' | 'upcoming' | 'results'>('all')
  const [materialFilter, setMaterialFilter] = useState<'all' | 'received' | 'pending'>('all')
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
    // 0. Instantly load from user-specific cache if available
    try {
      const cachedStr = sessionStorage.getItem("ms_student_profile_cache")
      if (cachedStr) {
        const cached = JSON.parse(cachedStr)
        if (cached?.profile?.user_id) {
          setProfile(cached.profile)
          setEditName(cached.profile.name || "")
          setEditPhone(cached.profile.phone || "")
          if (cached.student) setStudentData(cached.student)
          setEnrollments(cached.enrollments || [])
          setCourses(cached.courses || [])
          setPendingSubmissions(cached.pendingSubmissions || [])
          setAttendance(cached.attendance || [])
          setDues(cached.dues || [])
          setExamResults(cached.examResults || [])
          if (cached.batchExams) setBatchExams(cached.batchExams)
          if (cached.materials) setMaterials(cached.materials)
          if (cached.materialIssues) setMaterialIssues(cached.materialIssues)
          if (cached.paymentAccounts) setPaymentAccounts(cached.paymentAccounts)
          setLoading(false)
        }
      }
    } catch {}

    async function loadStudentProfile() {
      try {
        const res = await fetch("/api/student/profile", { cache: "no-store", headers: { "Cache-Control": "no-cache" } })
        if (res.ok) {
          const data = await res.json()
          if (data.profile) {
            setProfile(data.profile)
            setEditName(data.profile.name || "")
            setEditPhone(data.profile.phone || "")
          }
          setStudentData(data.student || null)
          setEnrollments(data.enrollments || [])
          setCourses(data.courses || [])
          setPendingSubmissions(data.pendingSubmissions || [])
          setAttendance(data.attendance || [])
          setDues(data.dues || [])
          setExamResults(data.examResults || [])
          if (data.batchExams) setBatchExams(data.batchExams)
          let currentMaterials = data.materials || []
          let currentIssues = data.materialIssues || []

          // Merge issues from localStorage if available
          try {
            const rawLocalIssues = localStorage.getItem("medhashiree_material_issues")
            if (rawLocalIssues) {
              const parsed = JSON.parse(rawLocalIssues)
              if (Array.isArray(parsed) && parsed.length > 0) {
                const existingIssueIds = new Set(currentIssues.map((i: any) => String(i.id)))
                const studentIdCandidates = [
                  data.student?.id,
                  data.student?.student_id,
                  data.profile?.user_id,
                  data.profile?.email,
                ].filter(Boolean).map(x => String(x).toLowerCase())

                parsed.forEach((li: any) => {
                  if (li.status === "returned") return
                  const liSid = String(li.student_id || "").toLowerCase()
                  const liCode = String(li.student?.student_id || "").toLowerCase()
                  const matchesStudent = studentIdCandidates.includes(liSid) || studentIdCandidates.includes(liCode)
                  if (matchesStudent && !existingIssueIds.has(String(li.id))) {
                    currentIssues.push(li)
                  }
                })
              }
            }
          } catch {}

          // Enrich materials with is_received
          currentMaterials = currentMaterials.map((m: any) => {
            const mId = String(m.id || "")
            const mName = String(m.name || "").trim().toLowerCase()
            const iss = currentIssues.find((i: any) => {
              if (i.status === "returned") return false
              if (i.material_id && String(i.material_id) === mId) return true
              const iName = String(i.material?.name || i.material_name || i.name || "").trim().toLowerCase()
              return iName && mName && iName === mName
            })
            return {
              ...m,
              is_received: m.is_received || !!iss,
              issue_record: iss || m.issue_record || null,
              issued_at: iss?.issued_at || m.issued_at || null,
            }
          })

          setMaterials(currentMaterials)
          setMaterialIssues(currentIssues)

          if (data.paymentAccounts) {
            setPaymentAccounts(data.paymentAccounts)
          } else {
            const { data: acctData } = await supabase.from("payment_accounts").select("*").eq("is_active", true)
            if (acctData) setPaymentAccounts(acctData)
          }

          try {
            sessionStorage.setItem("ms_student_profile_cache", JSON.stringify({
              ...data,
              materials: currentMaterials,
              materialIssues: currentIssues,
            }))
          } catch {}
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

          // Direct client fallback for materials
          try {
            const { data: fbMats } = await supabase.from("materials").select("*").order("created_at", { ascending: false })
            if (fbMats) {
              const seenIds = new Set<string>()
              const seenSigs = new Set<string>()
              const deduped: any[] = []
              for (const m of fbMats) {
                const idStr = String(m.id || "")
                const sig = `${(m.name || "").trim().toLowerCase()}::${(m.type || "").trim().toLowerCase()}::${(m.subject || "").trim().toLowerCase()}`
                if (idStr && seenIds.has(idStr)) continue
                if (sig !== "::::" && seenSigs.has(sig)) continue
                if (idStr) seenIds.add(idStr)
                if (sig !== "::::") seenSigs.add(sig)
                deduped.push(m)
              }
              setMaterials(deduped)
            }
            if (studentRecord?.id) {
              const { data: fbIssues } = await supabase.from("material_issues").select("*").eq("student_id", studentRecord.id)
              if (fbIssues) setMaterialIssues(fbIssues)
            }
          } catch {}

          const { data: acctData } = await supabase.from("payment_accounts").select("*").eq("is_active", true)
          if (acctData) setPaymentAccounts(acctData)
        }
      } catch (err) {
        console.error("Failed to load student profile data:", err)
      } finally {
        setLoading(false)
      }
    }

    loadStudentProfile()

    const onWindowFocus = () => {
      loadStudentProfile()
    }
    window.addEventListener("focus", onWindowFocus)

    // Instant cross-tab sync when a material is deleted or distributed from admin panel
    const onStorageChange = (e: StorageEvent) => {
      if (e.key === "medhashiree_material_deleted" && e.newValue) {
        try {
          const { id } = JSON.parse(e.newValue)
          if (id) {
            const idStr = String(id)
            setMaterials(prev => prev.filter(m => String(m.id) !== idStr))
            setMaterialIssues(prev => prev.filter(i => String(i.material_id) !== idStr))
            loadStudentProfile()
          }
        } catch {}
      }
      if (e.key === "medhashiree_material_distributed" || e.key === "medhashiree_material_issues") {
        loadStudentProfile()
      }
    }
    window.addEventListener("storage", onStorageChange)

    // Real-time Supabase subscriptions for materials
    const materialsChannel = supabase
      .channel("student-profile-materials-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "materials" },
        () => {
          loadStudentProfile()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "material_issues" },
        () => {
          loadStudentProfile()
        }
      )
      .subscribe()

    return () => {
      window.removeEventListener("focus", onWindowFocus)
      window.removeEventListener("storage", onStorageChange)
      supabase.removeChannel(materialsChannel)
    }
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
        {/* Banner Skeleton */}
        <div className="h-44 bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 rounded-3xl p-6 sm:p-8 flex items-center gap-5">
          <div className="w-20 h-20 bg-white/20 rounded-2xl animate-pulse" />
          <div className="space-y-3 flex-1">
            <div className="h-6 w-48 bg-white/20 rounded-lg" />
            <div className="h-4 w-32 bg-white/10 rounded-lg" />
            <div className="h-3 w-56 bg-white/10 rounded-lg" />
          </div>
        </div>

        {/* Analytics Cards Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-28 bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
              <div className="h-3 w-16 bg-gray-200 rounded" />
              <div className="h-7 w-12 bg-gray-200 rounded" />
              <div className="h-2 w-24 bg-gray-100 rounded" />
            </div>
          ))}
        </div>

        {/* Batches Skeleton */}
        <div className="space-y-4">
          <div className="h-6 w-48 bg-gray-200 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map(i => (
              <div key={i} className="h-40 bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                <div className="h-4 w-20 bg-indigo-50 rounded" />
                <div className="h-5 w-40 bg-gray-200 rounded" />
                <div className="h-3 w-32 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      </main>
    )
  }

  // Segregate pending submissions
  const pendingBatchSubmissions = pendingSubmissions.filter(s => s.batch_id || s.item_type !== "course")
  const pendingCourseSubmissions = pendingSubmissions.filter(s => s.course_id || s.item_type === "course")

  // Analytics
  const totalClasses = attendance.length
  const presentClasses = attendance.filter(a => a.status === "present" || a.status === "late").length
  const attendanceRate = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 0
  const activeDues = dues.filter((d: any) => d.status !== "paid" && d.status !== "waived" && (Number(d.due_amount || 0) - Number(d.paid_amount || 0)) > 0)
  const settledDues = dues.filter((d: any) => d.status === "paid" || d.status === "waived" || (Number(d.due_amount || 0) - Number(d.paid_amount || 0)) <= 0)
  const totalPendingDue = activeDues.reduce((acc: number, d: any) => acc + Math.max(0, Number(d.due_amount || 0) - Number(d.paid_amount || 0)), 0)
  const avgScore = examResults.length > 0
    ? Math.round(examResults.reduce((acc, r) => {
        const marksConfig = getExamMarksConfig(r.exam || r)
        const total = marksConfig.totalMarks > 0 ? marksConfig.totalMarks : (Number(r.exam?.total_marks) || 100)
        const rawObt = r.obtained_marks ?? r.marks_obtained
        let obtained = rawObt != null && rawObt !== "" ? Number(rawObt) : 0
        if (marksConfig.isWeekly && r.day_marks && typeof r.day_marks === "object") {
          let dSum = 0
          for (const v of Object.values(r.day_marks)) {
            const m = typeof v === "object" && v !== null ? Number((v as any).marks) : Number(v)
            if (!isNaN(m) && m > 0) dSum += m
          }
          if (dSum > 0 && (obtained === 0 || dSum > obtained)) obtained = dSum
        }
        return acc + (total > 0 ? (obtained / total) * 100 : 0)
      }, 0) / examResults.length)
    : 0

  const receivedMaterialIds = new Set(
    materialIssues
      .filter((mi: any) => mi.status !== "returned")
      .map((mi: any) => String(mi.material_id))
      .filter(Boolean)
  )
  const receivedMaterialNames = new Set(
    materialIssues
      .filter((mi: any) => mi.status !== "returned")
      .map((mi: any) => String(mi.material?.name || mi.material_name || mi.name || "").trim().toLowerCase())
      .filter(Boolean)
  )
  const totalMaterials = materials.length
  const receivedMaterialsCount = materials.filter((m: any) => {
    if (m.is_received) return true
    const mId = String(m.id || "")
    const mName = String(m.name || "").trim().toLowerCase()
    if (mId && receivedMaterialIds.has(mId)) return true
    if (mName && receivedMaterialNames.has(mName)) return true
    return false
  }).length

  const inputClass = "w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"

  return (
    <>
    <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8">
      {/* Profile Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 rounded-3xl p-4 sm:p-8 text-white shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-48 h-48 bg-violet-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
          <div className="flex flex-col xs:flex-row items-start xs:items-center gap-3.5 sm:gap-5 min-w-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-indigo-400 to-violet-400 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl font-extrabold text-white shadow-lg border-2 border-white/20 shrink-0">
              {profile?.name ? profile.name.charAt(0).toUpperCase() : "S"}
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-3xl font-bold truncate">{profile?.name || "Student"}</h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-semibold rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5" /> Active Student
                </span>
              </div>
              <div className="flex items-center gap-2 text-indigo-200 text-sm">
                <span className="font-mono bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/10 font-bold tracking-wider text-white">
                  {profile?.user_id || "N/A"}
                </span>
                <button onClick={copyId} className="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer" title="Copy Student ID">
                  {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-indigo-200" />}
                </button>
              </div>
              <div className="flex items-center gap-4 text-xs sm:text-sm text-indigo-200/80 pt-1 flex-wrap">
                {profile?.email && <span className="flex items-center gap-1.5 truncate max-w-[240px]"><Mail className="w-3.5 h-3.5 shrink-0" /> {profile.email}</span>}
                {profile?.phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 shrink-0" /> {profile.phone}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 shrink-0 flex-wrap w-full sm:w-auto">
            <StudentIdCardTrigger
              student={{
                ...studentData,
                id: studentData?.id || profile?.id,
                student_id: profile?.user_id || studentData?.student_id,
                name: profile?.name || studentData?.name,
                phone: profile?.phone || studentData?.phone,
                batch_roll: enrollments[0]?.roll_no ?? studentData?.roll_no ?? studentData?.batch_roll,
                roll_no: enrollments[0]?.roll_no ?? studentData?.roll_no ?? studentData?.batch_roll,
                guardian_name: studentData?.guardian_name,
                guardian_phone: studentData?.guardian_phone,
              }}
              batchName={enrollments[0]?.batch?.name}
              buttonVariant="banner"
              buttonText="🪪 ডিজিটাল আইডি কার্ড"
            />
            <AdmissionSlipTrigger
              student={{
                ...studentData,
                id: studentData?.id || profile?.id,
                student_id: profile?.user_id || studentData?.student_id,
                name: profile?.name || studentData?.name,
                phone: profile?.phone || studentData?.phone,
                guardian_name: studentData?.guardian_name,
                guardian_phone: studentData?.guardian_phone,
              }}
              batch={enrollments[0]?.batch}
              enrollment={enrollments[0]}
              due={dues[0]}
              buttonVariant="banner"
              buttonText="🧾 ভর্তি ও মানি রসিদ"
            />
            <div className="hidden sm:block bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/15 text-center">
              <p className="text-xs text-indigo-300">MedhaShiree ID</p>
              <p className="text-lg font-mono font-bold text-white">{profile?.user_id}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-4">
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
            <span className="text-[11px] font-semibold uppercase tracking-wider">Fee Dues</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <p className={`text-2xl sm:text-3xl font-extrabold ${totalPendingDue > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            {formatCurrency(totalPendingDue)}
          </p>
          <p className="text-xs text-gray-500">{activeDues.length > 0 ? `${activeDues.length} pending months` : "All fees clear"}</p>
          <p className="text-xs text-amber-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">{activeDues.length > 0 ? 'Pay now →' : 'View history →'}</p>
        </button>

        <button onClick={() => setActiveModal('exams')} className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm space-y-1 hover:border-violet-300 hover:shadow-md hover:bg-violet-50/20 transition-all group cursor-pointer text-left w-full">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Exams</span>
            <GraduationCap className="w-4 h-4 text-violet-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-violet-600">
            {batchExams.length > 0 ? `${examResults.length}/${batchExams.length}` : (examResults.length > 0 ? `${avgScore}%` : "—")}
          </p>
          <p className="text-xs text-gray-500">
            {batchExams.length > 0 ? `${examResults.length} done • ${avgScore}% avg` : `${examResults.length} exams taken`}
          </p>
          <p className="text-xs text-violet-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Schedule & results →</p>
        </button>

        <button onClick={() => setActiveModal('materials')} className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm space-y-1 hover:border-teal-300 hover:shadow-md hover:bg-teal-50/20 transition-all group cursor-pointer text-left w-full">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Materials</span>
            <Package className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-teal-600">
            {totalMaterials > 0 ? `${receivedMaterialsCount}/${totalMaterials}` : "0"}
          </p>
          <p className="text-xs text-gray-500">
            {totalMaterials > 0 ? `${receivedMaterialsCount} received (Got)` : "Batch materials"}
          </p>
          <p className="text-xs text-teal-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">View materials →</p>
        </button>
      </div>

      {/* 1. My Classroom Batches */}
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
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 bg-amber-100 text-amber-700 font-semibold rounded-full border border-amber-300 animate-pulse">
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
                    const latestExamObj = latestExam?.exam
                    const marksConfig = getExamMarksConfig(latestExamObj || latestExam)
                    const latestTotal = marksConfig.totalMarks > 0 ? marksConfig.totalMarks : (Number(latestExamObj?.total_marks) || 100)
                    const latestRaw = latestExam ? (latestExam.obtained_marks ?? latestExam.marks_obtained) : null
                    let latestObt = latestRaw != null && latestRaw !== "" ? Number(latestRaw) : 0
                    if (marksConfig.isWeekly && latestExam?.day_marks && typeof latestExam.day_marks === "object") {
                      let dSum = 0
                      for (const v of Object.values(latestExam.day_marks)) {
                        const m = typeof v === "object" && v !== null ? Number((v as any).marks) : Number(v)
                        if (!isNaN(m) && m > 0) dSum += m
                      }
                      if (dSum > 0 && (latestObt === 0 || dSum > latestObt)) latestObt = dSum
                    }

                    return (
                      <Link key={i} href={`/student/batch/${targetBatchId}`}
                        className="group bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all space-y-3 cursor-pointer">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 font-semibold rounded-lg border border-indigo-100">{b?.subject || "Subject"}</span>
                              {(enr.roll_no != null || studentData?.roll_no != null || studentData?.batch_roll != null) && (
                                <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-900 font-bold rounded-lg border border-amber-300">
                                  Roll #{enr.roll_no ?? studentData?.roll_no ?? studentData?.batch_roll}
                                </span>
                              )}
                            </div>
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

                        {/* Batch Study Materials Status Indicator */}
                        {(() => {
                          const bIdStr = targetBatchId ? String(targetBatchId) : ""
                          const batchMatList = materials.filter((m: any) => {
                            if (bIdStr && m.batch_id && String(m.batch_id) === bIdStr) return true
                            if (bIdStr && m.batch_ids) {
                              if (Array.isArray(m.batch_ids) && m.batch_ids.some((bid: any) => String(bid) === bIdStr)) return true
                              if (typeof m.batch_ids === "string") {
                                try {
                                  const parsed = JSON.parse(m.batch_ids)
                                  if (Array.isArray(parsed) && parsed.some((bid: any) => String(bid) === bIdStr)) return true
                                } catch {
                                  if (m.batch_ids.includes(bIdStr)) return true
                                }
                              }
                            }
                            if (b?.name && (m.batch_name?.toLowerCase() === b.name.toLowerCase() || m.subject?.toLowerCase() === b.name.toLowerCase())) return true
                            const hasNoBatch = (!m.batch_id || m.batch_id === "" || m.batch_id === "all") &&
                              (!m.batch_ids || (Array.isArray(m.batch_ids) && m.batch_ids.length === 0) || m.batch_ids === "[]")
                            if (hasNoBatch) return true
                            return false
                          })
                          if (batchMatList.length === 0) return null
                          const receivedForBatch = batchMatList.filter((m: any) => receivedMaterialIds.has(String(m.id)) || m.is_received).length

                          return (
                            <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                              <span className={`font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
                                receivedForBatch > 0 
                                  ? "text-emerald-700 bg-emerald-50 border-emerald-200 shadow-2xs" 
                                  : "text-amber-700 bg-amber-50 border-amber-200"
                              }`}>
                                <Package className="w-3.5 h-3.5 shrink-0" />
                                <span>Study Materials:</span>
                                <strong>
                                  {receivedForBatch}/{batchMatList.length} {receivedForBatch === batchMatList.length ? "Got" : "Received"}
                                </strong>
                              </span>
                              <span className="text-[11px] text-gray-400 font-medium">
                                {batchMatList.length} {batchMatList.length === 1 ? "item" : "items"}
                              </span>
                            </div>
                          )
                        })()}

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100 flex-wrap gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                            <StudentIdCardTrigger
                              student={{
                                ...studentData,
                                id: studentData?.id || profile?.id,
                                student_id: profile?.user_id || studentData?.student_id,
                                name: profile?.name || studentData?.name,
                                phone: profile?.phone || studentData?.phone,
                                roll_no: enr.roll_no ?? studentData?.roll_no ?? studentData?.batch_roll,
                                batch_roll: enr.roll_no ?? studentData?.roll_no ?? studentData?.batch_roll,
                                guardian_name: studentData?.guardian_name,
                                guardian_phone: studentData?.guardian_phone,
                              }}
                              batchName={b?.name}
                              rollNo={enr.roll_no ?? studentData?.roll_no ?? studentData?.batch_roll}
                              buttonVariant="badge"
                              buttonText="🪪 আইডি কার্ড"
                            />
                            <AdmissionSlipTrigger
                              student={{
                                ...studentData,
                                id: studentData?.id || profile?.id,
                                student_id: profile?.user_id || studentData?.student_id,
                                name: profile?.name || studentData?.name,
                                phone: profile?.phone || studentData?.phone,
                                guardian_name: studentData?.guardian_name,
                                guardian_phone: studentData?.guardian_phone,
                              }}
                              batch={b}
                              enrollment={enr}
                              due={dues.find((d: any) => d.batch_id === enr.batch_id)}
                              buttonVariant="badge"
                              buttonText="🧾 মানি রসিদ"
                            />
                          </div>
                          <span className="text-indigo-600 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center">
                            বিস্তারিত দেখুন <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
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

      {/* 2. My Online Courses Section */}
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

                        {/* Course Study Materials Indicator if applicable */}
                        {(() => {
                          const courseMatList = materials.filter((m: any) => {
                            if (m.course_id === item.course_id || m.course_id === c.id) return true
                            if (c.title && (m.subject?.toLowerCase() === c.title.toLowerCase() || m.name?.toLowerCase().includes(c.title.toLowerCase()))) return true
                            return false
                          })
                          if (courseMatList.length === 0) return null
                          const receivedForCourse = courseMatList.filter((m: any) => receivedMaterialIds.has(String(m.id)) || m.is_received).length

                          return (
                            <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                              <span className={`font-semibold flex items-center gap-1.5 px-2 py-0.5 rounded-md border ${
                                receivedForCourse > 0 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-purple-700 bg-purple-50 border-purple-200"
                              }`}>
                                <Package className="w-3.5 h-3.5" />
                                <span>Materials:</span>
                                <strong>{receivedForCourse}/{courseMatList.length} Got</strong>
                              </span>
                            </div>
                          )
                        })()}

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
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4" onClick={() => setActiveModal(null)}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> Attendance Overview</h2>
            <button onClick={() => setActiveModal(null)} className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"><X className="w-5 h-5 text-gray-500" /></button>
          </div>
          <div className="p-4 sm:p-6 overflow-y-auto">
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
              {[
                { label: 'Present', count: attendance.filter(a => a.status === 'present').length, color: 'bg-emerald-100 text-emerald-700' },
                { label: 'Absent', count: attendance.filter(a => a.status === 'absent').length, color: 'bg-rose-100 text-rose-700' },
                { label: 'Late', count: attendance.filter(a => a.status === 'late').length, color: 'bg-amber-100 text-amber-700' },
              ].map(s => (
                <div key={s.label} className={`rounded-2xl p-3 sm:p-4 text-center ${s.color}`}>
                  <p className="text-xl sm:text-2xl font-extrabold">{s.count}</p>
                  <p className="text-[11px] sm:text-xs font-semibold mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            {attendance.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {attendance.slice(0, 30).map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 text-xs sm:text-sm">
                    <span className="text-gray-600">{formatDate(a.date)}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${a.status === 'present' ? 'bg-emerald-100 text-emerald-700' : a.status === 'absent' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{a.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-400 py-8 text-sm">No attendance records yet.</p>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Dues Modal */}
    {activeModal === 'dues' && (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4" onClick={() => setActiveModal(null)}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" /> Fee Dues & Due History
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {activeDues.length} active due{activeDues.length === 1 ? '' : 's'} · {settledDues.length} settled in history
              </p>
            </div>
            <button onClick={() => setActiveModal(null)} className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"><X className="w-5 h-5 text-gray-500" /></button>
          </div>
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
            {/* Active Dues */}
            {activeDues.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase text-rose-600 tracking-wider">Active Receivables</h3>
                {activeDues.map((due: any, i: number) => {
                  const remaining = Math.max(0, Number(due.due_amount || 0) - Number(due.paid_amount || 0))
                  const hasPartial = Number(due.paid_amount || 0) > 0
                  return (
                    <div key={due.id || i} className="flex items-center justify-between p-4 bg-rose-50 border border-rose-100 rounded-xl gap-4">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {due.batch?.name ? `${due.batch.name} • ` : ''}
                          {due.due_month ? new Date(due.due_month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'Unknown'}
                        </p>
                        <p className="text-sm text-rose-600 font-bold mt-0.5">
                          {formatCurrency(remaining)} due
                          {hasPartial && (
                            <span className="text-xs font-medium text-amber-700 ml-1.5">
                              ({formatCurrency(due.paid_amount)} already paid)
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => { setPayingDue(due); setActiveModal(null); setPayMethod('bkash'); setSenderNumber(''); setTransactionId(''); setReferralName(''); setReferralReason('') }}
                        className="flex-shrink-0 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer"
                      >
                        Pay Now
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Settled / Due History */}
            {settledDues.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase text-emerald-700 tracking-wider">Settled / Due History</h3>
                {settledDues.map((due: any, i: number) => (
                  <div key={due.id || i} className="flex items-center justify-between p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-xl gap-3">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {due.batch?.name ? `${due.batch.name} • ` : ''}
                        {due.due_month ? new Date(due.due_month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Total Fee: <span className="font-semibold text-gray-700">{formatCurrency(due.due_amount)}</span> • Paid: <span className="font-semibold text-emerald-700">{formatCurrency(due.paid_amount || due.due_amount)}</span>
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {due.status === "waived" ? "Waived" : "✓ Settled"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {activeDues.length === 0 && settledDues.length === 0 && (
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

    {/* Exam Results & Schedule Modal */}
    {activeModal === 'exams' && (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4" onClick={() => setActiveModal(null)}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-violet-500 shrink-0" /> Exam Schedule & Results
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Upcoming scheduled tests and your recorded results displayed side-by-side
              </p>
            </div>
            <button onClick={() => setActiveModal(null)} className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"><X className="w-5 h-5 text-gray-500" /></button>
          </div>

          <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
            {(() => {
              const recordedExamIds = new Set(examResults.map((r: any) => r.exam_id).filter(Boolean))
              
              // Build unified list of exams
              const unifiedList: any[] = []
              
              for (const be of batchExams) {
                const res = examResults.find((r: any) => r.exam_id === be.id)
                const marksCfg = getExamMarksConfig(be)
                unifiedList.push({
                  id: be.id,
                  title: be.title,
                  subject: be.subject || res?.exam?.subject,
                  batch_id: be.batch_id || res?.exam?.batch_id,
                  exam_date: be.exam_date || res?.exam?.exam_date,
                  duration_minutes: be.duration_minutes,
                  total_marks: marksCfg.totalMarks,
                  pass_marks: marksCfg.passMarks,
                  exam_schedule_type: marksCfg.isWeekly ? "weekly" : (be.exam_schedule_type || res?.exam?.exam_schedule_type),
                  recurring_days: be.recurring_days || res?.exam?.recurring_days,
                  published_days: be.published_days || res?.exam?.published_days,
                  is_weekly_published: be.is_weekly_published ?? res?.exam?.is_weekly_published,
                  has_result: !!res,
                  result: res || null,
                  marksConfig: marksCfg,
                })
              }

              for (const res of examResults) {
                if (res.exam_id && !batchExams.some((be: any) => be.id === res.exam_id)) {
                  const marksCfg = getExamMarksConfig(res.exam || res)
                  unifiedList.push({
                    id: res.exam_id,
                    title: res.exam?.title || "Exam",
                    subject: res.exam?.subject,
                    batch_id: res.exam?.batch_id,
                    exam_date: res.exam?.exam_date,
                    duration_minutes: res.exam?.duration_minutes,
                    total_marks: marksCfg.totalMarks,
                    pass_marks: marksCfg.passMarks,
                    exam_schedule_type: marksCfg.isWeekly ? "weekly" : res.exam?.exam_schedule_type,
                    recurring_days: res.exam?.recurring_days,
                    published_days: res.exam?.published_days,
                    is_weekly_published: res.exam?.is_weekly_published,
                    has_result: true,
                    result: res,
                    marksConfig: marksCfg,
                  })
                }
              }

              const pendingCount = unifiedList.filter(e => !e.has_result).length
              const resultCount = unifiedList.filter(e => e.has_result).length

              const filteredList = unifiedList.filter(e => {
                if (examFilter === 'upcoming') return !e.has_result
                if (examFilter === 'results') return e.has_result
                return true
              })

              return (
                <>
                  {/* Filter Pills */}
                  <div className="flex items-center gap-2 pb-1 flex-wrap">
                    <button
                      onClick={() => setExamFilter('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        examFilter === 'all'
                          ? 'bg-violet-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      All Exams ({unifiedList.length})
                    </button>
                    <button
                      onClick={() => setExamFilter('upcoming')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        examFilter === 'upcoming'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      ⏳ Scheduled / Pending ({pendingCount})
                    </button>
                    <button
                      onClick={() => setExamFilter('results')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        examFilter === 'results'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      ✓ Results Given ({resultCount})
                    </button>
                  </div>

                  {filteredList.length === 0 ? (
                    <div className="text-center py-10">
                      <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="font-semibold text-gray-700">No exams match the selected filter</p>
                      <p className="text-xs text-gray-400 mt-1">Check other tabs or visit your batch details page.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredList.map((exam: any) => {
                        const batchObj = enrollments.find(e => e.batch_id === exam.batch_id)?.batch
                        const r = exam.result
                        const marksCfg = exam.marksConfig || getExamMarksConfig(exam)
                        const rawObt = r?.obtained_marks ?? r?.marks_obtained
                        let obtained = rawObt != null && rawObt !== "" ? Number(rawObt) : null
                        if (marksCfg.isWeekly && r?.day_marks && typeof r.day_marks === "object") {
                          let dSum = 0
                          for (const v of Object.values(r.day_marks)) {
                            const m = typeof v === "object" && v !== null ? Number((v as any).marks) : Number(v)
                            if (!isNaN(m) && m > 0) dSum += m
                          }
                          if (dSum > 0 && (obtained === null || obtained === 0 || dSum > obtained)) obtained = dSum
                        }
                        const isWeekly = marksCfg.isWeekly
                        const total = marksCfg.totalMarks
                        const passMarks = marksCfg.passMarks
                        const pct = obtained != null && total > 0 ? Math.round((obtained / total) * 100) : null
                        const passed = obtained != null && obtained >= passMarks
                        const isPublic = r?.exam?.show_all_results !== false && !r?.exam?.result_note?.includes('[SHOW_ALL_RESULTS:false]')

                        return (
                          <div
                            key={exam.id}
                            className={`p-4 rounded-2xl border transition-all ${
                              exam.has_result
                                ? "bg-white border-violet-100 hover:border-violet-200 shadow-xs"
                                : "bg-blue-50/40 border-blue-100 hover:border-blue-200"
                            } flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-gray-900">{exam.title || "Exam"}</p>
                                {isWeekly ? (
                                  <span className="text-[10px] text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-200 flex items-center gap-1">
                                    <CalendarDays className="w-3 h-3" />
                                    সাপ্তাহিক পরীক্ষা
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    এককালীন পরীক্ষা
                                  </span>
                                )}
                                {exam.subject && (
                                  <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                    {exam.subject}
                                  </span>
                                )}
                                {batchObj?.name && (
                                  <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                    {batchObj.name}
                                  </span>
                                )}
                                {exam.has_result && (
                                  isPublic ? (
                                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                      Merit Public
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                      Private
                                    </span>
                                  )
                                )}
                              </div>

                              <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                                {exam.exam_date && (
                                  <span className="font-medium text-slate-700 flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                                    {formatDate(exam.exam_date)}
                                  </span>
                                )}
                                {exam.duration_minutes && <span>• {exam.duration_minutes} mins</span>}
                                <span>• Total: {total} marks</span>
                                {r?.rank && <span className="text-amber-600 font-bold">• Rank #{r.rank}</span>}
                              </div>

                              {/* Day-by-day score breakdown for weekly exams */}
                              {r?.day_marks && Object.keys(r.day_marks).length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                  {Object.entries(r.day_marks).map(([dKey, dVal]: any) => {
                                    const mVal = typeof dVal === "object" && dVal !== null ? (dVal.marks ?? 0) : dVal
                                    const tVal = typeof dVal === "object" && dVal !== null ? (dVal.total ?? "") : ""
                                    return (
                                      <span
                                        key={dKey}
                                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-800"
                                      >
                                        <span className="capitalize">{dKey}:</span>
                                        <strong className="text-purple-950 font-black">{mVal}{tVal ? `/${tVal}` : ""}</strong>
                                      </span>
                                    )
                                  })}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2.5 self-end sm:self-center justify-between sm:justify-end w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 flex-wrap">
                              {exam.has_result ? (
                                <div className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <span className={`text-lg font-black ${passed ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {obtained} / {total}
                                    </span>
                                    {pct != null && (
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                        {pct}%
                                      </span>
                                    )}
                                    {r?.grade && (
                                      <span className="px-2 py-0.5 text-xs font-bold bg-gray-100 text-gray-800 rounded">
                                        {r.grade}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center justify-end gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Result Published
                                  </p>
                                </div>
                              ) : (
                                <div className="text-right">
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full border border-blue-200">
                                    <Clock className="w-3 h-3 text-blue-600" /> Scheduled (Result Pending)
                                  </span>
                                </div>
                              )}

                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Link
                                  href={`/student/exam/${exam.id}/results`}
                                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs flex items-center gap-1 flex-shrink-0 cursor-pointer"
                                >
                                  <Trophy className="w-3.5 h-3.5 text-amber-300" />
                                  <span>ফলাফল ও মেরিট</span>
                                </Link>

                                {exam.batch_id && (
                                  <Link
                                    href={`/student/batch/${exam.batch_id}`}
                                    className="px-2.5 py-1.5 bg-white hover:bg-indigo-50 text-indigo-600 font-semibold rounded-xl text-xs border border-indigo-200 transition-colors shadow-xs flex-shrink-0"
                                  >
                                    ব্যাচ →
                                  </Link>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      </div>
    )}

    {/* Materials Modal */}
    {activeModal === 'materials' && (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4" onClick={() => setActiveModal(null)}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-teal-500 shrink-0" /> Batch Study Materials
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Classroom lecture sheets, books, and handouts for your enrolled batches
              </p>
            </div>
            <button onClick={() => setActiveModal(null)} className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"><X className="w-5 h-5 text-gray-500" /></button>
          </div>

          <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
            {/* Quick Summary Bar */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">✓ Got / Received (সংগৃহীত)</p>
                  <p className="text-2xl font-black text-emerald-700 mt-0.5">{receivedMaterialsCount}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <CheckCircle className="w-5 h-5" />
                </div>
              </div>
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">⏳ Pending Collection (বাকি)</p>
                  <p className="text-2xl font-black text-amber-700 mt-0.5">{Math.max(0, totalMaterials - receivedMaterialsCount)}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 pb-1 flex-wrap">
              <button
                onClick={() => setMaterialFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  materialFilter === 'all'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All Materials ({materials.length})
              </button>
              <button
                onClick={() => setMaterialFilter('received')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  materialFilter === 'received'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                ✓ Received ({receivedMaterialsCount})
              </button>
              <button
                onClick={() => setMaterialFilter('pending')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  materialFilter === 'pending'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                ⏳ Pending ({Math.max(0, totalMaterials - receivedMaterialsCount)})
              </button>
            </div>

            {(() => {
              const filteredMaterials = materials.filter((m: any) => {
                const isReceived = receivedMaterialIds.has(String(m.id)) || m.is_received === true
                if (materialFilter === 'received') return isReceived
                if (materialFilter === 'pending') return !isReceived
                return true
              })

              if (filteredMaterials.length === 0) {
                return (
                  <div className="text-center py-10">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="font-semibold text-gray-700">
                      {materials.length === 0 ? "No materials uploaded for your batches yet" : "No materials match this filter"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Class lecture sheets, books, and handouts will appear here when distributed.
                    </p>
                  </div>
                )
              }

              return (
                <div className="space-y-3">
                  {filteredMaterials.map((m: any) => {
                    const isReceived = receivedMaterialIds.has(String(m.id)) || m.is_received === true
                    const issueRecord = materialIssues.find((mi: any) => String(mi.material_id) === String(m.id)) || m.issue_record
                    const batchObj = enrollments.find((e: any) => 
                      e.batch_id === m.batch_id || 
                      (Array.isArray(m.batch_ids) && m.batch_ids.includes(e.batch_id))
                    )?.batch
                    const courseObj = courses.find((c: any) =>
                      c.course_id === m.course_id || c.course?.id === m.course_id || c.id === m.course_id
                    )?.course || m.course
                    const targetBatchId = m.batch_id || (Array.isArray(m.batch_ids) && m.batch_ids[0]) || (enrollments[0]?.batch_id)
                    const stockCount = m.available_stock ?? m.total_stock ?? m.quantity

                    return (
                      <div
                        key={m.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isReceived
                            ? "bg-emerald-50/40 border-emerald-200 shadow-xs"
                            : "bg-gray-50 border-gray-100 hover:border-gray-200"
                        } flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-gray-900">{m.name || m.title || "Study Material"}</p>
                            {m.type && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wide">
                                {m.type}
                              </span>
                            )}
                            {batchObj?.name && (
                              <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                {batchObj.name}
                              </span>
                            )}
                            {courseObj?.title && (
                              <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                                🎓 {courseObj.title}
                              </span>
                            )}
                            {isReceived ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> ✓ Got / Received (সংগৃহীত)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" /> Available (সংগ্রহ বাকি)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                            {m.subject && <span>Subject: <strong className="text-gray-700">{m.subject}</strong></span>}
                            {isReceived && issueRecord?.issued_at && (
                              <span className="text-emerald-700 font-medium">
                                • Received on {formatDate(issueRecord.issued_at)}
                              </span>
                            )}
                            {!isReceived && (
                              <span className="text-amber-700 font-medium">
                                • 🏢 Collect from coaching office
                              </span>
                            )}
                            {stockCount != null && (
                              <span>• In stock: {stockCount}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {m.file_url && (
                            <a
                              href={m.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs border border-gray-200 transition-colors shadow-xs flex items-center gap-1"
                            >
                              <FileText className="w-3 h-3 text-slate-500" /> Download
                            </a>
                          )}
                          {m.course_id ? (
                            <Link
                              href={`/student/course/${m.course_id}`}
                              className="px-3 py-1 bg-white hover:bg-purple-50 text-purple-600 font-semibold rounded-xl text-xs border border-purple-200 transition-colors shadow-xs"
                            >
                              Course Page →
                            </Link>
                          ) : targetBatchId ? (
                            <Link
                              href={`/student/batch/${targetBatchId}`}
                              className="px-3 py-1 bg-white hover:bg-indigo-50 text-indigo-600 font-semibold rounded-xl text-xs border border-indigo-200 transition-colors shadow-xs"
                            >
                              Batch Page →
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    )}

    {/* Pay Due Modal */}
    {payingDue && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-4 sm:p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg sm:text-xl font-bold">Pay Due</h2>
                <p className="text-indigo-200 text-xs sm:text-sm mt-0.5">{payingDue.due_month ? new Date(payingDue.due_month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'Fee Payment'}</p>
              </div>
              <button onClick={() => setPayingDue(null)} className="p-1.5 sm:p-2 hover:bg-white/20 rounded-xl transition-colors cursor-pointer"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-3 sm:mt-4 bg-white/10 rounded-2xl p-3 sm:p-4 border border-white/20">
              <p className="text-xs text-indigo-200 uppercase tracking-wider font-semibold">Amount to Pay</p>
              <p className="text-2xl sm:text-3xl font-extrabold mt-1">{formatCurrency(payingDue.due_amount - (payingDue.paid_amount || 0))}</p>
            </div>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
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