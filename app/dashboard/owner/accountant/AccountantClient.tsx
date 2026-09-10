"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  Calculator, Search, Filter, DollarSign, CreditCard, Users,
  BookOpen, CheckCircle, AlertCircle, Clock, ArrowRight,
  RefreshCw, Printer, X, Download, Shield, Landmark, Sparkles,
  Calendar, Check, ChevronRight, FileText, MessageSquare, Send,
  CheckSquare, Square, Phone, Mail, Layers, Tag
} from "lucide-react"
import { toast } from "sonner"
import type { Branch } from "@/lib/supabase/types"

interface StudentRow {
  id: string
  name: string
  student_id: string
  roll_no?: number | null
  batch_roll?: number | null
  phone?: string | null
  guardian_phone?: string | null
  guardian_name?: string | null
  class_level?: string | null
  branch_id?: string | null
  enrollments?: any[]
}

interface BatchRow {
  id: string
  name: string
  monthly_fee: number
  admission_fee?: number
  fee_type?: "monthly" | "quarterly" | "one_time" | string
  branch_id?: string | null
  class_level?: string | null
  current_seats?: number
  max_seats?: number
  is_active: boolean
  status?: string
  branch?: any
}

interface DueRow {
  id: string
  student_id: string
  batch_id: string
  due_month: string
  due_amount: number
  paid_amount: number
  due_date: string
  status: "pending" | "partial" | "paid" | "waived"
  batch?: any
}

interface PaymentRow {
  id: string
  student_id: string
  batch_id?: string | null
  amount: number
  total_paid: number
  payment_method: string
  payment_for: string
  payment_month?: string | null
  receipt_number: string
  created_at: string
  notes?: string | null
  student?: any
  batch?: any
}

interface LedgerItem {
  rowKey: string
  student: StudentRow
  batch: BatchRow
  enrollment: any
  rollNo: number
  allBatchRolls?: Array<{ batchId: string; batchName: string; roll: number }>
  isMonthly: boolean
  expectedAmount: number
  paidAmount: number
  dueAmount: number
  status: "paid" | "partial" | "due"
  dueObj?: DueRow | null
  feeTypeLabel: string
  referralAmount?: number
  hasReferral?: boolean
  referralNotes?: string | null
}

interface Props {
  initialStudents: any[]
  initialBatches: any[]
  initialDues: any[]
  initialPayments: any[]
  branches: any[]
  currentStaff: {
    id: string
    name: string
    role: string
  }
}

export default function AccountantClient({
  initialStudents,
  initialBatches,
  initialDues,
  initialPayments,
  branches,
  currentStaff,
}: Props) {
  const supabase = createClient()

  // Main State
  const [students, setStudents] = useState<StudentRow[]>(initialStudents)
  const [batches, setBatches] = useState<BatchRow[]>(initialBatches)
  const [dues, setDues] = useState<DueRow[]>(initialDues)
  const [payments, setPayments] = useState<PaymentRow[]>(initialPayments)

  // Current Month Default
  const currentMonthStr = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  }, [])

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr)
  const [activeTab, setActiveTab] = useState<"students" | "batches" | "history">("students")

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBatchId, setSelectedBatchId] = useState<string>("all")
  const [batchTypeFilter, setBatchTypeFilter] = useState<"all" | "monthly" | "course">("all")
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "partial" | "due" | "referral">("all")
  const [historyMethodFilter, setHistoryMethodFilter] = useState<string>("all")

  // Multi-Selection State for Marked Rows
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set())

  // Loading States
  const [generatingBilling, setGeneratingBilling] = useState(false)
  const [sendingSms, setSendingSms] = useState(false)

  // Collect Payment Modal State
  const [payModalStudent, setPayModalStudent] = useState<StudentRow | null>(null)
  const [payModalBatch, setPayModalBatch] = useState<BatchRow | null>(null)
  const [payModalDue, setPayModalDue] = useState<DueRow | null>(null)
  const [payFeeType, setPayFeeType] = useState<"monthly" | "admission" | "course" | "exam" | "other">("monthly")
  const [payMonth, setPayMonth] = useState<string>(currentMonthStr)
  const [payTargetFee, setPayTargetFee] = useState<string>("")
  const [payPreviouslyPaid, setPayPreviouslyPaid] = useState<number>(0)
  const [payAmount, setPayAmount] = useState<string>("")
  const [payDiscount, setPayDiscount] = useState<string>("0")
  const [payDueDate, setPayDueDate] = useState<string>("")
  const [payMethod, setPayMethod] = useState<string>("cash")
  const [payReferralName, setPayReferralName] = useState<string>("")
  const [payReferralReason, setPayReferralReason] = useState<string>("")
  const [payTransactionId, setPayTransactionId] = useState<string>("")
  const [payNotes, setPayNotes] = useState<string>("")
  const [paySubmitting, setPaySubmitting] = useState(false)

  // Single Student Due SMS Modal
  const [singleSmsItem, setSingleSmsItem] = useState<LedgerItem | null>(null)
  const [singleSmsPhoneTarget, setSingleSmsPhoneTarget] = useState<"guardian" | "student">("guardian")
  const [singleSmsMessage, setSingleSmsMessage] = useState<string>("")

  // Bulk Due SMS Modal
  const [bulkSmsOpen, setBulkSmsOpen] = useState(false)
  const [bulkSmsTemplate, setBulkSmsTemplate] = useState<string>(
    "সম্মানিত অভিভাবক, মেধাশিরী কোচিং: {name}-এর {batch} ব্যাচের বকেয়া ৳{due} ({month})। বকেয়া পরিশোধ করার জন্য বিনীত অনুরোধ করা হচ্ছে। ধন্যবাদ।"
  )

  // Batches Tab Filter Pill
  const [batchesTabFilter, setBatchesTabFilter] = useState<"all" | "monthly" | "course">("all")

  // Printable Receipt Modal
  const [receiptData, setReceiptData] = useState<any | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  // Auto-sync monthly billing cycle on mount to ensure current month is refreshed
  useEffect(() => {
    async function autoRenewMonthlyBilling() {
      try {
        const res = await fetch(`/api/billing/generate-monthly?month=${selectedMonth}`)
        const data = await res.json()
        if (data.success && data.duesCreated > 0) {
          const { data: updatedDues } = await supabase
            .from("fee_dues")
            .select("id, student_id, batch_id, due_month, due_amount, paid_amount, due_date, status, batch:batches(id, name, monthly_fee)")
            .order("due_date", { ascending: false })
          if (updatedDues) {
            setDues(updatedDues)
            toast.info(`Auto-renewed ${data.duesCreated} monthly dues for ${selectedMonth}`)
          }
        }
      } catch {
        // silent fallback
      }
    }

    autoRenewMonthlyBilling()
  }, [selectedMonth])

  // Split Batches into Monthly and Course/One-time
  const monthlyBatches = useMemo(() => {
    return batches.filter((b) => b.fee_type === "monthly" || (Number(b.monthly_fee) || 0) > 0)
  }, [batches])

  const courseBatches = useMemo(() => {
    return batches.filter((b) => b.fee_type === "one_time" || (Number(b.monthly_fee) || 0) === 0)
  }, [batches])

  // Trigger Manual Monthly Billing Renewal
  async function handleRunMonthlyBillingCycle() {
    setGeneratingBilling(true)
    try {
      const res = await fetch(`/api/billing/generate-monthly?month=${selectedMonth}`, { method: "POST" })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to generate monthly billing cycle")
      }

      // Re-fetch dues from DB
      const { data: refreshedDues } = await supabase
        .from("fee_dues")
        .select("id, student_id, batch_id, due_month, due_amount, paid_amount, due_date, status, batch:batches(id, name, monthly_fee)")
        .order("due_date", { ascending: false })

      if (refreshedDues) setDues(refreshedDues)

      toast.success(
        `Monthly billing cycle for ${selectedMonth} complete: ${json.duesCreated} new dues created, ${json.existingDues} already existing. Total billed: ৳${json.totalBilledAmount}`
      )
    } catch (err: any) {
      toast.error(err?.message || "Could not generate monthly billing cycle")
    } finally {
      setGeneratingBilling(false)
    }
  }

  // Map of dues for selected month keyed by studentId_batchId
  const duesMapForSelectedMonth = useMemo(() => {
    const map = new Map<string, DueRow>()
    for (const d of dues) {
      if (d.due_month === selectedMonth) {
        map.set(`${d.student_id}_${d.batch_id}`, d)
      }
    }
    return map
  }, [dues, selectedMonth])

  // Build Comprehensive Ledger Items for ALL Enrolled Students across ALL Batches
  // Build Comprehensive Ledger Items for ALL Enrolled Students across ALL Batches
  const allLedgerItems = useMemo(() => {
    const items: LedgerItem[] = []

    // Pre-calculate batchwise sequential order for fallback roll numbers
    const batchCounterMap = new Map<string, number>()

    for (const st of students) {
      const activeEnrollments = (st.enrollments || []).filter((e) => e.status === "active" && e.batch)

      // Gather all batch rolls for this student across their active enrollments
      const allBatchRolls = activeEnrollments.map((enr, idx) => {
        const b = enr.batch
        const bId = b?.id || enr.batch_id || "default"
        const count = (batchCounterMap.get(bId) || 0) + 1
        batchCounterMap.set(bId, count)
        const roll = (enr.roll_no != null && Number(enr.roll_no) > 0)
          ? Number(enr.roll_no)
          : (st.roll_no != null && Number(st.roll_no) > 0 && activeEnrollments.length === 1)
            ? Number(st.roll_no)
            : (st.batch_roll != null && Number(st.batch_roll) > 0 && activeEnrollments.length === 1)
              ? Number(st.batch_roll)
              : count
        return {
          batchId: b?.id || enr.batch_id,
          batchName: b?.name || "Batch",
          roll,
        }
      })

      for (const enr of activeEnrollments) {
        const batch: BatchRow = enr.batch
        const rowKey = `${st.id}_${batch.id}`
        const isMonthly = batch.fee_type === "monthly" || (Number(batch.monthly_fee) || 0) > 0

        const thisBatchRollObj = allBatchRolls.find((br) => br.batchId === batch.id)
        const rollNo = thisBatchRollObj ? thisBatchRollObj.roll : ((enr.roll_no != null && Number(enr.roll_no) > 0) ? Number(enr.roll_no) : 1)

        let expectedAmount = 0
        let paidAmount = 0
        let dueAmount = 0
        let status: "paid" | "partial" | "due" = "due"
        let dueObj: DueRow | null = null

        if (isMonthly) {
          dueObj = duesMapForSelectedMonth.get(rowKey) || null
          expectedAmount = dueObj ? Number(dueObj.due_amount) : Number(batch.monthly_fee) || 0

          if (dueObj) {
            paidAmount = Number(dueObj.paid_amount || 0)
          } else {
            // Check payments for this student, batch, and month
            const monthPayments = payments.filter(
              (p) => p.student_id === st.id && p.batch_id === batch.id && p.payment_month === selectedMonth
            )
            paidAmount = monthPayments.reduce((acc, p) => acc + (Number(p.total_paid ?? p.amount) || 0), 0)
          }

          dueAmount = Math.max(0, expectedAmount - paidAmount)
          status = expectedAmount > 0 && dueAmount <= 0 ? "paid" : paidAmount > 0 ? "partial" : "due"
        } else {
          // One-time / Course Batch - check if an active due record exists in fee_dues
          dueObj =
            dues.find(
              (d) =>
                d.student_id === st.id &&
                d.batch_id === batch.id &&
                (d.status === "pending" || d.status === "partial")
            ) ||
            dues.find((d) => d.student_id === st.id && d.batch_id === batch.id) ||
            null

          if (dueObj) {
            expectedAmount =
              Number(dueObj.due_amount) ||
              (Number(batch.admission_fee) || 0) + (Number(batch.monthly_fee) || 0)
            const batchPayments = payments.filter((p) => p.student_id === st.id && p.batch_id === batch.id)
            const paySum = batchPayments.reduce((acc, p) => acc + (Number(p.total_paid ?? p.amount) || 0), 0)
            paidAmount = Math.max(Number(dueObj.paid_amount || 0), paySum)
          } else {
            expectedAmount = (Number(batch.admission_fee) || 0) + (Number(batch.monthly_fee) || 0)
            if (expectedAmount === 0 && Number(batch.admission_fee) > 0) {
              expectedAmount = Number(batch.admission_fee)
            }
            const batchPayments = payments.filter((p) => p.student_id === st.id && p.batch_id === batch.id)
            paidAmount = batchPayments.reduce((acc, p) => acc + (Number(p.total_paid ?? p.amount) || 0), 0)
          }

          dueAmount = Math.max(0, expectedAmount - paidAmount)
          status = expectedAmount > 0 && dueAmount <= 0 ? "paid" : paidAmount > 0 ? "partial" : "due"
        }

        // Calculate Referral amount paid for this student & batch
        const referralPaymentsForThis = payments.filter(
          (p) =>
            p.student_id === st.id &&
            p.batch_id === batch.id &&
            (p.payment_method === "referral" || (p.notes && p.notes.includes("Referral:"))) &&
            (!isMonthly || p.payment_month === selectedMonth || !p.payment_month)
        )
        const referralAmount = referralPaymentsForThis.reduce(
          (acc, p) => acc + (Number(p.total_paid ?? p.amount) || 0),
          0
        )
        const hasReferral = referralAmount > 0
        const referralNotes = referralPaymentsForThis[0]?.notes || null

        const feeTypeLabel = isMonthly
          ? `Monthly (৳${batch.monthly_fee || 0}/mo)`
          : `Course Fee (৳${expectedAmount})`

        items.push({
          rowKey,
          student: st,
          batch,
          enrollment: enr,
          rollNo,
          allBatchRolls,
          isMonthly,
          expectedAmount,
          paidAmount,
          dueAmount,
          status,
          dueObj,
          feeTypeLabel,
          referralAmount,
          hasReferral,
          referralNotes,
        })
      }
    }

    return items
  }, [students, duesMapForSelectedMonth, payments, selectedMonth])

  // Filtered Ledger Items
  const filteredLedgerItems = useMemo(() => {
    return allLedgerItems.filter((item) => {
      // 1. Branch Filter
      if (selectedBranchId !== "all" && item.student.branch_id !== selectedBranchId) {
        return false
      }

      // 2. Batch Filter
      if (selectedBatchId !== "all" && item.batch.id !== selectedBatchId) {
        return false
      }

      // 3. Batch Type Filter
      if (batchTypeFilter === "monthly" && !item.isMonthly) return false
      if (batchTypeFilter === "course" && item.isMonthly) return false

      // 4. Status Filter (includes referral filter)
      if (statusFilter === "referral") {
        if (!item.hasReferral) return false
      } else if (statusFilter !== "all" && item.status !== statusFilter) {
        return false
      }

      // 5. Search Query (name, student_id, roll_no, phone, guardian_phone)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const bnToEnMap: Record<string, string> = { "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9" }
        const qNormalized = q.replace(/[০-৯]/g, (d) => bnToEnMap[d] || d)
        const qClean = qNormalized.replace(/^(roll|r|#|রোল|\s)+/i, "").trim()
        const qNum = parseInt(qClean, 10)
        const isNumericQuery = !isNaN(qNum) && qNum > 0

        const nameMatch = item.student.name?.toLowerCase().includes(q)
        const idMatch = item.student.student_id?.toLowerCase().includes(q)
        const phoneMatch = item.student.phone?.includes(q)
        const gPhoneMatch = item.student.guardian_phone?.includes(q)

        // Match current batch roll
        const rStr = String(item.rollNo)
        let rollMatch = (isNumericQuery && item.rollNo === qNum) ||
          rStr === q || rStr === qClean || rStr === qNormalized ||
          `roll ${rStr}`.includes(qNormalized) || `roll #${rStr}`.includes(qNormalized) ||
          `r${rStr}` === qNormalized || `রোল ${rStr}`.includes(q)

        // Match any batch roll across all enrolled batches of this student
        if (!rollMatch && item.allBatchRolls) {
          rollMatch = item.allBatchRolls.some((br) => {
            const brNum = Number(br.roll)
            const brStr = String(br.roll)
            if (isNumericQuery && brNum === qNum) return true
            if (brStr === q || brStr === qClean || brStr === qNormalized) return true
            if (`roll ${brStr}`.includes(qNormalized) || `roll #${brStr}`.includes(qNormalized) || `r${brStr}` === qNormalized || `রোল ${brStr}`.includes(q)) return true
            return false
          })
        }

        if (!rollMatch && item.student.enrollments) {
          rollMatch = item.student.enrollments.some((e: any) => {
            const eRoll = e.roll_no ?? item.student.roll_no
            if (eRoll == null) return false
            const eRollNum = Number(eRoll)
            const eRollStr = String(eRoll)
            if (isNumericQuery && eRollNum === qNum) return true
            if (eRollStr === q || eRollStr === qClean || eRollStr === qNormalized) return true
            if (`roll ${eRollStr}`.includes(qNormalized) || `roll #${eRollStr}`.includes(qNormalized) || `r${eRollStr}` === qNormalized || `রোল ${eRollStr}`.includes(q)) return true
            return false
          })
        }

        if (!nameMatch && !idMatch && !phoneMatch && !gPhoneMatch && !rollMatch) return false
      }

      return true
    })
  }, [allLedgerItems, selectedBranchId, selectedBatchId, batchTypeFilter, statusFilter, searchQuery])

  // Top Financial KPI Aggregate Stats
  const stats = useMemo(() => {
    const studentIdSet = new Set<string>()
    let expectedRevenue = 0
    let totalCollected = 0
    let totalDue = 0
    let paidRowsCount = 0
    let dueRowsCount = 0
    let totalReferralAmount = 0
    let referralCount = 0

    // Compute total referral across all payments
    for (const p of payments) {
      if (p.payment_method === "referral") {
        totalReferralAmount += Number(p.total_paid ?? p.amount) || 0
        referralCount++
      }
    }

    for (const item of filteredLedgerItems) {
      studentIdSet.add(item.student.id)
      expectedRevenue += item.expectedAmount
      totalCollected += item.paidAmount
      totalDue += item.dueAmount

      if (item.status === "paid") {
        paidRowsCount++
      } else {
        dueRowsCount++
      }
    }

    const collectionRate = expectedRevenue > 0 ? Math.round((totalCollected / expectedRevenue) * 100) : 0

    return {
      totalStudents: studentIdSet.size,
      totalEnrollments: filteredLedgerItems.length,
      expectedRevenue,
      totalCollected,
      totalDue,
      paidRowsCount,
      dueRowsCount,
      collectionRate,
      totalReferralAmount,
      referralCount,
    }
  }, [filteredLedgerItems, payments])

  // Checkbox Selection Controls
  const isAllFilteredSelected = useMemo(() => {
    if (filteredLedgerItems.length === 0) return false
    return filteredLedgerItems.every((it) => selectedRowKeys.has(it.rowKey))
  }, [filteredLedgerItems, selectedRowKeys])

  const selectedLedgerItems = useMemo(() => {
    return allLedgerItems.filter((it) => selectedRowKeys.has(it.rowKey))
  }, [allLedgerItems, selectedRowKeys])

  const selectedItemsWithDue = useMemo(() => {
    return selectedLedgerItems.filter((it) => it.dueAmount > 0)
  }, [selectedLedgerItems])

  const totalSelectedDue = useMemo(() => {
    return selectedItemsWithDue.reduce((sum, it) => sum + it.dueAmount, 0)
  }, [selectedItemsWithDue])

  // Filter payments in History Tab by payment method
  const displayedPayments = useMemo(() => {
    if (historyMethodFilter === "all") return payments
    return payments.filter((p) => {
      if (historyMethodFilter === "referral") return p.payment_method === "referral"
      if (historyMethodFilter === "cash") return p.payment_method === "cash"
      if (historyMethodFilter === "online") return p.payment_method !== "cash" && p.payment_method !== "referral"
      return p.payment_method === historyMethodFilter
    })
  }, [payments, historyMethodFilter])

  function handleToggleSelectAll() {
    if (isAllFilteredSelected) {
      // Deselect all in filtered list
      setSelectedRowKeys((prev) => {
        const next = new Set(prev)
        filteredLedgerItems.forEach((it) => next.delete(it.rowKey))
        return next
      })
    } else {
      // Select all in filtered list
      setSelectedRowKeys((prev) => {
        const next = new Set(prev)
        filteredLedgerItems.forEach((it) => next.add(it.rowKey))
        return next
      })
    }
  }

  function handleToggleRow(rowKey: string) {
    setSelectedRowKeys((prev) => {
      const next = new Set(prev)
      if (next.has(rowKey)) {
        next.delete(rowKey)
      } else {
        next.add(rowKey)
      }
      return next
    })
  }

  function handleSelectAllWithDues() {
    const next = new Set(selectedRowKeys)
    filteredLedgerItems.forEach((it) => {
      if (it.dueAmount > 0) next.add(it.rowKey)
    })
    setSelectedRowKeys(next)
    toast.info(`Marked all ${filteredLedgerItems.filter((it) => it.dueAmount > 0).length} students with outstanding dues`)
  }

  function handleClearSelection() {
    setSelectedRowKeys(new Set())
  }

  // Open Payment Collection Modal for Specific Type
  function openPayModal(
    student: StudentRow,
    batch: BatchRow,
    item?: LedgerItem | null,
    defaultType: "monthly" | "admission" | "course" | "exam" | "other" = "monthly"
  ) {
    setPayModalStudent(student)
    setPayModalBatch(batch)

    const isMonthlyBatch = batch.fee_type === "monthly" || (Number(batch.monthly_fee) || 0) > 0
    const resolvedType = defaultType || (isMonthlyBatch ? "monthly" : "course")
    setPayFeeType(resolvedType)
    setPayMonth(selectedMonth)

    const dueObj =
      item?.dueObj ||
      (resolvedType === "monthly"
        ? duesMapForSelectedMonth.get(`${student.id}_${batch.id}`) || null
        : dues.find(
            (d) =>
              d.student_id === student.id &&
              d.batch_id === batch.id &&
              (d.status === "pending" || d.status === "partial")
          ) ||
          dues.find((d) => d.student_id === student.id && d.batch_id === batch.id) ||
          null)

    setPayModalDue(dueObj)

    // Calculate Target Fee & Previously Paid
    let targetFee = 0
    let prevPaid = 0

    if (item && item.expectedAmount > 0) {
      targetFee = item.expectedAmount
      prevPaid = item.paidAmount
    } else if (resolvedType === "monthly") {
      targetFee = dueObj ? Number(dueObj.due_amount) : Number(batch.monthly_fee) || 0
      const monthPayments = payments.filter(
        (p) => p.student_id === student.id && p.batch_id === batch.id && p.payment_month === selectedMonth
      )
      const paySum = monthPayments.reduce((acc, p) => acc + (Number(p.total_paid ?? p.amount) || 0), 0)
      prevPaid = dueObj ? Math.max(Number(dueObj.paid_amount || 0), paySum) : paySum
    } else if (resolvedType === "course") {
      targetFee = dueObj
        ? Number(dueObj.due_amount)
        : (Number(batch.monthly_fee) || 0) + (Number(batch.admission_fee) || 0) || Number(batch.admission_fee) || 0
      const batchPayments = payments.filter(
        (p) => p.student_id === student.id && p.batch_id === batch.id && (p.payment_for === "course" || !p.payment_month)
      )
      const paySum = batchPayments.reduce((acc, p) => acc + (Number(p.total_paid ?? p.amount) || 0), 0)
      prevPaid = dueObj ? Math.max(Number(dueObj.paid_amount || 0), paySum) : paySum
    } else if (resolvedType === "admission") {
      targetFee = Number(batch.admission_fee) || 0
      const admPayments = payments.filter(
        (p) => p.student_id === student.id && p.batch_id === batch.id && p.payment_for === "admission"
      )
      prevPaid = admPayments.reduce((acc, p) => acc + (Number(p.total_paid ?? p.amount) || 0), 0)
    } else if (resolvedType === "exam") {
      targetFee = 500
      const examPayments = payments.filter(
        (p) => p.student_id === student.id && p.batch_id === batch.id && p.payment_for === "exam"
      )
      prevPaid = examPayments.reduce((acc, p) => acc + (Number(p.total_paid ?? p.amount) || 0), 0)
    }

    const remaining = Math.max(0, targetFee - prevPaid)
    setPayTargetFee(String(targetFee > 0 ? targetFee : ""))
    setPayPreviouslyPaid(prevPaid)
    setPayAmount(String(remaining > 0 ? remaining : targetFee > 0 ? targetFee : ""))
    setPayDiscount("0")

    const nextDue = new Date()
    nextDue.setMonth(nextDue.getMonth() + 1)
    nextDue.setDate(10)
    setPayDueDate(dueObj?.due_date || nextDue.toISOString().split("T")[0])

    setPayMethod("cash")
    setPayReferralName("")
    setPayReferralReason("")
    setPayTransactionId("")
    setPayNotes(
      resolvedType === "monthly"
        ? `Monthly Fee: ${selectedMonth}`
        : `${resolvedType.toUpperCase()} Fee - ${batch.name}`
    )
  }

  // Recalculate amount when user toggles fee type in modal
  function handleFeeTypeChange(type: "monthly" | "admission" | "course" | "exam" | "other") {
    setPayFeeType(type)
    if (!payModalBatch || !payModalStudent) return

    const student = payModalStudent
    const batch = payModalBatch

    const dueObj =
      type === "monthly"
        ? duesMapForSelectedMonth.get(`${student.id}_${batch.id}`) || null
        : dues.find(
            (d) =>
              d.student_id === student.id &&
              d.batch_id === batch.id &&
              (d.status === "pending" || d.status === "partial")
          ) ||
          dues.find((d) => d.student_id === student.id && d.batch_id === batch.id) ||
          null

    setPayModalDue(dueObj)

    let targetFee = 0
    let prevPaid = 0

    if (type === "monthly") {
      targetFee = dueObj ? Number(dueObj.due_amount) : Number(batch.monthly_fee) || 0
      const monthPayments = payments.filter(
        (p) => p.student_id === student.id && p.batch_id === batch.id && p.payment_month === payMonth
      )
      const paySum = monthPayments.reduce((acc, p) => acc + (Number(p.total_paid ?? p.amount) || 0), 0)
      prevPaid = dueObj ? Math.max(Number(dueObj.paid_amount || 0), paySum) : paySum
      setPayNotes(`Monthly Fee: ${payMonth}`)
    } else if (type === "admission") {
      targetFee = Number(batch.admission_fee) || 0
      const admPayments = payments.filter(
        (p) => p.student_id === student.id && p.batch_id === batch.id && p.payment_for === "admission"
      )
      prevPaid = admPayments.reduce((acc, p) => acc + (Number(p.total_paid ?? p.amount) || 0), 0)
      setPayNotes(`Admission Fee - ${batch.name}`)
    } else if (type === "course") {
      targetFee = dueObj
        ? Number(dueObj.due_amount)
        : (Number(batch.monthly_fee) || 0) + (Number(batch.admission_fee) || 0) || Number(batch.admission_fee) || 0
      const batchPayments = payments.filter(
        (p) => p.student_id === student.id && p.batch_id === batch.id && (p.payment_for === "course" || !p.payment_month)
      )
      const paySum = batchPayments.reduce((acc, p) => acc + (Number(p.total_paid ?? p.amount) || 0), 0)
      prevPaid = dueObj ? Math.max(Number(dueObj.paid_amount || 0), paySum) : paySum
      setPayNotes(`Full Course Fee - ${batch.name}`)
    } else if (type === "exam") {
      targetFee = 500
      const examPayments = payments.filter(
        (p) => p.student_id === student.id && p.batch_id === batch.id && p.payment_for === "exam"
      )
      prevPaid = examPayments.reduce((acc, p) => acc + (Number(p.total_paid ?? p.amount) || 0), 0)
      setPayNotes(`Exam Fee - ${batch.name}`)
    } else {
      targetFee = 0
      prevPaid = 0
      setPayNotes(`Fee payment - ${batch.name}`)
    }

    const remaining = Math.max(0, targetFee - prevPaid)
    setPayTargetFee(String(targetFee > 0 ? targetFee : ""))
    setPayPreviouslyPaid(prevPaid)
    setPayAmount(String(remaining > 0 ? remaining : targetFee > 0 ? targetFee : ""))

    const nextDue = new Date()
    nextDue.setMonth(nextDue.getMonth() + 1)
    nextDue.setDate(10)
    setPayDueDate(dueObj?.due_date || nextDue.toISOString().split("T")[0])
  }

  // Handle Payment Submit
  async function handleRecordPaymentSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!payModalStudent || !payModalBatch) return

    const amountNum = parseFloat(payAmount)
    const discountNum = parseFloat(payDiscount || "0")
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid payment amount")
      return
    }

    if (payMethod === "referral") {
      if (!payReferralName.trim()) {
        toast.error("Please enter the Referral Person Name or Student ID")
        return
      }
      if (!payReferralReason.trim()) {
        toast.error("Please enter the reason for the referral payment")
        return
      }
    }

    setPaySubmitting(true)
    try {
      const netPaidNow = Math.max(0, amountNum - discountNum)
      const targetFeeNum = parseFloat(payTargetFee) || (payPreviouslyPaid + netPaidNow)
      const totalPaidSoFar = payPreviouslyPaid + netPaidNow
      const remainingDue = Math.max(0, targetFeeNum - totalPaidSoFar)

      const defaultNextDue = (() => {
        const d = new Date()
        d.setMonth(d.getMonth() + 1)
        d.setDate(10)
        return d.toISOString().split("T")[0]
      })()
      const effectiveDueDate = payDueDate || defaultNextDue

      const now = new Date()
      const receiptNo = `RCP-${now.getFullYear()}-${Date.now().toString().slice(-6)}`

      let finalNotes = payNotes.trim()
      if (payMethod === "referral") {
        const refPrefix = `Referral: ${payReferralName.trim()} | Reason: ${payReferralReason.trim()}`
        finalNotes = finalNotes ? `${refPrefix} | ${finalNotes}` : refPrefix
      }

      const trxId = payTransactionId.trim() || (payMethod === "referral" ? `REF-${Date.now().toString().slice(-6)}` : null)

      // 1. Insert Payment Record
      const { data: payRecord, error: payErr } = await supabase
        .from("payments")
        .insert({
          student_id: payModalStudent.id,
          batch_id: payModalBatch.id,
          amount: amountNum,
          discount: discountNum,
          total_paid: netPaidNow,
          payment_method: payMethod,
          payment_for: payFeeType,
          payment_month: payFeeType === "monthly" ? payMonth : null,
          transaction_id: trxId,
          receipt_number: receiptNo,
          notes: finalNotes || null,
        })
        .select("*, student:students(name, student_id), batch:batches(name)")
        .single()

      if (payErr) throw payErr

      // 2. Fee Dues Sync: Determine dueMonth for fee_dues (must be YYYY-MM)
      const dueMonth = payFeeType === "monthly" ? payMonth : (payMonth || now.toISOString().slice(0, 7))

      // 3. Find existing due record to update or check if we need to insert
      let existingDue = payModalDue
      if (!existingDue) {
        if (payFeeType === "monthly") {
          existingDue = duesMapForSelectedMonth.get(`${payModalStudent.id}_${payModalBatch.id}`) || null
        } else {
          existingDue =
            dues.find(
              (d) =>
                d.student_id === payModalStudent.id &&
                d.batch_id === payModalBatch.id &&
                (d.status === "pending" || d.status === "partial")
            ) ||
            dues.find(
              (d) => d.student_id === payModalStudent.id && d.batch_id === payModalBatch.id
            ) ||
            null
        }
      }

      if (existingDue) {
        // Update existing due record
        const newPaid = (Number(existingDue.paid_amount) || 0) + netPaidNow
        const totalTarget = Math.max(Number(existingDue.due_amount) || 0, targetFeeNum, newPaid + remainingDue)
        const isFull = newPaid >= totalTarget
        const newStatus: "paid" | "partial" = isFull ? "paid" : "partial"

        const { data: updData, error: updErr } = await supabase
          .from("fee_dues")
          .update({
            due_amount: totalTarget,
            paid_amount: newPaid,
            status: newStatus,
            due_date: effectiveDueDate,
          })
          .eq("id", existingDue.id)
          .select("id, student_id, batch_id, due_month, due_amount, paid_amount, due_date, status, batch:batches(id, name, monthly_fee)")
          .single()

        if (updErr) {
          console.error("Error updating fee_dues:", updErr)
        } else if (updData) {
          setDues((prev) => prev.map((d) => (d.id === existingDue.id ? updData : d)))
        }
      } else if (remainingDue > 0 || payFeeType === "monthly") {
        // No existing due record, but student has remaining due (partial payment) OR it's monthly
        const isFull = totalPaidSoFar >= targetFeeNum
        const newStatus: "paid" | "partial" = isFull ? "paid" : "partial"

        const { data: insData, error: insErr } = await supabase
          .from("fee_dues")
          .insert({
            student_id: payModalStudent.id,
            batch_id: payModalBatch.id,
            due_month: dueMonth,
            due_amount: targetFeeNum,
            paid_amount: totalPaidSoFar,
            due_date: effectiveDueDate,
            status: newStatus,
          })
          .select("id, student_id, batch_id, due_month, due_amount, paid_amount, due_date, status, batch:batches(id, name, monthly_fee)")
          .single()

        if (insErr) {
          // If conflict with existing (student_id, batch_id, due_month), fall back to update
          console.warn("Insert due note, attempting fallback update:", insErr.message)
          const { data: fallbackData } = await supabase
            .from("fee_dues")
            .update({
              due_amount: targetFeeNum,
              paid_amount: totalPaidSoFar,
              status: newStatus,
              due_date: effectiveDueDate,
            })
            .eq("student_id", payModalStudent.id)
            .eq("batch_id", payModalBatch.id)
            .eq("due_month", dueMonth)
            .select("id, student_id, batch_id, due_month, due_amount, paid_amount, due_date, status, batch:batches(id, name, monthly_fee)")
            .maybeSingle()

          if (fallbackData) {
            setDues((prev) => {
              const exists = prev.some((d) => d.id === fallbackData.id)
              return exists ? prev.map((d) => (d.id === fallbackData.id ? fallbackData : d)) : [fallbackData, ...prev]
            })
          }
        } else if (insData) {
          setDues((prev) => [insData, ...prev])
        }
      }

      if (payRecord) {
        setPayments((prev) => [payRecord, ...prev])
      }

      if (payMethod === "referral") {
        if (remainingDue > 0) {
          toast.success(
            `Referral credit of ৳${netPaidNow} applied via ${payReferralName.trim()}! Remaining due: ৳${remainingDue} (Due date: ${effectiveDueDate})`
          )
        } else {
          toast.success(
            `Referral credit of ৳${netPaidNow} recorded via ${payReferralName.trim()} for ${payModalStudent.name}! (Full settlement)`
          )
        }
      } else if (remainingDue > 0) {
        toast.success(
          `Payment of ৳${netPaidNow} recorded! New due of ৳${remainingDue} created (Due date: ${effectiveDueDate})`
        )
      } else {
        toast.success(`Payment of ৳${netPaidNow} recorded successfully for ${payModalStudent.name}! (Full settlement)`)
      }

      // Display official printable voucher
      setReceiptData({
        receiptNumber: receiptNo,
        studentName: payModalStudent.name,
        studentId: payModalStudent.student_id,
        batchName: payModalBatch.name,
        feeType: payFeeType.toUpperCase(),
        month: payFeeType === "monthly" ? payMonth : "N/A",
        amount: amountNum,
        discount: discountNum,
        totalPaid: netPaidNow,
        targetFee: targetFeeNum,
        remainingDue: remainingDue,
        nextDueDate: remainingDue > 0 ? effectiveDueDate : null,
        method: payMethod,
        referralName: payMethod === "referral" ? payReferralName.trim() : null,
        referralReason: payMethod === "referral" ? payReferralReason.trim() : null,
        transactionId: trxId || "N/A",
        date: new Date().toLocaleDateString("en-GB"),
        recordedBy: currentStaff.name,
      })

      setPayModalStudent(null)
      setPayModalBatch(null)
      setPayModalDue(null)
      setPayReferralName("")
      setPayReferralReason("")
    } catch (err: any) {
      toast.error(err?.message || "Failed to record payment")
    } finally {
      setPaySubmitting(false)
    }
  }

  // Open Single Student Due SMS Modal
  function openSingleDueSms(item: LedgerItem) {
    setSingleSmsItem(item)
    const phone = item.student.guardian_phone || item.student.phone || ""
    setSingleSmsPhoneTarget(item.student.guardian_phone ? "guardian" : "student")

    const msg = `সম্মানিত অভিভাবক, মেধাশিরী কোচিং থেকে অবগতির জন্য জানানো যাচ্ছে যে, ${item.student.name}-এর ${item.batch.name} ব্যাচের বকেয়া ৳${item.dueAmount} (${item.isMonthly ? selectedMonth : "কোর্স ফি"})। অনুগ্রহ করে দ্রুত পরিশোধ করুন। ধন্যবাদ।`
    setSingleSmsMessage(msg)
  }

  // Send Single Due SMS
  async function handleSendSingleDueSms() {
    if (!singleSmsItem || !singleSmsMessage.trim()) return

    const targetPhone =
      singleSmsPhoneTarget === "guardian"
        ? singleSmsItem.student.guardian_phone || singleSmsItem.student.phone
        : singleSmsItem.student.phone || singleSmsItem.student.guardian_phone

    if (!targetPhone) {
      toast.error("No phone number available for this student or guardian")
      return
    }

    setSendingSms(true)
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: singleSmsItem.student.branch_id || singleSmsItem.batch.branch_id || undefined,
          recipients: [
            {
              phone: targetPhone,
              message: singleSmsMessage.trim(),
              name: singleSmsItem.student.name,
              studentId: singleSmsItem.student.student_id,
            },
          ],
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to send SMS reminder")
      }

      toast.success(`Due SMS reminder sent to ${targetPhone}!`)
      setSingleSmsItem(null)
    } catch (err: any) {
      toast.error(err?.message || "Could not send SMS")
    } finally {
      setSendingSms(false)
    }
  }

  // Send Bulk Due SMS
  async function handleSendBulkDueSms() {
    if (selectedItemsWithDue.length === 0) {
      toast.error("None of the marked students have an outstanding due")
      return
    }

    const recipients = selectedItemsWithDue
      .map((it) => {
        const phone = it.student.guardian_phone || it.student.phone
        if (!phone) return null

        let msg = bulkSmsTemplate
        msg = msg.replace(/\{name\}/g, it.student.name)
        msg = msg.replace(/\{student_id\}/g, it.student.student_id)
        msg = msg.replace(/\{batch\}/g, it.batch.name)
        msg = msg.replace(/\{due\}/g, String(it.dueAmount))
        msg = msg.replace(/\{month\}/g, it.isMonthly ? selectedMonth : "Course")

        return {
          phone,
          message: msg,
          name: it.student.name,
          studentId: it.student.student_id,
        }
      })
      .filter(Boolean)

    if (recipients.length === 0) {
      toast.error("No valid phone numbers found among the marked students with dues")
      return
    }

    setSendingSms(true)
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: selectedBranchId !== "all" ? selectedBranchId : undefined,
          recipients,
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to dispatch bulk SMS")
      }

      toast.success(`Successfully sent ${recipients.length} due SMS reminders via gateway!`)
      setBulkSmsOpen(false)
      setSelectedRowKeys(new Set())
    } catch (err: any) {
      toast.error(err?.message || "Failed to send bulk SMS reminders")
    } finally {
      setSendingSms(false)
    }
  }

  // Print voucher
  function triggerPrint() {
    window.print()
  }

  return (
    <div className="space-y-6 pb-24">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & FINANCIAL CONTROL BAR */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Accountant Desk</h1>
                <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-2.5 py-0.5 rounded-full">
                  All Batches & Monthly Cycles
                </span>
                <span className="hidden sm:inline-flex text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> Due SMS Ready
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Financial control, batch payments, multi-student selection, and instant due SMS gateway
              </p>
            </div>
          </div>
        </div>

        {/* Financial Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-500 ml-1.5" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden py-1 px-1.5 cursor-pointer"
              title="Select Billing Month"
            />
          </div>

          {/* Run Monthly Billing Renewal Action Button */}
          <button
            onClick={handleRunMonthlyBillingCycle}
            disabled={generatingBilling}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
            title="Automatically generates monthly dues for all active students on the 1st of the month"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generatingBilling ? "animate-spin" : ""}`} />
            <span>{generatingBilling ? "Renewing..." : "⚡ Run Monthly Renewal"}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. FINANCIAL KPI STATS CARDS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Total Students */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Students</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.totalStudents}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">{stats.totalEnrollments} batch enrollments</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Expected Revenue */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expected Target</p>
            <h3 className="text-2xl font-black text-indigo-700 mt-1">{formatCurrency(stats.expectedRevenue)}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">{selectedMonth} + one-time</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <Landmark className="w-5 h-5" />
          </div>
        </div>

        {/* Total Collected */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Collected</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{formatCurrency(stats.totalCollected)}</h3>
            <p className="text-[11px] text-emerald-700 font-medium mt-0.5">{stats.paidRowsCount} items fully paid</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Total Due */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Outstanding Due</p>
            <h3 className="text-2xl font-black text-rose-600 mt-1">{formatCurrency(stats.totalDue)}</h3>
            <p className="text-[11px] text-rose-700 font-medium mt-0.5">{stats.dueRowsCount} pending collection</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Total Referral Settled */}
        <div
          onClick={() => {
            setStatusFilter(statusFilter === "referral" ? "all" : "referral")
            setActiveTab("students")
          }}
          className={`p-4 rounded-2xl border shadow-xs flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] ${
            statusFilter === "referral"
              ? "bg-purple-100 border-purple-400 ring-2 ring-purple-400/40"
              : "bg-white border-slate-200 hover:border-purple-300"
          }`}
          title="Click to filter students with referral payments"
        >
          <div>
            <p className="text-xs font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Total Referral
            </p>
            <h3 className="text-2xl font-black text-purple-900 mt-1">{formatCurrency(stats.totalReferralAmount)}</h3>
            <p className="text-[11px] text-purple-600 font-medium mt-0.5">
              {stats.referralCount} referral settlement{stats.referralCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center flex-shrink-0">
            <Tag className="w-5 h-5" />
          </div>
        </div>

        {/* Collection Efficiency */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Collection Rate</p>
            <span className="text-xs font-black text-amber-600">{stats.collectionRate}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden my-1.5">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, stats.collectionRate)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400">
            {stats.paidRowsCount} of {stats.totalEnrollments} settled
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. TABS & FILTER CONTROLS */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab("students")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "students"
                ? "bg-slate-900 text-white shadow-md"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Student Billing Ledger ({filteredLedgerItems.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("batches")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "batches"
                ? "bg-slate-900 text-white shadow-md"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>All Batches ({batches.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "history"
                ? "bg-slate-900 text-white shadow-md"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Recent Payments ({payments.length})</span>
          </button>
        </div>

        {/* Filter Controls for Student Billing Ledger */}
        {activeTab === "students" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, roll, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            {/* Batch Filter - ALL Batches Included */}
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium py-2 px-3 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Batches ({batches.length})</option>
              {batches.map((b) => {
                const isMonthly = b.fee_type === "monthly" || (Number(b.monthly_fee) || 0) > 0
                return (
                  <option key={b.id} value={b.id}>
                    {b.name} ({isMonthly ? `৳${b.monthly_fee}/mo` : `৳${b.admission_fee || b.monthly_fee || 0} Course`})
                  </option>
                )
              })}
            </select>

            {/* Batch Type Filter (Monthly vs One-Time Course) */}
            <select
              value={batchTypeFilter}
              onChange={(e) => setBatchTypeFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium py-2 px-3 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Billing Types</option>
              <option value="monthly">Monthly Cycles ({monthlyBatches.length})</option>
              <option value="course">One-Time / Courses ({courseBatches.length})</option>
            </select>

            {/* Branch Filter */}
            {branches.length > 0 ? (
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium py-2 px-3 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">All Branches</option>
                {branches.map((br) => (
                  <option key={br.id} value={br.id}>
                    {br.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs text-slate-400 py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl">
                Main Campus
              </div>
            )}

            {/* Payment Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold py-2 px-3 focus:outline-hidden focus:border-indigo-500 cursor-pointer text-slate-800"
            >
              <option value="all">All Statuses</option>
              <option value="due">🔴 Due / Unpaid</option>
              <option value="partial">🟡 Partial Payment</option>
              <option value="paid">🟢 Fully Paid</option>
              <option value="referral">🎁 Referral Payment ({formatCurrency(stats.totalReferralAmount)})</option>
            </select>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. TAB 1: STUDENT BILLING LEDGER TABLE (ALL BATCHES + MULTI-SELECT) */}
      {/* ========================================================================= */}
      {activeTab === "students" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Quick Selection Toolbar (Above Table) */}
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleSelectAll}
                className="font-bold text-slate-700 hover:text-indigo-600 flex items-center gap-1.5 cursor-pointer"
              >
                {isAllFilteredSelected ? (
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>Select All ({filteredLedgerItems.length})</span>
              </button>

              <span className="text-slate-300">|</span>

              <button
                onClick={handleSelectAllWithDues}
                className="text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Select All With Dues ({filteredLedgerItems.filter((it) => it.dueAmount > 0).length})</span>
              </button>
            </div>

            {selectedRowKeys.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                  {selectedRowKeys.size} marked
                </span>
                <span className="text-slate-500 font-medium">Due: ৳{totalSelectedDue}</span>
                <button
                  onClick={handleClearSelection}
                  className="text-slate-500 hover:text-slate-800 font-bold underline cursor-pointer"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="w-10 px-3 py-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={isAllFilteredSelected}
                      onChange={handleToggleSelectAll}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3.5">Student Details</th>
                  <th className="px-3.5 py-3.5">Roll No</th>
                  <th className="px-4 py-3.5">Batch & Billing Type</th>
                  <th className="px-4 py-3.5">Standard Fee</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Collected</th>
                  <th className="px-4 py-3.5">Due Amount</th>
                  <th className="px-4 py-3.5 text-right">Accounting Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLedgerItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400">
                      <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-600">No student enrollments match your criteria</p>
                      <p className="text-xs text-slate-400 mt-0.5">Try choosing another batch or adjusting filters</p>
                    </td>
                  </tr>
                ) : (
                  filteredLedgerItems.map((item) => {
                    const isMarked = selectedRowKeys.has(item.rowKey)
                    const isPaid = item.status === "paid"
                    const isPartial = item.status === "partial"

                    return (
                      <tr
                        key={item.rowKey}
                        className={`transition-colors ${
                          isMarked ? "bg-indigo-50/50" : "hover:bg-slate-50/70"
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isMarked}
                            onChange={() => handleToggleRow(item.rowKey)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>

                        {/* Student Info */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-black text-xs flex items-center justify-center flex-shrink-0">
                              {item.student.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">{item.student.name}</p>
                              <p className="text-[11px] text-slate-400">
                                ID:{" "}
                                <span className="font-mono text-indigo-600 font-semibold">
                                  {item.student.student_id}
                                </span>
                                {(item.student.guardian_phone || item.student.phone) && (
                                  <span> • {item.student.guardian_phone || item.student.phone}</span>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Roll No Column */}
                        <td className="px-3.5 py-3.5 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1 font-mono bg-amber-100/90 px-2.5 py-1 rounded-lg text-xs font-black text-amber-950 border border-amber-300 shadow-2xs w-fit">
                              <span className="text-[10px] text-amber-700 font-sans font-bold">রোল</span> #{item.rollNo}
                            </span>
                            {item.allBatchRolls && item.allBatchRolls.length > 1 && (
                              <div className="flex flex-wrap gap-1 mt-0.5 max-w-[150px]">
                                {item.allBatchRolls.map((br, idx) => {
                                  if (br.batchId === item.batch.id) return null
                                  return (
                                    <span
                                      key={idx}
                                      className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200"
                                      title={`${br.batchName}: Roll #${br.roll}`}
                                    >
                                      #{br.roll} ({br.batchName})
                                    </span>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Batch Name & Billing Type */}
                        <td className="px-4 py-3.5">
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold">
                              <BookOpen className="w-3 h-3 text-slate-500" />
                              {item.batch.name}
                            </span>
                            <div className="mt-1 flex items-center gap-1.5">
                              {item.isMonthly ? (
                                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200/60 px-1.5 py-0.2 rounded font-bold uppercase">
                                  Monthly Cycle
                                </span>
                              ) : (
                                <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200/60 px-1.5 py-0.2 rounded font-bold uppercase">
                                  Course / One-time
                                </span>
                              )}
                              {Number(item.batch.admission_fee) > 0 && (
                                <span className="text-[10px] text-slate-400">
                                  +Adm ৳{item.batch.admission_fee}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Standard Fee */}
                        <td className="px-4 py-3.5 font-bold text-slate-900">
                          {formatCurrency(item.expectedAmount)}
                        </td>

                        {/* Status Badge */}
                        <td className="px-4 py-3.5">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle className="w-3 h-3" /> Paid
                            </span>
                          ) : isPartial ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3" /> Partial
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                              <AlertCircle className="w-3 h-3" /> Due
                            </span>
                          )}
                        </td>

                        {/* Paid Amount */}
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-emerald-600">
                            {formatCurrency(item.paidAmount)}
                          </p>
                          {item.hasReferral && (
                            <div
                              className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-black"
                              title={item.referralNotes || "Referral Applied"}
                            >
                              <Sparkles className="w-2.5 h-2.5 text-purple-600 shrink-0" />
                              <span>Referral: ৳{item.referralAmount}</span>
                            </div>
                          )}
                        </td>

                        {/* Outstanding Due */}
                        <td className="px-4 py-3.5 font-black text-rose-600">
                          {item.dueAmount > 0 ? formatCurrency(item.dueAmount) : "৳0"}
                        </td>

                        {/* Action Buttons */}
                        <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                          {/* Send Due SMS button */}
                          <button
                            onClick={() => openSingleDueSms(item)}
                            title="Send Due SMS Reminder"
                            className="p-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>

                          {/* Collect Payment / Record Extra */}
                          {isPaid ? (
                            <button
                              onClick={() => openPayModal(item.student, item.batch, item, item.isMonthly ? "monthly" : "course")}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                            >
                              <span>Record Extra</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => openPayModal(item.student, item.batch, item, item.isMonthly ? "monthly" : "course")}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Pay Due (৳{item.dueAmount})</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TAB 2: ALL BATCHES FINANCIAL OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === "batches" && (
        <div className="space-y-4">
          {/* Batches Sub-Filter Pills */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBatchesTabFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                batchesTabFilter === "all"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              All Batches ({batches.length})
            </button>
            <button
              onClick={() => setBatchesTabFilter("monthly")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                batchesTabFilter === "monthly"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              Monthly Cycles ({monthlyBatches.length})
            </button>
            <button
              onClick={() => setBatchesTabFilter("course")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                batchesTabFilter === "course"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              One-Time / Courses ({courseBatches.length})
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(batchesTabFilter === "all"
              ? batches
              : batchesTabFilter === "monthly"
              ? monthlyBatches
              : courseBatches
            ).map((batch) => {
              const isMonthly = batch.fee_type === "monthly" || (Number(batch.monthly_fee) || 0) > 0
              const enrolled = students.filter((s) =>
                (s.enrollments || []).some((e) => e.batch_id === batch.id && e.status === "active")
              )
              const count = enrolled.length
              const fee = Number(batch.monthly_fee) || Number(batch.admission_fee) || 0
              const expectedTotal = isMonthly
                ? count * (Number(batch.monthly_fee) || 0)
                : count * ((Number(batch.monthly_fee) || 0) + (Number(batch.admission_fee) || 0))

              let collectedTotal = 0
              if (isMonthly) {
                for (const s of enrolled) {
                  const due = duesMapForSelectedMonth.get(`${s.id}_${batch.id}`)
                  if (due) collectedTotal += Number(due.paid_amount) || 0
                }
              } else {
                for (const s of enrolled) {
                  const pList = payments.filter((p) => p.student_id === s.id && p.batch_id === batch.id)
                  collectedTotal += pList.reduce((acc, p) => acc + (Number(p.total_paid ?? p.amount) || 0), 0)
                }
              }

              const dueTotal = Math.max(0, expectedTotal - collectedTotal)
              const pct = expectedTotal > 0 ? Math.round((collectedTotal / expectedTotal) * 100) : 0

              return (
                <div key={batch.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      {isMonthly ? (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60">
                          Monthly Cycle
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60">
                          Course / One-time
                        </span>
                      )}
                      <h3 className="text-base font-black text-slate-900 mt-1">{batch.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {batch.class_level || "All Classes"} • {batch.branch?.name || "Main Campus"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-400">{isMonthly ? "Monthly Fee" : "Course Fee"}</p>
                      <p className="text-lg font-black text-indigo-700">{formatCurrency(fee)}</p>
                      {Number(batch.admission_fee) > 0 && isMonthly && (
                        <p className="text-[10px] text-slate-400">+Adm ৳{batch.admission_fee}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Students</p>
                      <p className="text-sm font-black text-slate-800 mt-0.5">{count}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-emerald-600 uppercase">Collected</p>
                      <p className="text-sm font-black text-emerald-600 mt-0.5">{formatCurrency(collectedTotal)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-rose-600 uppercase">Due</p>
                      <p className="text-sm font-black text-rose-600 mt-0.5">{formatCurrency(dueTotal)}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1 font-semibold text-slate-600">
                      <span>Recovery Rate</span>
                      <span className="text-amber-600 font-bold">{pct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedBatchId(batch.id)
                      setActiveTab("students")
                    }}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>View Batch Students</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. TAB 3: RECENT PAYMENTS LOG */}
      {/* ========================================================================= */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {/* Method Filter Pills & Summary */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Method Filter:</span>
              <button
                type="button"
                onClick={() => setHistoryMethodFilter("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  historyMethodFilter === "all"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All Methods ({payments.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryMethodFilter("cash")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  historyMethodFilter === "cash"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                💵 Cash
              </button>
              <button
                type="button"
                onClick={() => setHistoryMethodFilter("online")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  historyMethodFilter === "online"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                📱 bKash / Nagad / Online
              </button>
              <button
                type="button"
                onClick={() => setHistoryMethodFilter("referral")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  historyMethodFilter === "referral"
                    ? "bg-purple-700 text-white shadow-xs"
                    : "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
                }`}
              >
                <span>🎁 Referral / Waiver</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    historyMethodFilter === "referral"
                      ? "bg-purple-900 text-purple-100"
                      : "bg-purple-200 text-purple-800"
                  }`}
                >
                  ৳{stats.totalReferralAmount}
                </span>
              </button>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{displayedPayments.length}</span> payment records
            </div>
          </div>

          {/* Payments Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5">Receipt #</th>
                    <th className="px-4 py-3.5">Student</th>
                    <th className="px-4 py-3.5">Batch</th>
                    <th className="px-4 py-3.5">Payment For</th>
                    <th className="px-4 py-3.5">Month</th>
                    <th className="px-4 py-3.5">Method</th>
                    <th className="px-4 py-3.5">Paid Amount</th>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-4 py-3.5 text-right">Voucher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedPayments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400">
                        No payments found for this filter
                      </td>
                    </tr>
                  ) : (
                    displayedPayments.map((p) => {
                      const isReferral = p.payment_method === "referral"
                      let refName: string | null = null
                      let refReason: string | null = null
                      if (p.notes) {
                        const match = p.notes.match(/Referral:\s*([^|]+)(?:\s*\|\s*Reason:\s*([^|]+))?/)
                        if (match) {
                          refName = match[1]?.trim() || null
                          refReason = match[2]?.trim() || null
                        }
                      }

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs font-bold text-indigo-600">
                            {p.receipt_number}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900">{p.student?.name || "Student"}</td>
                          <td className="px-4 py-3 font-medium text-slate-700">{p.batch?.name || "All Batches"}</td>
                          <td className="px-4 py-3">
                            <span className="capitalize px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded text-xs font-bold">
                              {p.payment_for || "monthly"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 font-medium">{p.payment_month || "N/A"}</td>
                          <td className="px-4 py-3">
                            {isReferral ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md text-[11px] font-bold border border-purple-200">
                                  <Sparkles className="w-3 h-3 text-purple-600" />
                                  <span>Referral / Waiver</span>
                                </span>
                                {refName && (
                                  <p className="text-[10px] text-purple-900 font-semibold truncate max-w-[160px]">
                                    Ref: {refName}
                                  </p>
                                )}
                                {refReason && (
                                  <p className="text-[9px] text-purple-700 truncate max-w-[160px]">
                                    {refReason}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="capitalize px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-bold">
                                {p.payment_method}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`font-black ${
                                isReferral ? "text-purple-700" : "text-emerald-600"
                              }`}
                            >
                              {formatCurrency(p.total_paid || p.amount)}
                            </span>
                            {isReferral && (
                              <span className="block text-[10px] text-purple-600 font-semibold">
                                Referral Credit
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(p.created_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => {
                                setReceiptData({
                                  receiptNumber: p.receipt_number,
                                  studentName: p.student?.name || "Student",
                                  studentId: p.student_id,
                                  batchName: p.batch?.name || "Fee",
                                  feeType: (p.payment_for || "monthly").toUpperCase(),
                                  month: p.payment_month || "N/A",
                                  amount: p.amount,
                                  discount: p.amount - (p.total_paid || p.amount),
                                  totalPaid: p.total_paid || p.amount,
                                  method: p.payment_method,
                                  referralName: refName,
                                  referralReason: refReason,
                                  date: formatDate(p.created_at),
                                  recordedBy: currentStaff.name,
                                })
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <Printer className="w-3 h-3" />
                              <span>Print</span>
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. FLOATING ACTION BAR FOR MARKED / SELECTED STUDENTS */}
      {/* ========================================================================= */}
      {selectedRowKeys.size > 0 && activeTab === "students" && (
        <div className="fixed bottom-6 inset-x-4 max-w-2xl mx-auto z-40 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                {selectedRowKeys.size}
              </div>
              <div>
                <p className="text-xs font-bold text-white">
                  {selectedRowKeys.size} student{selectedRowKeys.size > 1 ? "s" : ""} selected
                </p>
                <p className="text-[11px] text-slate-400">
                  Total Outstanding:{" "}
                  <span className="text-rose-400 font-black">৳{totalSelectedDue}</span> (
                  {selectedItemsWithDue.length} with dues)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setBulkSmsOpen(true)}
                disabled={selectedItemsWithDue.length === 0}
                className="px-3.5 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-500/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Send Due SMS ({selectedItemsWithDue.length})</span>
              </button>

              <button
                onClick={handleClearSelection}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. COLLECT SPECIFIC FEE PAYMENT MODAL */}
      {/* ========================================================================= */}
      {payModalStudent && payModalBatch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                  ৳
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Collect Fee Payment</h3>
                  <p className="text-xs text-slate-500">Record specific payment and issue voucher</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setPayModalStudent(null)
                  setPayModalBatch(null)
                  setPayModalDue(null)
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Student & Batch Summary Box */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Student:</span>
                <span className="font-bold text-slate-900">
                  {payModalStudent.name} ({payModalStudent.student_id})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Batch:</span>
                <span className="font-bold text-slate-800">{payModalBatch.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Contact:</span>
                <span className="font-medium text-slate-700">
                  {payModalStudent.guardian_phone || payModalStudent.phone || "N/A"}
                </span>
              </div>
            </div>

            {/* Payment Form */}
            <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
              {/* Fee Type Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Payment Type / Fee Category <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleFeeTypeChange("monthly")}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer text-left ${
                      payFeeType === "monthly"
                        ? "bg-amber-50 border-amber-400 text-amber-900 shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <p className="font-black">Monthly Fee</p>
                    <p className="text-[10px] text-slate-400 font-normal mt-0.5">Recurring tuition</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFeeTypeChange("admission")}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer text-left ${
                      payFeeType === "admission"
                        ? "bg-blue-50 border-blue-400 text-blue-900 shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <p className="font-black">Admission Fee</p>
                    <p className="text-[10px] text-slate-400 font-normal mt-0.5">One-time entry</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFeeTypeChange("course")}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer text-left ${
                      payFeeType === "course"
                        ? "bg-purple-50 border-purple-400 text-purple-900 shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <p className="font-black">Course Fee</p>
                    <p className="text-[10px] text-slate-400 font-normal mt-0.5">Full package</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFeeTypeChange("exam")}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer text-left ${
                      payFeeType === "exam"
                        ? "bg-rose-50 border-rose-400 text-rose-900 shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <p className="font-black">Exam Fee</p>
                    <p className="text-[10px] text-slate-400 font-normal mt-0.5">Test registration</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFeeTypeChange("other")}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer text-left col-span-2 sm:col-span-2 ${
                      payFeeType === "other"
                        ? "bg-slate-100 border-slate-400 text-slate-900 shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <p className="font-black">Other / Custom</p>
                    <p className="text-[10px] text-slate-400 font-normal mt-0.5">Books, ID card, sheet</p>
                  </button>
                </div>
              </div>

              {/* Month Picker for Monthly Fee */}
              {payFeeType === "monthly" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Billing Month</label>
                  <input
                    type="month"
                    value={payMonth}
                    onChange={(e) => {
                      const newMonth = e.target.value
                      setPayMonth(newMonth)
                      setPayNotes(`Monthly Fee: ${newMonth}`)
                      if (payModalStudent && payModalBatch) {
                        const dueObj =
                          dues.find(
                            (d) =>
                              d.student_id === payModalStudent.id &&
                              d.batch_id === payModalBatch.id &&
                              d.due_month === newMonth
                          ) || null
                        setPayModalDue(dueObj)
                        const targetFee = dueObj ? Number(dueObj.due_amount) : Number(payModalBatch.monthly_fee) || 0
                        const mPays = payments.filter(
                          (p) =>
                            p.student_id === payModalStudent.id &&
                            p.batch_id === payModalBatch.id &&
                            p.payment_month === newMonth
                        )
                        const paySum = mPays.reduce((acc, p) => acc + (Number(p.total_paid ?? p.amount) || 0), 0)
                        const prevPaid = dueObj ? Math.max(Number(dueObj.paid_amount || 0), paySum) : paySum
                        const rem = Math.max(0, targetFee - prevPaid)
                        setPayTargetFee(String(targetFee > 0 ? targetFee : ""))
                        setPayPreviouslyPaid(prevPaid)
                        setPayAmount(String(rem > 0 ? rem : targetFee > 0 ? targetFee : ""))
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                  />
                </div>
              )}

              {/* Target Fee & Payment Breakdown Card */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Total Target Fee for {payFeeType.toUpperCase()} (৳)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={payTargetFee}
                      onChange={(e) => setPayTargetFee(e.target.value)}
                      placeholder="e.g. 3000"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs font-black text-slate-900 bg-white focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-slate-500 mb-1">Previously Paid:</span>
                    <div className="px-2.5 py-1.5 bg-slate-200/70 rounded-xl text-xs font-black text-slate-800">
                      ৳{payPreviouslyPaid}
                    </div>
                  </div>
                </div>

                {/* Live Real-time Due Status Preview */}
                {(() => {
                  const targetNum = parseFloat(payTargetFee) || 0
                  const payNum = parseFloat(payAmount) || 0
                  const discNum = parseFloat(payDiscount) || 0
                  const netPay = Math.max(0, payNum - discNum)
                  const totalPaidAfter = payPreviouslyPaid + netPay
                  const remDue = targetNum > 0 ? Math.max(0, targetNum - totalPaidAfter) : 0

                  if (targetNum > 0 && remDue > 0) {
                    return (
                      <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-xs font-black text-amber-900">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            Partial Payment: Remaining Due
                          </span>
                          <span className="text-sm font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                            ৳{remDue}
                          </span>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-amber-900 mb-1 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-amber-700" />
                            Next Due Date for Balance (বকেয়া পরিশোধের শেষ তারিখ):
                          </label>
                          <input
                            type="date"
                            value={payDueDate}
                            onChange={(e) => setPayDueDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-amber-400 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:border-amber-600 cursor-pointer shadow-xs"
                          />
                        </div>
                        <p className="text-[10px] text-amber-800 leading-relaxed font-medium">
                          ⚠️ A new tracking due record of <strong className="text-rose-700 font-black">৳{remDue}</strong> will automatically be created in Fee Dues and appear in student ledger.
                        </p>
                      </div>
                    )
                  } else if (targetNum > 0 && remDue === 0) {
                    return (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 flex items-center justify-between text-xs font-bold">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          Full Settlement: Fee cleared in full
                        </span>
                        <span className="text-emerald-700 font-black bg-emerald-100 px-2 py-0.5 rounded-md">
                          ৳0 Due
                        </span>
                      </div>
                    )
                  }
                  return null
                })()}
              </div>

              {/* Amount and Discount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Amount to Collect (৳) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-black text-slate-900 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Discount (৳)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={payDiscount}
                    onChange={(e) => setPayDiscount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Total Net Paid Indicator */}
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 flex justify-between items-center text-xs">
                <span className="font-bold text-emerald-800">Net Paid Amount:</span>
                <span className="font-black text-base text-emerald-600">
                  ৳{Math.max(0, (parseFloat(payAmount) || 0) - (parseFloat(payDiscount) || 0))}
                </span>
              </div>

              {/* Payment Method & Transaction ID */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="cash">Cash (নগদ)</option>
                    <option value="bkash">bKash (বিকাশ)</option>
                    <option value="nagad">Nagad (নগদ)</option>
                    <option value="rocket">Rocket (রকেট)</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="card">Card / POS</option>
                    <option value="online">Online Gateway</option>
                    <option value="referral">🎁 Referral / Waiver (রেফারেল)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">TrxID / Reference</label>
                  <input
                    type="text"
                    placeholder={payMethod === "referral" ? "Auto-generated REF-..." : "e.g. 9X483KLS"}
                    value={payTransactionId}
                    onChange={(e) => setPayTransactionId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Referral Details Inputs */}
              {payMethod === "referral" && (
                <div className="p-3.5 bg-purple-50/80 border border-purple-300 rounded-2xl space-y-3 animate-in fade-in duration-150 text-xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-purple-200/60">
                    <span className="font-extrabold text-purple-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      Referral Payment Details (রেফারেল তথ্য)
                    </span>
                    <span className="bg-purple-200/90 text-purple-900 px-2 py-0.5 rounded-md font-black text-[11px]">
                      Referral Amount: ৳{Math.max(0, (parseFloat(payAmount) || 0) - (parseFloat(payDiscount) || 0))}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-purple-900 mb-1">
                        Referral Person / Student Name or ID <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={payReferralName}
                        onChange={(e) => setPayReferralName(e.target.value)}
                        placeholder="e.g. Rafiq Sir or Shakib (Roll 2401)"
                        className="w-full px-2.5 py-1.5 bg-white border border-purple-300 rounded-xl text-xs font-bold text-purple-950 focus:outline-hidden focus:border-purple-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-purple-900 mb-1">
                        Referral Reason / Note <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={payReferralReason}
                        onChange={(e) => setPayReferralReason(e.target.value)}
                        placeholder="e.g. Special teacher discount, Sibling concession"
                        className="w-full px-2.5 py-1.5 bg-white border border-purple-300 rounded-xl text-xs font-bold text-purple-950 focus:outline-hidden focus:border-purple-600"
                      />
                    </div>
                  </div>

                  <p className="text-[10px] text-purple-700 font-medium leading-relaxed">
                    ✨ This referral credit amount (৳{Math.max(0, (parseFloat(payAmount) || 0) - (parseFloat(payDiscount) || 0))}) will be automatically tracked in the accounting ledger, under the Total Referral KPI, and on student records.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Receipt Memo / Note</label>
                <input
                  type="text"
                  placeholder="Optional memo..."
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPayModalStudent(null)
                    setPayModalBatch(null)
                    setPayModalDue(null)
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paySubmitting}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {paySubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{paySubmitting ? "Recording..." : "Confirm & Save"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. SINGLE STUDENT DUE SMS MODAL */}
      {/* ========================================================================= */}
      {singleSmsItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Send Due SMS Reminder</h3>
                  <p className="text-xs text-slate-500">{singleSmsItem.student.name} ({singleSmsItem.student.student_id})</p>
                </div>
              </div>
              <button
                onClick={() => setSingleSmsItem(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Recipient Details */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Batch:</span>
                <span className="font-bold text-slate-800">{singleSmsItem.batch.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Outstanding Due:</span>
                <span className="font-black text-rose-600">৳{singleSmsItem.dueAmount}</span>
              </div>

              {/* Phone Target Selector */}
              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Recipient Phone:</span>
                <div className="flex items-center gap-2">
                  {singleSmsItem.student.guardian_phone && (
                    <button
                      type="button"
                      onClick={() => setSingleSmsPhoneTarget("guardian")}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                        singleSmsPhoneTarget === "guardian"
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      Guardian: {singleSmsItem.student.guardian_phone}
                    </button>
                  )}
                  {singleSmsItem.student.phone && (
                    <button
                      type="button"
                      onClick={() => setSingleSmsPhoneTarget("student")}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                        singleSmsPhoneTarget === "student"
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      Student: {singleSmsItem.student.phone}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Message Body */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">Message Content</label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {singleSmsMessage.length} chars
                </span>
              </div>
              <textarea
                rows={4}
                value={singleSmsMessage}
                onChange={(e) => setSingleSmsMessage(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 leading-relaxed font-sans"
              />
            </div>

            {/* Language Preset Buttons */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 text-[11px]">Preset:</span>
              <button
                type="button"
                onClick={() => {
                  setSingleSmsMessage(
                    `সম্মানিত অভিভাবক, মেধাশিরী কোচিং থেকে অবগতির জন্য জানানো যাচ্ছে যে, ${singleSmsItem.student.name}-এর ${singleSmsItem.batch.name} ব্যাচের বকেয়া ৳${singleSmsItem.dueAmount} (${singleSmsItem.isMonthly ? selectedMonth : "কোর্স ফি"})। অনুগ্রহ করে দ্রুত পরিশোধ করুন। ধন্যবাদ।`
                  )
                }}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[11px] font-semibold text-slate-700 cursor-pointer"
              >
                বাংলা (Standard)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSingleSmsMessage(
                    `Dear Parent, MedhaShiree Coaching reminder: ${singleSmsItem.student.name} (${singleSmsItem.student.student_id}) has an outstanding due of ৳${singleSmsItem.dueAmount} for ${singleSmsItem.batch.name}. Please clear the due payment. Thank you.`
                  )
                }}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[11px] font-semibold text-slate-700 cursor-pointer"
              >
                English
              </button>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSingleSmsItem(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendSingleDueSms}
                disabled={sendingSms || !singleSmsMessage.trim()}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {sendingSms ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>{sendingSms ? "Sending..." : "Send SMS Now"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 10. BULK DUE SMS MODAL FOR MARKED STUDENTS */}
      {/* ========================================================================= */}
      {bulkSmsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Bulk Due SMS Gateway</h3>
                  <p className="text-xs text-slate-500">Send personalized SMS reminders to marked students</p>
                </div>
              </div>
              <button
                onClick={() => setBulkSmsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Overview Box */}
            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center text-xs">
              <div>
                <p className="text-slate-400 font-bold uppercase text-[10px]">Marked Students</p>
                <p className="text-sm font-black text-slate-800 mt-0.5">{selectedRowKeys.size}</p>
              </div>
              <div>
                <p className="text-indigo-600 font-bold uppercase text-[10px]">SMS Eligible</p>
                <p className="text-sm font-black text-indigo-700 mt-0.5">{selectedItemsWithDue.length}</p>
              </div>
              <div>
                <p className="text-rose-600 font-bold uppercase text-[10px]">Total Due</p>
                <p className="text-sm font-black text-rose-600 mt-0.5">৳{totalSelectedDue}</p>
              </div>
            </div>

            {/* Template Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">SMS Template</label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setBulkSmsTemplate(
                        "সম্মানিত অভিভাবক, মেধাশিরী কোচিং: {name}-এর {batch} ব্যাচের বকেয়া ৳{due} ({month})। বকেয়া পরিশোধ করার জন্য বিনীত অনুরোধ করা হচ্ছে। ধন্যবাদ।"
                      )
                    }
                    className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer"
                  >
                    Bangla Preset
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() =>
                      setBulkSmsTemplate(
                        "Dear Parent, MedhaShiree Coaching reminder: {name} has an outstanding due of ৳{due} for {batch}. Please clear the payment. Thank you."
                      )
                    }
                    className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer"
                  >
                    English Preset
                  </button>
                </div>
              </div>
              <textarea
                rows={3}
                value={bulkSmsTemplate}
                onChange={(e) => setBulkSmsTemplate(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 font-sans"
              />
              <p className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-1">
                <span>Placeholders:</span>
                <code className="bg-slate-100 px-1 rounded text-indigo-600 font-bold">{"{name}"}</code>
                <code className="bg-slate-100 px-1 rounded text-indigo-600 font-bold">{"{student_id}"}</code>
                <code className="bg-slate-100 px-1 rounded text-indigo-600 font-bold">{"{batch}"}</code>
                <code className="bg-slate-100 px-1 rounded text-indigo-600 font-bold">{"{due}"}</code>
                <code className="bg-slate-100 px-1 rounded text-indigo-600 font-bold">{"{month}"}</code>
              </p>
            </div>

            {/* Live Preview of first recipient */}
            {selectedItemsWithDue.length > 0 && (
              <div className="bg-indigo-50/60 p-3 rounded-2xl border border-indigo-200/60 text-xs">
                <p className="text-[10px] font-bold text-indigo-900 uppercase mb-1">
                  Sample Preview (for {selectedItemsWithDue[0].student.name})
                </p>
                <p className="text-slate-800 leading-relaxed italic">
                  {bulkSmsTemplate
                    .replace(/\{name\}/g, selectedItemsWithDue[0].student.name)
                    .replace(/\{student_id\}/g, selectedItemsWithDue[0].student.student_id)
                    .replace(/\{batch\}/g, selectedItemsWithDue[0].batch.name)
                    .replace(/\{due\}/g, String(selectedItemsWithDue[0].dueAmount))
                    .replace(/\{month\}/g, selectedItemsWithDue[0].isMonthly ? selectedMonth : "Course")}
                </p>
              </div>
            )}

            {/* Recipient Roster Preview */}
            <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase sticky top-0">
                  <tr>
                    <th className="px-3 py-1.5">Student</th>
                    <th className="px-3 py-1.5">Batch</th>
                    <th className="px-3 py-1.5">Phone</th>
                    <th className="px-3 py-1.5 text-right">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedItemsWithDue.map((it) => (
                    <tr key={it.rowKey}>
                      <td className="px-3 py-1.5 font-bold text-slate-800">{it.student.name}</td>
                      <td className="px-3 py-1.5 text-slate-600">{it.batch.name}</td>
                      <td className="px-3 py-1.5 font-mono text-slate-700">
                        {it.student.guardian_phone || it.student.phone || "No phone"}
                      </td>
                      <td className="px-3 py-1.5 text-right font-black text-rose-600">৳{it.dueAmount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBulkSmsOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendBulkDueSms}
                disabled={sendingSms || selectedItemsWithDue.length === 0}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {sendingSms ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>{sendingSms ? "Dispatching..." : `Send ${selectedItemsWithDue.length} SMS Reminders`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 11. PRINTABLE RECEIPT MODAL */}
      {/* ========================================================================= */}
      {receiptData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Payment Successful
              </span>
              <button
                onClick={() => setReceiptData(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Voucher Section */}
            <div
              ref={printRef}
              className="bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-300 space-y-3 text-xs"
            >
              <div className="text-center border-b border-slate-200 pb-2">
                <h4 className="font-extrabold text-slate-900 text-base">MedhaShiree Coaching</h4>
                <p className="text-[10px] text-slate-500">Official Fee Payment Voucher</p>
                <p className="font-mono text-[10px] text-indigo-700 font-bold mt-0.5">
                  Receipt: {receiptData.receiptNumber}
                </p>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Student:</span>
                  <span className="font-bold text-slate-900">{receiptData.studentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Student ID:</span>
                  <span className="font-mono text-slate-900 font-semibold">{receiptData.studentId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Batch:</span>
                  <span className="font-medium text-slate-800">{receiptData.batchName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Fee Category:</span>
                  <span className="font-bold text-indigo-700">{receiptData.feeType}</span>
                </div>
                {receiptData.month && receiptData.month !== "N/A" && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Billing Month:</span>
                    <span className="font-bold text-slate-900">{receiptData.month}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Mode:</span>
                  <span
                    className={`uppercase font-bold ${
                      receiptData.method === "referral" ? "text-purple-700" : "text-slate-700"
                    }`}
                  >
                    {receiptData.method === "referral" ? "🎁 Referral / Waiver (রেফারেল)" : receiptData.method}
                  </span>
                </div>
                {receiptData.referralName && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-2.5 my-1.5 space-y-1 text-purple-950">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-purple-800">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      <span>Referral Waiver Details (রেফারেল তথ্য)</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-purple-700 font-medium">Referred By:</span>
                      <span className="font-bold text-purple-900">{receiptData.referralName}</span>
                    </div>
                    {receiptData.referralReason && (
                      <div className="flex justify-between text-[11px]">
                        <span className="text-purple-700 font-medium">Reason / Note:</span>
                        <span className="font-medium text-purple-900 text-right max-w-[200px] truncate">
                          {receiptData.referralReason}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span className="text-slate-700">{receiptData.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Accountant:</span>
                  <span className="text-slate-700">{receiptData.recordedBy}</span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-2 space-y-1.5 text-xs">
                {receiptData.targetFee && receiptData.targetFee > receiptData.totalPaid && (
                  <div className="flex justify-between text-slate-600 text-[11px]">
                    <span>Target Fee:</span>
                    <span className="font-bold">৳{receiptData.targetFee}</span>
                  </div>
                )}
                {receiptData.discount > 0 && (
                  <div className="flex justify-between text-emerald-600 text-[11px]">
                    <span>Discount:</span>
                    <span className="font-bold">-৳{receiptData.discount}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm font-black text-slate-900 border-t border-slate-200/60 pt-1">
                  <span>{receiptData.method === "referral" ? "Referral Credit Applied:" : "Total Paid Now:"}</span>
                  <span className={`${receiptData.method === "referral" ? "text-purple-700" : "text-emerald-600"} text-base`}>
                    ৳{receiptData.totalPaid}
                  </span>
                </div>
                {receiptData.remainingDue > 0 ? (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-2 space-y-1 mt-1 text-rose-800">
                    <div className="flex justify-between font-black text-xs text-rose-700">
                      <span>Remaining Due (বকেয়া):</span>
                      <span className="text-rose-600 font-black">৳{receiptData.remainingDue}</span>
                    </div>
                    {receiptData.nextDueDate && (
                      <div className="flex justify-between text-[10px] text-rose-600">
                        <span>Next Due Date:</span>
                        <span className="font-bold">{receiptData.nextDueDate}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-1.5 text-center text-[10px] font-bold text-emerald-700 mt-1">
                    ✓ Paid in Full (৳0 Due)
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={triggerPrint}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </button>
              <button
                onClick={() => setReceiptData(null)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
