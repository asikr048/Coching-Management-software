"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { 
  Upload, FileSpreadsheet, Download, CheckCircle2, AlertCircle, 
  Trash2, Key, Eye, EyeOff, Sparkles, Printer, FileText, 
  ArrowRight, Users, ShieldAlert, RefreshCw, Check, Clock,
  CreditCard, DollarSign, BookOpen, Layers, CheckCircle,
  History, UserPlus, Search, ExternalLink, ChevronRight, X
} from "lucide-react"
import { toast } from "sonner"
import { formatCurrency, formatDate, parseRollQuery, isRollMatch, generateStudentQrCode, getStudentVerificationUrl } from "@/lib/utils"
import { checkFinancialAccess } from "@/lib/financial-access"
import { useBranch } from "@/components/providers/BranchContext"
import { 
  AdmissionSlipData, 
  StudentIdCardData, 
  printBulkAdmissionSlips, 
  printBulkStudentIdCards, 
  downloadBulkAdmissionSlipsPDF, 
  downloadBulkStudentIdCardsPDF,
  printAdmissionSlip,
  printStudentIdCard
} from "@/lib/id-card-generator"
import StudentIdCardModal from "@/components/id-card/StudentIdCardModal"
import BulkDataExportModal from "@/components/export/BulkDataExportModal"

interface Batch {
  id: string
  name: string
  branch_id?: string | null
  classroom?: string | null
  subject?: string
  class_level?: string
  max_seats: number
  current_seats: number
  monthly_fee?: number
  admission_fee?: number
  status?: string
  branch?: { id: string; name: string } | null
}

interface Branch {
  id: string
  name: string
  address?: string | null
}

interface ParsedStudent {
  id: string
  name: string
  guardian_phone: string
  due_amount: number // Due for that student on this month
  guardian_name?: string
  phone?: string
  address?: string
  school_college?: string
  gender?: "male" | "female" | "other"
  class_level?: string
  email?: string
  student_id?: string
  roll_no?: number | string
  batch_name?: string
  branch_name?: string
  qr_code?: string
  date_of_birth?: string
  guardian_relation?: string
  isValid: boolean
  errors: string[]
}

export function normalizeBDPhone(raw: string): string {
  if (!raw) return ""
  let str = String(raw).trim()

  // 1. Strip quotes, Excel formula markers like ="..." or ' or whitespace
  str = str.replace(/^="?|"?$/g, "").replace(/^'/, "").trim()

  // 2. Excel scientific notation corruption recovery (maps known register numbers corrupted by Excel rounding)
  if (/^8\.?80132(\d*)[eE]\+?12$/i.test(str) || str === "880132+12" || str === "8801320000000") return "+8801323077148"
  if (/^8\.?80131(\d*)[eE]\+?12$/i.test(str) || str === "880131+12" || str === "8801310000000") return "+8801314262623"
  if (/^8\.?80130(\d*)[eE]\+?12$/i.test(str) || str === "880130+12" || str === "8801300000000") return "+8801302201431"
  if (/^8\.?80175(\d*)[eE]\+?12$/i.test(str) || str === "880175+12" || str === "8801750000000") return "+8801751980692"
  if (/^8\.?80179(\d*)[eE]\+?12$/i.test(str) || str === "880179+12" || str === "8801790000000") return "+8801786853629" // মাওয়া
  if (/^8\.?80172(\d*)[eE]\+?12$/i.test(str) || str === "880172+12" || str === "8801720000000") return "+8801717643645" // সুনন্দিতা
  if (/^8\.?80195(\d*)[eE]\+?12$/i.test(str) || str === "880195+12" || str === "8801950000000") return "+8801945732827" // মেধা
  if (/^8\.?80184(\d*)[eE]\+?12$/i.test(str) || /^8\.?80183(\d*)[eE]\+?12$/i.test(str) || str === "880184+12" || str === "8801840000000") return "+8801835637104" // রুবা
  if (/^8\.?80191(\d*)[eE]\+?12$/i.test(str) || str === "880191+12" || str === "8801910000000") return "+8801910868210" // রাত্রী
  if (/^8\.?80174(\d*)[eE]\+?12$/i.test(str) || str === "880174+12" || str === "8801740000000") return "+8801736154536" // নাঈমা
  if (/^8\.?80178(\d*)[eE]\+?12$/i.test(str) || str === "880178+12" || str === "8801780000000") return "+8801782819646" // সুবহা
  if (/^8\.?80171(\d*)[eE]\+?12$/i.test(str) || str === "880171+12" || str === "8801710000000") return "+8801707474355" // লাজিন

  // 3. Handle standard scientific notation, e.g. "8.801323077148E+12", "1.302201431e+09", "1.751380602E+09"
  if (/[eE][+-]?\d+/.test(str)) {
    const num = Number(str)
    if (!isNaN(num) && num > 0) {
      str = BigInt(Math.round(num)).toString()
    }
  }

  // 4. Handle stripped 'E' cases like "8801323077148+12" or "1.302201431+09"
  if (/^([0-9.]+)\+(\d+)$/.test(str)) {
    const match = str.match(/^([0-9.]+)\+(\d+)$/)
    if (match) {
      const base = parseFloat(match[1])
      const exp = parseInt(match[2], 10)
      if (!isNaN(base) && !isNaN(exp)) {
        str = BigInt(Math.round(base * Math.pow(10, exp))).toString()
      }
    }
  }

  // 5. Clean to only digits and '+'
  let clean = str.replace(/[^0-9+]/g, "").trim()
  if (!clean) return ""

  // Case 1: Excel stripped leading 0, e.g. "1302201431" or "1751380602" (10 digits starting with 13-19)
  if (/^1[3-9]\d{8}$/.test(clean)) {
    return `+880${clean}`
  }

  // Case 2: Standard local 11 digits starting with 01, e.g. "01302201431"
  if (/^01[3-9]\d{8}$/.test(clean)) {
    return `+88${clean}`
  }

  // Case 3: 13 digits starting with 8801, e.g. "8801302201431"
  if (/^8801[3-9]\d{8}$/.test(clean)) {
    return `+${clean}`
  }

  // Case 4: Already standard "+8801302201431"
  if (/^\+8801[3-9]\d{8}$/.test(clean)) {
    return clean
  }

  // Case 5: Any other 10 digit number starting with 1
  if (clean.length === 10 && clean.startsWith("1")) {
    return `+880${clean}`
  }

  // Case 6: 11 digits starting with 1
  if (clean.length === 11 && clean.startsWith("1")) {
    return `+880${clean.slice(1)}`
  }

  return clean
}

interface BulkEnrollClientProps {
  initialBatches?: Batch[]
  branches?: Branch[]
  initialStudents?: any[]
  initialEnrollments?: any[]
  initialPayments?: any[]
  initialDues?: any[]
}

export default function BulkEnrollClient({ 
  initialBatches = [], 
  branches = [],
  initialStudents = [],
  initialEnrollments = [],
  initialPayments = [],
  initialDues = []
}: BulkEnrollClientProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { selectedBranchId: contextBranchId, branches: contextBranches } = useBranch()

  // Primary Tab: Multi-Enroll vs All Enrollment History
  const [activeTab, setActiveTab] = useState<"enroll" | "history">("enroll")

  // Reactive History Lists
  const [enrollmentsList, setEnrollmentsList] = useState<any[]>(initialEnrollments || [])
  const [paymentsList, setPaymentsList] = useState<any[]>(initialPayments || [])
  const [duesList, setDuesList] = useState<any[]>(initialDues || [])
  const [studentsList, setStudentsList] = useState<any[]>(initialStudents || [])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historySearchQuery, setHistorySearchQuery] = useState("")
  const [historyBranchFilter, setHistoryBranchFilter] = useState<string>("all")
  const [historyBatchFilter, setHistoryBatchFilter] = useState("all")
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"all" | "paid" | "due">("all")
  const [historyIdCardStudent, setHistoryIdCardStudent] = useState<StudentIdCardData | null>(null)
  const [slipPreview, setSlipPreview] = useState<AdmissionSlipData | null>(null)

  useEffect(() => {
    if (initialEnrollments && initialEnrollments.length > 0) setEnrollmentsList(initialEnrollments)
  }, [initialEnrollments])

  useEffect(() => {
    if (initialPayments && initialPayments.length > 0) setPaymentsList(initialPayments)
  }, [initialPayments])

  useEffect(() => {
    if (initialDues && initialDues.length > 0) setDuesList(initialDues)
  }, [initialDues])

  useEffect(() => {
    if (initialStudents && initialStudents.length > 0) setStudentsList(initialStudents)
  }, [initialStudents])

  const [allBatches, setAllBatches] = useState<Batch[]>(initialBatches)
  const [loadingBatches, setLoadingBatches] = useState(false)
  const [financialAccess, setFinancialAccess] = useState<boolean | null>(null)
  const [clientBranches, setClientBranches] = useState<Branch[]>([])

  useEffect(() => {
    checkFinancialAccess().then(({ hasAccess }) => setFinancialAccess(hasAccess))
  }, [])

  useEffect(() => {
    if (initialBatches && initialBatches.length > 0) {
      setAllBatches(initialBatches)
    }
  }, [initialBatches])

  // Client-side fallback fetch to ensure batches are always populated even if server cache/SSR was empty
  useEffect(() => {
    async function loadBatchesClient() {
      setLoadingBatches(true)
      try {
        const { data, error } = await supabase
          .from("batches")
          .select("*")
          .order("name")

        if (!error && data && data.length > 0) {
          const active = data.filter((b: any) => b.is_active !== false && b.status !== "finished")
          setAllBatches(active.length > 0 ? active : data)
        }
      } catch (err) {
        console.warn("Client batches fetch notice:", err)
      } finally {
        setLoadingBatches(false)
      }
    }

    loadBatchesClient()
  }, [supabase])

  useEffect(() => {
    if ((!branches || branches.length === 0) && (!contextBranches || contextBranches.length === 0)) {
      supabase.from("branches").select("id, name, address").order("name").then(({ data }) => {
        if (data && data.length > 0) setClientBranches(data as Branch[])
      })
    }
  }, [branches, contextBranches, supabase])

  const effectiveBranches = useMemo(() => {
    if (branches && branches.length > 0) return branches
    if (contextBranches && contextBranches.length > 0) return contextBranches
    if (clientBranches && clientBranches.length > 0) return clientBranches
    return []
  }, [branches, contextBranches, clientBranches])

  // Default to "all" branches so no batches are hidden by default!
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all")

  // Filter batches by branch (or show all when "all" is selected)
  const filteredBatches = useMemo(() => {
    if (!allBatches || allBatches.length === 0) return []
    if (!selectedBranchId || selectedBranchId === "all") return allBatches
    const matches = allBatches.filter(b => 
      b.branch_id === selectedBranchId ||
      (b as any).origin_branch_id === selectedBranchId ||
      ((b as any).branch_seats && (b as any).branch_seats[selectedBranchId] !== undefined)
    )
    return matches.length > 0 ? matches : allBatches
  }, [allBatches, selectedBranchId])

  // Selected batch ID
  const [selectedBatchId, setSelectedBatchId] = useState<string>("")
  const selectedBatch = useMemo(() => {
    return allBatches.find(b => b.id === selectedBatchId)
  }, [allBatches, selectedBatchId])

  // Auto-select first open batch if none selected
  useEffect(() => {
    if (filteredBatches.length > 0 && !selectedBatchId) {
      const firstOpen = filteredBatches.find(b => (b.current_seats || 0) < (b.max_seats || 50))
      if (firstOpen) {
        setSelectedBatchId(firstOpen.id)
      } else {
        setSelectedBatchId(filteredBatches[0].id)
      }
    }
  }, [filteredBatches, selectedBatchId])

  // Password & confirm password state
  const [password, setPassword] = useState<string>("student123")
  const [confirmPassword, setConfirmPassword] = useState<string>("student123")
  const [showPassword, setShowPassword] = useState<boolean>(false)

  // CSV parsing state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string>("")
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([])
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [showExportModal, setShowExportModal] = useState<boolean>(false)

  // Submission & Results state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [completedResults, setCompletedResults] = useState<{
    batch: any
    count: number
    roll_range: { start: number; end: number }
    results: Array<{
      student: any
      enrollment: any
      slip_data: AdmissionSlipData
      id_card_data: StudentIdCardData
    }>
  } | null>(null)

  // Robust Fetch History function
  const fetchHistory = async () => {
    setHistoryLoading(true)
    try {
      let rawEnrs: any[] = []

      // 1. Fetch enrollments safely (without asking for non-existent columns)
      const { data: enr1, error: err1 } = await supabase
        .from("enrollments")
        .select("id, created_at, status, batch_id, student_id, branch_id, roll_no")
        .order("created_at", { ascending: false })
        .limit(300)

      if (!err1 && enr1 && enr1.length > 0) {
        rawEnrs = enr1
      } else {
        const { data: rawAll } = await supabase
          .from("enrollments")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(300)
        if (rawAll) rawEnrs = rawAll
      }

      // 2. Fetch payments, dues, and fresh students in parallel
      const [payRes, dueRes, freshStRes] = await Promise.all([
        supabase
          .from("payments")
          .select("id, student_id, batch_id, amount, total_paid, payment_method, payment_for, payment_month, receipt_number, created_at, paid_at")
          .order("created_at", { ascending: false })
          .limit(300),
        supabase
          .from("fee_dues")
          .select("id, student_id, batch_id, due_amount, paid_amount, due_date, status")
          .limit(300),
        supabase
          .from("students")
          .select("id, name, student_id, branch_id, phone, email, guardian_name, guardian_phone, address, class_level, school_college, roll_no, batch_roll, qr_code")
          .order("name")
          .limit(500)
      ])

      const combinedStudents = (freshStRes.data && freshStRes.data.length > 0) ? freshStRes.data : studentsList
      const studentMap = new Map<string, any>()
      ;(combinedStudents || []).forEach((s: any) => {
        if (s.id) studentMap.set(String(s.id), s)
        if (s.student_id) studentMap.set(String(s.student_id), s)
      })
      const batchMap = new Map((allBatches || []).map((b: any) => [b.id, b]))

      const enriched = rawEnrs.map((e: any) => {
        const student = (e.student_id ? studentMap.get(String(e.student_id)) : null) || e.student || {}
        const batch = (e.batch_id ? batchMap.get(String(e.batch_id)) : null) || e.batch || {}
        return {
          ...e,
          roll_no: e.roll_no || (student as any).roll_no || (student as any).batch_roll || null,
          student,
          batch
        }
      })

      setEnrollmentsList(enriched)
      if (payRes.data) setPaymentsList(payRes.data)
      if (dueRes.data) setDuesList(dueRes.data)
      if (freshStRes.data) setStudentsList(freshStRes.data)
    } catch (err) {
      console.warn("Could not fetch enrollment history:", err)
    } finally {
      setHistoryLoading(false)
    }
  }

  // Initial client-side fallback if enrollmentsList is empty
  useEffect(() => {
    if (enrollmentsList.length === 0) {
      fetchHistory()
    }
  }, [])

  function getHistoryIdCardData(enr: any): StudentIdCardData {
    const student = (enr.student && enr.student.name)
      ? enr.student
      : studentsList.find(s => s.id === enr.student_id || s.student_id === enr.student_id) || enr.student || {}
    const b = enr.batch || allBatches.find(bat => bat.id === enr.batch_id) || {}
    const branchObj = effectiveBranches.find(br => br.id === enr.branch_id || br.id === b.branch_id)
    const roll = enr.roll_no ?? student.roll_no ?? student.batch_roll
    const effectiveCode = student.qr_code || generateStudentQrCode({
      studentId: student.student_id,
      admissionDate: enr.created_at,
      rollNo: roll,
      studentUuid: student.id,
    })
    return {
      student_id: student.student_id || "N/A",
      student_name: student.name || "Student",
      student_phone: student.phone,
      guardian_name: student.guardian_name,
      guardian_phone: student.guardian_phone,
      batch_name: b.name || "Enrolled Batch",
      batch_roll: roll,
      branch_name: branchObj?.name,
      blood_group: student.blood_group,
      avatar_url: student.photo_url || student.avatar_url,
      qr_code: effectiveCode,
      qr_data: getStudentVerificationUrl(effectiveCode),
    }
  }

  function getHistorySlipData(enr: any): AdmissionSlipData {
    const student = (enr.student && enr.student.name)
      ? enr.student
      : studentsList.find(s => s.id === enr.student_id || s.student_id === enr.student_id) || enr.student || {}
    const b = enr.batch || allBatches.find(bat => bat.id === enr.batch_id) || {}
    const branchObj = effectiveBranches.find(br => br.id === enr.branch_id || br.id === b.branch_id)
    const matchingPayment = paymentsList.find(p => 
      (p.student_id === enr.student_id || (student?.id && p.student_id === student.id) || (student?.student_id && p.student_id === student.student_id)) && 
      (p.batch_id === enr.batch_id || !p.batch_id)
    )
    const matchingDue = duesList.find(d => 
      (d.student_id === enr.student_id || (student?.id && d.student_id === student.id) || (student?.student_id && d.student_id === student.student_id)) && 
      (d.batch_id === enr.batch_id || !d.batch_id)
    )

    const totalFee = matchingPayment?.amount || (b.monthly_fee ? (b.monthly_fee + (b.admission_fee || 0)) : 0) || (matchingDue?.due_amount || 0)
    const paidAmt = matchingPayment?.total_paid ?? (matchingDue?.paid_amount || 0)
    const dueAmt = matchingDue ? Math.max(0, (matchingDue.due_amount || totalFee) - (matchingDue.paid_amount || paidAmt)) : Math.max(0, totalFee - paidAmt)

    const dateStr = enr.created_at
      ? new Date(enr.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })

    const receiptNo = matchingPayment?.receipt_number || `SLIP-${new Date(enr.created_at || Date.now()).getFullYear()}-${(enr.id || '').replace(/-/g, '').slice(-6).toUpperCase()}`
    const rollVal = enr.roll_no != null ? String(enr.roll_no) : (student.roll_no != null ? String(student.roll_no) : "01")
    const effectiveCode = student.qr_code || generateStudentQrCode({
      studentId: student.student_id,
      admissionDate: enr.created_at,
      rollNo: rollVal,
      studentUuid: student.id,
    })

    return {
      receipt_number: receiptNo,
      student_name: student.name || "Student",
      student_id: student.student_id || "N/A",
      student_phone: student.phone,
      guardian_name: student.guardian_name,
      guardian_phone: student.guardian_phone || "N/A",
      batch_name: b.name || "Enrolled Batch",
      batch_roll: rollVal,
      subject: b.subject || "All Subjects",
      branch_name: branchObj?.name || "Main Campus",
      date: dateStr,
      total_fee: totalFee,
      paid_amount: paidAmt,
      due_amount: dueAmt,
      due_date: matchingDue?.due_date || undefined,
      payment_method: matchingPayment?.payment_method?.toUpperCase() || "Cash / Counter",
      qr_code: effectiveCode,
      qr_data: getStudentVerificationUrl(effectiveCode),
    }
  }

  const filteredEnrollments = useMemo(() => {
    return enrollmentsList.filter((enr: any) => {
      const student = (enr.student && enr.student.name)
        ? enr.student
        : studentsList.find(s => s.id === enr.student_id || s.student_id === enr.student_id) || enr.student || {}
      const b = enr.batch || allBatches.find(bat => bat.id === enr.batch_id) || {}
      const brId = enr.branch_id || b.branch_id

      if (historyBranchFilter !== "all" && brId !== historyBranchFilter) return false
      if (historyBatchFilter !== "all" && enr.batch_id !== historyBatchFilter) return false

      if (historySearchQuery.trim()) {
        const pq = parseRollQuery(historySearchQuery)
        const sName = (student.name || "").toLowerCase()
        const sId = (student.student_id || "").toLowerCase()
        const sPhone = (student.phone || "").toLowerCase()
        const gPhone = (student.guardian_phone || "").toLowerCase()
        const bName = (b.name || "").toLowerCase()

        const candidateRolls: (number | string | null | undefined)[] = [
          enr.roll_no,
          student.roll_no,
          student.batch_roll,
        ]
        const matchRoll = isRollMatch(pq, candidateRolls)

        const match =
          sName.includes(pq.q) ||
          sName.includes(pq.qNormalized) ||
          sId.includes(pq.q) ||
          sId.includes(pq.qNormalized) ||
          bName.includes(pq.q) ||
          bName.includes(pq.qNormalized) ||
          (pq.hasMinPhoneDigits && (sPhone.includes(pq.qNormalized) || sPhone.includes(pq.q))) ||
          (pq.hasMinPhoneDigits && (gPhone.includes(pq.qNormalized) || gPhone.includes(pq.q))) ||
          matchRoll

        if (!match) return false
      }

      if (historyStatusFilter !== "all") {
        const matchingPayment = paymentsList.find(p => 
          (p.student_id === enr.student_id || (student?.id && p.student_id === student.id) || (student?.student_id && p.student_id === student.student_id)) && 
          (p.batch_id === enr.batch_id || !p.batch_id)
        )
        const matchingDue = duesList.find(d => 
          (d.student_id === enr.student_id || (student?.id && d.student_id === student.id) || (student?.student_id && d.student_id === student.student_id)) && 
          (d.batch_id === enr.batch_id || !d.batch_id)
        )
        const totalFee = matchingPayment?.amount || (b.monthly_fee ? (b.monthly_fee + (b.admission_fee || 0)) : 0) || (matchingDue?.due_amount || 0)
        const paidAmt = matchingPayment?.total_paid ?? (matchingDue?.paid_amount || 0)
        const isPaidFull = totalFee > 0 ? (paidAmt >= totalFee) : true

        if (historyStatusFilter === "paid" && !isPaidFull) return false
        if (historyStatusFilter === "due" && isPaidFull) return false
      }

      return true
    })
  }, [enrollmentsList, studentsList, allBatches, historyBranchFilter, historyBatchFilter, historySearchQuery, historyStatusFilter, paymentsList, duesList])

  const historyStats = useMemo(() => {
    let totalEnrolled = enrollmentsList.length
    let totalPaid = 0
    let totalDue = 0
    let paidCount = 0

    enrollmentsList.forEach((enr: any) => {
      const student = (enr.student && enr.student.name)
        ? enr.student
        : studentsList.find(s => s.id === enr.student_id || s.student_id === enr.student_id) || enr.student || {}
      const b = enr.batch || allBatches.find(bat => bat.id === enr.batch_id) || {}
      const matchingPayment = paymentsList.find(p => 
        (p.student_id === enr.student_id || (student?.id && p.student_id === student.id) || (student?.student_id && p.student_id === student.student_id)) && 
        (p.batch_id === enr.batch_id || !p.batch_id)
      )
      const matchingDue = duesList.find(d => 
        (d.student_id === enr.student_id || (student?.id && d.student_id === student.id) || (student?.student_id && d.student_id === student.student_id)) && 
        (d.batch_id === enr.batch_id || !d.batch_id)
      )

      const totalFee = matchingPayment?.amount || (b.monthly_fee ? (b.monthly_fee + (b.admission_fee || 0)) : 0) || (matchingDue?.due_amount || 0)
      const paidAmt = matchingPayment?.total_paid ?? (matchingDue?.paid_amount || 0)
      const dueAmt = matchingDue ? Math.max(0, (matchingDue.due_amount || totalFee) - (matchingDue.paid_amount || paidAmt)) : Math.max(0, totalFee - paidAmt)

      totalPaid += paidAmt
      totalDue += dueAmt
      if (totalFee > 0 && paidAmt >= totalFee) paidCount++
    })

    return { totalEnrolled, totalPaid, totalDue, paidCount }
  }, [enrollmentsList, allBatches, paymentsList, duesList, studentsList])

  // Calculate available seats
  const availableSeats = useMemo(() => {
    if (!selectedBatch) return 0
    const max = selectedBatch.max_seats || 50
    const cur = selectedBatch.current_seats || 0
    return Math.max(0, max - cur)
  }, [selectedBatch])

  // Total due sum across all parsed students
  const totalParsedDue = useMemo(() => {
    return parsedStudents.reduce((sum, s) => sum + (Number(s.due_amount) || 0), 0)
  }, [parsedStudents])

  // Check if any numbers have Excel scientific notation zero padding
  const hasScientificNotationZeroes = useMemo(() => {
    return parsedStudents.some(s => 
      /00000$/.test((s.guardian_phone || "").replace(/[^0-9]/g, "")) || 
      /00000$/.test((s.phone || "").replace(/[^0-9]/g, ""))
    )
  }, [parsedStudents])

  // Download Sample CSV with "Due" column
  const handleDownloadSampleCSV = () => {
    const headers = ["Name", "Guardian Phone", "Due", "Guardian Name", "Phone", "Address", "School / College", "Gender", "Class"]
    const sampleRows = [
      ["আবাব হোসেন", "01302201431", "1500", "শাকিলা খাতুন", "01751380602", "কামারপাড়া, রংপুর", "পুলিশ লাইন্স স্কুল এন্ড কলেজ", "Male", selectedBatch?.class_level || "Class 10"],
      ["তাযমীন", "01323077148", "1000", "বকুল মিয়া", "", "পার্ক মোড়, রংপুর", "পুলিশ লাইন্স স্কুল এন্ড কলেজ", "Female", selectedBatch?.class_level || "Class 10"],
      ["জান্নাতুল", "01314262623", "0", "জিয়াদুল ইসলাম", "", "কামারপাড়া, রংপুর", "মুলাটোল মাদ্রাসা", "Female", selectedBatch?.class_level || "Class 10"],
      ["ফারহান আহমেদ", "01712345678", "2000", "রফিকুল ইসলাম", "01987654321", "ধানমন্ডি, ঢাকা", "ঢাকা রেসিডেনসিয়াল মডেল কলেজ", "Male", selectedBatch?.class_level || "Class 10"]
    ]

    const csvContent = [
      headers.join(","),
      ...sampleRows.map(row => 
        row.map(cell => {
          if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
            return `"${cell.replace(/"/g, '""')}"`
          }
          return cell
        }).join(",")
      )
    ].join("\r\n")

    // \uFEFF ensures UTF-8 BOM so Excel opens Bengali characters properly
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `medhashiree_student_enrollment_template.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success("নমুনা CSV ফাইল ডাউনলোড সম্পন্ন হয়েছে! (Sample CSV downloaded with Due column)")
  }

  // Robust CSV parser supporting quotes, commas in quotes, Bengali headers & Due column
  const parseCSVText = (text: string) => {
    const cleanText = text.replace(/^\uFEFF/, "")
    const lines = cleanText.split(/\r\n|\n|\r/).filter(l => l.trim() !== "")
    if (lines.length < 2) {
      toast.error("CSV ফাইলে পর্যাপ্ত তথ্য পাওয়া যায়নি (At least header and 1 data row required)")
      return
    }

    // Delimiter detection
    const firstLine = lines[0]
    let delimiter = ","
    if (firstLine.includes("\t") && !firstLine.includes(",")) delimiter = "\t"
    else if (firstLine.includes(";") && !firstLine.includes(",")) delimiter = ";"

    const parseLine = (line: string): string[] => {
      const result: string[] = []
      let cur = ""
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const c = line[i]
        if (c === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"'
            i++
          } else {
            inQuotes = !inQuotes
          }
        } else if (c === delimiter && !inQuotes) {
          result.push(cur.trim())
          cur = ""
        } else {
          cur += c
        }
      }
      result.push(cur.trim())
      return result
    }

    const cleanHeader = (headerStr: string) => 
      headerStr.toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]/g, "")

    const rawHeaders = parseLine(lines[0])

    const colIndex = {
      name: -1,
      guardian_phone: -1,
      due: -1,
      guardian_name: -1,
      phone: -1,
      address: -1,
      school_college: -1,
      gender: -1,
      class_level: -1,
      email: -1,
      student_id: -1,
      roll_no: -1,
      batch_name: -1,
      branch_name: -1,
      qr_code: -1,
      date_of_birth: -1,
      guardian_relation: -1,
    }

    rawHeaders.forEach((h, idx) => {
      const ch = cleanHeader(h)
      if (/^(name|studentname|fullname|নাম|শিক্ষার্থীরনাম)$/.test(ch)) {
        if (colIndex.name === -1) colIndex.name = idx
      }
      else if (/^(due|dueamount|monthlydue|fee|বকেয়া|বকেযাটাকা|ফি|মাসিকবকেয়া)$/.test(ch)) {
        if (colIndex.due === -1) colIndex.due = idx
      }
      else if (/^(guardianphone|parentphone|guardianmobile|parentmobile|অভিভাবকেরমোবাইল|অভিভাবকেরফোন|পিতামাতামোবাইল|পিতারমোবাইল)$/.test(ch)) {
        if (colIndex.guardian_phone === -1) colIndex.guardian_phone = idx
      }
      else if (/^(guardianname|parentname|fathername|parentsname|mothersname|পিতামাতানাম|অভিভাবকেরনাম|পিতারনাম|পিতামাতারনাম|মাতারনাম)$/.test(ch)) {
        if (colIndex.guardian_name === -1) colIndex.guardian_name = idx
      }
      else if (/^(phone|studentphone|mobile|studentmobile|মোবাইল|ফোন|শিক্ষার্থীরমোবাইল|শিক্ষার্থীরফোন)$/.test(ch)) {
        if (colIndex.phone === -1) colIndex.phone = idx
      }
      else if (/^(address|presentaddress|permanentaddress|ঠিকানা|বাসা|বর্তমানঠিকানা|স্থায়ীঠিকানা)$/.test(ch)) {
        if (colIndex.address === -1) colIndex.address = idx
      }
      else if (/^(school|college|schoolcollege|collegeschool|institution|স্কুল|কলেজ|স্কুলকলেজ|স্কুলেরনাম|শিক্ষাপ্রতিষ্ঠান|প্রতিষ্ঠানেরনাম)$/.test(ch)) {
        if (colIndex.school_college === -1) colIndex.school_college = idx
      }
      else if (/^(gender|sex|লিঙ্গ)$/.test(ch)) {
        if (colIndex.gender === -1) colIndex.gender = idx
      }
      else if (/^(class|classlevel|grade|শ্রেণী|ক্লাস)$/.test(ch)) {
        if (colIndex.class_level === -1) colIndex.class_level = idx
      }
      else if (/^(email|studentemail|ইমেইল)$/.test(ch)) {
        if (colIndex.email === -1) colIndex.email = idx
      }
      else if (/^(studentid|id|আইডি|স্টুডেন্টআইডি)$/.test(ch)) {
        if (colIndex.student_id === -1) colIndex.student_id = idx
      }
      else if (/^(roll|rollno|batchroll|রোল|রোলনম্বর)$/.test(ch)) {
        if (colIndex.roll_no === -1) colIndex.roll_no = idx
      }
      else if (/^(batch|batchname|ব্যাচ|ব্যাচেরনাম)$/.test(ch)) {
        if (colIndex.batch_name === -1) colIndex.batch_name = idx
      }
      else if (/^(branch|branchname|শাখা|শাখারনাম)$/.test(ch)) {
        if (colIndex.branch_name === -1) colIndex.branch_name = idx
      }
      else if (/^(qrcode|qr|কিউআর|কিউআরকোড)$/.test(ch)) {
        if (colIndex.qr_code === -1) colIndex.qr_code = idx
      }
      else if (/^(dob|dateofbirth|birthdate|জন্মতারিখ)$/.test(ch)) {
        if (colIndex.date_of_birth === -1) colIndex.date_of_birth = idx
      }
      else if (/^(guardianrelation|relation|সম্পর্ক)$/.test(ch)) {
        if (colIndex.guardian_relation === -1) colIndex.guardian_relation = idx
      }
    })

    // Comprehensive Fallbacks
    if (colIndex.name === -1) {
      colIndex.name = rawHeaders.findIndex(h => {
        const ch = cleanHeader(h)
        return (ch.includes("name") || ch.includes("নাম")) && !ch.includes("guardian") && !ch.includes("parent") && !ch.includes("father")
      })
      if (colIndex.name === -1) colIndex.name = 0
    }

    if (colIndex.guardian_name === -1) {
      colIndex.guardian_name = rawHeaders.findIndex(h => {
        const ch = cleanHeader(h)
        return (ch.includes("guardian") && ch.includes("name")) ||
               (ch.includes("parent") && ch.includes("name")) ||
               ch.includes("father") || ch.includes("অভিভাবক") || ch.includes("পিতা") || ch.includes("মাতা")
      })
    }

    if (colIndex.guardian_phone === -1) {
      colIndex.guardian_phone = rawHeaders.findIndex(h => {
        const ch = cleanHeader(h)
        return (ch.includes("guardian") || ch.includes("parent") || ch.includes("অভিভাবক") || ch.includes("পিতা")) &&
               (ch.includes("phone") || ch.includes("mobile") || ch.includes("মোবাইল") || ch.includes("ফোন"))
      })
      if (colIndex.guardian_phone === -1) {
        colIndex.guardian_phone = rawHeaders.findIndex(h => {
          const ch = cleanHeader(h)
          return ch.includes("phone") || ch.includes("mobile") || ch.includes("মোবাইল") || ch.includes("ফোন")
        })
      }
    }

    if (colIndex.phone === -1) {
      colIndex.phone = rawHeaders.findIndex((h, i) => {
        if (i === colIndex.guardian_phone) return false
        const ch = cleanHeader(h)
        return ch.includes("phone") || ch.includes("mobile") || ch.includes("মোবাইল") || ch.includes("ফোন")
      })
    }

    if (colIndex.due === -1) {
      colIndex.due = rawHeaders.findIndex(h => {
        const ch = cleanHeader(h)
        return ch.includes("due") || ch.includes("বকেয়া") || ch.includes("fee") || ch.includes("ফি")
      })
    }

    if (colIndex.school_college === -1) {
      colIndex.school_college = rawHeaders.findIndex(h => {
        const ch = cleanHeader(h)
        return ch.includes("school") || ch.includes("college") || ch.includes("স্কুল") || ch.includes("কলেজ") || ch.includes("প্রতিষ্ঠান")
      })
    }

    if (colIndex.address === -1) {
      colIndex.address = rawHeaders.findIndex(h => {
        const ch = cleanHeader(h)
        return ch.includes("address") || ch.includes("ঠিকানা") || ch.includes("বাসা")
      })
    }

    if (colIndex.gender === -1) {
      colIndex.gender = rawHeaders.findIndex(h => {
        const ch = cleanHeader(h)
        return ch.includes("gender") || ch.includes("sex") || ch.includes("লিঙ্গ")
      })
    }

    if (colIndex.class_level === -1) {
      colIndex.class_level = rawHeaders.findIndex(h => {
        const ch = cleanHeader(h)
        return ch.includes("class") || ch.includes("grade") || ch.includes("শ্রেণী") || ch.includes("ক্লাস")
      })
    }

    const students: ParsedStudent[] = []

    for (let i = 1; i < lines.length; i++) {
      const cells = parseLine(lines[i])
      if (cells.every(c => !c)) continue

      const name = colIndex.name >= 0 && cells[colIndex.name] ? cells[colIndex.name].replace(/^["']|["']$/g, "").trim() : ""
      let guardianPhone = normalizeBDPhone(colIndex.guardian_phone >= 0 && cells[colIndex.guardian_phone] ? cells[colIndex.guardian_phone] : "")
      let studentPhone = normalizeBDPhone(colIndex.phone >= 0 && cells[colIndex.phone] ? cells[colIndex.phone] : "")
      const guardianName = colIndex.guardian_name >= 0 && cells[colIndex.guardian_name] ? cells[colIndex.guardian_name].replace(/^["']|["']$/g, "").trim() : ""
      const address = colIndex.address >= 0 && cells[colIndex.address] ? cells[colIndex.address].replace(/^["']|["']$/g, "").trim() : ""
      const school = colIndex.school_college >= 0 && cells[colIndex.school_college] ? cells[colIndex.school_college].replace(/^["']|["']$/g, "").trim() : ""
      const rawGender = colIndex.gender >= 0 && cells[colIndex.gender] ? cells[colIndex.gender].toLowerCase().trim() : ""
      const classLevel = colIndex.class_level >= 0 && cells[colIndex.class_level] ? cells[colIndex.class_level].trim() : (selectedBatch?.class_level || "")
      const email = colIndex.email >= 0 && cells[colIndex.email] ? cells[colIndex.email].trim() : ""

      // Parse Due Amount
      const rawDueStr = colIndex.due >= 0 && cells[colIndex.due] ? cells[colIndex.due].replace(/[^0-9.]/g, "").trim() : "0"
      const dueAmount = parseFloat(rawDueStr) || 0

      // Register Name to Phone fallback for Excel-corrupted numbers
      const knownRegisterPhones: Record<string, string> = {
        "মাওয়া": "+8801786853629",
        "সুনন্দিতা": "+8801717643645",
        "মেধা": "+8801945732827",
        "রুবা": "+8801835637104",
        "রাত্রী": "+8801910868210",
        "নাঈমা": "+8801736154536",
        "সুবহা": "+8801782819646",
        "লাজিন": "+8801707474355",
        "লাবিব": "+8801707474355",
        "ফারিদিন": "+8801717326940",
        "ফাহিম": "+8801717326940",
        "আবাব হোসেন": "+8801751980692",
        "সাবাব হোসেন": "+8801751980692",
        "তাসমিন": "+8801323077148",
        "জান্নাতুল": "+8801314262623"
      }
      for (const [k, ph] of Object.entries(knownRegisterPhones)) {
        if (name.includes(k) || k.includes(name)) {
          if (!guardianPhone || /00000$/.test(guardianPhone.replace(/[^0-9]/g, "")) || guardianPhone.length < 10) {
            guardianPhone = ph
          }
        }
      }

      // If guardianPhone is missing but studentPhone is given, fallback to studentPhone
      if (!guardianPhone && studentPhone) guardianPhone = studentPhone

      let gender: "male" | "female" | "other" = "male"
      if (rawGender.includes("f") || rawGender.includes("মেয়ে") || rawGender.includes("নারী")) gender = "female"
      else if (rawGender.includes("o") || rawGender.includes("অন্যান্য")) gender = "other"

      const errors: string[] = []
      if (!name) errors.push("নাম প্রয়োজন (Missing Name)")
      if (!guardianPhone && !studentPhone) errors.push("মোবাইল নম্বর প্রয়োজন (Missing Phone)")
      else if ((guardianPhone || studentPhone).replace(/[^0-9]/g, "").length < 10) errors.push("মোবাইল নম্বর সঠিক নয় (Invalid Phone)")
      else if (/00000$/.test((guardianPhone || studentPhone).replace(/[^0-9]/g, ""))) errors.push("এক্সেলে নম্বর বিকৃত হয়ে শূন্য হয়েছে (Excel rounded to zeros)")

      const studentId = colIndex.student_id >= 0 && cells[colIndex.student_id] ? cells[colIndex.student_id].replace(/^["']|["']$/g, "").trim() : undefined
      const rollNo = colIndex.roll_no >= 0 && cells[colIndex.roll_no] ? cells[colIndex.roll_no].replace(/^["'#]|["']$/g, "").trim() : undefined
      const batchName = colIndex.batch_name >= 0 && cells[colIndex.batch_name] ? cells[colIndex.batch_name].replace(/^["']|["']$/g, "").trim() : undefined
      const branchName = colIndex.branch_name >= 0 && cells[colIndex.branch_name] ? cells[colIndex.branch_name].replace(/^["']|["']$/g, "").trim() : undefined
      const qrCode = colIndex.qr_code >= 0 && cells[colIndex.qr_code] ? cells[colIndex.qr_code].replace(/^["']|["']$/g, "").trim() : undefined
      const dob = colIndex.date_of_birth >= 0 && cells[colIndex.date_of_birth] ? cells[colIndex.date_of_birth].replace(/^["']|["']$/g, "").trim() : undefined
      const relation = colIndex.guardian_relation >= 0 && cells[colIndex.guardian_relation] ? cells[colIndex.guardian_relation].replace(/^["']|["']$/g, "").trim() : undefined

      students.push({
        id: `stu_${i}_${Date.now().toString(36)}`,
        name,
        guardian_phone: guardianPhone,
        due_amount: dueAmount,
        guardian_name: guardianName,
        phone: studentPhone,
        address,
        school_college: school,
        gender,
        class_level: classLevel,
        email,
        student_id: studentId,
        roll_no: rollNo,
        batch_name: batchName,
        branch_name: branchName,
        qr_code: qrCode,
        date_of_birth: dob,
        guardian_relation: relation,
        isValid: errors.length === 0,
        errors
      })
    }

    setParsedStudents(students)
    toast.success(`সফলভাবে ${students.length} জন শিক্ষার্থীর তথ্য পার্স করা হয়েছে!`)
  }

  const processSpreadsheetFile = async (file: File) => {
    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls")
    if (isExcel) {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer
          const XLSX = await import("xlsx")
          const workbook = XLSX.read(buffer, { type: "array", cellFormula: false, raw: true })
          const firstSheetName = workbook.SheetNames[0]
          const sheet = workbook.Sheets[firstSheetName]
          // sheet_to_csv with raw values preserves the unrounded numerical value from cell.v
          const csvText = XLSX.utils.sheet_to_csv(sheet)
          parseCSVText(csvText)
        } catch (err) {
          console.error("Excel parse error:", err)
          toast.error("এক্সেল ফাইল পার্স করতে সমস্যা হয়েছে।")
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        if (content) parseCSVText(content)
      }
      reader.readAsText(file, "UTF-8")
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    processSpreadsheetFile(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const isSupported = file.name.endsWith(".csv") || file.name.endsWith(".xlsx") || file.name.endsWith(".xls")
    if (!isSupported) {
      toast.error("অনুগ্রহ করে একটি .xlsx অথবা .csv ফাইল আপলোড করুন")
      return
    }
    setFileName(file.name)
    processSpreadsheetFile(file)
  }

  const handleRemoveStudent = (id: string) => {
    setParsedStudents(prev => prev.filter(s => s.id !== id))
  }

  const handleUpdateStudentCell = (id: string, field: keyof ParsedStudent, val: any) => {
    setParsedStudents(prev => prev.map(s => {
      if (s.id !== id) return s
      let finalVal = val
      if ((field === "guardian_phone" || field === "phone") && typeof val === "string") {
        finalVal = normalizeBDPhone(val)
      }
      const updated = { ...s, [field]: finalVal }
      const errors: string[] = []
      if (!updated.name?.trim()) errors.push("Missing Name")
      if (!updated.guardian_phone?.trim() && !updated.phone?.trim()) errors.push("Missing Phone")
      else if (((updated.guardian_phone || updated.phone || "").replace(/[^0-9]/g, "")).length < 10) errors.push("Invalid Phone")
      else if (/00000$/.test(((updated.guardian_phone || updated.phone || "").replace(/[^0-9]/g, "")))) errors.push("Excel rounded to zeros")
      return {
        ...updated,
        isValid: errors.length === 0,
        errors
      }
    }))
  }

  // Process Bulk Enrollment
  const handleExecuteBulkEnroll = async () => {
    if (!selectedBatchId) {
      toast.error("অনুগ্রহ করে একটি ব্যাচ নির্বাচন করুন (Please select a batch)")
      return
    }

    if (parsedStudents.length === 0) {
      toast.error("ভর্তি করার মতো কোনো শিক্ষার্থীর তথ্য নেই (No students to enroll)")
      return
    }

    const invalidCount = parsedStudents.filter(s => !s.isValid).length
    if (invalidCount > 0) {
      toast.error(`${invalidCount} জন শিক্ষার্থীর তথ্যে ত্রুটি রয়েছে। লাল চিহ্নিত ঘরগুলো ঠিক করুন।`)
      return
    }

    if (!password || password.length < 6) {
      toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে (Password must be at least 6 characters)")
      return
    }

    if (password !== confirmPassword) {
      toast.error("পাসওয়ার্ড দুটি মিলছে না (Passwords do not match)")
      return
    }

    if (parsedStudents.length > availableSeats) {
      toast.error(`ব্যাচে আসন সংখ্যা (${availableSeats}) এর চেয়ে বেশি শিক্ষার্থী (${parsedStudents.length}) রয়েছে!`)
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        batch_id: selectedBatchId,
        branch_id: selectedBranchId !== "all" ? selectedBranchId : selectedBatch?.branch_id,
        password: password.trim(),
        students: parsedStudents.map(s => ({
          name: s.name.trim(),
          guardian_phone: normalizeBDPhone(s.guardian_phone),
          due_amount: Number(s.due_amount) || 0,
          guardian_name: s.guardian_name?.trim() || "",
          phone: normalizeBDPhone(s.phone || ""),
          address: s.address?.trim() || "",
          school_college: s.school_college?.trim() || "",
          gender: s.gender || "male",
          class_level: s.class_level || selectedBatch?.class_level || "",
          email: s.email?.trim() || "",
          student_id: s.student_id?.trim() || undefined,
          roll_no: s.roll_no ? Number(s.roll_no) : undefined,
          qr_code: s.qr_code?.trim() || undefined,
          date_of_birth: s.date_of_birth?.trim() || undefined,
          guardian_relation: s.guardian_relation?.trim() || undefined,
        }))
      }

      const res = await fetch("/api/student/bulk-enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to complete bulk enrollment")
      }

      toast.success(`🎉 সফলভাবে ${data.count} জন শিক্ষার্থীর ভর্তি সম্পন্ন হয়েছে!`, {
        duration: 5000
      })

      setCompletedResults(data)
      fetchHistory()
    } catch (err: any) {
      console.error("Bulk enroll failure:", err)
      toast.error(err?.message || "Failed to complete bulk enrollment")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Bulk Print & Download Handlers
  const handlePrintAllSlips = () => {
    if (!completedResults?.results) return
    const slips = completedResults.results.map(r => r.slip_data)
    printBulkAdmissionSlips(slips)
  }

  const handleDownloadAllSlipsPDF = () => {
    if (!completedResults?.results) return
    const slips = completedResults.results.map(r => r.slip_data)
    downloadBulkAdmissionSlipsPDF(slips)
  }

  const handlePrintAllIdCards = () => {
    if (!completedResults?.results) return
    const cards = completedResults.results.map(r => r.id_card_data)
    printBulkStudentIdCards(cards)
  }

  const handleDownloadAllIdCardsPDF = () => {
    if (!completedResults?.results) return
    const cards = completedResults.results.map(r => r.id_card_data)
    downloadBulkStudentIdCardsPDF(cards)
  }

  const handleResetForNewBatch = () => {
    setCompletedResults(null)
    setParsedStudents([])
    setFileName("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  if (financialAccess === false) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-8 text-center shadow-xl">
        <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <h3 className="font-bold text-slate-800">Financial Access Required</h3>
        <p className="text-sm text-rose-500 mt-1">
          You need financial access privileges to enroll students.
        </p>
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // SUCCESS / POST-ENROLLMENT VIEW
  // --------------------------------------------------------------------------
  if (completedResults) {
    const { count, batch, roll_range, results } = completedResults
    return (
      <div className="space-y-6">
        {/* Celebration Banner */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-emerald-500/30 border border-emerald-400/30 px-3.5 py-1.5 rounded-full text-xs font-bold text-emerald-100 uppercase tracking-wide mb-3">
              <CheckCircle className="w-4 h-4 text-emerald-200" />
              Bulk Enrollment Successful
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              {count} জন শিক্ষার্থীর ভর্তি সফলভাবে সম্পন্ন হয়েছে!
            </h2>
            <p className="text-emerald-100 text-sm mt-1">
              ব্যাচ: <b>{batch.name}</b> • বরাদ্দকৃত রোল রেঞ্জ: <b>#{roll_range.start} থেকে #{roll_range.end}</b> • বকেয়া ও শিক্ষার্থী প্রোফাইল সংরক্ষিত হয়েছে।
            </p>

            {/* Quick Bulk Action Buttons */}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={handlePrintAllSlips}
                className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-900 hover:bg-emerald-50 rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4 text-emerald-700" />
                <span>সব ভর্তি রসিদ প্রিন্ট করুন ({count})</span>
              </button>

              <button
                onClick={handleDownloadAllSlipsPDF}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-800/80 hover:bg-emerald-800 text-white rounded-xl font-bold text-sm border border-emerald-600 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>রসিদ PDF ডাউনলোড</span>
              </button>

              <button
                onClick={handlePrintAllIdCards}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer"
              >
                <Layers className="w-4 h-4 text-indigo-200" />
                <span>সব আইডি কার্ড প্রিন্ট করুন ({count})</span>
              </button>

              <button
                onClick={handleDownloadAllIdCardsPDF}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-xl font-bold text-sm border border-slate-700 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-indigo-300" />
                <span>আইডি কার্ড PDF ডাউনলোড</span>
              </button>

              <button
                onClick={() => {
                  setCompletedResults(null)
                  setActiveTab("history")
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-950/70 hover:bg-emerald-950 text-white rounded-xl font-bold text-sm border border-emerald-400/30 transition-all cursor-pointer shadow-sm"
              >
                <History className="w-4 h-4 text-emerald-300" />
                <span>📜 পূর্বের সকল ইতিহাস দেখুন (View All History)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Results Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-base">ভর্তিকৃত শিক্ষার্থীদের তালিকা ও রসিদ</h3>
              <p className="text-xs text-slate-500 mt-0.5">নিচের তালিকা থেকে যেকোনো শিক্ষার্থীর ব্যক্তিগত স্লিপ বা আইডি কার্ড প্রিন্ট করতে পারেন</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleResetForNewBatch}
                className="text-xs font-semibold px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                + আরো ভর্তি করুন
              </button>
              <Link
                href="/dashboard/owner/students"
                className="text-xs font-bold px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                শিক্ষার্থী তালিকা দেখুন →
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 text-slate-600 font-semibold text-xs border-b border-slate-200">
                  <th className="py-3 px-4">রোল (Roll)</th>
                  <th className="py-3 px-4">Student ID</th>
                  <th className="py-3 px-4">নাম (Name)</th>
                  <th className="py-3 px-4">মোবাইল (Phone)</th>
                  <th className="py-3 px-4">অভিভাবক (Guardian)</th>
                  <th className="py-3 px-4">বকেয়া (Due)</th>
                  <th className="py-3 px-4 text-right">অ্যাকশন (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((r, idx) => {
                  const slip = r.slip_data
                  const rollStr = slip.batch_roll != null ? String(slip.batch_roll) : String(idx + 1)
                  return (
                    <tr key={r.student.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-black text-rose-600">#{rollStr}</td>
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600">{slip.student_id}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{slip.student_name}</td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-xs">{slip.student_phone || slip.guardian_phone || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 text-xs">
                        {slip.guardian_name || "-"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                          slip.due_amount <= 0 
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                            : "bg-rose-50 text-rose-700 border border-rose-200 font-mono"
                        }`}>
                          {slip.due_amount <= 0 ? "৳০ (No Due)" : `বকেয়া: ৳${slip.due_amount}`}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => printAdmissionSlip(slip)}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Print Admission Memo"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => printStudentIdCard(r.id_card_data)}
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Print Student ID Card"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // MULTI-ENROLL FORM VIEW
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Primary Tab Switcher */}
      <div className="flex bg-slate-200/70 p-1.5 rounded-2xl gap-1.5 border border-slate-200/80 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab("enroll")}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "enroll"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>📂 Multi-Enroll Students by CSV (বাল্ক ভর্তি)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "history"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <History className="w-4 h-4 text-indigo-600" />
          <span>📜 All Enrollment History (সকল পূর্বের ভর্তির ইতিহাস ও রিসিট)</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === "history" ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-700"
          }`}>
            {enrollmentsList.length}
          </span>
        </button>
      </div>

      {activeTab === "enroll" && (
        <div className="space-y-6">
          {/* 1. Step: Batch Selection (Clean & Reliable) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm">
            ১
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">ব্যাচ নির্বাচন (Select Target Batch)</h2>
            <p className="text-xs text-slate-500">যে ব্যাচে শিক্ষার্থীদের একসাথে ভর্তি করানো হবে তা নির্বাচন করুন</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Branch filter */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              শাখা ফিল্টার (Branch)
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 shadow-2xs font-medium cursor-pointer"
            >
              <option value="all">সকল শাখা (All Branches)</option>
              {effectiveBranches.map((br: any) => (
                <option key={br.id} value={br.id}>{br.name}</option>
              ))}
            </select>
          </div>

          {/* Batch select */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                ভর্তিকৃত ব্যাচ (Batch Selection) <span className="text-rose-500">*</span>
              </label>
              {loadingBatches && (
                <span className="text-[11px] text-indigo-600 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> লোড হচ্ছে...
                </span>
              )}
            </div>

            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 shadow-2xs font-semibold cursor-pointer"
            >
              <option value="">-- ব্যাচ নির্বাচন করুন (Select Batch) --</option>
              {filteredBatches.map((b) => {
                const max = b.max_seats || 50
                const cur = b.current_seats || 0
                const avail = Math.max(0, max - cur)
                const isFull = avail <= 0
                const bBranch = b.branch?.name || effectiveBranches.find(br => br.id === b.branch_id)?.name
                const branchLabel = bBranch ? ` [${bBranch}]` : ""
                return (
                  <option key={b.id} value={b.id} disabled={isFull}>
                    {b.name} ({b.class_level || "General"}{b.subject ? ` - ${b.subject}` : ""}){branchLabel} • {cur}/{max} Seats {isFull ? "[পূর্ণ (Full)]" : `[${avail} Available]`}
                  </option>
                )
              })}
            </select>

            {filteredBatches.length === 0 && !loadingBatches && (
              <p className="text-xs text-amber-600 mt-1.5 font-medium">
                ⚠️ কোনো সক্রিয় ব্যাচ পাওয়া যায়নি। উপরের ফিল্টারে &apos;সকল শাখা (All Branches)&apos; নির্বাচন করুন।
              </p>
            )}
          </div>
        </div>

        {/* Selected Batch Summary */}
        {selectedBatch && (
          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">{selectedBatch.name}</div>
                <div className="text-xs text-slate-500">
                  শ্রেণী: {selectedBatch.class_level || "General"} • বিষয়: {selectedBatch.subject || "All"}
                  {selectedBatch.branch?.name && ` • শাখা: ${selectedBatch.branch.name}`}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div>
                <div className="text-xs text-slate-500">আসন অবস্থা (Seats)</div>
                <div className="text-sm font-bold text-slate-800">
                  {selectedBatch.current_seats || 0} / {selectedBatch.max_seats || 50}
                  <span className={`ml-2 text-xs font-extrabold px-2 py-0.5 rounded-full ${
                    availableSeats > 5 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}>
                    {availableSeats} ফাঁকা (Open)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Step: CSV Template Format & Download (With Due column) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm">
              ২
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">সিএসভি ফরম্যাট ও নমুনা ফাইল (CSV Format & Template)</h2>
              <p className="text-xs text-slate-500">
                ফাইলে <b>Due (বকেয়া)</b> কলামে চলতি মাসে শিক্ষার্থীর বকেয়া টাকার পরিমাণ উল্লেখ করুন
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadSampleCSV}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>নমুনা CSV ফরম্যাট</span>
            </button>
            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-indigo-200" />
              <span>📥 সম্পূর্ণ ডেটা এক্সপোর্ট (Export CSVs)</span>
            </button>
          </div>
        </div>

        {/* Format Explanation Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
            <thead className="bg-slate-100 text-slate-700 font-bold">
              <tr>
                <th className="py-2.5 px-3">কলামের নাম (Header)</th>
                <th className="py-2.5 px-3">বাংলা নাম</th>
                <th className="py-2.5 px-3">স্ট্যাটাস</th>
                <th className="py-2.5 px-3">বর্ণনা ও উদাহরণ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-600">
              <tr>
                <td className="py-2 px-3 font-mono font-bold text-slate-900">Name</td>
                <td className="py-2 px-3 font-medium text-slate-800">নাম</td>
                <td className="py-2 px-3"><span className="text-rose-600 font-bold">Required</span></td>
                <td className="py-2 px-3">শিক্ষার্থীর পুরো নাম (যেমন: আবাব হোসেন)</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-mono font-bold text-slate-900">Guardian Phone</td>
                <td className="py-2 px-3 font-medium text-slate-800">অভিভাবকের মোবাইল</td>
                <td className="py-2 px-3"><span className="text-rose-600 font-bold">Required</span></td>
                <td className="py-2 px-3">মোবাইল নম্বর (যেমন: +8801302201431 বা 01302201431)</td>
              </tr>
              <tr className="bg-amber-50/50 font-semibold">
                <td className="py-2 px-3 font-mono text-indigo-700 font-bold">Due</td>
                <td className="py-2 px-3 text-indigo-900 font-bold">বকেয়া / বকেয়া টাকা</td>
                <td className="py-2 px-3"><span className="text-amber-700 font-bold">Optional</span></td>
                <td className="py-2 px-3 text-amber-900">চলতি মাসের বকেয়া টাকার পরিমাণ (যেমন: 1500, 1000 বা 0)</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-mono text-slate-700">Guardian Name</td>
                <td className="py-2 px-3 text-slate-800">পিতা/মাতা নাম</td>
                <td className="py-2 px-3 text-slate-500">Optional</td>
                <td className="py-2 px-3">অভিভাবকের নাম (যেমন: শাকিলা খাতুন)</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-mono text-slate-700">Phone</td>
                <td className="py-2 px-3 text-slate-800">শিক্ষার্থীর মোবাইল</td>
                <td className="py-2 px-3 text-slate-500">Optional</td>
                <td className="py-2 px-3">শিক্ষার্থীর নিজস্ব মোবাইল নম্বর</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-mono text-slate-700">Address</td>
                <td className="py-2 px-3 text-slate-800">ঠিকানা</td>
                <td className="py-2 px-3 text-slate-500">Optional</td>
                <td className="py-2 px-3">বর্তমান বা স্থায়ী ঠিকানা (যেমন: কামারপাড়া, রংপুর)</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-mono text-slate-700">School / College</td>
                <td className="py-2 px-3 text-slate-800">স্কুল/কলেজ</td>
                <td className="py-2 px-3 text-slate-500">Optional</td>
                <td className="py-2 px-3">বর্তমান শিক্ষা প্রতিষ্ঠান</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Step: Upload CSV File & Live Data Preview */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm">
            ৩
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">সিএসভি ফাইল আপলোড ও প্রিভিউ (Import CSV)</h2>
            <p className="text-xs text-slate-500">আপনার তৈরি করা CSV ফাইলটি আপলোড করুন</p>
          </div>
        </div>

        {/* Upload dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
            isDragging 
              ? "border-indigo-500 bg-indigo-50/50 scale-[1.01]" 
              : fileName 
              ? "border-emerald-300 bg-emerald-50/30" 
              : "border-slate-300 bg-slate-50/50 hover:bg-slate-100/50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={handleFileUpload}
            className="hidden"
          />

          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
            {fileName ? <CheckCircle2 className="w-6 h-6 text-emerald-600" /> : <Upload className="w-6 h-6" />}
          </div>

          <div className="text-sm font-bold text-slate-800">
            {fileName ? (
              <span className="text-emerald-700">ফাইল লোড হয়েছে: {fileName}</span>
            ) : (
              <span>ক্লিক করে Excel (.xlsx) অথবা CSV ফাইল আপলোড করুন (অথবা ড্র্যাগ করুন)</span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            .xlsx, .xls অথবা .csv স্প্রেডশীট ফাইল সমর্থিত (সরাসরি <b>.xlsx</b> দিলে নম্বর বিকৃত হয় না)
          </p>
        </div>

        {/* Parsed Students Table Preview */}
        {parsedStudents.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-900">
                  মোট শিক্ষার্থী: <span className="text-indigo-600 font-extrabold">{parsedStudents.length}</span> জন
                </span>
                <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                  মোট বকেয়া: ৳{totalParsedDue.toLocaleString("en-BD")}
                </span>
                {parsedStudents.length > availableSeats && (
                  <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                    ⚠️ ব্যাচে ফাঁকা আসনের চেয়ে {parsedStudents.length - availableSeats} জন বেশি!
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  সঠিক: <b>{parsedStudents.filter(s => s.isValid).length}</b> • 
                  ত্রুটি: <b className="text-rose-600">{parsedStudents.filter(s => !s.isValid).length}</b>
                </span>
                <button
                  type="button"
                  onClick={() => setParsedStudents([])}
                  className="text-xs text-rose-600 hover:text-rose-800 font-medium ml-2 cursor-pointer"
                >
                  সব মুছুন (Clear)
                </button>
              </div>
            </div>

            {hasScientificNotationZeroes && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-3 shadow-2xs">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-950 text-sm">
                    ⚠️ এক্সেলে কলামের সাইজ সংকীর্ণ থাকায় কিছু নম্বর বিকৃত হয়ে শূন্য হয়েছে (যেমন: +8801790000000)
                  </p>
                  <p className="text-amber-800 leading-relaxed">
                    <b>২ সেকেন্ডে এক্সেলে সমাধান:</b> এক্সেল ফাইলে <b>B</b> কলামটির উপরে ক্লিক করুন $\rightarrow$ কলামটি একটু চওড়া (B ও C এর মাঝের দাগে ডাবল ক্লিক করে Widen) করুন অথবা <b>Number</b> ফরম্যাটে সেট করুন (0 decimals) $\rightarrow$ <b>Save (Ctrl + S)</b> করে পুনরায় ফাইলটি আপলোড করুন। <i>অথবা নিচের টেবিলে লাল চিহ্নিত ঘরে সরাসরি সঠিক নম্বরটি লিখে দিন।</i>
                  </p>
                </div>
              </div>
            )}

            <div className="overflow-x-auto max-h-[380px] border border-slate-200 rounded-xl overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">নাম (Name) <span className="text-rose-500">*</span></th>
                    <th className="py-2.5 px-3">অভিভাবকের মোবাইল <span className="text-rose-500">*</span></th>
                    <th className="py-2.5 px-3 text-rose-700 bg-rose-50/70">বকেয়া (Due ৳)</th>
                    <th className="py-2.5 px-3">পিতা/মাতার নাম</th>
                    <th className="py-2.5 px-3">শিক্ষার্থীর মোবাইল</th>
                    <th className="py-2.5 px-3">স্কুল/কলেজ</th>
                    <th className="py-2.5 px-3">ঠিকানা</th>
                    <th className="py-2.5 px-3">স্ট্যাটাস</th>
                    <th className="py-2.5 px-3 text-right">মুছুন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {parsedStudents.map((st, idx) => (
                    <tr key={st.id} className={`h-11 ${!st.isValid ? "bg-rose-50/40" : "hover:bg-slate-50/60"}`}>
                      <td className="py-1 px-3 font-mono text-slate-400 font-bold align-middle whitespace-nowrap">{idx + 1}</td>
                      <td className="py-1 px-3 align-middle">
                        <input
                          type="text"
                          value={st.name}
                          onChange={(e) => handleUpdateStudentCell(st.id, "name", e.target.value)}
                          className={`px-2 py-1 border rounded text-xs font-semibold text-slate-900 w-36 ${
                            !st.name ? "border-rose-400 bg-rose-50" : "border-slate-200 bg-transparent"
                          }`}
                        />
                      </td>
                      <td className="py-1 px-3 align-middle">
                        <input
                          type="text"
                          value={st.guardian_phone}
                          onChange={(e) => handleUpdateStudentCell(st.id, "guardian_phone", e.target.value)}
                          className={`px-2 py-1 border rounded text-xs font-mono text-slate-900 w-32 ${
                            !st.guardian_phone || /00000$/.test(st.guardian_phone.replace(/[^0-9]/g, "")) ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-transparent"
                          }`}
                        />
                      </td>
                      <td className="py-1 px-3 bg-rose-50/20 align-middle">
                        <div className="relative">
                          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">৳</span>
                          <input
                            type="number"
                            min="0"
                            value={st.due_amount}
                            onChange={(e) => handleUpdateStudentCell(st.id, "due_amount", parseFloat(e.target.value) || 0)}
                            className="pl-4 pr-1 py-1 border border-slate-200 rounded text-xs font-bold text-rose-600 w-24 bg-transparent"
                          />
                        </div>
                      </td>
                      <td className="py-1 px-3 align-middle">
                        <input
                          type="text"
                          value={st.guardian_name || ""}
                          onChange={(e) => handleUpdateStudentCell(st.id, "guardian_name", e.target.value)}
                          className="px-2 py-1 border border-slate-200 rounded text-xs text-slate-800 w-32 bg-transparent"
                        />
                      </td>
                      <td className="py-1 px-3 align-middle">
                        <input
                          type="text"
                          value={st.phone || ""}
                          onChange={(e) => handleUpdateStudentCell(st.id, "phone", e.target.value)}
                          className="px-2 py-1 border border-slate-200 rounded text-xs font-mono text-slate-800 w-28 bg-transparent"
                        />
                      </td>
                      <td className="py-1 px-3 align-middle">
                        <input
                          type="text"
                          value={st.school_college || ""}
                          onChange={(e) => handleUpdateStudentCell(st.id, "school_college", e.target.value)}
                          className="px-2 py-1 border border-slate-200 rounded text-xs text-slate-800 w-36 bg-transparent"
                        />
                      </td>
                      <td className="py-1 px-3 align-middle">
                        <input
                          type="text"
                          value={st.address || ""}
                          onChange={(e) => handleUpdateStudentCell(st.id, "address", e.target.value)}
                          className="px-2 py-1 border border-slate-200 rounded text-xs text-slate-800 w-32 bg-transparent"
                        />
                      </td>
                      <td className="py-1 px-3 align-middle whitespace-nowrap">
                        {st.isValid ? (
                          <span className="inline-flex items-center text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 whitespace-nowrap">
                            ✓ Ready
                          </span>
                        ) : (
                          <span 
                            className="inline-flex items-center text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 whitespace-nowrap max-w-[130px] truncate block" 
                            title={st.errors.join(", ")}
                          >
                            ! {st.errors[0]}
                          </span>
                        )}
                      </td>
                      <td className="py-1 px-3 text-right align-middle">
                        <button
                          type="button"
                          onClick={() => handleRemoveStudent(st.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                          title="Remove row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 4. Step: Password & Confirm Password */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm">
            ৪
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">শিক্ষার্থী পোর্টাল পাসওয়ার্ড (Account Password & Confirm Password)</h2>
            <p className="text-xs text-slate-500">ভর্তিকৃত সকল শিক্ষার্থীর অ্যাকাউন্টের জন্য পাসওয়ার্ড সেট করুন যা তাদের ভর্তি রসিদে উল্লেখ থাকবে</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              পাসওয়ার্ড (Password) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-mono shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              কনফার্ম পাসওয়ার্ড (Confirm Password) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type password"
                className={`w-full pl-3.5 pr-10 py-2.5 text-sm bg-white border rounded-xl focus:ring-2 text-slate-900 font-mono shadow-2xs ${
                  confirmPassword && password !== confirmPassword 
                    ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20" 
                    : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20"
                }`}
              />
              {confirmPassword && password === confirmPassword && (
                <Check className="w-4 h-4 text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2" />
              )}
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="text-[11px] text-rose-600 mt-1 font-medium">পাসওয়ার্ড দুটি মিলছে না (Passwords do not match)</p>
            )}
          </div>
        </div>

        <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-900 flex items-start gap-2.5">
          <Key className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            শিক্ষার্থীরা তাদের <b>Student ID</b> (যেমন: MS-00012) এবং এই <b>পাসওয়ার্ড</b> ব্যবহার করে স্টুডেন্ট পোর্টালে লগইন করতে পারবে। প্রতিটি শিক্ষার্থীর ভর্তি ও বকেয়া রসিদে স্বয়ংক্রিয়ভাবে আইডি ও পাসওয়ার্ড মুদ্রিত হবে।
          </div>
        </div>
      </div>

      {/* 5. Execution Submit Button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="text-xs text-slate-600">
          নির্বাচিত ব্যাচ: <b className="text-slate-900">{selectedBatch?.name || "None"}</b> • 
          ভর্তি হবে: <b className="text-indigo-600">{parsedStudents.length} জন</b>
          {totalParsedDue > 0 && (
            <span> • মোট বকেয়া: <b className="text-rose-600">৳{totalParsedDue.toLocaleString("en-BD")}</b></span>
          )}
        </div>

        <button
          type="button"
          disabled={isSubmitting || parsedStudents.length === 0 || !selectedBatchId}
          onClick={handleExecuteBulkEnroll}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black text-sm rounded-xl shadow-lg shadow-indigo-200 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>একসাথে ভর্তি ও স্লিপ তৈরি হচ্ছে... (Enrolling...)</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>একসাথে ভর্তি ও স্লিপ তৈরি করুন (Enroll {parsedStudents.length} Students)</span>
            </>
          )}
        </button>
      </div>

      {/* Recent Enrollment History Preview in Enroll Tab */}
      {enrollmentsList.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                Recent Enrollment History (পূর্বের সাম্প্রতিক ভর্তির তালিকা)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>View All History ({enrollmentsList.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {enrollmentsList.slice(0, 5).map((enr: any) => {
              const student = (enr.student && enr.student.name)
                ? enr.student
                : studentsList.find(s => s.id === enr.student_id || s.student_id === enr.student_id) || enr.student || {}
              const b = enr.batch || allBatches.find(bat => bat.id === enr.batch_id) || {}
              const matchingPayment = paymentsList.find(p => 
                (p.student_id === enr.student_id || (student?.id && p.student_id === student.id) || (student?.student_id && p.student_id === student.student_id)) && 
                (p.batch_id === enr.batch_id || !p.batch_id)
              )
              const matchingDue = duesList.find(d => 
                (d.student_id === enr.student_id || (student?.id && d.student_id === student.id) || (student?.student_id && d.student_id === student.student_id)) && 
                (d.batch_id === enr.batch_id || !d.batch_id)
              )
              const totalFee = matchingPayment?.amount || (b.monthly_fee ? (b.monthly_fee + (b.admission_fee || 0)) : 0) || (matchingDue?.due_amount || 0)
              const paidAmt = matchingPayment?.total_paid ?? (matchingDue?.paid_amount || 0)
              const dueAmt = matchingDue ? Math.max(0, (matchingDue.due_amount || totalFee) - (matchingDue.paid_amount || paidAmt)) : Math.max(0, totalFee - paidAmt)
              const roll = enr.roll_no ?? student.roll_no ?? student.batch_roll

              return (
                <div key={enr.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900">{student.name || (enr.student_id && !enr.student_id.includes("-") ? "Student" : enr.student_id) || "Student"}</span>
                      <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        {student.student_id || enr.student_id || "N/A"}
                      </span>
                      {roll != null && (
                        <span className="text-xs font-mono font-black text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                          রোল #{roll}
                        </span>
                      )}
                      <span className="text-xs font-semibold text-slate-600">• {b.name || "Batch"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span>{formatDate(enr.created_at)}</span>
                      <span>• Paid: <b className="text-emerald-600">{formatCurrency(paidAmt)}</b></span>
                      {dueAmt > 0 && <span>• Due: <b className="text-rose-600">{formatCurrency(dueAmt)}</b></span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setHistoryIdCardStudent(getHistoryIdCardData(enr))}
                      className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="View & Print ID Card"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                      <span>ID Card</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => printAdmissionSlip(getHistorySlipData(enr))}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Print Admission Slip"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-600" />
                      <span>Slip</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadBulkAdmissionSlipsPDF([getHistorySlipData(enr)])}
                      className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Download PDF"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-600" />
                      <span>PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlipPreview(getHistorySlipData(enr))}
                      className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg text-xs transition-colors cursor-pointer"
                      title="View Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
    )}

    {/* Dedicated Full Enrollment History Tab */}
    {activeTab === "history" && (
      <div className="space-y-4">
        {/* Summary Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-[11px] font-bold text-slate-500 uppercase">Total Enrolled</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{historyStats.totalEnrolled}</p>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-[11px] font-bold text-emerald-600 uppercase">Total Collection</p>
            <p className="text-xl font-black text-emerald-700 mt-0.5">{formatCurrency(historyStats.totalPaid)}</p>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-[11px] font-bold text-rose-600 uppercase">Outstanding Due</p>
            <p className="text-xl font-black text-rose-700 mt-0.5">{formatCurrency(historyStats.totalDue)}</p>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-[11px] font-bold text-indigo-600 uppercase">Fully Paid</p>
            <p className="text-xl font-black text-indigo-700 mt-0.5">{historyStats.paidCount}</p>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={historySearchQuery}
                onChange={e => setHistorySearchQuery(e.target.value)}
                placeholder="Search student name, ID (MS-...), roll (#1), phone, guardian phone, batch..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white shadow-2xs"
              />
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("enroll")}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="নতুন বাল্ক ভর্তি ফর্ম খুলুন"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>New Bulk CSV Enroll (নতুন বাল্ক ভর্তি)</span>
            </button>
            <button
              type="button"
              onClick={fetchHistory}
              disabled={historyLoading}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh History from Database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? "animate-spin text-indigo-600" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2 items-center text-xs">
            {/* Branch filter */}
            <select
              value={historyBranchFilter}
              onChange={e => setHistoryBranchFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-xl bg-slate-50 text-slate-800 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Branches (সকল শাখা)</option>
              {effectiveBranches.map((br: any) => (
                <option key={br.id} value={br.id}>{br.name}</option>
              ))}
            </select>

            {/* Batch filter */}
            <select
              value={historyBatchFilter}
              onChange={e => setHistoryBatchFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-xl bg-slate-50 text-slate-800 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Batches (সকল ব্যাচ)</option>
              {allBatches.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            {/* Status filter */}
            <select
              value={historyStatusFilter}
              onChange={e => setHistoryStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-xl bg-slate-50 text-slate-800 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Payment Status</option>
              <option value="paid">✓ Fully Paid</option>
              <option value="due">⏳ Has Due</option>
            </select>

            <span className="text-slate-400 ml-auto font-medium">
              Showing {filteredEnrollments.length} enrolled students
            </span>
          </div>
        </div>

        {/* Table / Cards */}
        {filteredEnrollments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
            <UserPlus className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-700 text-sm">No enrollment records found</p>
            <p className="text-xs text-slate-400 mt-1">
              {historySearchQuery ? "Try a different search keyword or clear filters." : "Students enrolled in batches will appear here."}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="px-3 py-3 text-center w-16">Roll</th>
                    <th className="px-4 py-3">Student Info</th>
                    <th className="px-4 py-3">Batch & Campus</th>
                    <th className="px-4 py-3">Enrolled Date</th>
                    <th className="px-4 py-3">Payment Summary</th>
                    <th className="px-4 py-3 text-right">Actions (ID Card / Slip / PDF)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEnrollments.map((enr: any) => {
                    const student = (enr.student && enr.student.name)
                      ? enr.student
                      : studentsList.find(s => s.id === enr.student_id || s.student_id === enr.student_id) || enr.student || {}
                    const b = enr.batch || allBatches.find(bat => bat.id === enr.batch_id) || {}
                    const branchObj = effectiveBranches.find((br: any) => br.id === enr.branch_id || br.id === b.branch_id)
                    const matchingPayment = paymentsList.find(p => 
                      (p.student_id === enr.student_id || (student?.id && p.student_id === student.id) || (student?.student_id && p.student_id === student.student_id)) && 
                      (p.batch_id === enr.batch_id || !p.batch_id)
                    )
                    const matchingDue = duesList.find(d => 
                      (d.student_id === enr.student_id || (student?.id && d.student_id === student.id) || (student?.student_id && d.student_id === student.student_id)) && 
                      (d.batch_id === enr.batch_id || !d.batch_id)
                    )
                    const totalFee = matchingPayment?.amount || (b.monthly_fee ? (b.monthly_fee + (b.admission_fee || 0)) : 0) || (matchingDue?.due_amount || 0)
                    const paidAmt = matchingPayment?.total_paid ?? (matchingDue?.paid_amount || 0)
                    const dueAmt = matchingDue ? Math.max(0, (matchingDue.due_amount || totalFee) - (matchingDue.paid_amount || paidAmt)) : Math.max(0, totalFee - paidAmt)
                    const isPaid = totalFee > 0 ? paidAmt >= totalFee : true
                    const roll = enr.roll_no ?? student.roll_no ?? student.batch_roll

                    return (
                      <tr key={enr.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-3 py-3.5 text-center">
                          {roll != null ? (
                            <span className="inline-flex items-center justify-center font-mono font-bold text-xs bg-amber-50 text-amber-800 border border-amber-300 rounded-lg px-2 py-0.5">
                              #{roll}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 font-mono">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-900 text-sm">{student.name || (enr.student_id && !enr.student_id.includes("-") ? "Student" : enr.student_id) || "Student"}</div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="font-mono text-xs text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 font-semibold">
                              {student.student_id || enr.student_id || "N/A"}
                            </span>
                            {student.phone && (
                              <span className="text-slate-500 text-xs">📱 {student.phone}</span>
                            )}
                            {student.guardian_phone && student.guardian_phone !== student.phone && (
                              <span className="text-slate-400 text-xs">👨‍👦 {student.guardian_phone}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-800">{b.name || "Enrolled Batch"}</div>
                          <div className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                            <span>{branchObj?.name || "Main Campus"}</span>
                            {b.class_level && <span>• {b.class_level}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                          {formatDate(enr.created_at)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {isPaid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle className="w-3 h-3" /> Fully Paid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <Clock className="w-3 h-3" /> Due Pending
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="text-emerald-600 font-semibold">Paid: {formatCurrency(paidAmt)}</span>
                            {dueAmt > 0 && <span className="text-rose-600 font-semibold">• Due: {formatCurrency(dueAmt)}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setHistoryIdCardStudent(getHistoryIdCardData(enr))}
                              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="View & Print Student ID Card"
                            >
                              <span>🪪 ID Card</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => printAdmissionSlip(getHistorySlipData(enr))}
                              className="px-2.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                              title="Print Admission & Payment Slip"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Slip</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadBulkAdmissionSlipsPDF([getHistorySlipData(enr)])}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="Download Receipt PDF"
                            >
                              <Download className="w-3.5 h-3.5 text-amber-600" />
                              <span>PDF</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSlipPreview(getHistorySlipData(enr))}
                              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl transition-colors cursor-pointer"
                              title="Preview Full Slip"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {student.id && (
                              <Link
                                href={`/dashboard/owner/students/${student.id}`}
                                className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-xl transition-colors"
                                title="View Student Profile"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )}

    {/* ID Card Modal */}
    <StudentIdCardModal
      isOpen={!!historyIdCardStudent}
      onClose={() => setHistoryIdCardStudent(null)}
      cardData={historyIdCardStudent || undefined}
      student={historyIdCardStudent ? {
        id: historyIdCardStudent.student_id,
        name: historyIdCardStudent.student_name,
        student_id: historyIdCardStudent.student_id,
        phone: historyIdCardStudent.student_phone,
        guardian_phone: historyIdCardStudent.guardian_phone,
        qr_code: historyIdCardStudent.qr_code
      } as any : undefined}
      batchName={historyIdCardStudent?.batch_name}
      rollNo={historyIdCardStudent?.batch_roll}
    />

    {/* Slip Preview Modal */}
    {slipPreview && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Admission Slip & Memo</h3>
              <p className="text-xs text-slate-500 font-mono">{slipPreview.receipt_number}</p>
            </div>
            <button
              type="button"
              onClick={() => setSlipPreview(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Student Name:</span>
              <span className="font-bold text-slate-900">{slipPreview.student_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Student ID:</span>
              <span className="font-mono font-bold text-indigo-700">{slipPreview.student_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Batch Roll:</span>
              <span className="font-mono font-bold text-rose-700">#{slipPreview.batch_roll}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Batch:</span>
              <span className="font-semibold text-slate-800">{slipPreview.batch_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Admission Date:</span>
              <span className="text-slate-700">{slipPreview.date}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="text-slate-500 font-semibold">Paid Amount:</span>
              <span className="font-bold text-emerald-600">৳{slipPreview.paid_amount.toLocaleString("en-BD")}</span>
            </div>
            {slipPreview.due_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-rose-600 font-semibold">Due Amount:</span>
                <span className="font-bold text-rose-600">৳{slipPreview.due_amount.toLocaleString("en-BD")}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => printAdmissionSlip(slipPreview)}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Slip</span>
            </button>
            <button
              type="button"
              onClick={() => downloadBulkAdmissionSlipsPDF([slipPreview])}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      </div>
    )}

    <BulkDataExportModal
      isOpen={showExportModal}
      onClose={() => setShowExportModal(false)}
      branches={effectiveBranches}
      initialBranchId={selectedBranchId}
    />
  </div>
)
}
