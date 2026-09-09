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
  EyeOff,
  Package,
  Layers,
  ClipboardList,
  Building2,
  PlayCircle,
  Sparkles,
  CalendarDays,
  ExternalLink,
  Award,
  ChevronRight,
} from 'lucide-react'

export const ALL_WEEK_DAYS = [
  { id: "saturday", bn: "শনিবার", en: "Saturday" },
  { id: "sunday", bn: "রবিবার", en: "Sunday" },
  { id: "monday", bn: "সোমবার", en: "Monday" },
  { id: "tuesday", bn: "মঙ্গলবার", en: "Tuesday" },
  { id: "wednesday", bn: "বুধবার", en: "Wednesday" },
  { id: "thursday", bn: "বৃহস্পতিবার", en: "Thursday" },
  { id: "friday", bn: "শুক্রবার", en: "Friday" },
]

export function parseWeeklyDays(exam: any): any[] {
  if (!exam) return []
  const isWeekly =
    exam.exam_schedule_type === "weekly" ||
    (Array.isArray(exam.recurring_days) && exam.recurring_days.length > 0) ||
    exam.is_weekly_published === true ||
    Boolean(exam.title?.includes("সাপ্তাহিক"))

  const dayConfigMap: Record<string, any> = {}

  if (Array.isArray(exam.recurring_days) && exam.recurring_days.length > 0) {
    for (const item of exam.recurring_days) {
      const isObj = typeof item === "object" && item !== null
      const rawKey = isObj ? (item.day || item.day_bn || item.day_en || "") : String(item)
      const dayKey = String(rawKey).toLowerCase()
      const matched = ALL_WEEK_DAYS.find((d) => d.id === dayKey || d.bn === rawKey || d.en.toLowerCase() === dayKey)
      const canonicalKey = matched?.id || dayKey
      const bnName = matched?.bn || (isObj ? item.day_bn : rawKey)
      const enName = matched?.en || (isObj ? item.day_en : rawKey)
      dayConfigMap[canonicalKey] = {
        key: canonicalKey,
        day_bn: bnName,
        day_en: enName,
        exam_name: isObj && item.exam_name ? item.exam_name : `${bnName}ের পরীক্ষা`,
        subject: isObj && item.subject ? item.subject : exam.subject || "",
        total_marks: isObj && item.total_marks ? Number(item.total_marks) : 50,
        pass_marks: isObj && item.pass_marks ? Number(item.pass_marks) : 20,
      }
    }
  }

  const note = exam.result_note || ""
  if (note.includes("[WEEKLY_SCHEDULE:")) {
    try {
      const match = note.match(/\[WEEKLY_SCHEDULE:(.*?)\]/)
      if (match && match[1]) {
        const parsed = JSON.parse(match[1])
        if (Array.isArray(parsed) && parsed.length > 0) {
          for (const item of parsed) {
            const rawKey = item.day || item.day_bn || item.day_en || ""
            const dayKey = String(rawKey).toLowerCase()
            const matched = ALL_WEEK_DAYS.find((d) => d.id === dayKey || d.bn === rawKey || d.en.toLowerCase() === dayKey)
            const canonicalKey = matched?.id || dayKey
            if (!dayConfigMap[canonicalKey]) {
              dayConfigMap[canonicalKey] = {
                key: canonicalKey,
                day_bn: matched?.bn || item.day_bn || item.day,
                day_en: matched?.en || item.day_en || item.day,
                exam_name: item.exam_name || `${matched?.bn || item.day}ের পরীক্ষা`,
                subject: item.subject || exam.subject || "",
                total_marks: Number(item.total_marks) || 50,
                pass_marks: Number(item.pass_marks) || 20,
              }
            }
          }
        }
      }
    } catch {}
  }

  const foundDaysInTitle = ALL_WEEK_DAYS.filter(
    (d) => exam.title?.includes(d.bn) || exam.title?.toLowerCase()?.includes(d.id)
  )
  if (foundDaysInTitle.length > 0) {
    const subjectList = (exam.subject || "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean)

    foundDaysInTitle.forEach((d, idx) => {
      if (!dayConfigMap[d.id]) {
        const assignedSubj = subjectList[idx] || exam.subject || ""
        dayConfigMap[d.id] = {
          key: d.id,
          day_bn: d.bn,
          day_en: d.en,
          exam_name: assignedSubj ? `${assignedSubj} পরীক্ষা` : `${d.bn}ের পরীক্ষা`,
          subject: assignedSubj,
          total_marks: 50,
          pass_marks: 20,
        }
      }
    })
  }

  if (isWeekly) {
    return ALL_WEEK_DAYS.map((w) => {
      if (dayConfigMap[w.id]) {
        return dayConfigMap[w.id]
      }
      return {
        key: w.id,
        day_bn: w.bn,
        day_en: w.en,
        exam_name: `${w.bn}ের পরীক্ষা`,
        subject: exam.subject || "",
        total_marks: 50,
        pass_marks: 20,
      }
    })
  }
  return []
}

export function getExamMarksConfig(exam: any) {
  const isWeekly =
    exam?.exam_schedule_type === "weekly" ||
    (Array.isArray(exam?.recurring_days) && exam?.recurring_days.length > 0) ||
    exam?.is_weekly_published === true ||
    Boolean(exam?.title?.includes("সাপ্তাহিক"))

  if (isWeekly) {
    const days = parseWeeklyDays(exam)
    const sumTotal = days.reduce((acc, d) => acc + (Number(d.total_marks) || 50), 0)
    const sumPass = days.reduce((acc, d) => acc + (Number(d.pass_marks) || 20), 0)
    return {
      isWeekly: true,
      totalMarks: sumTotal > 0 ? sumTotal : 350,
      passMarks: sumPass > 0 ? sumPass : 140,
      days,
    }
  }

  return {
    isWeekly: false,
    totalMarks: Number(exam?.total_marks) || 100,
    passMarks: Number(exam?.pass_marks) || 33,
    days: [],
  }
}

const materialTypeBadge: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  sheet: { label: "Lecture Sheet", icon: FileText, color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  book: { label: "Book", icon: BookOpen, color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  notes: { label: "Class Notes", icon: ClipboardList, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  worksheet: { label: "Worksheet", icon: Layers, color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
  exam_paper: { label: "Question Paper", icon: FileText, color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200" },
  other: { label: "Material", icon: Package, color: "text-slate-700", bg: "bg-slate-50", border: "border-slate-200" },
}

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
  const [allExams, setAllExams] = useState<any[]>([])
  const [allBatchMaterials, setAllBatchMaterials] = useState<any[]>([])
  const [examFilter, setExamFilter] = useState<'all' | 'upcoming' | 'completed'>('all')
  const [examSubTab, setExamSubTab] = useState<'schedule' | 'results'>('results')
  const [materialFilter, setMaterialFilter] = useState<'all' | 'received' | 'pending'>('all')

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
    const marksConfig = getExamMarksConfig(exam)
    const examId = exam?.id || exam?.exam_id
    setSelectedLeaderboardExam({
      ...exam,
      id: examId,
      total_marks: marksConfig.totalMarks,
      pass_marks: marksConfig.passMarks,
      is_weekly: marksConfig.isWeekly,
      recurring_days: marksConfig.days.length > 0 ? marksConfig.days : exam?.recurring_days,
    })
    setLeaderboardLoading(true)
    setLeaderboardError(null)
    setLeaderboardResults([])
    try {
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
        setAllExams(prev => prev.map(e => {
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
        let currentProfile: any = null
        let currentEnrollment: any = null
        let profileExamResults: any[] = []
        let profileMaterials: any[] = []
        let profileMaterialIssues: any[] = []

        try {
          const profileRes = await fetch('/api/student/profile')
          if (profileRes.ok) {
            const profileJson = await profileRes.json()
            if (profileJson.student) studentData = profileJson.student
            if (profileJson.profile) currentProfile = profileJson.profile
            if (profileJson.enrollments) {
              currentEnrollment = profileJson.enrollments.find((e: any) => e.batch_id === batchId || e.batch?.id === batchId)
            }
            if (profileJson.examResults) {
              profileExamResults = profileJson.examResults
            }
            if (Array.isArray(profileJson.materials)) {
              profileMaterials = profileJson.materials
            }
            if (Array.isArray(profileJson.materialIssues)) {
              profileMaterialIssues = profileJson.materialIssues
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

          currentProfile = userProf || {
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
        
        // 6. Get batch exams (scheduled & conducted) + match with student exam results
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
              .select('*, exam:exams(id, title, exam_date, total_marks, pass_marks, batch_id, batch_ids, subject, is_online, show_all_results, result_note, duration_minutes, exam_schedule_type, recurring_days, is_paused, is_public_result)')
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

        // Fetch all batch exams (scheduled, upcoming, or past) from `exams` table
        let rawBatchExams: any[] = []
        try {
          const { data: bExams } = await supabase
            .from('exams')
            .select('*, teacher:staff(name)')
            .or(`batch_id.eq.${batchId},batch_ids.cs.["${batchId}"]`)
            .order('exam_date', { ascending: false })

          if (bExams && bExams.length > 0) {
            rawBatchExams = bExams
          } else {
            const { data: fbExams } = await supabase
              .from('exams')
              .select('*, teacher:staff(name)')
              .eq('batch_id', batchId)
              .order('exam_date', { ascending: false })
            if (fbExams) rawBatchExams = fbExams
          }
        } catch {
          const { data: fbExams } = await supabase
            .from('exams')
            .select('*, teacher:staff(name)')
            .eq('batch_id', batchId)
            .order('exam_date', { ascending: false })
          if (fbExams) rawBatchExams = fbExams
        }

        // Merge scheduled exams with student results
        const resultMap = new Map<string, any>()
        mergedExams.forEach((r: any) => {
          const eId = r.exam_id || r.exam?.id
          if (eId) resultMap.set(eId, r)
        })

        const combinedExams: any[] = []
        const seenExamIds = new Set<string>()

        // Add all batch exams
        rawBatchExams.forEach((ex: any) => {
          seenExamIds.add(ex.id)
          const matched = resultMap.get(ex.id)
          const marksConfig = getExamMarksConfig(ex)
          const total = marksConfig.totalMarks
          const pass = marksConfig.passMarks

          if (matched) {
            let studentDayMarks = matched.day_marks || null
            if (!studentDayMarks && ex.result_note?.includes("[STUDENT_DAY_MARKS:")) {
              try {
                const match = ex.result_note.match(/\[STUDENT_DAY_MARKS:(.*?)\]/)
                if (match && match[1]) {
                  const parsed = JSON.parse(match[1])
                  if (studentId && parsed[studentId]) {
                    studentDayMarks = parsed[studentId]
                  }
                }
              } catch {}
            }

            const raw = matched.obtained_marks ?? matched.marks_obtained
            let obt = raw != null && raw !== "" ? Number(raw) : 0

            if (marksConfig.isWeekly && studentDayMarks && typeof studentDayMarks === 'object') {
              let dSum = 0
              for (const v of Object.values(studentDayMarks)) {
                const m = typeof v === 'object' && v !== null ? Number((v as any).marks) : Number(v)
                if (!isNaN(m)) dSum += m
              }
              if (dSum > 0 && (obt === 0 || dSum > obt)) {
                obt = dSum
              }
            }

            const pct = total > 0 ? (obt / total) * 100 : 0
            let autoGrade = matched.grade
            if (!autoGrade || autoGrade === 'Pass' || autoGrade === 'Fail') {
              if (pct >= 80) autoGrade = 'A+'
              else if (pct >= 70) autoGrade = 'A'
              else if (pct >= 60) autoGrade = 'A-'
              else if (pct >= 50) autoGrade = 'B'
              else if (pct >= 40) autoGrade = 'C'
              else if (pct >= 33) autoGrade = 'D'
              else autoGrade = 'F'
            }

            combinedExams.push({
              id: matched.id || `exam-${ex.id}`,
              exam_id: ex.id,
              exam: {
                ...ex,
                ...matched.exam,
                total_marks: total,
                pass_marks: pass,
                recurring_days: marksConfig.days.length > 0 ? marksConfig.days : ex.recurring_days,
              },
              has_result: true,
              obtained_marks: obt,
              marks_obtained: obt,
              grade: autoGrade,
              rank: matched.rank || 1,
              day_marks: studentDayMarks,
              exam_date: ex.exam_date || matched.exam?.exam_date,
              status: 'completed',
              is_public: ex.show_all_results !== false && !ex.result_note?.includes('[SHOW_ALL_RESULTS:false]'),
              is_weekly: marksConfig.isWeekly,
              weekly_days: marksConfig.days,
            })
          } else {
            const isUpcoming = !ex.exam_date || new Date(ex.exam_date) >= new Date(new Date().setHours(0,0,0,0)) || marksConfig.isWeekly
            combinedExams.push({
              id: `sched-${ex.id}`,
              exam_id: ex.id,
              exam: {
                ...ex,
                total_marks: total,
                pass_marks: pass,
                recurring_days: marksConfig.days.length > 0 ? marksConfig.days : ex.recurring_days,
              },
              has_result: false,
              obtained_marks: null,
              marks_obtained: null,
              grade: null,
              rank: null,
              day_marks: null,
              exam_date: ex.exam_date,
              status: isUpcoming ? 'upcoming' : 'pending_result',
              is_public: false,
              is_weekly: marksConfig.isWeekly,
              weekly_days: marksConfig.days,
            })
          }
        })

        // Add any standalone student results not in rawBatchExams
        mergedExams.forEach((r: any) => {
          const eId = r.exam_id || r.exam?.id
          if (eId && !seenExamIds.has(eId)) {
            const marksConfig = getExamMarksConfig(r.exam || { id: eId, title: 'Exam' })
            const total = marksConfig.totalMarks
            const pass = marksConfig.passMarks
            const raw = r.obtained_marks ?? r.marks_obtained
            let obt = raw != null && raw !== "" ? Number(raw) : 0

            let studentDayMarks = r.day_marks || null
            if (marksConfig.isWeekly && studentDayMarks && typeof studentDayMarks === 'object') {
              let dSum = 0
              for (const v of Object.values(studentDayMarks)) {
                const m = typeof v === 'object' && v !== null ? Number((v as any).marks) : Number(v)
                if (!isNaN(m)) dSum += m
              }
              if (dSum > 0 && (obt === 0 || dSum > obt)) {
                obt = dSum
              }
            }

            const pct = total > 0 ? (obt / total) * 100 : 0
            let autoGrade = r.grade
            if (!autoGrade || autoGrade === 'Pass' || autoGrade === 'Fail') {
              if (pct >= 80) autoGrade = 'A+'
              else if (pct >= 70) autoGrade = 'A'
              else if (pct >= 60) autoGrade = 'A-'
              else if (pct >= 50) autoGrade = 'B'
              else if (pct >= 40) autoGrade = 'C'
              else if (pct >= 33) autoGrade = 'D'
              else autoGrade = 'F'
            }

            combinedExams.push({
              id: r.id || `res-${eId}`,
              exam_id: eId,
              exam: {
                ...(r.exam || { id: eId, title: 'Exam', total_marks: 100 }),
                total_marks: total,
                pass_marks: pass,
                recurring_days: marksConfig.days.length > 0 ? marksConfig.days : r.exam?.recurring_days,
              },
              has_result: true,
              obtained_marks: obt,
              marks_obtained: obt,
              grade: autoGrade,
              rank: r.rank || 1,
              day_marks: studentDayMarks,
              exam_date: r.exam?.exam_date,
              status: 'completed',
              is_public: r.exam?.show_all_results !== false && !r.exam?.result_note?.includes('[SHOW_ALL_RESULTS:false]'),
              is_weekly: marksConfig.isWeekly,
              weekly_days: marksConfig.days,
            })
          }
        })

        setAllExams(combinedExams)
        setExamResults(combinedExams.filter(e => e.has_result))

        // 7. Get batch materials & student material issues
        let combinedMaterials: any[] = []

        // Primary: Load directly from dedicated server API
        try {
          const apiMatRes = await fetch(`/api/student/batch/${batchId}/materials`)
          if (apiMatRes.ok) {
            const apiJson = await apiMatRes.json()
            if (Array.isArray(apiJson.materials) && apiJson.materials.length > 0) {
              combinedMaterials = apiJson.materials
            }
          }
        } catch (apiMatErr) {
          console.warn("API batch materials fetch notice:", apiMatErr)
        }

        // Secondary / Fallback: Combine with profileMaterials and direct query
        if (combinedMaterials.length === 0) {
          let rawBatchMaterials: any[] = []
          try {
            const { data: allMats } = await supabase
              .from('materials')
              .select('*')
              .order('created_at', { ascending: false })

            let candidateMaterials: any[] = allMats && allMats.length > 0 ? allMats : []

            // Merge from profile API if candidateMaterials is empty
            if (candidateMaterials.length === 0 && profileMaterials.length > 0) {
              candidateMaterials = profileMaterials
            }

            const bIdStr = String(batchId)
            const currentBatchName = batchData?.name || currentEnrollment?.batch?.name || ''
            const currentBranchId = batchData?.branch_id || currentEnrollment?.batch?.branch_id || ''

            rawBatchMaterials = candidateMaterials.filter((m: any) => {
              if (!m) return false

              // 1. Single batch match
              if (m.batch_id && String(m.batch_id) === bIdStr) return true

              // 2. Multi batch match via batch_ids
              if (m.batch_ids) {
                if (Array.isArray(m.batch_ids)) {
                  if (m.batch_ids.some((bid: any) => String(bid) === bIdStr)) return true
                } else if (typeof m.batch_ids === 'string') {
                  try {
                    const parsed = JSON.parse(m.batch_ids)
                    if (Array.isArray(parsed) && parsed.some((bid: any) => String(bid) === bIdStr)) return true
                  } catch {
                    if (m.batch_ids.includes(bIdStr)) return true
                  }
                }
              }

              // 3. Batch Name / Class match
              if (currentBatchName) {
                const bNameLower = currentBatchName.trim().toLowerCase()
                if (m.batch_name && String(m.batch_name).trim().toLowerCase() === bNameLower) return true
                if (m.subject && String(m.subject).trim().toLowerCase() === bNameLower) return true
                if (Array.isArray(m.batch_names) && m.batch_names.some((bn: any) => String(bn).trim().toLowerCase() === bNameLower)) return true
              }

              // 3.5. Course match
              if (m.course_id && String(m.course_id) === bIdStr) return true

              // 4. Material with no specific batch or course (general material)
              const hasNoTarget = (!m.batch_id || m.batch_id === "" || m.batch_id === "all") &&
                (!m.batch_ids || (Array.isArray(m.batch_ids) && m.batch_ids.length === 0) || m.batch_ids === "[]") &&
                !m.course_id

              if (hasNoTarget) {
                if (m.branch_id && currentBranchId) {
                  return String(m.branch_id) === String(currentBranchId)
                }
                return true
              }

              return false
            })
          } catch (mCatchErr) {
            console.warn("Materials loading error in batch page:", mCatchErr)
          }

          let studentIssues: any[] = profileMaterialIssues || []
          const candidateSids = Array.from(new Set([
            studentId,
            studentData?.id,
            studentData?.student_id,
            currentProfile?.user_id,
          ].filter(Boolean)))

          if (studentIssues.length === 0 && candidateSids.length > 0) {
            try {
              const { data: materialData } = await supabase
                .from('material_issues')
                .select('*, material:materials(*)')
                .in('student_id', candidateSids)

              if (materialData) {
                studentIssues = materialData
              }
            } catch (mErr) {
              console.warn('Material issues fetch note:', mErr)
            }
          }

          // Map received materials
          const issuesMap = new Map<string, any>()
          studentIssues.forEach((iss: any) => {
            if (iss.material_id) issuesMap.set(String(iss.material_id), iss)
          })

          const seenMatIds = new Set<string>()

          rawBatchMaterials.forEach((mat: any) => {
            seenMatIds.add(String(mat.id))
            const iss = issuesMap.get(String(mat.id))
            combinedMaterials.push({
              id: mat.id,
              material: mat,
              is_received: !!iss && iss.status !== 'returned',
              is_returned: !!iss?.returned_at || iss?.status === 'returned',
              issue_record: iss || null,
              issued_at: iss?.issued_at || null,
              return_due_date: iss?.return_due_date || null,
              returned_at: iss?.returned_at || null,
            })
          })

          // Add any student issues for this batch not in rawBatchMaterials
          studentIssues.forEach((iss: any) => {
            if (iss.material_id && !seenMatIds.has(String(iss.material_id))) {
              const isThisBatch = iss.batch_id === batchId || 
                iss.material?.batch_id === batchId || 
                iss.material?.course_id === batchId ||
                (Array.isArray(iss.material?.batch_ids) && iss.material.batch_ids.includes(batchId)) ||
                !iss.material?.batch_id

              if (isThisBatch && iss.material) {
                combinedMaterials.push({
                  id: iss.material_id,
                  material: iss.material,
                  is_received: iss.status !== 'returned',
                  is_returned: !!iss.returned_at || iss.status === 'returned',
                  issue_record: iss,
                  issued_at: iss.issued_at,
                  return_due_date: iss.return_due_date,
                  returned_at: iss.returned_at,
                })
              }
            }
          })
        }

        setAllBatchMaterials(combinedMaterials)
        setMaterials(combinedMaterials.filter((m: any) => m.is_received).map(m => m.issue_record || m))

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
            <span className="text-sm font-medium">Exams & Schedule</span>
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {allExams.filter(e => e.has_result).length} <span className="text-sm font-normal text-slate-400">/ {allExams.length}</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {allExams.filter(e => !e.has_result && e.status === 'upcoming').length > 0
              ? `${allExams.filter(e => !e.has_result && e.status === 'upcoming').length} upcoming scheduled`
              : `${allExams.filter(e => e.has_result).length} results recorded`}
          </div>
          <div className="text-xs text-indigo-600 font-semibold mt-2 opacity-0 group-hover:opacity-100 transition-opacity">View schedule & results →</div>
        </button>

        <button
          onClick={() => setActiveTab('materials')}
          className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-center text-left hover:border-blue-300 hover:shadow-md hover:bg-blue-50/30 transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <BookOpen className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">Materials & Sheets</span>
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {allBatchMaterials.filter(m => m.is_received).length} <span className="text-sm font-normal text-slate-400">/ {allBatchMaterials.length}</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {allBatchMaterials.filter(m => m.is_received).length} received ({allBatchMaterials.filter(m => !m.is_received).length} available)
          </div>
          <div className="text-xs text-blue-600 font-semibold mt-2 opacity-0 group-hover:opacity-100 transition-opacity">View items & status →</div>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto py-2 no-scrollbar gap-2 sticky top-0 bg-slate-50/90 backdrop-blur z-20 -mx-4 px-4 md:mx-0 md:px-0">
        {[
          { id: 'info', label: 'Info', icon: Info },
          { id: 'attendance', label: 'Attendance', icon: CheckCircle2 },
          { id: 'fees', label: 'Fees & Dues', icon: CreditCard },
          { id: 'exams', label: 'Exams & Results', icon: GraduationCap },
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

        {/* EXAMS & RESULTS TAB */}
        {activeTab === 'exams' && (() => {
          const completedResults = allExams.filter((item: any) => item.has_result)
          const weeklyRoutineExams = allExams.filter((item: any) => item.is_weekly)
          const upcomingOneTimeExams = allExams.filter((item: any) => !item.has_result && item.status === 'upcoming' && !item.is_weekly)
          const scheduledCount = weeklyRoutineExams.length + upcomingOneTimeExams.length

          // Performance metrics for Results KPI
          const totalRecorded = completedResults.length
          const totalPct = completedResults.reduce((acc: number, item: any) => {
            const totM = Number(item.exam?.total_marks) || 100
            const obt = Number(item.obtained_marks) || 0
            return acc + (totM > 0 ? (obt / totM) * 100 : 0)
          }, 0)
          const averageScore = totalRecorded > 0 ? Math.round(totalPct / totalRecorded) : 0
          const passedCount = completedResults.filter((item: any) => {
            const passM = Number(item.exam?.pass_marks) || 0
            const obt = Number(item.obtained_marks) || 0
            return obt >= passM
          }).length
          const bestRank = completedResults.length > 0 
            ? Math.min(...completedResults.map((r: any) => Number(r.rank) || 999).filter((rk: number) => rk > 0))
            : 1

          return (
            <div>
              {/* Header & Sub-navigation bar */}
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-indigo-500" />
                    Exam Schedule & Results (পরীক্ষার সময়সূচী ও ফলাফল)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    সময়সূচী (Schedule) এবং অনলাইন ও অফলাইন পরীক্ষার ফলাফল (Result) দেখুন।
                  </p>
                </div>

                {/* Sub-Tabs: Schedule vs Result */}
                <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-2xl border border-slate-200 self-start sm:self-auto shadow-inner">
                  <button
                    type="button"
                    onClick={() => setExamSubTab('schedule')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      examSubTab === 'schedule'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                    }`}
                  >
                    <CalendarDays className="w-4 h-4 text-indigo-600" />
                    <span>📅 Schedule (সময়সূচী)</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      examSubTab === 'schedule' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {scheduledCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExamSubTab('results')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      examSubTab === 'results'
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                    }`}
                  >
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <span>🏆 Result (ফলাফল)</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      examSubTab === 'results' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {completedResults.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* 1. SCHEDULE SUB-VIEW */}
              {examSubTab === 'schedule' && (
                <div className="p-6 space-y-6">
                  {/* Weekly Exam Routine Cards */}
                  {weeklyRoutineExams.map((exItem: any) => {
                    const routineDays = exItem.weekly_days && exItem.weekly_days.length > 0
                      ? exItem.weekly_days
                      : parseWeeklyDays(exItem.exam)
                    const routineTotalMarks = routineDays.reduce((acc: number, d: any) => acc + (Number(d.total_marks) || 50), 0) || 350
                    const routinePassMarks = routineDays.reduce((acc: number, d: any) => acc + (Number(d.pass_marks) || 20), 0) || 140

                    return (
                      <div key={`routine-${exItem.exam_id}`} className="bg-gradient-to-br from-indigo-50/60 via-white to-purple-50/40 rounded-3xl border border-indigo-100 p-6 shadow-xs">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-indigo-100/70">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-800 border border-purple-200">
                                <CalendarDays className="w-3.5 h-3.5 text-purple-600" />
                                সাপ্তাহিক পরীক্ষার রুটিন (Weekly Exam Routine)
                              </span>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                চলমান সূচি (Active)
                              </span>
                            </div>
                            <h4 className="text-xl font-bold text-slate-900 mt-2">
                              {exItem.exam?.title || "সাপ্তাহিক নিয়মিত পরীক্ষা"}
                            </h4>
                            <p className="text-xs text-slate-500 mt-1">
                              প্রতি সপ্তাহে শনিবার হতে শুক্রবার পর্যন্ত প্রতিদিনের নির্ধারিত বিষয়ে পরীক্ষা অনুষ্ঠিত হয়।
                            </p>
                          </div>

                          <div className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-indigo-100 shadow-2xs">
                            <div className="text-right">
                              <div className="text-[11px] text-slate-400 font-semibold uppercase">সাপ্তাহিক পূর্ণমান</div>
                              <div className="text-lg font-black text-indigo-700">{routineTotalMarks} নম্বর</div>
                            </div>
                            <div className="h-8 w-px bg-slate-200"></div>
                            <div className="text-left">
                              <div className="text-[11px] text-slate-400 font-semibold uppercase">পাস মার্ক</div>
                              <div className="text-lg font-black text-emerald-600">{routinePassMarks} নম্বর</div>
                            </div>
                          </div>
                        </div>

                        {/* 7 Days Routine Grid */}
                        <div className="mt-5">
                          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-indigo-500" />
                            ৭ দিনের পরীক্ষার সময়সূচী ও বিষয় তালিকা (Saturday – Friday)
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {routineDays.map((dayItem: any, dIdx: number) => {
                              return (
                                <div 
                                  key={dayItem.key || dIdx}
                                  className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all flex flex-col justify-between"
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                      <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-50 text-indigo-800 border border-indigo-100">
                                        {dayItem.day_bn || dayItem.day}
                                      </span>
                                      <span className="text-[11px] font-semibold text-slate-400 font-mono">
                                        {dayItem.day_en}
                                      </span>
                                    </div>
                                    <h5 className="text-sm font-bold text-slate-900 line-clamp-1">
                                      {dayItem.subject || dayItem.exam_name || "বিষয় পরীক্ষা"}
                                    </h5>
                                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                                      {dayItem.exam_name || `${dayItem.day_bn}ের পরীক্ষা`}
                                    </p>
                                  </div>

                                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                                    <span className="text-slate-500 font-medium">পূর্ণমান:</span>
                                    <span className="font-bold text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-100">
                                      {dayItem.total_marks || 50} নম্বর
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        <div className="mt-5 pt-4 border-t border-indigo-100/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            সাপ্তাহিক পরীক্ষার মূল্যায়ন শেষে মেধা তালিকা ও ফলাফল প্রস্তুত করা হয়।
                          </span>
                          {exItem.has_result && (
                            <button
                              onClick={() => setExamSubTab('results')}
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-indigo-200 shadow-2xs"
                            >
                              🏆 এই পরীক্ষার ফলাফল দেখুন →
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Upcoming / One-time Exams */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      আসন্ন অন্যান্য পরীক্ষাসমূহ (Upcoming One-time Exams)
                    </h4>
                    {upcomingOneTimeExams.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {upcomingOneTimeExams.map((item: any) => {
                          const totM = Number(item.exam?.total_marks) || 100
                          const passM = Number(item.exam?.pass_marks) || 33
                          return (
                            <div key={item.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                              <div>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    নির্ধারিত পরীক্ষা
                                  </span>
                                  {item.exam?.is_online && (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                      Online Exam
                                    </span>
                                  )}
                                </div>
                                <h5 className="text-base font-bold text-slate-900">{item.exam?.title}</h5>
                                {item.exam?.subject && (
                                  <p className="text-xs font-semibold text-indigo-600 mt-1">{item.exam?.subject}</p>
                                )}
                                <div className="flex items-center gap-4 text-xs text-slate-500 mt-3">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                    {item.exam_date ? formatDate(item.exam_date) : "তারিখ শীঘ্রই জানানো হবে"}
                                  </span>
                                  {item.exam?.duration_minutes && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                                      {item.exam.duration_minutes} মিনিট
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                                <span className="text-xs text-slate-500 font-medium">
                                  পূর্ণমান: <strong>{totM}</strong> • পাস: <strong>{passM}</strong>
                                </span>
                                {item.exam?.is_online ? (
                                  <Link
                                    href={`/student/exam/${item.exam_id}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
                                  >
                                    <PlayCircle className="w-3.5 h-3.5" />
                                    পরীক্ষা দিন →
                                  </Link>
                                ) : (
                                  <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                                    ক্লাসরুম পরীক্ষা
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : weeklyRoutineExams.length === 0 ? (
                      <div className="p-12 text-center text-slate-500 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                        <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-700">বর্তমানে নতুন কোনো পরীক্ষার তারিখ নির্ধারিত নেই।</p>
                        <p className="text-xs text-slate-400 mt-0.5">নতুন পরীক্ষা যোগ করা হলে তা এখানে দেখা যাবে।</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* 2. RESULT SUB-VIEW (Accurate Homepage Result Values) */}
              {examSubTab === 'results' && (
                <div className="p-6 space-y-6">
                  {/* KPI Summary Cards */}
                  {completedResults.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
                          <GraduationCap className="w-4 h-4 text-indigo-600" />
                          মোট পরীক্ষা
                        </div>
                        <div className="text-2xl font-black text-slate-900">{completedResults.length} টি</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">ফলাফল প্রকাশিত</div>
                      </div>

                      <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mb-1">
                          <Sparkles className="w-4 h-4 text-emerald-600" />
                          গড় প্রাপ্ত নম্বর
                        </div>
                        <div className="text-2xl font-black text-emerald-700">{averageScore}%</div>
                        <div className="text-[11px] text-emerald-600/80 mt-0.5">সামগ্রিক পারফর্ম্যান্স</div>
                      </div>

                      <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 mb-1">
                          <Trophy className="w-4 h-4 text-amber-600" />
                          সেরা অবস্থান
                        </div>
                        <div className="text-2xl font-black text-amber-700">Rank #{bestRank || 1}</div>
                        <div className="text-[11px] text-amber-600/80 mt-0.5">ব্যাচ মেধা তালিকায়</div>
                      </div>

                      <div className="bg-purple-50/50 rounded-2xl p-4 border border-purple-100">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 mb-1">
                          <Award className="w-4 h-4 text-purple-600" />
                          পাস ফলাফল
                        </div>
                        <div className="text-2xl font-black text-purple-700">{passedCount} / {completedResults.length}</div>
                        <div className="text-[11px] text-purple-600/80 mt-0.5">কৃতকার্য হয়েছেন</div>
                      </div>
                    </div>
                  )}

                  {/* Result Cards / Table */}
                  {completedResults.length > 0 ? (
                    <div className="space-y-4">
                      {completedResults.map((item: any, idx: number) => {
                        const isWeeklyExam = item.is_weekly ||
                          item.exam?.exam_schedule_type === 'weekly' ||
                          (Array.isArray(item.exam?.recurring_days) && item.exam?.recurring_days.length > 0) ||
                          item.exam?.is_weekly_published === true ||
                          Boolean(item.exam?.title?.includes('সাপ্তাহিক'))

                        const weeklyDays = isWeeklyExam ? (item.weekly_days || parseWeeklyDays(item.exam)) : []
                        const totalMarks = isWeeklyExam
                          ? (weeklyDays.reduce((sum: number, d: any) => sum + (Number(d.total_marks) || 50), 0) || 350)
                          : (Number(item.exam?.total_marks) || 100)
                        const passMarks = isWeeklyExam
                          ? (weeklyDays.reduce((sum: number, d: any) => sum + (Number(d.pass_marks) || 20), 0) || 140)
                          : (Number(item.exam?.pass_marks) || 33)

                        const rawObtained = item.obtained_marks ?? item.marks_obtained
                        let obtained = rawObtained != null && rawObtained !== "" ? Number(rawObtained) : 0

                        // Check day_marks sum if available
                        if (isWeeklyExam && item.day_marks && typeof item.day_marks === 'object') {
                          let dSum = 0
                          for (const v of Object.values(item.day_marks)) {
                            const m = typeof v === 'object' && v !== null ? Number((v as any).marks) : Number(v)
                            if (!isNaN(m)) dSum += m
                          }
                          if (dSum > 0 && (obtained === 0 || dSum > obtained)) {
                            obtained = dSum
                          }
                        }

                        const percentage = totalMarks > 0 ? Math.round((obtained / totalMarks) * 100) : 0
                        const passed = obtained >= passMarks
                        const isPublic = item.is_public !== false && item.exam?.show_all_results !== false && !item.exam?.result_note?.includes('[SHOW_ALL_RESULTS:false]')

                        return (
                          <div 
                            key={item.id || idx}
                            className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs hover:shadow-md transition-shadow"
                          >
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                              {/* Left: Exam Info & Badges */}
                              <div className="space-y-2 max-w-xl">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {isWeeklyExam ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-800 border border-purple-200">
                                      <Sparkles className="w-3 h-3 text-purple-600" />
                                      সাপ্তাহিক পরীক্ষা (Weekly Result)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                      মডেল টেস্ট / ক্লাস টেস্ট
                                    </span>
                                  )}

                                  {item.exam?.subject && (
                                    <span className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded font-semibold">
                                      {item.exam.subject}
                                    </span>
                                  )}

                                  {item.exam_date && (
                                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                      <Calendar className="w-3 h-3 text-slate-400" />
                                      {formatDate(item.exam_date)}
                                    </span>
                                  )}
                                </div>

                                <h4 className="text-lg font-bold text-slate-900">
                                  {item.exam?.title || "Exam Result"}
                                </h4>

                                <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
                                  <span>পূর্ণমান: <strong>{totalMarks}</strong> নম্বর</span>
                                  <span>•</span>
                                  <span>পাস মার্ক: <strong>{passMarks}</strong> নম্বর</span>
                                  {item.exam?.duration_minutes && (
                                    <>
                                      <span>•</span>
                                      <span>সময়: {item.exam.duration_minutes} মিনিট</span>
                                    </>
                                  )}
                                </div>

                                {/* Day-wise marks pills if available */}
                                {item.day_marks && Object.keys(item.day_marks).length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-slate-100">
                                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                      <CalendarDays className="w-3 h-3 text-indigo-500" />
                                      দিনভিত্তিক প্রাপ্ত নম্বর (Day-wise Breakdown):
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {Object.entries(item.day_marks).map(([dKey, dVal]: any) => {
                                        const mVal = typeof dVal === "object" && dVal !== null ? (dVal.marks ?? 0) : dVal
                                        const matchedDay = ALL_WEEK_DAYS.find(w => w.id === dKey.toLowerCase() || w.bn === dKey)
                                        const label = matchedDay ? matchedDay.bn : dKey
                                        return (
                                          <span 
                                            key={dKey} 
                                            className="text-xs px-2.5 py-1 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 font-semibold flex items-center gap-1"
                                          >
                                            <span>{label}:</span>
                                            <strong className="text-purple-700 font-bold">{mVal}</strong>
                                          </span>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Right: Scores, Grade, Rank, and Actions */}
                              <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-4 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100">
                                {/* Score & Badges */}
                                <div className="flex items-baseline gap-2">
                                  <div className="text-right">
                                    <div className="text-2xl sm:text-3xl font-black text-slate-900">
                                      {obtained}
                                      <span className="text-slate-400 text-sm font-semibold"> / {totalMarks}</span>
                                    </div>
                                  </div>
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-black border shadow-2xs ${
                                    passed 
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                                      : 'bg-rose-100 text-rose-800 border-rose-300'
                                  }`}>
                                    {percentage}% {passed ? '• উত্তীর্ণ' : '• অনুত্তীর্ণ'}
                                  </span>
                                </div>

                                {/* Grade and Rank pills */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-3 py-1 rounded-xl text-xs font-black bg-slate-100 text-slate-800 border border-slate-200">
                                    Grade: {item.grade || (percentage >= 80 ? 'A+' : percentage >= 70 ? 'A' : percentage >= 60 ? 'A-' : percentage >= 50 ? 'B' : percentage >= 40 ? 'C' : percentage >= 33 ? 'D' : 'F')}
                                  </span>
                                  <span className="px-3 py-1 rounded-xl text-xs font-black bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs flex items-center gap-1">
                                    <Trophy className="w-3.5 h-3.5 text-amber-600" />
                                    Rank #{item.rank || 1}
                                  </span>
                                </div>

                                {/* Actions: Batch Merit List & Online Result Portal */}
                                <div className="flex items-center gap-2 mt-1">
                                  {isPublic ? (
                                    <button
                                      onClick={() => handleOpenLeaderboard({
                                        ...(item.exam || {}),
                                        id: item.exam_id || item.exam?.id,
                                        title: item.exam?.title,
                                        total_marks: totalMarks,
                                        pass_marks: passMarks,
                                        subject: item.exam?.subject,
                                        recurring_days: item.exam?.recurring_days,
                                      })}
                                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition-all border border-indigo-200/80 shadow-xs cursor-pointer active:scale-95"
                                    >
                                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                                      Batch Merit List (মেধা তালিকা)
                                    </button>
                                  ) : (
                                    <span 
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 font-semibold rounded-xl text-xs border border-amber-200/80"
                                      title="Exam marks are kept private. Only your own score is visible."
                                    >
                                      <Lock className="w-3.5 h-3.5 text-amber-600" />
                                      ব্যক্তিগত (Private)
                                    </span>
                                  )}

                                  <Link
                                    href={`/online-result?exam_id=${item.exam_id}`}
                                    target="_blank"
                                    className="inline-flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors border border-slate-200"
                                  >
                                    <span>পোর্টাল</span>
                                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="p-16 text-center text-slate-500 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                      <Trophy className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                      <p className="font-semibold text-slate-700">এখনো কোনো পরীক্ষার ফলাফল প্রকাশিত হয়নি।</p>
                      <p className="text-xs text-slate-400 mt-1">শিক্ষক মূল্যায়ন শেষ করে ফলাফল প্রকাশ করলে এখানে আপনার নম্বর ও মেধা তালিকা দেখতে পাবেন।</p>
                      <button
                        onClick={() => setExamSubTab('schedule')}
                        className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-indigo-700 transition-colors cursor-pointer"
                      >
                        পরীক্ষার সময়সূচী দেখুন →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {/* MATERIALS TAB */}
        {activeTab === 'materials' && (
          <div>
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-indigo-500" />
                  Batch Study Materials (লেকচার শিট ও বইসমূহ)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  All materials for this batch. Items marked with a green tick (<strong className="text-emerald-600">✓ Received</strong>) are already issued to you.
                </p>
              </div>

              {/* Filter pills */}
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 self-start sm:self-auto shadow-xs">
                <button
                  onClick={() => setMaterialFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    materialFilter === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  All ({allBatchMaterials.length})
                </button>
                <button
                  onClick={() => setMaterialFilter('received')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    materialFilter === 'received' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  ✓ Received ({allBatchMaterials.filter(m => m.is_received).length})
                </button>
                <button
                  onClick={() => setMaterialFilter('pending')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    materialFilter === 'pending' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  ⏳ Pending ({allBatchMaterials.filter(m => !m.is_received).length})
                </button>
              </div>
            </div>
            
            {(() => {
              const filteredMaterials = allBatchMaterials.filter((item: any) => {
                if (materialFilter === 'received') return item.is_received
                if (materialFilter === 'pending') return !item.is_received
                return true
              })

              return filteredMaterials.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 font-medium">Material Name & Details</th>
                        <th className="px-6 py-4 font-medium">Type</th>
                        <th className="px-6 py-4 font-medium">Status (Got / Available)</th>
                        <th className="px-6 py-4 font-medium">Issued / Available Date</th>
                        <th className="px-6 py-4 font-medium text-right">Office Collection</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredMaterials.map((item: any, idx: number) => {
                        const mat = item.material || {}
                        const typeConfig = materialTypeBadge[mat.type] || materialTypeBadge.other
                        const IconComp = typeConfig.icon

                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                            {/* Material Name & Details */}
                            <td className="px-6 py-4 font-medium text-slate-800">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-900">{mat.name || 'Study Material'}</span>
                                  {mat.subject && (
                                    <span className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded font-semibold">
                                      {mat.subject}
                                    </span>
                                  )}
                                </div>
                                {mat.description && (
                                  <p className="text-xs text-slate-400 mt-1 max-w-md line-clamp-1">{mat.description}</p>
                                )}
                              </div>
                            </td>

                            {/* Material Type */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${typeConfig.bg} ${typeConfig.color} ${typeConfig.border}`}>
                                <IconComp className="w-3.5 h-3.5" />
                                {typeConfig.label}
                              </span>
                            </td>

                            {/* Status (THE GREEN TICK IF RECEIVED!) */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              {item.is_received ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs w-fit">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    ✓ Got / Received (সংগৃহীত)
                                  </span>
                                  {item.return_due_date && (
                                    <span className="text-[11px] text-slate-500 ml-1">
                                      Return Due: {formatDate(item.return_due_date)}
                                    </span>
                                  )}
                                </div>
                              ) : item.is_returned ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                                  Returned on {formatDate(item.returned_at)}
                                </span>
                              ) : (
                                <div className="flex flex-col gap-0.5">
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 w-fit">
                                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    Available (সংগ্রহ বাকি)
                                  </span>
                                  <span className="text-[11px] text-amber-700 font-medium ml-1">
                                    Not collected yet
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* Issued or Available Date */}
                            <td className="px-6 py-4 whitespace-nowrap text-slate-500 text-xs">
                              {item.is_received ? (
                                <div>
                                  <span className="font-semibold text-slate-700">{formatDate(item.issued_at)}</span>
                                  <p className="text-[11px] text-slate-400">Date issued</p>
                                </div>
                              ) : (
                                <div>
                                  <span className="text-slate-600">{mat.created_at ? formatDate(mat.created_at) : '-'}</span>
                                  <p className="text-[11px] text-slate-400">Available since</p>
                                </div>
                              )}
                            </td>

                            {/* Office Collection Status */}
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              {item.is_received ? (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  In Your Possession
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
                                  <Building2 className="w-3.5 h-3.5 text-amber-600" />
                                  Collect from Office
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
                  <p className="font-semibold text-slate-700">No materials match the selected filter.</p>
                  <p className="text-xs text-slate-400 mt-1">Check back later or collect from the front desk reception.</p>
                </div>
              )
            })()}
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
                              {r.day_marks && Object.keys(r.day_marks).length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap mt-1">
                                  {Object.entries(r.day_marks).map(([dKey, dVal]: any) => {
                                    const mVal = typeof dVal === "object" && dVal !== null ? (dVal.marks ?? 0) : dVal
                                    return (
                                      <span key={dKey} className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 border border-purple-200 text-purple-800 font-semibold">
                                        {dKey}: <strong>{mVal}</strong>
                                      </span>
                                    )
                                  })}
                                </div>
                              )}
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
