"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  FileText,
  CreditCard,
  BookOpen,
  GraduationCap,
  Info,
  Loader2,
  Phone,
  Hash,
  Send,
  Smartphone,
  Banknote,
  X,
  Check,
  Copy,
  DollarSign,
  Trophy,
  Users,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react'

export default function StudentBatchDetailPage() {
  const params = useParams()
  const router = useRouter()
  const batchId = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('info')
  const [error, setError] = useState<string | null>(null)
  
  const [student, setStudent] = useState<any>(null)
  const [batch, setBatch] = useState<any>(null)
  const [enrollment, setEnrollment] = useState<any>(null)
  const [attendance, setAttendance] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [dues, setDues] = useState<any[]>([])
  const [examResults, setExamResults] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])

  // Pay Due modal state
  const [payingDue, setPayingDue] = useState<any>(null)  // the due being paid
  const [payMethod, setPayMethod] = useState('bkash')
  const [senderNumber, setSenderNumber] = useState('')
  const [transactionId, setTransactionId] = useState('')
  const [referralName, setReferralName] = useState('')
  const [referralReason, setReferralReason] = useState('')
  const [submittingPayment, setSubmittingPayment] = useState(false)
  const [paymentAccounts, setPaymentAccounts] = useState<any[]>([])
  const [copied, setCopied] = useState<string | null>(null)

  // Batch Leaderboard Modal state
  const [selectedLeaderboardExam, setSelectedLeaderboardExam] = useState<any | null>(null)
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [leaderboardResults, setLeaderboardResults] = useState<any[]>([])
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null)

  async function handleOpenLeaderboard(exam: any) {
    setSelectedLeaderboardExam(exam)
    setLeaderboardLoading(true)
    setLeaderboardError(null)
    setLeaderboardResults([])
    try {
      const examId = exam?.id || exam?.exam_id
      const res = await fetch(`/api/exams/${examId}/results`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load leaderboard")

      if (!json.can_view_all) {
        toast.info("This exam is set to Private. Only your own marks are visible.")
      }
      const resultsList = json.results || []
      setLeaderboardResults(resultsList)

      // Find current student's true rank from the results and update the main table
      const myRes = resultsList.find((r: any) => r.is_current_student || (student && r.student_id === student.id))
      if (myRes && myRes.rank) {
        setExamResults(prev => prev.map(e => {
          const match = e.id === myRes.id || e.exam_id === examId || e.exam?.id === examId
          return match ? { ...e, rank: myRes.rank } : e
        }))
      }
    } catch (err: any) {
      console.error("Leaderboard load error:", err)
      setLeaderboardError(err.message || "Failed to load results")
    } finally {
      setLeaderboardLoading(false)
    }
  }
  
  const supabase = createClient()
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // 1. Fetch student profile and verified enrollments via server API
        let studentData: any = null
        let currentEnrollment: any = null
        let profileExamResults: any[] = []

        try {
          const profileRes = await fetch('/api/student/profile')
          if (profileRes.ok) {
            const profileJson = await profileRes.json()
            if (profileJson.student) studentData = profileJson.student
            if (profileJson.enrollments) {
              currentEnrollment = profileJson.enrollments.find((e: any) => e.batch_id === batchId || e.batch?.id === batchId)
            }
            if (profileJson.examResults) {
              profileExamResults = profileJson.examResults
            }
          }
        } catch (apiErr) {
          console.warn('Profile API fallback notice:', apiErr)
        }

        // Fallback to client query if server API didn't yield student
        if (!studentData) {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) {
            router.push('/login')
            return
          }

          let userProf: any = null
          const { data: byId } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('auth_user_id', user.id)
            .maybeSingle()
          userProf = byId

          if (!userProf && user.email) {
            const { data: byEmail } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('email', user.email)
              .maybeSingle()
            userProf = byEmail
          }

          const currentProfile = userProf || {
            user_id: user.user_metadata?.user_id || 'MS-' + user.id.slice(0, 5).toUpperCase(),
            email: user.email,
          }

          if (currentProfile.user_id) {
            const { data: sData } = await supabase
              .from('students')
              .select('*')
              .eq('student_id', currentProfile.user_id)
              .maybeSingle()
            if (sData) studentData = sData
          }

          if (!studentData && currentProfile.email) {
            const { data: sDataEmail } = await supabase
              .from('students')
              .select('*')
              .ilike('email', currentProfile.email)
              .maybeSingle()
            if (sDataEmail) studentData = sDataEmail
          }
        }

        if (studentData) {
          setStudent(studentData)
        }

        const studentId = studentData?.id || null

        // 2. Get batch info
        const { data: batchData, error: batchError } = await supabase
          .from('batches')
          .select('*, teacher:staff(name), room:rooms(name)')
          .eq('id', batchId)
          .maybeSingle()

        if (batchData) {
          setBatch(batchData)
        } else if (currentEnrollment?.batch) {
          setBatch(currentEnrollment.batch)
        } else {
          throw new Error('Batch details could not be found.')
        }

        // 3. Get enrollment info
        if (currentEnrollment) {
          setEnrollment(currentEnrollment)
        } else if (studentId) {
          const { data: enrollData } = await supabase
            .from('enrollments')
            .select('*')
            .eq('student_id', studentId)
            .eq('batch_id', batchId)
            .maybeSingle()

          if (enrollData) setEnrollment(enrollData)
        }
        
        // 4. Get attendance
        const { data: attData } = await supabase
          .from('attendance')
          .select('*')
          .eq('student_id', studentId)
          .eq('batch_id', batchId)
          .order('date', { ascending: false })
          
        if (attData) setAttendance(attData)
        
        // 5. Get payments & dues
        const { data: paymentData } = await supabase
          .from('payments')
          .select('*')
          .eq('student_id', studentId)
          .eq('batch_id', batchId)
          .order('paid_at', { ascending: false })
          
        if (paymentData) setPayments(paymentData)
        
        const { data: dueData } = await supabase
          .from('fee_dues')
          .select('*')
          .eq('student_id', studentId)
          .eq('batch_id', batchId)
          .in('status', ['pending', 'partial'])
          .order('due_month', { ascending: false })
          
        if (dueData) setDues(dueData)
        
        // 6. Get exam results (combining server verified results and database query)
        let mergedExams: any[] = []
        if (profileExamResults && profileExamResults.length > 0) {
          mergedExams = profileExamResults.filter((r: any) => 
            r.exam?.batch_id === batchId || 
            (Array.isArray(r.exam?.batch_ids) && r.exam.batch_ids.includes(batchId)) || 
            !r.exam?.batch_id
          )
        }

        if (studentId) {
          try {
            const { data: examData } = await supabase
              .from('exam_results')
              .select('*, exam:exams(id, title, exam_date, total_marks, pass_marks, batch_id, batch_ids, subject)')
              .eq('student_id', studentId)

            if (examData && examData.length > 0) {
              const batchFromDb = examData.filter((r: any) => 
                r.exam?.batch_id === batchId || 
                (Array.isArray(r.exam?.batch_ids) && r.exam.batch_ids.includes(batchId))
              )
              const map = new Map<string, any>()
              mergedExams.forEach(e => map.set(e.id || e.exam_id, e))
              batchFromDb.forEach(e => map.set(e.id || e.exam_id, e))
              mergedExams = Array.from(map.values())
            }
          } catch (exErr) {
            console.warn('Exam results query note:', exErr)
          }
        }

        // Normalize marks so both obtained_marks and marks_obtained are accurate numbers
        mergedExams = mergedExams.map((r: any) => {
          const raw = r.obtained_marks ?? r.marks_obtained
          const obt = raw != null && raw !== "" ? Number(raw) : 0
          return {
            ...r,
            obtained_marks: obt,
            marks_obtained: obt,
          }
        })
        setExamResults(mergedExams)
        
        // 7. Get material issues
        const { data: materialData } = await supabase
          .from('material_issues')
          .select('*, material:materials(name, type, batch_id, batch_ids)')
          .eq('student_id', studentId)
          
        if (materialData) {
          const batchMaterials = materialData.filter((m: any) => 
            m.material?.batch_id === batchId || 
            (Array.isArray(m.material?.batch_ids) && m.material.batch_ids.includes(batchId)) ||
            !m.material?.batch_id
          )
          setMaterials(batchMaterials)
        }

        // 8. Get payment accounts (bKash, Nagad, etc.)
        const { data: acctData } = await supabase
          .from('payment_accounts')
          .select('*')
          .eq('is_active', true)
        if (acctData) setPaymentAccounts(acctData)
        
      } catch (err: any) {
        console.error('Error fetching data:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    if (batchId) {
      fetchData()
    }
  }, [batchId, router, supabase])

  function copyNumber(num: string) {
    navigator.clipboard.writeText(num)
    setCopied(num)
    setTimeout(() => setCopied(null), 2000)
  }

  async function handlePayDue() {
    if (payMethod === 'referral') {
      if (!referralName.trim()) { toast.error('Enter the Referral Student Name or ID'); return }
      if (!referralReason.trim()) { toast.error('Enter the reason for referral adjustment'); return }
    } else {
      if (!senderNumber.trim()) { toast.error('Enter your bKash/Nagad number'); return }
      if (!transactionId.trim()) { toast.error('Enter the transaction ID'); return }
    }
    if (!payingDue || !student || !batch) return

    setSubmittingPayment(true)
    try {
      const amountDue = payingDue.due_amount - (payingDue.paid_amount || 0)
      const isRef = payMethod === 'referral'
      const { error } = await supabase.from('payment_submissions').insert({
        student_id: student.id,
        batch_id: batchId,
        fee_due_id: payingDue.id,
        amount: amountDue,
        total_fee: amountDue,
        due_amount: 0,
        payment_method: payMethod,
        sender_number: isRef ? referralName.trim() : senderNumber.trim(),
        transaction_id: isRef ? `REF-${Date.now().toString(36).toUpperCase()}` : transactionId.trim(),
        status: 'pending',
        notes: isRef 
          ? `Referral: ${referralName.trim()} | Reason: ${referralReason.trim()}`
          : `Due payment for ${payingDue.due_month}`,
      })
      if (error) throw error

      toast.success(isRef ? 'Referral payment request submitted for admin approval!' : 'Payment submitted! Admin will verify and update your dues.')
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
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (error || !batch) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <div className="rounded-2xl bg-red-50 p-6 text-red-600 border border-red-100 flex flex-col items-center justify-center gap-4">
          <AlertCircle className="h-10 w-10" />
          <h2 className="text-xl font-semibold">Error Loading Batch</h2>
          <p>{error || 'Batch details could not be found.'}</p>
          <Link href="/student/profile" className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">
            Return to Profile
          </Link>
        </div>
      </div>
    )
  }

  const presentCount = attendance.filter(a => a.status === 'present').length
  const attendancePercentage = attendance.length > 0 
    ? Math.round((presentCount / attendance.length) * 100) 
    : 0
    
  const totalDuesAmount = dues.reduce((sum, due) => sum + (due.due_amount - (due.paid_amount || 0)), 0)

  return (
    <>
    <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6 pb-20">
      {/* Header & Back Button */}
      <div className="flex items-center gap-4">
        <Link 
          href="/student/profile" 
          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Profile
        </Link>
      </div>

      {/* Batch Header Card */}
      <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 p-8 text-white shadow-lg overflow-hidden relative">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-indigo-900 opacity-20 rounded-full blur-2xl"></div>
        
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-semibold tracking-wider uppercase mb-4 backdrop-blur-sm border border-white/10">
                {batch.subject}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">{batch.name}</h1>
              <div className="flex items-center gap-2 text-indigo-100 mt-2">
                <User className="h-4 w-4 opacity-80" />
                <span>{batch.teacher?.name || 'TBA'}</span>
              </div>
            </div>
            
            <div className="flex flex-col gap-3 bg-black/10 p-5 rounded-2xl border border-white/10 backdrop-blur-sm md:min-w-64">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-indigo-200" />
                <div>
                  <div className="text-xs text-indigo-200 uppercase tracking-wider font-semibold">Schedule</div>
                  <div className="font-medium text-white">{batch.schedule || 'Not scheduled'}</div>
                </div>
              </div>
              <div className="h-px bg-white/10 w-full my-1"></div>
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-indigo-200" />
                <div>
                  <div className="text-xs text-indigo-200 uppercase tracking-wider font-semibold">Room</div>
                  <div className="font-medium text-white">{batch.room?.name || 'TBA'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row — clickable to jump to tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => setActiveTab('attendance')}
          className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-center text-left hover:border-emerald-300 hover:shadow-md hover:bg-emerald-50/30 transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium">Attendance</span>
          </div>
          <div className={`text-2xl font-bold ${attendancePercentage >= 75 ? 'text-emerald-600' : attendancePercentage >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{attendancePercentage}%</div>
          <div className="text-xs text-slate-400 mt-1">{presentCount} of {attendance.length} days</div>
          <div className="text-xs text-emerald-600 font-semibold mt-2 opacity-0 group-hover:opacity-100 transition-opacity">View details →</div>
        </button>

        <button
          onClick={() => setActiveTab('fees')}
          className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-center text-left hover:border-rose-300 hover:shadow-md hover:bg-rose-50/30 transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <CreditCard className="h-4 w-4 text-rose-500" />
            <span className="text-sm font-medium">Pending Dues</span>
          </div>
          <div className={`text-2xl font-bold ${totalDuesAmount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{formatCurrency(totalDuesAmount)}</div>
          <div className="text-xs text-slate-400 mt-1">{dues.length} pending items</div>
          <div className="text-xs text-rose-600 font-semibold mt-2 opacity-0 group-hover:opacity-100 transition-opacity">{dues.length > 0 ? 'Pay now →' : 'View history →'}</div>
        </button>

        <button
          onClick={() => setActiveTab('exams')}
          className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-center text-left hover:border-indigo-300 hover:shadow-md hover:bg-indigo-50/30 transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <GraduationCap className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-medium">Exams Taken</span>
          </div>
          <div className="text-2xl font-bold text-slate-800">{examResults.length}</div>
          <div className="text-xs text-slate-400 mt-1">Recorded results</div>
          <div className="text-xs text-indigo-600 font-semibold mt-2 opacity-0 group-hover:opacity-100 transition-opacity">View results →</div>
        </button>

        <button
          onClick={() => setActiveTab('materials')}
          className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-center text-left hover:border-blue-300 hover:shadow-md hover:bg-blue-50/30 transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <BookOpen className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">Materials</span>
          </div>
          <div className="text-2xl font-bold text-slate-800">{materials.length}</div>
          <div className="text-xs text-slate-400 mt-1">Issued items</div>
          <div className="text-xs text-blue-600 font-semibold mt-2 opacity-0 group-hover:opacity-100 transition-opacity">View items →</div>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto py-2 no-scrollbar gap-2 sticky top-0 bg-slate-50/90 backdrop-blur z-20 -mx-4 px-4 md:mx-0 md:px-0">
        {[
          { id: 'info', label: 'Info', icon: Info },
          { id: 'attendance', label: 'Attendance', icon: CheckCircle2 },
          { id: 'fees', label: 'Fees & Dues', icon: CreditCard },
          { id: 'exams', label: 'Exam Results', icon: GraduationCap },
          { id: 'materials', label: 'Materials', icon: BookOpen },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap
              ${activeTab === tab.id 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}
            `}
          >
            <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? 'opacity-100' : 'opacity-70'}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-h-[400px]">
        {/* INFO TAB */}
        {activeTab === 'info' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
              <Info className="h-5 w-5 text-indigo-500" />
              Batch Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                  <div className="text-sm text-slate-500 font-medium">Batch Name</div>
                  <div className="col-span-2 text-sm font-medium text-slate-900">{batch.name}</div>
                </div>
                <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                  <div className="text-sm text-slate-500 font-medium">Subject</div>
                  <div className="col-span-2 text-sm font-medium text-slate-900">{batch.subject}</div>
                </div>
                <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                  <div className="text-sm text-slate-500 font-medium">Class Level</div>
                  <div className="col-span-2 text-sm font-medium text-slate-900">{batch.class_level || 'N/A'}</div>
                </div>
                <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                  <div className="text-sm text-slate-500 font-medium">Teacher</div>
                  <div className="col-span-2 text-sm font-medium text-slate-900">{batch.teacher?.name || 'TBA'}</div>
                </div>
                <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                  <div className="text-sm text-slate-500 font-medium">Schedule</div>
                  <div className="col-span-2 text-sm font-medium text-slate-900">{batch.schedule || 'N/A'}</div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                  <div className="text-sm text-slate-500 font-medium">Fee Type</div>
                  <div className="col-span-2 text-sm font-medium text-slate-900 capitalize">{batch.fee_type || 'N/A'}</div>
                </div>
                <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                  <div className="text-sm text-slate-500 font-medium">Monthly Fee</div>
                  <div className="col-span-2 text-sm font-medium text-slate-900">{formatCurrency(batch.monthly_fee || 0)}</div>
                </div>
                <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                  <div className="text-sm text-slate-500 font-medium">Admission Fee</div>
                  <div className="col-span-2 text-sm font-medium text-slate-900">{formatCurrency(batch.admission_fee || 0)}</div>
                </div>
                <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                  <div className="text-sm text-slate-500 font-medium">Start Date</div>
                  <div className="col-span-2 text-sm font-medium text-slate-900">{batch.start_date ? formatDate(batch.start_date) : 'N/A'}</div>
                </div>
                <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                  <div className="text-sm text-slate-500 font-medium">End Date</div>
                  <div className="col-span-2 text-sm font-medium text-slate-900">{batch.end_date ? formatDate(batch.end_date) : 'N/A'}</div>
                </div>
              </div>
            </div>
            
            {enrollment && (
              <div className="mt-8 pt-6 border-t border-slate-100">
                <h4 className="text-md font-semibold text-slate-800 mb-4">Enrollment Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-sm text-slate-500 font-medium">Enrollment Date</div>
                    <div className="col-span-2 text-sm font-medium text-slate-900">{formatDate(enrollment.enrollment_date)}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-sm text-slate-500 font-medium">Status</div>
                    <div className="col-span-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-md ${
                        enrollment.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                        enrollment.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {enrollment.status || 'active'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ATTENDANCE TAB */}
        {activeTab === 'attendance' && (
          <div>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-indigo-500" />
                Attendance Record
              </h3>
              <div className="text-sm font-medium px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-slate-600">
                Overall: <span className={attendancePercentage >= 75 ? 'text-emerald-600' : attendancePercentage >= 50 ? 'text-amber-500' : 'text-red-500'}>{attendancePercentage}%</span>
              </div>
            </div>
            
            {attendance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendance.map((record: any, idx: number) => (
                      <tr key={record.id || idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-700">
                          {formatDate(record.date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            record.status === 'present' ? 'bg-emerald-100 text-emerald-700' : 
                            record.status === 'absent' ? 'bg-rose-100 text-rose-700' : 
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {record.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {record.note || <span className="text-slate-400 italic">No notes</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500">
                <Calendar className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p>No attendance records found for this batch.</p>
              </div>
            )}
          </div>
        )}

        {/* FEES & DUES TAB */}
        {activeTab === 'fees' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-indigo-500" />
              Pending Dues
            </h3>
            
            {dues.length > 0 ? (
              <div className="grid gap-4 mb-8">
                {dues.map((due: any, idx: number) => (
                  <div key={due.id || idx} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-rose-100 bg-rose-50/50 gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-rose-100 text-rose-600 rounded-lg shrink-0 mt-0.5">
                        <AlertCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-800">Fee for {due.due_month ? new Date(due.due_month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'Unknown Month'}</h4>
                        <p className="text-sm text-slate-600 mt-1">
                          Amount due: <span className="font-semibold text-slate-900">{formatCurrency(due.due_amount - (due.paid_amount || 0))}</span>
                          {due.paid_amount > 0 && <span className="text-slate-400 ml-2">(৳{due.paid_amount} already paid)</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-start md:self-auto">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 capitalize border border-rose-200">
                        {due.status}
                      </span>
                      <button
                        onClick={() => { setPayingDue(due); setPayMethod('bkash'); setSenderNumber(''); setTransactionId('') }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                        <DollarSign className="h-4 w-4" />
                        Pay Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 mb-8 text-center text-slate-500 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-400 mb-3" />
                <p className="font-medium text-emerald-800">All caught up!</p>
                <p className="text-sm mt-1">No pending dues for this batch.</p>
              </div>
            )}
            
            <h3 className="text-lg font-semibold text-slate-800 mb-4 mt-8 flex items-center gap-2 pt-6 border-t border-slate-100">
              <FileText className="h-5 w-5 text-indigo-500" />
              Payment History
            </h3>
            
            {payments.length > 0 ? (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 font-medium">Amount</th>
                      <th className="px-6 py-4 font-medium">Method</th>
                      <th className="px-6 py-4 font-medium">Receipt No</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((payment: any, idx: number) => (
                      <tr key={payment.id || idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-700">
                          {formatDate(payment.paid_at)}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-900">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="px-6 py-4">
                          {(() => {
                            const isRef = payment.payment_method?.toLowerCase() === 'referral' || (payment.notes && payment.notes.toLowerCase().includes('referral'))
                            const matchRef = payment.notes?.match(/Referral:\s*([^|]+)/i)
                            const matchReason = payment.notes?.match(/Reason:\s*(.+)/i)
                            return isRef ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 uppercase border border-purple-200">
                                  Referral
                                </span>
                                {matchRef && (
                                  <p className="text-xs font-semibold text-purple-900">
                                    Ref: {matchRef[1].trim()}
                                  </p>
                                )}
                                {matchReason && (
                                  <p className="text-[11px] text-purple-700 italic">
                                    {matchReason[1].trim()}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="capitalize">{payment.payment_method || '-'}</span>
                            )
                          })()}
                        </td>
                        <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                          {payment.receipt_number || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold ${
                            payment.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {payment.status || 'completed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 border border-slate-200 border-dashed rounded-xl">
                <p>No payment history found for this batch.</p>
              </div>
            )}
          </div>
        )}

        {/* EXAM RESULTS TAB */}
        {activeTab === 'exams' && (
          <div>
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-indigo-500" />
                Exam Results & Batch Merit List
              </h3>
              <p className="text-xs text-slate-500">
                Click <strong className="font-semibold text-indigo-600">Batch Merit List</strong> to view class ranks
              </p>
            </div>
            
            {examResults.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 font-medium">Exam Name</th>
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 font-medium">My Marks</th>
                      <th className="px-6 py-4 font-medium">%</th>
                      <th className="px-6 py-4 font-medium">Grade</th>
                      <th className="px-6 py-4 font-medium text-right">Batch Results</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {examResults.map((result: any, idx: number) => {
                      const totalMarks = Number(result.exam?.total_marks) || 100
                      const rawObtained = result.obtained_marks ?? result.marks_obtained
                      const obtained = rawObtained != null && rawObtained !== "" ? Number(rawObtained) : 0
                      const percentage = totalMarks > 0 ? Math.round((obtained / totalMarks) * 100) : 0
                      const passMarks = Number(result.exam?.pass_marks) || 0
                      const passed = obtained >= passMarks
                      
                      // Check if results are public to batch or private
                      const isPublic = result.exam?.show_all_results !== false && !result.exam?.result_note?.includes('[SHOW_ALL_RESULTS:false]')

                      return (
                        <tr key={result.id || idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-800">
                            <div>
                              <span>{result.exam?.title || 'Unknown Exam'}</span>
                              {result.exam?.subject && (
                                <span className="ml-2 text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-medium">
                                  {result.exam.subject}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                            {result.exam?.exam_date ? formatDate(result.exam.exam_date) : '-'}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-semibold text-slate-900">{obtained}</span>
                            <span className="text-slate-400"> / {totalMarks}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`font-semibold ${passed ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {percentage}%
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              {result.grade || (passed ? 'Pass' : 'Fail')}
                            </span>
                            {result.rank && (
                              <span className="ml-1.5 inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                Rank #{result.rank}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            {isPublic ? (
                              <button
                                onClick={() => handleOpenLeaderboard(result.exam || { id: result.exam_id, title: result.exam?.title, total_marks: totalMarks, pass_marks: passMarks, subject: result.exam?.subject })}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition-colors border border-indigo-200/80 shadow-xs cursor-pointer active:scale-95"
                              >
                                <Users className="w-3.5 h-3.5 text-indigo-600" />
                                Batch Merit List
                              </button>
                            ) : (
                              <span 
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 font-semibold rounded-xl text-xs border border-amber-200/80"
                                title="Exam marks are kept private. Only your own score is visible."
                              >
                                <Lock className="w-3.5 h-3.5 text-amber-600" />
                                Private (Only You)
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-16 text-center text-slate-500">
                <FileText className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p>No exam results recorded for this batch yet.</p>
              </div>
            )}
          </div>
        )}

        {/* MATERIALS TAB */}
        {activeTab === 'materials' && (
          <div>
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-500" />
                Issued Materials
              </h3>
            </div>
            
            {materials.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 font-medium">Item</th>
                      <th className="px-6 py-4 font-medium">Type</th>
                      <th className="px-6 py-4 font-medium">Issued Date</th>
                      <th className="px-6 py-4 font-medium">Due Date</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {materials.map((item: any, idx: number) => {
                      const isReturned = !!item.returned_at
                      const isOverdue = !isReturned && item.return_due_date && new Date(item.return_due_date) < new Date()
                      
                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-800">
                            {item.material?.name || 'Unknown Item'}
                          </td>
                          <td className="px-6 py-4 capitalize text-slate-500">
                            {item.material?.type || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {item.issued_at ? formatDate(item.issued_at) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {item.return_due_date ? formatDate(item.return_due_date) : '-'}
                          </td>
                          <td className="px-6 py-4">
                            {isReturned ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                                Returned on {formatDate(item.returned_at)}
                              </span>
                            ) : isOverdue ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                                Overdue
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                                Issued
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-16 text-center text-slate-500">
                <BookOpen className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p>No materials have been issued to you for this batch.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    {/* Pay Due Modal */}
    {payingDue && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
          {/* Modal Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Pay Due</h2>
                <p className="text-indigo-200 text-sm mt-0.5">
                  {payingDue.due_month ? new Date(payingDue.due_month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'Fee Payment'}
                </p>
              </div>
              <button
                onClick={() => setPayingDue(null)}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 bg-white/10 rounded-2xl p-4 border border-white/20">
              <p className="text-xs text-indigo-200 uppercase tracking-wider font-semibold">Amount to Pay</p>
              <p className="text-3xl font-extrabold mt-1">
                {formatCurrency(payingDue.due_amount - (payingDue.paid_amount || 0))}
              </p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Payment Method Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Payment Method</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'bkash', label: 'bKash' },
                  { id: 'nagad', label: 'Nagad' },
                  { id: 'rocket', label: 'Rocket' },
                  { id: 'referral', label: 'Referral' },
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setPayMethod(m.id)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                      payMethod === m.id
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {payMethod === 'referral' ? (
              <div className="space-y-3.5 bg-purple-50/80 p-4 rounded-2xl border border-purple-200 animate-in fade-in duration-150">
                <div>
                  <label className="block text-xs font-bold text-purple-900 uppercase tracking-wider mb-1.5">
                    Referral Student Name / ID / Phone *
                  </label>
                  <input
                    value={referralName}
                    onChange={e => setReferralName(e.target.value)}
                    placeholder="e.g. Tanvir Ahmed (MS-10023)"
                    className="w-full px-3.5 py-2.5 border border-purple-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-purple-900 font-medium"
                  />
                  <p className="text-[11px] text-purple-600 mt-1">Mention the name or Student ID of the student who referred you or whom you referred.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-900 uppercase tracking-wider mb-1.5">
                    Reason for Referral Adjustment *
                  </label>
                  <input
                    value={referralReason}
                    onChange={e => setReferralReason(e.target.value)}
                    placeholder="e.g. Referral bonus / admission discount reward"
                    className="w-full px-3.5 py-2.5 border border-purple-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-purple-900"
                  />
                  <p className="text-[11px] text-purple-600 mt-1">Admin will verify the referral details and approve your due payment.</p>
                </div>
              </div>
            ) : (
              <>
                {/* Coaching Account Number */}
                {(() => {
                  const account = paymentAccounts.find((a: any) =>
                    a.method?.toLowerCase() === payMethod || a.type?.toLowerCase() === payMethod
                  )
                  const accountNumber = account?.number || account?.account_number || null
                  return accountNumber ? (
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Send to this {payMethod} number</p>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xl font-mono font-bold text-slate-900 tracking-wider">{accountNumber}</p>
                        <button
                          onClick={() => copyNumber(accountNumber)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          {copied === accountNumber ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                          {copied === accountNumber ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      {account?.account_name && <p className="text-xs text-slate-400 mt-1">Account: {account.account_name}</p>}
                    </div>
                  ) : (
                    <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
                      <p className="text-sm text-amber-700 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        Contact admin for the {payMethod} payment number.
                      </p>
                    </div>
                  )
                })()}

                {/* Sender Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Your {payMethod} Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      value={senderNumber}
                      onChange={e => setSenderNumber(e.target.value)}
                      placeholder="01XXXXXXXXX"
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Transaction ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Transaction ID</label>
                  <div className="relative">
                    <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      value={transactionId}
                      onChange={e => setTransactionId(e.target.value)}
                      placeholder="e.g. 8A2BF9KL3P"
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Enter the TrxID from your {payMethod} confirmation SMS.</p>
                </div>
              </>
            )}

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setPayingDue(null)}
                className="flex-1 py-3 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handlePayDue}
                disabled={submittingPayment}
                className="flex-1 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submittingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit Payment
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Batch Merit List / Leaderboard Modal */}
    {selectedLeaderboardExam && (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedLeaderboardExam(null)}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-slate-50/80">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  {selectedLeaderboardExam.title || "Batch Merit List"}
                </h2>
                {selectedLeaderboardExam.subject && (
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold border border-indigo-200/60">
                    {selectedLeaderboardExam.subject}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Batch: {batch?.name || "Class"} • Total Marks: {selectedLeaderboardExam.total_marks || 100} • Pass Marks: {selectedLeaderboardExam.pass_marks || 33}
              </p>
            </div>
            <button onClick={() => setSelectedLeaderboardExam(null)} className="p-2 hover:bg-gray-200/60 rounded-xl transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto flex-1">
            {leaderboardLoading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                <p className="text-sm font-medium text-gray-500">Loading batch merit list...</p>
              </div>
            ) : leaderboardError ? (
              <div className="py-12 text-center text-rose-500 space-y-2">
                <AlertCircle className="w-10 h-10 mx-auto" />
                <p className="font-semibold">{leaderboardError}</p>
              </div>
            ) : leaderboardResults.length > 0 ? (
              <div className="overflow-x-auto border border-gray-200 rounded-2xl">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-center w-16">Rank</th>
                      <th className="px-4 py-3 font-semibold">Student</th>
                      <th className="px-4 py-3 font-semibold">Student ID</th>
                      <th className="px-4 py-3 font-semibold">Marks</th>
                      <th className="px-4 py-3 font-semibold">%</th>
                      <th className="px-4 py-3 font-semibold">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(() => {
                      const sorted = [...leaderboardResults].sort((a: any, b: any) => {
                        const marksA = Number(a.obtained_marks) || 0
                        const marksB = Number(b.obtained_marks) || 0
                        return marksB - marksA
                      })

                      let currentRank = 1
                      return sorted.map((r: any, idx: number) => {
                        if (idx > 0) {
                          const prev = Number(sorted[idx - 1].obtained_marks) || 0
                          const cur = Number(r.obtained_marks) || 0
                          if (cur < prev) currentRank = idx + 1
                        }
                        const rankNum = currentRank
                        const isMe = r.is_current_student || (student && r.student_id === student.id)
                        const obt = Number(r.obtained_marks) || 0
                        const total = Number(selectedLeaderboardExam?.total_marks) || 100
                        const pct = total > 0 ? Math.round((obt / total) * 100) : 0
                        const passM = Number(selectedLeaderboardExam?.pass_marks) || 0
                        const passed = obt >= passM

                        return (
                          <tr 
                            key={r.id || idx} 
                            className={`transition-colors ${
                              isMe 
                                ? "bg-indigo-50/80 font-medium text-indigo-950 border-l-4 border-indigo-600" 
                                : "hover:bg-gray-50/60"
                            }`}
                          >
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              {rankNum === 1 ? (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-black text-xs border border-amber-300 shadow-xs">
                                  🥇 1
                                </span>
                              ) : rankNum === 2 ? (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-200 text-slate-800 font-black text-xs border border-slate-300">
                                  🥈 2
                                </span>
                              ) : rankNum === 3 ? (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-50 text-amber-900 font-black text-xs border border-amber-200">
                                  🥉 3
                                </span>
                              ) : (
                                <span className="font-bold text-gray-500 text-xs">#{rankNum}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900">{r.student?.name || "Student"}</span>
                                {isMe && (
                                  <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-extrabold rounded-full">
                                    YOU
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-500">
                              {r.student?.student_id || "-"}
                            </td>
                            <td className="px-4 py-3 font-bold text-gray-900">
                              {obt} <span className="text-gray-400 font-normal">/ {total}</span>
                            </td>
                            <td className="px-4 py-3 font-semibold">
                              <span className={passed ? "text-emerald-600" : "text-rose-600"}>
                                {pct}%
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-white border border-gray-200 text-gray-800 shadow-xs">
                                {r.grade || (passed ? "Pass" : "Fail")}
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-gray-500">
                <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="font-medium">No results recorded for this exam yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  )
}
