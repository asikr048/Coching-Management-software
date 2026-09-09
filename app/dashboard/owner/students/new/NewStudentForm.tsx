"use client"
import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { 
  Loader2, UserPlus, BookOpen, CreditCard, Check, Lock, Search, ShieldAlert, 
  AlertCircle, Printer, Download, RefreshCw, Landmark, DoorOpen, History, 
  Calendar, Filter, Eye, Phone, Mail, UserCheck, ArrowRight, FileText, 
  CheckCircle2, Clock, DollarSign, ChevronRight, ExternalLink, X 
} from "lucide-react"
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils"
import { checkFinancialAccess } from "@/lib/financial-access"

interface Batch { 
  id: string
  name: string
  branch_id?: string | null
  classroom?: string | null
  subject?: string
  class_level?: string
  max_seats: number
  current_seats: number
  monthly_fee: number
  admission_fee: number
  status?: string 
}
interface StudentOpt { 
  id: string
  name: string
  student_id: string
  branch_id?: string | null
  phone?: string
  email?: string
  guardian_name?: string
  guardian_phone?: string
  address?: string
  class_level?: string
  school_college?: string 
}

interface EnrollmentReceipt {
  receipt_number: string
  student_name: string
  student_id: string
  password?: string
  student_phone?: string
  student_email?: string
  guardian_name?: string
  guardian_phone?: string
  batch_name: string
  subject?: string
  date: string
  total_fee: number
  paid_amount: number
  due_amount: number
  due_date?: string
  payment_method: string
  qr_data: string
}

export default function NewStudentForm({ 
  batches, 
  students, 
  branches = [],
  initialEnrollments = [],
  initialPayments = [],
  initialDues = [],
}: { 
  batches: Batch[]
  students: StudentOpt[]
  branches?: { id: string; name: string }[] 
  initialEnrollments?: any[]
  initialPayments?: any[]
  initialDues?: any[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [financialAccess, setFinancialAccess] = useState<boolean | null>(null)

  // Primary tab state: Enroll form vs Enrollment History
  const [activeTab, setActiveTab] = useState<"enroll" | "history">("enroll")

  // Reactive history lists
  const [enrollmentsList, setEnrollmentsList] = useState<any[]>(initialEnrollments || [])
  const [paymentsList, setPaymentsList] = useState<any[]>(initialPayments || [])
  const [duesList, setDuesList] = useState<any[]>(initialDues || [])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historySearchQuery, setHistorySearchQuery] = useState("")
  const [historyBranchFilter, setHistoryBranchFilter] = useState("all")
  const [historyBatchFilter, setHistoryBatchFilter] = useState("all")
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"all" | "paid" | "due">("all")

  const [mode, setMode] = useState<"new" | "existing">("new")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStudent, setSelectedStudent] = useState<StudentOpt | null>(null)
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => branches[0]?.id || "")
  const [form, setForm] = useState({ name: "", phone: "", email: "", gender: "male", date_of_birth: "", guardian_name: "", guardian_phone: "", guardian_relation: "Parent", address: "", school_college: "", class_level: "", referred_by_code: "", batch_id: "", password: "", confirmPassword: "" })
  const [existingFix, setExistingFix] = useState({ guardian_name: "", guardian_phone: "", address: "", class_level: "", school_college: "" })
  const [batchRoll, setBatchRoll] = useState<string>("")
  const [paidAmount, setPaidAmount] = useState("")
  const [dueDate, setDueDate] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(10); return d.toISOString().split("T")[0] })
  
  const [enrolledBatchIds, setEnrolledBatchIds] = useState<string[]>([])
  const [allBatches, setAllBatches] = useState<Batch[]>(batches || [])

  // Auto-calculate next batch roll (1, 2, 3...) when batch changes
  useEffect(() => {
    if (!form.batch_id) {
      setBatchRoll("")
      return
    }
    let isCancelled = false
    async function loadNextRoll() {
      try {
        const { data: enrs } = await supabase
          .from("enrollments")
          .select("roll_no")
          .eq("batch_id", form.batch_id)
          .order("roll_no", { ascending: false })
          .limit(1)

        if (isCancelled) return
        let nextRoll = 1
        if (enrs && enrs.length > 0 && enrs[0].roll_no != null && Number(enrs[0].roll_no) > 0) {
          nextRoll = Number(enrs[0].roll_no) + 1
        } else {
          const { count } = await supabase
            .from("enrollments")
            .select("id", { count: "exact", head: true })
            .eq("batch_id", form.batch_id)
          nextRoll = (count || 0) + 1
        }
        setBatchRoll(String(nextRoll))
      } catch (err) {
        if (!isCancelled) setBatchRoll("1")
      }
    }
    loadNextRoll()
    return () => { isCancelled = true }
  }, [form.batch_id])

  useEffect(() => {
    if (initialEnrollments && initialEnrollments.length > 0) {
      setEnrollmentsList(initialEnrollments)
    }
  }, [initialEnrollments])

  useEffect(() => {
    if (initialPayments && initialPayments.length > 0) {
      setPaymentsList(initialPayments)
    }
  }, [initialPayments])

  useEffect(() => {
    if (initialDues && initialDues.length > 0) {
      setDuesList(initialDues)
    }
  }, [initialDues])

  async function fetchHistory() {
    setHistoryLoading(true)
    try {
      const [enrRes, payRes, dueRes] = await Promise.all([
        supabase
          .from("enrollments")
          .select("id, created_at, status, batch_id, student_id, branch_id, roll_no, student:students(id, name, student_id, phone, email, guardian_name, guardian_phone, address, school_college, class_level, roll_no, batch_roll), batch:batches(id, name, subject, class_level, monthly_fee, admission_fee, classroom, branch_id)")
          .order("created_at", { ascending: false })
          .limit(150),
        supabase
          .from("payments")
          .select("id, student_id, batch_id, amount, total_paid, payment_method, payment_for, payment_month, receipt_number, created_at, paid_at")
          .order("created_at", { ascending: false })
          .limit(250),
        supabase
          .from("fee_dues")
          .select("id, student_id, batch_id, due_amount, paid_amount, due_date, status")
          .limit(250),
      ])
      if (enrRes.data && enrRes.data.length > 0) setEnrollmentsList(enrRes.data)
      if (payRes.data) setPaymentsList(payRes.data)
      if (dueRes.data) setDuesList(dueRes.data)
    } catch (err) {
      console.warn("Could not fetch enrollment history:", err)
    } finally {
      setHistoryLoading(false)
    }
  }

  // Client-side fallback if enrollmentsList is initially empty
  useEffect(() => {
    if (enrollmentsList.length === 0) {
      fetchHistory()
    }
  }, [])

  useEffect(() => {
    if (batches && batches.length > 0) {
      setAllBatches(batches)
    } else {
      async function fetchBatchesClient() {
        try {
          const { data, error } = await supabase
            .from("batches")
            .select("id, name, branch_id, origin_batch_id, origin_branch_id, branch_seats, classroom, subject, class_level, max_seats, current_seats, monthly_fee, admission_fee, status, is_active")
            .order("name")

          if (!error && data && data.length > 0) {
            const active = data.filter((b: any) => b.is_active !== false && b.status !== "finished")
            setAllBatches(active.length > 0 ? active : data)
          }
        } catch {
          try {
            const { data: raw } = await supabase.from("batches").select("*").order("name")
            if (raw && raw.length > 0) {
              const active = raw.filter((b: any) => b.is_active !== false && b.status !== "finished")
              setAllBatches(active.length > 0 ? active : raw)
            }
          } catch {}
        }
      }
      fetchBatchesClient()
    }
  }, [batches])
  
  // Post-enrollment receipt modal
  const [receipt, setReceipt] = useState<EnrollmentReceipt | null>(null)
  const receiptRef = useRef<HTMLDivElement>(null)

  useEffect(() => { checkFinancialAccess().then(({ hasAccess }) => setFinancialAccess(hasAccess)) }, [])

  // When selected student changes, fetch their enrolled batch IDs
  async function handleSelectStudent(s: StudentOpt | null) {
    setSelectedStudent(s)
    if (!s) {
      setEnrolledBatchIds([])
      return
    }
    if (s.branch_id) {
      handleBranchChange(s.branch_id)
    }
    setExistingFix({
      guardian_name: s.guardian_name || "",
      guardian_phone: s.guardian_phone || "",
      address: s.address || "",
      class_level: s.class_level || "",
      school_college: s.school_college || ""
    })
    try {
      const { data } = await supabase
        .from("enrollments")
        .select("batch_id")
        .eq("student_id", s.id)
      setEnrolledBatchIds((data || []).map((e: { batch_id: string }) => e.batch_id))
    } catch {
      setEnrolledBatchIds([])
    }
  }

  function update(f: string, v: string) { setForm(prev => ({ ...prev, [f]: v })) }

  function handleBranchChange(newBrId: string) {
    setSelectedBranchId(newBrId)
    const matches = allBatches.filter(b => 
      b.branch_id === newBrId ||
      (b as any).origin_branch_id === newBrId ||
      ((b as any).branch_seats && (b as any).branch_seats[newBrId] !== undefined) ||
      !b.branch_id
    )
    const candidateList = matches.length > 0 ? matches : allBatches
    const openBatch = candidateList.find(b => 
      !enrolledBatchIds.includes(b.id) &&
      (b.current_seats || 0) < b.max_seats &&
      b.status !== "admission_closed" &&
      b.status !== "finished"
    ) || candidateList[0]

    setForm(f => ({ ...f, batch_id: openBatch ? openBatch.id : "" }))
  }

  function resetForm() {
    setForm({ name: "", phone: "", email: "", gender: "male", date_of_birth: "", guardian_name: "", guardian_phone: "", guardian_relation: "Parent", address: "", school_college: "", class_level: "", referred_by_code: "", batch_id: "", password: "", confirmPassword: "" })
    setExistingFix({ guardian_name: "", guardian_phone: "", address: "", class_level: "", school_college: "" })
    setSelectedStudent(null)
    setEnrolledBatchIds([])
    setSearchQuery("")
    setPaidAmount("")
    const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(10)
    setDueDate(d.toISOString().split("T")[0])
    setReceipt(null)
  }

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return students.filter(s => s.name.toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q) || (s.phone && s.phone.includes(q))).slice(0, 8)
  }, [searchQuery, students])

  const branchFilteredBatches = useMemo(() => {
    if (!allBatches || allBatches.length === 0) return []
    if (!selectedBranchId) return allBatches
    const matches = allBatches.filter(b => 
      b.branch_id === selectedBranchId ||
      (b as any).origin_branch_id === selectedBranchId ||
      ((b as any).branch_seats && (b as any).branch_seats[selectedBranchId] !== undefined)
    )
    const globalBatches = allBatches.filter(b => !b.branch_id && !(b as any).origin_branch_id)
    const combined = [...matches, ...globalBatches.filter(g => !matches.some(e => e.id === g.id))]
    return combined.length > 0 ? combined : allBatches
  }, [allBatches, selectedBranchId])

  // Auto-select first available batch if none selected so payment section appears immediately
  useEffect(() => {
    if (!form.batch_id && branchFilteredBatches.length > 0) {
      const firstOpen = branchFilteredBatches.find(b => 
        !enrolledBatchIds.includes(b.id) &&
        (b.current_seats || 0) < b.max_seats &&
        b.status !== "admission_closed" &&
        b.status !== "finished"
      ) || branchFilteredBatches[0]
      if (firstOpen) {
        setForm(f => ({ ...f, batch_id: firstOpen.id }))
      }
    }
  }, [branchFilteredBatches, form.batch_id, enrolledBatchIds])

  const batch = allBatches.find(b => b.id === form.batch_id)
  const total = batch ? batch.monthly_fee + batch.admission_fee : 0
  const paid = parseFloat(paidAmount) || 0
  const due = Math.max(0, total - paid)

  // Check what info is missing on existing student
  const missingFields = useMemo(() => {
    if (!selectedStudent) return []
    const missing: string[] = []
    if (!selectedStudent.guardian_phone) missing.push("guardian_phone")
    if (!selectedStudent.guardian_name) missing.push("guardian_name")
    if (!selectedStudent.address) missing.push("address")
    if (!selectedStudent.class_level) missing.push("class_level")
    if (!selectedStudent.school_college) missing.push("school_college")
    return missing
  }, [selectedStudent])

  function getEnrollmentReceiptData(enr: any): EnrollmentReceipt {
    const student = enr.student || students.find(s => s.id === enr.student_id) || {}
    const b = enr.batch || allBatches.find(bat => bat.id === enr.batch_id) || {}
    const matchingPayment = paymentsList.find(p => p.student_id === enr.student_id && (p.batch_id === enr.batch_id || !p.batch_id))
    const matchingDue = duesList.find(d => d.student_id === enr.student_id && (d.batch_id === enr.batch_id || !d.batch_id))

    const totalFee = matchingPayment?.amount || (b.monthly_fee ? (b.monthly_fee + (b.admission_fee || 0)) : 0) || (matchingDue?.due_amount || 0)
    const paidAmt = matchingPayment?.total_paid ?? (matchingDue?.paid_amount || 0)
    const dueAmt = matchingDue ? Math.max(0, (matchingDue.due_amount || totalFee) - (matchingDue.paid_amount || paidAmt)) : Math.max(0, totalFee - paidAmt)

    const dateStr = enr.created_at
      ? new Date(enr.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })

    const receiptNo = matchingPayment?.receipt_number || `RCP-${new Date(enr.created_at || Date.now()).getFullYear()}-${(enr.id || '').replace(/-/g, '').slice(-6).toUpperCase()}`

    const dispStudentId = student.student_id || student.id || "N/A"
    const qrData = `Student ID: ${dispStudentId} | Name: ${student.name || ''} | Batch: ${b.name || ''} | Fee: ${totalFee} | Paid: ${paidAmt}`

    return {
      receipt_number: receiptNo,
      student_name: student.name || "Student",
      student_id: dispStudentId,
      student_phone: student.phone,
      student_email: student.email,
      guardian_name: student.guardian_name,
      guardian_phone: student.guardian_phone,
      batch_name: b.name || "Enrolled Batch",
      subject: b.subject || b.class_level || "General",
      date: dateStr,
      total_fee: totalFee,
      paid_amount: paidAmt,
      due_amount: dueAmt,
      due_date: matchingDue?.due_date || undefined,
      payment_method: matchingPayment?.payment_method?.toUpperCase() || "Cash / Counter",
      qr_data: qrData
    }
  }

  function handlePrintFromHistory(enr: any) {
    const r = getEnrollmentReceiptData(enr)
    setReceipt(r)
    handlePrint(r)
  }

  function handleSavePDFFromHistory(enr: any) {
    const r = getEnrollmentReceiptData(enr)
    setReceipt(r)
    handleSavePDF(r)
  }

  function handlePreviewReceipt(enr: any) {
    const r = getEnrollmentReceiptData(enr)
    setReceipt(r)
  }

  const filteredEnrollments = useMemo(() => {
    return enrollmentsList.filter((enr: any) => {
      const student = enr.student || students.find(s => s.id === enr.student_id) || {}
      const b = enr.batch || allBatches.find(bat => bat.id === enr.batch_id) || {}
      const brId = enr.branch_id || b.branch_id

      if (historyBranchFilter !== "all" && brId !== historyBranchFilter) return false
      if (historyBatchFilter !== "all" && enr.batch_id !== historyBatchFilter) return false

      if (historySearchQuery.trim()) {
        const q = historySearchQuery.trim().toLowerCase()
        const sName = (student.name || "").toLowerCase()
        const sId = (student.student_id || "").toLowerCase()
        const sPhone = (student.phone || "").toLowerCase()
        const gPhone = (student.guardian_phone || "").toLowerCase()
        const bName = (b.name || "").toLowerCase()
        const rollVal = enr.roll_no != null ? String(enr.roll_no) : (student.roll_no != null ? String(student.roll_no) : "")
        const matchRoll = rollVal !== "" && (rollVal === q || `roll ${rollVal}`.includes(q) || `roll #${rollVal}`.includes(q) || `r${rollVal}` === q)
        const match = sName.includes(q) || sId.includes(q) || sPhone.includes(q) || gPhone.includes(q) || bName.includes(q) || matchRoll
        if (!match) return false
      }

      if (historyStatusFilter !== "all") {
        const matchingPayment = paymentsList.find(p => p.student_id === enr.student_id && (p.batch_id === enr.batch_id || !p.batch_id))
        const matchingDue = duesList.find(d => d.student_id === enr.student_id && (d.batch_id === enr.batch_id || !d.batch_id))
        const totalFee = matchingPayment?.amount || (b.monthly_fee ? (b.monthly_fee + (b.admission_fee || 0)) : 0) || (matchingDue?.due_amount || 0)
        const paidAmt = matchingPayment?.total_paid ?? (matchingDue?.paid_amount || 0)
        const isPaidFull = totalFee > 0 ? (paidAmt >= totalFee) : true

        if (historyStatusFilter === "paid" && !isPaidFull) return false
        if (historyStatusFilter === "due" && isPaidFull) return false
      }

      return true
    })
  }, [enrollmentsList, students, allBatches, historyBranchFilter, historyBatchFilter, historySearchQuery, historyStatusFilter, paymentsList, duesList])

  const historyStats = useMemo(() => {
    let totalEnrolled = enrollmentsList.length
    let totalPaid = 0
    let totalDue = 0
    let paidCount = 0

    enrollmentsList.forEach((enr: any) => {
      const b = enr.batch || allBatches.find(bat => bat.id === enr.batch_id) || {}
      const matchingPayment = paymentsList.find(p => p.student_id === enr.student_id && (p.batch_id === enr.batch_id || !p.batch_id))
      const matchingDue = duesList.find(d => d.student_id === enr.student_id && (d.batch_id === enr.batch_id || !d.batch_id))
      const totalFee = matchingPayment?.amount || (b.monthly_fee ? (b.monthly_fee + (b.admission_fee || 0)) : 0) || (matchingDue?.due_amount || 0)
      const paidAmt = matchingPayment?.total_paid ?? (matchingDue?.paid_amount || 0)
      const dueAmt = matchingDue ? Math.max(0, (matchingDue.due_amount || totalFee) - (matchingDue.paid_amount || paidAmt)) : Math.max(0, totalFee - paidAmt)

      totalPaid += paidAmt
      totalDue += dueAmt
      if (totalFee > 0 && paidAmt >= totalFee) paidCount++
    })

    return { totalEnrolled, totalPaid, totalDue, paidCount }
  }, [enrollmentsList, allBatches, paymentsList, duesList])

  if (financialAccess === false) return (
    <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-8 text-center shadow-xl">
      <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto mb-2" />
      <h3 className="font-bold text-white">Financial Access Required</h3>
      <p className="text-sm text-rose-400 mt-1">Contact the owner to get financial access.</p>
    </div>
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.batch_id) { toast.error("Select a batch"); return }
    setLoading(true)
    try {
      let sid: string, dispId: string
      let studentName = ""
      let studentPhone = ""
      let studentEmail = ""
      let guardianName = ""
      let guardianPhone = ""
      let recordedPassword = ""

      if (mode === "existing") {
        if (!selectedStudent) { toast.error("Select a student"); setLoading(false); return }
        if (missingFields.includes("guardian_phone") && !existingFix.guardian_phone.trim()) { toast.error("Guardian phone is required"); setLoading(false); return }
        sid = selectedStudent.id; dispId = selectedStudent.student_id
        studentName = selectedStudent.name
        studentPhone = selectedStudent.phone || ""
        studentEmail = selectedStudent.email || ""
        guardianName = existingFix.guardian_name.trim() || selectedStudent.guardian_name || ""
        guardianPhone = existingFix.guardian_phone.trim() || selectedStudent.guardian_phone || ""

        // Update missing info
        const updates: Record<string, string> = {}
        if (selectedBranchId && !selectedStudent.branch_id) (updates as any).branch_id = selectedBranchId
        if (missingFields.includes("guardian_phone") && existingFix.guardian_phone.trim()) updates.guardian_phone = existingFix.guardian_phone.trim()
        if (missingFields.includes("guardian_name") && existingFix.guardian_name.trim()) updates.guardian_name = existingFix.guardian_name.trim()
        if (missingFields.includes("address") && existingFix.address.trim()) updates.address = existingFix.address.trim()
        if (missingFields.includes("class_level") && existingFix.class_level.trim()) updates.class_level = existingFix.class_level.trim()
        if (missingFields.includes("school_college") && existingFix.school_college.trim()) updates.school_college = existingFix.school_college.trim()
        if (Object.keys(updates).length > 0) await supabase.from("students").update(updates).eq("id", sid)
      } else {
        if (!form.name.trim()) { toast.error("Name required"); setLoading(false); return }
        if (!form.guardian_phone.trim()) { toast.error("Guardian phone required"); setLoading(false); return }
        if (!form.password || form.password.length < 6) { toast.error("Password min 6 chars"); setLoading(false); return }
        if (form.password !== form.confirmPassword) { toast.error("Passwords don't match"); setLoading(false); return }

        recordedPassword = form.password

        // Generate unique student ID (MS-XXXXX) robustly
        const { data: lastStudents } = await supabase
          .from("students")
          .select("student_id")
          .ilike("student_id", "MS-%")
          .order("student_id", { ascending: false })
          .limit(10)

        let maxSeq = 0
        if (lastStudents && lastStudents.length > 0) {
          for (const s of lastStudents) {
            const numPart = parseInt(s.student_id.replace(/^MS-/i, ""), 10)
            if (!isNaN(numPart) && numPart > maxSeq) {
              maxSeq = numPart
            }
          }
        }
        if (maxSeq === 0) {
          const { count } = await supabase.from("students").select("*", { count: "exact", head: true })
          maxSeq = count || 0
        }
        const seq = maxSeq + 1
        const studentIdStr = `MS-${String(seq).padStart(5, "0")}`

        const email = form.email.trim() || `${studentIdStr.toLowerCase()}@medhashiree.local`

        // Call backend API to create student account without logging out the owner/admin!
        const res = await fetch("/api/student/create-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password: form.password,
            fullName: form.name.trim(),
            studentId: studentIdStr,
            phone: form.phone.trim() || null
          })
        })
        const authResult = await res.json()
        if (!res.ok) {
          throw new Error(authResult.error || "Failed to create login account")
        }

        const { data: st, error: sErr } = await supabase.from("students").insert({
          student_id: studentIdStr,
          name: form.name.trim(),
          branch_id: selectedBranchId || batch?.branch_id || null,
          phone: form.phone.trim() || null,
          email: email,
          gender: form.gender,
          date_of_birth: form.date_of_birth || null,
          guardian_name: form.guardian_name.trim() || null,
          guardian_phone: form.guardian_phone.trim(),
          guardian_relation: form.guardian_relation,
          address: form.address.trim() || null,
          school_college: form.school_college.trim() || null,
          class_level: form.class_level.trim() || null,
          referred_by_code: form.referred_by_code.trim() || null,
        }).select().single()
        if (sErr) throw new Error(sErr.message)
        sid = st.id; dispId = st.student_id
        studentName = st.name
        studentPhone = st.phone || ""
        studentEmail = st.email || ""
        guardianName = st.guardian_name || ""
        guardianPhone = st.guardian_phone || ""
      }

      // Check if student is already enrolled in this batch
      const { data: existingEnr } = await supabase
        .from("enrollments")
        .select("id, status")
        .eq("student_id", sid)
        .eq("batch_id", form.batch_id)
        .maybeSingle()

      if (existingEnr) {
        toast.error(`Student is already enrolled in ${batch?.name || "this batch"}!`)
        setLoading(false)
        return
      }

      // Add enrollment with adaptive column support
      const enrollPayload: Record<string, any> = {
        student_id: sid,
        batch_id: form.batch_id,
        status: "active"
      }
      if (selectedBranchId || batch?.branch_id) {
        enrollPayload.branch_id = selectedBranchId || batch?.branch_id || null
      }
      if (batchRoll && !isNaN(parseInt(batchRoll, 10)) && parseInt(batchRoll, 10) > 0) {
        enrollPayload.roll_no = parseInt(batchRoll, 10)
      }

      let { error: eErr } = await supabase.from("enrollments").insert(enrollPayload)

      // Fallback if branch_id column doesn't exist in live Supabase enrollments schema cache
      if (eErr && (
        eErr.message?.includes("branch_id") || 
        eErr.message?.includes("schema cache") || 
        (eErr as any).code === "PGRST204"
      )) {
        delete enrollPayload.branch_id
        const retryRes = await supabase.from("enrollments").insert(enrollPayload)
        eErr = retryRes.error
      }

      if (eErr) {
        if (eErr.code === "23505" || eErr.message?.includes("unique constraint") || eErr.message?.includes("duplicate key")) {
          toast.error(`Student is already enrolled in ${batch?.name || "this batch"}!`)
          setLoading(false)
          return
        }
        throw new Error(eErr.message)
      }

      // Sync roll_no to student table as well
      if (enrollPayload.roll_no != null) {
        await supabase.from("students").update({
          roll_no: enrollPayload.roll_no,
          batch_roll: enrollPayload.roll_no
        }).eq("id", sid)
      }

      // Update seats count
      if (batch) {
        await supabase.from("batches").update({ current_seats: (batch.current_seats || 0) + 1 }).eq("id", form.batch_id)
        if (selectedBranchId) {
          try {
            const { data: childBatch } = await supabase
              .from("batches")
              .select("id, current_seats")
              .eq("origin_batch_id", form.batch_id)
              .eq("branch_id", selectedBranchId)
              .maybeSingle()
            if (childBatch) {
              await supabase.from("batches").update({ current_seats: (childBatch.current_seats || 0) + 1 }).eq("id", childBatch.id)
            }
            if ((batch as any).origin_batch_id) {
              const { data: parentBatch } = await supabase
                .from("batches")
                .select("id, current_seats")
                .eq("id", (batch as any).origin_batch_id)
                .maybeSingle()
              if (parentBatch) {
                await supabase.from("batches").update({ current_seats: (parentBatch.current_seats || 0) + 1 }).eq("id", parentBatch.id)
              }
            }
          } catch {}
        }
      }

      // Record payment
      let receiptNum = `RCP-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`
      if (paid > 0) {
        const { data: pData } = await supabase.from("payments").insert({
          student_id: sid,
          batch_id: form.batch_id,
          amount: total,
          total_paid: paid,
          payment_method: "cash",
          payment_for: "admission",
          payment_month: new Date().toISOString().slice(0, 7)
        }).select().maybeSingle()
        if (pData?.receipt_number) {
          receiptNum = pData.receipt_number
        }
      }

      // Record dues (safely upsert or ignore if already existing for this month)
      if (due > 0) {
        const n = new Date()
        const dueMonth = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`
        
        // Check if a fee_due already exists for this student, batch, and month
        const { data: existingDue } = await supabase
          .from("fee_dues")
          .select("id, due_amount, paid_amount")
          .eq("student_id", sid)
          .eq("batch_id", form.batch_id)
          .eq("due_month", dueMonth)
          .maybeSingle()

        if (existingDue) {
          // Update existing due
          await supabase.from("fee_dues").update({
            due_amount: Math.max(existingDue.due_amount, total),
            paid_amount: existingDue.paid_amount + paid,
            due_date: dueDate,
            status: (existingDue.paid_amount + paid) >= total ? "paid" : "partial"
          }).eq("id", existingDue.id)
        } else {
          // Insert new due
          const { error: dueErr } = await supabase.from("fee_dues").insert({
            student_id: sid,
            batch_id: form.batch_id,
            due_month: dueMonth,
            due_amount: total,
            paid_amount: paid,
            due_date: dueDate,
            status: paid > 0 ? "partial" : "pending"
          })
          if (dueErr && !dueErr.message.includes("duplicate") && dueErr.code !== "23505") {
            console.warn("Could not insert fee due:", dueErr)
          }
        }
      }

      // Referral handling
      if (form.referred_by_code.trim()) {
        const refText = form.referred_by_code.trim()
        const { data: r } = await supabase
          .from("students")
          .select("id, name, student_id")
          .or(`referral_code.eq.${refText},student_id.eq.${refText},phone.eq.${refText},name.ilike.${refText}`)
          .maybeSingle()

        const commAmt = Math.round(total * 0.1)
        if (r) {
          await supabase.from("referrals").insert({
            referrer_id: r.id,
            referee_id: sid,
            commission_rate: 10,
            commission_amount: commAmt,
            status: "pending",
            notes: `Referred by ${r.name} (${r.student_id}) during enrollment`
          })
          await supabase.from("students").update({
            referred_by_student_id: r.id,
            referred_by_code: refText
          }).eq("id", sid)
        }
      }

      toast.success(`Enrolled successfully! ID: ${dispId}`)

      // Display receipt modal with print & save options, staying on this page
      const qrData = `Student ID: ${dispId} | Name: ${studentName} | Batch: ${batch?.name || ''} | Fee: ${total} | Paid: ${paid}`
      setReceipt({
        receipt_number: receiptNum,
        student_name: studentName,
        student_id: dispId,
        password: recordedPassword || undefined,
        student_phone: studentPhone,
        student_email: studentEmail,
        guardian_name: guardianName,
        guardian_phone: guardianPhone,
        batch_name: batch?.name || "Enrolled Batch",
        subject: batch?.subject || batch?.class_level || "General",
        date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        total_fee: total,
        paid_amount: paid,
        due_amount: due,
        due_date: due > 0 ? dueDate : undefined,
        payment_method: "Cash / Counter",
        qr_data: qrData
      })

      // Real-time update history lists
      const newEnrItem = {
        id: `enr-${Date.now()}`,
        student_id: sid,
        batch_id: form.batch_id,
        branch_id: selectedBranchId || batch?.branch_id || null,
        status: "active",
        created_at: new Date().toISOString(),
        student: {
          id: sid,
          name: studentName,
          student_id: dispId,
          phone: studentPhone,
          email: studentEmail,
          guardian_name: guardianName,
          guardian_phone: guardianPhone,
          address: form.address,
          school_college: form.school_college,
          class_level: form.class_level,
        },
        batch: batch || { id: form.batch_id, name: "Enrolled Batch", monthly_fee: 0, admission_fee: 0 },
      }
      setEnrollmentsList(prev => [newEnrItem, ...prev])

      if (paid > 0) {
        setPaymentsList(prev => [{
          id: `pay-${Date.now()}`,
          student_id: sid,
          batch_id: form.batch_id,
          amount: total,
          total_paid: paid,
          payment_method: "cash",
          payment_for: "admission",
          receipt_number: receiptNum,
          created_at: new Date().toISOString(),
        }, ...prev])
      }

      if (due > 0) {
        setDuesList(prev => [{
          id: `due-${Date.now()}`,
          student_id: sid,
          batch_id: form.batch_id,
          due_amount: total,
          paid_amount: paid,
          due_date: dueDate,
          status: paid > 0 ? "partial" : "pending",
        }, ...prev])
      }

    } catch (err: any) {
      toast.error(err?.message || "Failed")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Print function
  function handlePrint(customReceipt?: EnrollmentReceipt) {
    const target = customReceipt || receipt
    if (!target) return
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(target.qr_data)}`
    const win = window.open("", "_blank", "width=650,height=800")
    if (!win) return
    win.document.write(`<html><head><title>Admission Document - ${target.student_id}</title><style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px; max-width: 520px; margin: 0 auto; color: #1e293b; background: #fff; }
      .header { text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 15px; position: relative; }
      .header h1 { margin: 0; font-size: 22px; color: #4338ca; text-transform: uppercase; letter-spacing: 1px; }
      .header p { margin: 3px 0; font-size: 12px; color: #64748b; }
      .badge { display: inline-block; background: #e0e7ff; color: #3730a3; padding: 3px 10px; border-radius: 9999px; font-weight: bold; font-size: 11px; margin-top: 5px; }
      .section-title { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #4f46e5; margin: 14px 0 6px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 3px; }
      .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
      .label { color: #64748b; }
      .value { font-weight: 600; color: #0f172a; text-align: right; }
      .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin-top: 10px; }
      .total-row { display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; padding: 6px 0; }
      .due-text { color: #dc2626; }
      .paid-text { color: #16a34a; }
      .cred-box { background: #eef2ff; border: 1.5px solid #c7d2fe; border-radius: 8px; padding: 8px 12px; margin: 12px 0; }
      .qr-container { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-top: 1px dashed #cbd5e1; margin-top: 12px; }
      .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
      @media print { body { padding: 10px; } }
    </style></head><body>
      <div class="header">
        <h1>MedhaShiree Coaching</h1>
        <p>Enrollment & Fee Confirmation Slip</p>
        <span class="badge">Official Admission Copy</span>
      </div>
      
      <div class="section-title">Student Information</div>
      <div class="row"><span class="label">Student ID:</span><span class="value">${target.student_id}</span></div>
      <div class="row"><span class="label">Full Name:</span><span class="value">${target.student_name}</span></div>
      ${target.student_phone ? `<div class="row"><span class="label">Phone:</span><span class="value">${target.student_phone}</span></div>` : ''}
      ${target.guardian_name ? `<div class="row"><span class="label">Guardian:</span><span class="value">${target.guardian_name}</span></div>` : ''}
      ${target.guardian_phone ? `<div class="row"><span class="label">Guardian Phone:</span><span class="value">${target.guardian_phone}</span></div>` : ''}

      ${target.password ? `
      <div class="cred-box">
        <div class="row"><span class="label" style="color: #4338ca; font-weight: 600;">Student Portal Login ID:</span><span class="value">${target.student_id}</span></div>
        <div class="row"><span class="label" style="color: #4338ca; font-weight: 600;">Account Password:</span><span class="value font-mono" style="color: #4338ca;">${target.password}</span></div>
      </div>
      ` : ''}

      <div class="section-title">Enrolled Program</div>
      <div class="row"><span class="label">Batch:</span><span class="value">${target.batch_name}</span></div>
      <div class="row"><span class="label">Subject/Class:</span><span class="value">${target.subject}</span></div>
      <div class="row"><span class="label">Enrollment Date:</span><span class="value">${target.date}</span></div>

      <div class="section-title">Payment Breakdown</div>
      <div class="summary-box">
        <div class="row"><span class="label">Total Fee:</span><span class="value">৳${target.total_fee.toLocaleString("en-BD")}</span></div>
        <div class="row"><span class="label">Paid Amount:</span><span class="value paid-text">৳${target.paid_amount.toLocaleString("en-BD")}</span></div>
        <div class="total-row"><span class="label">Due Amount:</span><span class="value ${target.due_amount > 0 ? 'due-text' : 'paid-text'}">৳${target.due_amount.toLocaleString("en-BD")}</span></div>
        ${target.due_date ? `<div class="row"><span class="label">Due Date:</span><span class="value due-text">${target.due_date}</span></div>` : ''}
        <div class="row" style="margin-top: 5px; font-size: 11px; color: #64748b;"><span class="label">Receipt Ref:</span><span>${target.receipt_number}</span></div>
      </div>

      <div class="qr-container">
        <div>
          <p style="margin: 0; font-size: 11px; font-weight: bold; color: #334155;">Verification QR Code</p>
          <p style="margin: 3px 0 0; font-size: 10px; color: #64748b;">Scan to verify student admission status</p>
        </div>
        <img src="${qrUrl}" width="80" height="80" alt="Student QR Code" style="border-radius: 6px; border: 1px solid #cbd5e1;" />
      </div>

      <div class="footer">
        <p>Please keep this document safe for institutional records.</p>
        <p>MedhaShiree — Empowering Modern Education</p>
      </div>
    </body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 300)
  }

  // Save / Download PDF function using jsPDF
  async function handleSavePDF(customReceipt?: EnrollmentReceipt) {
    const target = customReceipt || receipt
    if (!target) return
    try {
      const { jsPDF } = await import("jspdf")
      const doc = new jsPDF({ unit: "mm", format: [105, 148] }) // A6 size receipt

      doc.setFont("helvetica", "bold")
      doc.setFontSize(14)
      doc.setTextColor(67, 56, 202)
      doc.text("MedhaShiree Coaching", 52.5, 12, { align: "center" })

      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text("Enrollment & Fee Confirmation Slip", 52.5, 17, { align: "center" })
      doc.line(10, 20, 95, 20)

      let y = 26
      doc.setFontSize(9)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(15, 23, 42)
      doc.text("Student ID: " + target.student_id, 10, y)
      y += 5
      doc.setFont("helvetica", "normal")
      doc.text("Name: " + target.student_name, 10, y)
      y += 5
      if (target.student_phone) {
        doc.text("Phone: " + target.student_phone, 10, y)
        y += 5
      }
      if (target.guardian_phone) {
        doc.text("Guardian Phone: " + target.guardian_phone, 10, y)
        y += 5
      }

      if (target.password) {
        doc.setFillColor(238, 242, 255)
        doc.roundedRect(10, y, 85, 10, 2, 2, "F")
        doc.setFont("helvetica", "bold")
        doc.setTextColor(67, 56, 202)
        doc.text("Login ID: " + target.student_id + "  |  Password: " + target.password, 13, y + 6)
        doc.setTextColor(15, 23, 42)
        y += 14
      }

      doc.setFont("helvetica", "bold")
      doc.text("Batch: " + target.batch_name, 10, y)
      y += 5
      doc.setFont("helvetica", "normal")
      doc.text("Date: " + target.date, 10, y)
      y += 6

      doc.setFillColor(248, 250, 252)
      doc.roundedRect(10, y, 85, 22, 2, 2, "F")
      doc.text("Total Fee: ৳" + target.total_fee.toLocaleString("en-BD"), 13, y + 6)
      doc.setTextColor(22, 163, 74)
      doc.text("Paid: ৳" + target.paid_amount.toLocaleString("en-BD"), 13, y + 11)
      doc.setTextColor(target.due_amount > 0 ? 220 : 22, target.due_amount > 0 ? 38 : 163, target.due_amount > 0 ? 38 : 74)
      doc.setFont("helvetica", "bold")
      doc.text("Due: ৳" + target.due_amount.toLocaleString("en-BD"), 13, y + 17)
      if (target.due_date) {
        doc.setFontSize(7)
        doc.setTextColor(180, 83, 9)
        doc.text("Due Date: " + target.due_date, 55, y + 17)
      }

      y += 26
      // Add QR code image
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(target.qr_data)}`
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.src = qrUrl
      await new Promise(resolve => {
        img.onload = () => {
          try {
            doc.addImage(img, "PNG", 37.5, y, 30, 30)
          } catch {}
          resolve(true)
        }
        img.onerror = () => resolve(true)
      })

      doc.save(`Enrollment_${target.student_id}.pdf`)
      toast.success("PDF document downloaded!")
    } catch (e: any) {
      toast.error("Could not generate PDF: " + (e?.message || "Please use print option"))
    }
  }

  const ic = "w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-2xs transition-all"
  const labelCls = "block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"

  return (
    <>
      {/* Top Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/90 shadow-2xs mb-5">
        <button
          type="button"
          onClick={() => setActiveTab("enroll")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "enroll"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <UserPlus className="w-4 h-4 text-amber-500" />
          <span>➕ Enroll Student (নতুন শিক্ষার্থী ভর্তি)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "history"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <History className="w-4 h-4 text-indigo-600" />
          <span>📜 Enrollment History (ভর্তির ইতিহাস ও মানি রিসিট)</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === "history" ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-700"
          }`}>
            {enrollmentsList.length}
          </span>
        </button>
      </div>

      {activeTab === "enroll" && (
        <div className="space-y-5">
          <form onSubmit={handleSubmit} className="space-y-5">
        {/* Mode selector */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm px-5 py-4 flex items-center gap-3">
          <select value={mode} onChange={e => { setMode(e.target.value as "new"|"existing"); setSelectedStudent(null); setSearchQuery(""); setExistingFix({ guardian_name: "", guardian_phone: "", address: "", class_level: "", school_college: "" }) }}
            className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 bg-slate-50 hover:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none cursor-pointer">
            <option value="new">➕ New Student (নতুন শিক্ষার্থী)</option>
            <option value="existing">🔍 Existing Student (পূর্বের শিক্ষার্থী)</option>
          </select>

          {mode === "existing" && !selectedStudent && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search name, ID, phone..."
                className="w-full pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 bg-white shadow-2xs" autoFocus />
              {filtered.length > 0 && (
                <div className="absolute z-30 top-full left-0 right-0 mt-1.5 bg-white rounded-xl border border-slate-200 shadow-xl max-h-52 overflow-y-auto divide-y divide-slate-100">
                  {filtered.map(s => (
                    <button type="button" key={s.id} onClick={() => { handleSelectStudent(s); setSearchQuery("") }}
                      className="w-full text-left px-4 py-2.5 hover:bg-amber-50/50 text-sm transition-colors cursor-pointer">
                      <span className="font-bold text-slate-900">{s.name}</span>
                      <span className="text-xs text-amber-600 font-mono font-bold ml-2">{s.student_id}</span>
                      {s.phone && <span className="text-xs text-slate-500 ml-2">• {s.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === "existing" && selectedStudent && (
            <div className="flex-1 flex items-center justify-between px-3.5 py-2 bg-amber-50 rounded-xl border border-amber-200">
              <div>
                <span className="text-sm font-bold text-slate-900">{selectedStudent.name}</span>
                <span className="text-xs text-amber-700 font-mono font-bold ml-2">{selectedStudent.student_id}</span>
                {selectedStudent.phone && <span className="text-xs text-slate-500 ml-2">• {selectedStudent.phone}</span>}
              </div>
              <button type="button" onClick={() => handleSelectStudent(null)} className="text-rose-600 hover:text-rose-700 text-sm font-bold ml-2 transition-colors cursor-pointer">✕</button>
            </div>
          )}
        </div>

        {/* Existing student — missing info prompt */}
        {mode === "existing" && selectedStudent && missingFields.length > 0 && (
          <div className="bg-amber-50 rounded-2xl border border-amber-200 px-5 py-4 shadow-sm">
            <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5 mb-2.5"><AlertCircle className="w-4 h-4 text-amber-600" /> Missing information — please fill in:</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {missingFields.includes("guardian_name") && (
                <div><label className={labelCls}>Guardian Name</label><input value={existingFix.guardian_name} onChange={e => setExistingFix(f => ({...f, guardian_name: e.target.value}))} className={ic} placeholder="Guardian name" /></div>
              )}
              {missingFields.includes("guardian_phone") && (
                <div><label className={`${labelCls} text-rose-600`}>Guardian Phone *</label><input required value={existingFix.guardian_phone} onChange={e => setExistingFix(f => ({...f, guardian_phone: e.target.value}))} className={`${ic} border-rose-300 focus:border-rose-500 focus:ring-rose-500/20`} placeholder="01..." /></div>
              )}
              {missingFields.includes("address") && (
                <div><label className={labelCls}>Address</label><input value={existingFix.address} onChange={e => setExistingFix(f => ({...f, address: e.target.value}))} className={ic} /></div>
              )}
              {missingFields.includes("class_level") && (
                <div><label className={labelCls}>Class</label><input value={existingFix.class_level} onChange={e => setExistingFix(f => ({...f, class_level: e.target.value}))} className={ic} placeholder="HSC 2025" /></div>
              )}
              {missingFields.includes("school_college") && (
                <div><label className={labelCls}>School / College</label><input value={existingFix.school_college} onChange={e => setExistingFix(f => ({...f, school_college: e.target.value}))} className={ic} /></div>
              )}
            </div>
          </div>
        )}

        {/* New student form */}
        {mode === "new" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm px-5 py-5 space-y-5">
            {/* Personal */}
            <div>
              <p className="text-xs font-black text-indigo-950 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span> Personal Info (ব্যক্তিগত তথ্য)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2"><label className={labelCls}>Full Name *</label><input required value={form.name} onChange={e => update("name", e.target.value)} className={ic} placeholder="Student full name" /></div>
                <div><label className={labelCls}>Phone</label><input value={form.phone} onChange={e => update("phone", e.target.value)} className={ic} placeholder="01..." /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-3">
                {branches.length > 0 && (
                  <div>
                    <label className={labelCls}>Branch / Campus</label>
                    <select
                      value={selectedBranchId}
                      onChange={e => {
                        setSelectedBranchId(e.target.value)
                        setForm(f => ({ ...f, batch_id: "" }))
                      }}
                      className={ic}
                    >
                      <option value="">Default / All</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div><label className={labelCls}>Email</label><input type="email" value={form.email} onChange={e => update("email", e.target.value)} className={ic} placeholder="Optional" /></div>
                <div><label className={labelCls}>Gender</label><select value={form.gender} onChange={e => update("gender", e.target.value)} className={ic}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
                <div><label className={labelCls}>Date of Birth</label><input type="date" value={form.date_of_birth} onChange={e => update("date_of_birth", e.target.value)} className={ic} /></div>
                <div><label className={labelCls}>Class</label><input value={form.class_level} onChange={e => update("class_level", e.target.value)} className={ic} placeholder="HSC 2025" /></div>
              </div>
            </div>

            {/* Guardian */}
            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs font-black text-indigo-950 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Guardian Info (অভিভাবক তথ্য)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div><label className={labelCls}>Name</label><input value={form.guardian_name} onChange={e => update("guardian_name", e.target.value)} className={ic} /></div>
                <div><label className={labelCls}>Phone *</label><input required value={form.guardian_phone} onChange={e => update("guardian_phone", e.target.value)} className={ic} placeholder="01..." /></div>
                <div><label className={labelCls}>Relation</label><select value={form.guardian_relation} onChange={e => update("guardian_relation", e.target.value)} className={ic}><option>Parent</option><option>Father</option><option>Mother</option><option>Uncle</option><option>Other</option></select></div>
                <div><label className={labelCls}>Address</label><input value={form.address} onChange={e => update("address", e.target.value)} className={ic} /></div>
              </div>
            </div>

            {/* Account */}
            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs font-black text-indigo-950 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span> <Lock className="w-3.5 h-3.5 text-indigo-600" /> Student Login Account
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div><label className={labelCls}>School / College</label><input value={form.school_college} onChange={e => update("school_college", e.target.value)} className={ic} /></div>
                <div><label className={labelCls}>Referral Name / Code</label><input value={form.referred_by_code} onChange={e => update("referred_by_code", e.target.value)} className={ic} placeholder="Referrer name or code (optional)" /></div>
                <div><label className={labelCls}>Password *</label><input type="password" required value={form.password} onChange={e => update("password", e.target.value)} className={ic} placeholder="Min 6 chars" minLength={6} /></div>
                <div><label className={labelCls}>Confirm Password *</label><input type="password" required value={form.confirmPassword} onChange={e => update("confirmPassword", e.target.value)} className={`${ic} ${form.confirmPassword && form.password !== form.confirmPassword ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20" : ""}`} placeholder="Re-enter" />
                  {form.confirmPassword && form.password !== form.confirmPassword && <p className="text-[10px] text-rose-600 font-semibold mt-1">Passwords don&apos;t match</p>}
                  {form.confirmPassword && form.password === form.confirmPassword && form.password.length >= 6 && <p className="text-[10px] text-emerald-600 font-semibold mt-1">✓ Match</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Branch Selection */}
        {branches.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm px-5 py-4">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-amber-600" /> Select Branch (শাখা নির্বাচন) *
              </p>
              <span className="text-[11px] text-slate-500 font-medium">নির্ধারিত শাখার ব্যাচসমূহ দেখতে ক্লিক করুন</span>
            </div>
            <div className="mb-2.5">
              <select
                value={selectedBranchId}
                onChange={e => handleBranchChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="">-- All Branches (সকল শাখা) --</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    🏛️ {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {branches.map(b => {
                const isSel = selectedBranchId === b.id
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleBranchChange(b.id)}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all text-left truncate flex items-center justify-between cursor-pointer ${
                      isSel
                        ? "bg-amber-600 text-white border-amber-700 shadow-xs ring-2 ring-amber-300"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="truncate">{b.name}</span>
                    {isSel && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-1" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Batch selection */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm px-5 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
            <p className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-indigo-600" /> Select Batch (ব্যাচ নির্বাচন) *
            </p>
            <span className="text-[11px] text-slate-500 font-medium">
              {branchFilteredBatches.length} available batch{branchFilteredBatches.length === 1 ? "" : "es"}
            </span>
          </div>

          {/* Dropdown Selector for Fast Batch Selection */}
          <div className="mb-3.5">
            <select
              value={form.batch_id}
              onChange={e => {
                const nextId = e.target.value
                setForm(f => ({ ...f, batch_id: nextId }))
                if (!nextId) setPaidAmount("")
                const selectedB = allBatches.find(b => b.id === nextId)
                if (selectedB?.branch_id && selectedB.branch_id !== selectedBranchId) {
                  setSelectedBranchId(selectedB.branch_id)
                }
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white border border-slate-300 focus:border-amber-500 rounded-xl text-sm font-bold text-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/20 shadow-2xs transition-all"
            >
              <option value="" disabled>-- Select from available batches ({branchFilteredBatches.length} available) --</option>
              {branchFilteredBatches.map(b => {
                const isEnrolled = enrolledBatchIds.includes(b.id)
                const full = b.current_seats >= b.max_seats
                const isClosed = b.status === "admission_closed"
                const isFinished = b.status === "finished"
                const brName = branches.find(br => br.id === b.branch_id)?.name
                const seatInfo = b.max_seats ? ` [${b.current_seats || 0}/${b.max_seats} seats]` : ""
                const statusText = isEnrolled ? " (Already Enrolled)" : isClosed ? " (Closed)" : isFinished ? " (Finished)" : full ? " (Full)" : ""
                return (
                  <option key={b.id} value={b.id} disabled={full || isEnrolled || isClosed || isFinished}>
                    {b.name} ({b.class_level || "All"}){brName ? ` • ${brName}` : ""}{seatInfo} — {formatCurrency(b.monthly_fee + (b.admission_fee || 0))}{statusText}
                  </option>
                )
              })}
            </select>
          </div>

          {branchFilteredBatches.length === 0 ? (
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <p className="text-xs font-bold text-slate-700">No batches currently found for this branch.</p>
              <button
                type="button"
                onClick={() => setSelectedBranchId("")}
                className="mt-2 text-xs font-bold text-amber-600 hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                View all available batches across all branches →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {branchFilteredBatches.map(b => {
                const isEnrolled = enrolledBatchIds.includes(b.id)
                const sel = form.batch_id === b.id
                const full = b.current_seats >= b.max_seats
                const isClosed = b.status === "admission_closed"
                const isFinished = b.status === "finished"
                const disabled = full || isEnrolled || isClosed || isFinished
                const branchObj = branches.find(br => br.id === b.branch_id)

                return (
                  <button
                    type="button"
                    key={b.id}
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return
                      update("batch_id", sel ? "" : b.id)
                      if (!sel) setPaidAmount("")
                      if (b.branch_id && b.branch_id !== selectedBranchId) {
                        setSelectedBranchId(b.branch_id)
                      }
                    }}
                    className={`px-3.5 py-3 rounded-xl border text-left text-xs transition-all relative cursor-pointer ${
                      sel
                        ? "border-amber-500 bg-amber-50/80 shadow-sm ring-2 ring-amber-500/20"
                        : isEnrolled
                        ? "border-emerald-200 bg-emerald-50/50 opacity-70 cursor-not-allowed"
                        : isClosed
                        ? "border-amber-200 bg-amber-50/50 opacity-60 cursor-not-allowed"
                        : isFinished
                        ? "border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed"
                        : full
                        ? "border-slate-200 opacity-40 cursor-not-allowed"
                        : "border-slate-200 bg-slate-50/60 hover:border-amber-400 hover:bg-amber-50/40"
                    }`}>
                    {sel && <Check className="float-right w-4 h-4 text-amber-600" />}
                    {isEnrolled && (
                      <span className="float-right px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                        ✓ Enrolled
                      </span>
                    )}
                    {!isEnrolled && isClosed && (
                      <span className="float-right px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        Closed
                      </span>
                    )}
                    {!isEnrolled && isFinished && (
                      <span className="float-right px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        Finished
                      </span>
                    )}
                    <p className={`font-bold text-[13px] ${isEnrolled ? "text-emerald-700" : isClosed ? "text-amber-800" : "text-slate-900"}`}>{b.name}</p>
                    
                    {/* Branch & Classroom Badges */}
                    {(branchObj || b.classroom) && (
                      <div className="flex flex-wrap items-center gap-1.5 my-1">
                        {branchObj && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100/70 text-amber-900 px-1.5 py-0.5 rounded">
                            <Landmark className="w-2.5 h-2.5" /> {branchObj.name}
                          </span>
                        )}
                        {b.classroom && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-slate-200/80 text-slate-700 px-1.5 py-0.5 rounded">
                            <DoorOpen className="w-2.5 h-2.5 text-slate-500" /> {b.classroom}
                          </span>
                        )}
                      </div>
                    )}

                    <p className="text-slate-500 text-[11px] mt-0.5">
                      {isEnrolled
                        ? "Already enrolled in this batch"
                        : isClosed
                        ? "Admission closed"
                        : isFinished
                        ? "Program completed"
                        : `${b.current_seats}/${b.max_seats} seats • ${formatCurrency(b.monthly_fee)}/mo${b.admission_fee > 0 ? ` +${formatCurrency(b.admission_fee)}` : ""}`}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Payment */}
        {batch && (mode === "new" || selectedStudent) && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm px-5 py-5">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <CreditCard className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span className="text-slate-600">Monthly Fee: <b className="text-slate-900">{formatCurrency(batch.monthly_fee)}</b></span>
              <span className="text-slate-600">Admission Fee: <b className="text-slate-900">{formatCurrency(batch.admission_fee)}</b></span>
              <span className="sm:ml-auto text-amber-700 font-black text-sm w-full sm:w-auto text-right">Total Payable: {formatCurrency(total)}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Batch Roll (রোল নং) *</label>
                <input
                  type="number"
                  value={batchRoll}
                  onChange={e => setBatchRoll(e.target.value)}
                  className={`${ic} font-mono font-bold text-amber-950 bg-amber-50/70 border-amber-300`}
                  placeholder="e.g. 1"
                  min="1"
                />
              </div>
              <div><label className={labelCls}>Paid Amount (৳) *</label><input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} className={`${ic} font-bold text-slate-900`} placeholder="0" min="0" /></div>
              <div><label className={labelCls}>Remaining Due</label><div className={`px-3.5 py-2.5 rounded-xl text-sm font-black text-center ${due > 0 ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>{formatCurrency(due)}</div></div>
              <div><label className={labelCls}>Due Date</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={ic} /></div>
            </div>
          </div>
        )}

        {/* Payment Guidance placeholder if no batch selected */}
        {!batch && (mode === "new" || selectedStudent) && (
          <div className="bg-white rounded-2xl border border-dashed border-amber-300/80 p-5 text-center shadow-2xs">
            <CreditCard className="w-6 h-6 text-amber-500 mx-auto mb-2 opacity-75" />
            <p className="text-xs font-bold text-slate-800">Select a batch from available batches above</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Once you select a batch, fee calculations and payment details will appear here to complete the next step.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="py-2.5 px-6 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-100 text-sm transition-colors cursor-pointer">Cancel</button>
          <button type="submit" disabled={loading || !form.batch_id || (mode === "existing" && !selectedStudent) || (mode === "new" && form.password !== form.confirmPassword)}
            className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-black disabled:opacity-40 flex items-center justify-center gap-2 text-sm shadow-md shadow-amber-500/25 transition-all cursor-pointer">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin text-white" /> Processing...</> : <><UserPlus className="w-4 h-4" /> {mode === "new" ? "Create & Enroll (ভর্তি সম্পন্ন করুন)" : "Enroll Student"}</>}
          </button>
        </div>
        </form>

        {/* Recent Enrollments Quick Access below Form */}
        {enrollmentsList.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-amber-600" />
                <h4 className="font-black text-slate-900 text-sm">Recent Enrollments (সাম্প্রতিক ভর্তির ইতিহাস)</h4>
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  Last {Math.min(5, enrollmentsList.length)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer transition-colors"
              >
                View All History ({enrollmentsList.length}) <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {enrollmentsList.slice(0, 5).map((enr: any) => {
                const student = enr.student || students.find(s => s.id === enr.student_id) || {}
                const b = enr.batch || allBatches.find(bat => bat.id === enr.batch_id) || {}
                const matchingPayment = paymentsList.find(p => p.student_id === enr.student_id && (p.batch_id === enr.batch_id || !p.batch_id))
                const matchingDue = duesList.find(d => d.student_id === enr.student_id && (d.batch_id === enr.batch_id || !d.batch_id))
                const totalFee = matchingPayment?.amount || (b.monthly_fee ? (b.monthly_fee + (b.admission_fee || 0)) : 0) || (matchingDue?.due_amount || 0)
                const paidAmt = matchingPayment?.total_paid ?? (matchingDue?.paid_amount || 0)
                const dueAmt = matchingDue ? Math.max(0, (matchingDue.due_amount || totalFee) - (matchingDue.paid_amount || paidAmt)) : Math.max(0, totalFee - paidAmt)

                return (
                  <div key={enr.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">{student.name || "Student"}</span>
                        <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          {student.student_id || "N/A"}
                        </span>
                        <span className="text-xs font-semibold text-slate-600">• {b.name || "Batch"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>{formatDate(enr.created_at)}</span>
                        <span>• Paid: <b className="text-emerald-600">{formatCurrency(paidAmt)}</b></span>
                        {dueAmt > 0 && <span>• Due: <b className="text-rose-600">{formatCurrency(dueAmt)}</b></span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handlePrintFromHistory(enr)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Print Admission Slip"
                      >
                        <Printer className="w-3.5 h-3.5 text-amber-600" />
                        <span>Print</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSavePDFFromHistory(enr)}
                        className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Download PDF"
                      >
                        <Download className="w-3.5 h-3.5 text-amber-600" />
                        <span>PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePreviewReceipt(enr)}
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

      {/* History Tab View */}
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
                  placeholder="Search student name, ID (MS-...), phone, guardian phone, batch..."
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 bg-white shadow-2xs"
                />
              </div>
              <button
                type="button"
                onClick={fetchHistory}
                disabled={historyLoading}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Refresh History from Database"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? "animate-spin text-amber-600" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 items-center text-xs">
              {/* Branch filter */}
              <select
                value={historyBranchFilter}
                onChange={e => setHistoryBranchFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-xl bg-slate-50 text-slate-800 font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="all">All Branches (সকল শাখা)</option>
                {branches.map(br => (
                  <option key={br.id} value={br.id}>{br.name}</option>
                ))}
              </select>

              {/* Batch filter */}
              <select
                value={historyBatchFilter}
                onChange={e => setHistoryBatchFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-xl bg-slate-50 text-slate-800 font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="all">All Batches (সকল ব্যাচ)</option>
                {allBatches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>

              {/* Status filter */}
              <select
                value={historyStatusFilter}
                onChange={e => setHistoryStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-xl bg-slate-50 text-slate-800 font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
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
                      <th className="px-4 py-3 text-right">Actions (Print / PDF)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEnrollments.map((enr: any) => {
                      const student = enr.student || students.find(s => s.id === enr.student_id) || {}
                      const b = enr.batch || allBatches.find(bat => bat.id === enr.batch_id) || {}
                      const branchObj = branches.find(br => br.id === enr.branch_id || br.id === b.branch_id)
                      const matchingPayment = paymentsList.find(p => p.student_id === enr.student_id && (p.batch_id === enr.batch_id || !p.batch_id))
                      const matchingDue = duesList.find(d => d.student_id === enr.student_id && (d.batch_id === enr.batch_id || !d.batch_id))
                      const totalFee = matchingPayment?.amount || (b.monthly_fee ? (b.monthly_fee + (b.admission_fee || 0)) : 0) || (matchingDue?.due_amount || 0)
                      const paidAmt = matchingPayment?.total_paid ?? (matchingDue?.paid_amount || 0)
                      const dueAmt = matchingDue ? Math.max(0, (matchingDue.due_amount || totalFee) - (matchingDue.paid_amount || paidAmt)) : Math.max(0, totalFee - paidAmt)
                      const isPaid = totalFee > 0 ? paidAmt >= totalFee : true
                      const roll = enr.roll_no ?? student.roll_no ?? student.batch_roll

                      return (
                        <tr key={enr.id} className="hover:bg-amber-50/30 transition-colors">
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
                            <div className="font-bold text-slate-900 text-sm">{student.name || "Student"}</div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="font-mono text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                {student.student_id || "N/A"}
                              </span>
                              {student.phone && <span className="text-[11px] text-slate-500 font-medium">📞 {student.phone}</span>}
                            </div>
                            {student.guardian_phone && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Guardian: {student.guardian_phone} {student.guardian_name ? `(${student.guardian_name})` : ""}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-800">{b.name || "Enrolled Batch"}</div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap text-[10px]">
                              {branchObj && (
                                <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-semibold border border-slate-200">
                                  🏢 {branchObj.name}
                                </span>
                              )}
                              {b.classroom && (
                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                  🚪 {b.classroom}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap text-slate-600">
                            <div className="font-medium text-slate-900">{formatDate(enr.created_at)}</div>
                            <div className="text-[10px] text-slate-400">{formatDateTime(enr.created_at).split(",")[1] || ""}</div>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">Total: {formatCurrency(totalFee)}</span>
                              {isPaid ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                                  ✓ Paid
                                </span>
                              ) : paidAmt > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md">
                                  ⏳ Partial
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded-md">
                                  ✕ Unpaid
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
                                onClick={() => handlePrintFromHistory(enr)}
                                className="px-2.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                                title="Print Admission & Payment Slip"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Print</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSavePDFFromHistory(enr)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                                title="Download Receipt PDF"
                              >
                                <Download className="w-3.5 h-3.5 text-amber-600" />
                                <span>PDF</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePreviewReceipt(enr)}
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

      {/* Confirmation & Printable PDF Modal with QR Code */}
      {receipt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-6 text-white text-center relative">
              <button 
                type="button" 
                onClick={() => setReceipt(null)} 
                className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title="Close receipt"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-12 h-12 bg-white/20 backdrop-blur-xs rounded-2xl flex items-center justify-center mx-auto mb-2 border border-white/20">
                <Check className="w-6 h-6 text-white font-black" />
              </div>
              <h3 className="text-xl font-black">Enrollment Confirmed!</h3>
              <p className="text-xs text-amber-100 font-medium mt-1">Ready to print, download PDF, or start next enrollment</p>
            </div>

            {/* Printable preview card */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div ref={receiptRef} className="border border-slate-200 rounded-2xl p-4 sm:p-5 bg-slate-50 space-y-3">
                <div className="text-center border-b border-dashed border-slate-300 pb-3">
                  <h4 className="font-black text-indigo-950 text-base">MedhaShiree Coaching</h4>
                  <p className="text-[11px] text-slate-500">Official Enrollment & Clearance Receipt</p>
                  <span className="inline-block bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full mt-1">
                    ID: {receipt.student_id}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Student Name:</span><span className="font-bold text-slate-900">{receipt.student_name}</span></div>
                  {receipt.student_phone && <div className="flex justify-between"><span className="text-slate-500">Phone:</span><span className="font-medium text-slate-700">{receipt.student_phone}</span></div>}
                  {receipt.guardian_phone && <div className="flex justify-between"><span className="text-slate-500">Guardian Contact:</span><span className="font-medium text-slate-700">{receipt.guardian_phone}</span></div>}
                  <div className="flex justify-between"><span className="text-slate-500">Batch Enrolled:</span><span className="font-bold text-indigo-700">{receipt.batch_name}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Date:</span><span className="text-slate-700">{receipt.date}</span></div>
                </div>

                {/* Account credentials box */}
                {receipt.password && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-2.5 text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-indigo-800 font-medium">Login User ID:</span><span className="font-bold text-slate-900">{receipt.student_id}</span></div>
                    <div className="flex justify-between"><span className="text-indigo-800 font-medium">Password:</span><span className="font-mono font-bold text-indigo-900">{receipt.password}</span></div>
                  </div>
                )}

                <div className="border-t border-dashed border-slate-300 pt-3 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Total Program Fee:</span><span className="font-bold text-slate-900">{formatCurrency(receipt.total_fee)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Amount Paid:</span><span className="font-bold text-emerald-700">{formatCurrency(receipt.paid_amount)}</span></div>
                  <div className="flex justify-between text-sm font-black pt-1">
                    <span className="text-slate-700">Due Remaining:</span>
                    <span className={receipt.due_amount > 0 ? "text-rose-600" : "text-emerald-700"}>{formatCurrency(receipt.due_amount)}</span>
                  </div>
                  {receipt.due_date && (
                    <div className="flex justify-between text-[11px] text-amber-700 pt-0.5 font-semibold">
                      <span>Due Date:</span><span>{receipt.due_date}</span>
                    </div>
                  )}
                </div>

                {/* QR Code section */}
                <div className="pt-2 border-t border-dashed border-slate-300 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-slate-800">Verification QR</p>
                    <p className="text-[10px] text-slate-500">Scan for student credentials</p>
                  </div>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(receipt.qr_data)}`}
                    alt="QR Verification"
                    className="w-16 h-16 border border-slate-200 rounded-lg p-0.5 bg-white"
                  />
                </div>
              </div>

              {/* Modal Buttons: Print, Save, Close */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handlePrint()}
                  className="py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow-md shadow-amber-500/20 transition-all cursor-pointer">
                  <Printer className="w-4 h-4" /> Print Receipt
                </button>
                <button
                  type="button"
                  onClick={() => handleSavePDF()}
                  className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-all cursor-pointer">
                  <Download className="w-4 h-4" /> Save PDF
                </button>
              </div>

              <button
                type="button"
                onClick={() => { resetForm(); setReceipt(null); }}
                className="w-full py-2.5 border border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer">
                <RefreshCw className="w-4 h-4" /> Close Slip / Next Student
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
