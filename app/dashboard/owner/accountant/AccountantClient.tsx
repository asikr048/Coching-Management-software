"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  Calculator, Search, Filter, DollarSign, CreditCard, Users,
  BookOpen, CheckCircle, AlertCircle, Clock, ArrowRight,
  RefreshCw, Printer, X, Download, Shield, Landmark, Sparkles,
  Calendar, Check, ChevronRight, FileText
} from "lucide-react"
import { toast } from "sonner"
import type { Branch } from "@/lib/supabase/types"

interface StudentRow {
  id: string
  name: string
  student_id: string
  phone?: string | null
  guardian_phone?: string | null
  class_level?: string | null
  branch_id?: string | null
  enrollments?: any[]
}

interface BatchRow {
  id: string
  name: string
  monthly_fee: number
  admission_fee?: number
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
  status: string
  branch_id?: string | null
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

  // State
  const [students, setStudents] = useState<StudentRow[]>(initialStudents)
  const [batches, setBatches] = useState<BatchRow[]>(initialBatches)
  const [dues, setDues] = useState<DueRow[]>(initialDues)
  const [payments, setPayments] = useState<PaymentRow[]>(initialPayments)

  // Current Month Defaults
  const currentMonthStr = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  }, [])

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr)
  const [activeTab, setActiveTab] = useState<"students" | "batches" | "history">("students")

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBatchId, setSelectedBatchId] = useState<string>("all")
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "partial" | "due">("all")

  // Billing Generation Loading
  const [generatingBilling, setGeneratingBilling] = useState(false)

  // Pay Due Modal
  const [payModalStudent, setPayModalStudent] = useState<StudentRow | null>(null)
  const [payModalBatch, setPayModalBatch] = useState<BatchRow | null>(null)
  const [payModalDue, setPayModalDue] = useState<DueRow | null>(null)
  const [payAmount, setPayAmount] = useState<string>("")
  const [payDiscount, setPayDiscount] = useState<string>("0")
  const [payMethod, setPayMethod] = useState<string>("cash")
  const [payNotes, setPayNotes] = useState<string>("")
  const [paySubmitting, setPaySubmitting] = useState(false)

  // Printable Receipt Modal
  const [receiptData, setReceiptData] = useState<any | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  // Auto-sync monthly billing cycle on mount to ensure current month is always renewed
  useEffect(() => {
    async function autoRenewMonthlyBilling() {
      try {
        const res = await fetch(`/api/billing/generate-monthly?month=${selectedMonth}`)
        const data = await res.json()
        if (data.success && data.duesCreated > 0) {
          // Refresh dues list
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

  // Filter batches that have a monthly fee (Monthly Billing Cycle Batches)
  const monthlyBatches = useMemo(() => {
    return batches.filter((b) => (Number(b.monthly_fee) || 0) > 0)
  }, [batches])

  // Trigger Manual Billing Cycle Generation
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

  // Aggregate stats for top Financial Control Bar
  const stats = useMemo(() => {
    let enrolledStudentCount = 0
    let expectedRevenue = 0
    let totalCollected = 0
    let totalDue = 0
    let paidStudentsCount = 0
    let dueStudentsCount = 0

    const seenStudentIds = new Set<string>()

    for (const st of students) {
      const activeEnrollments = (st.enrollments || []).filter(
        (e) => e.status === "active" && e.batch && (Number(e.batch.monthly_fee) || 0) > 0
      )
      if (activeEnrollments.length === 0) continue

      if (selectedBranchId !== "all" && st.branch_id !== selectedBranchId) continue

      seenStudentIds.add(st.id)

      let studentMonthBilled = 0
      let studentMonthPaid = 0
      let studentMonthDue = 0

      for (const enr of activeEnrollments) {
        if (selectedBatchId !== "all" && enr.batch_id !== selectedBatchId) continue

        const fee = Number(enr.batch?.monthly_fee) || 0
        const dueObj = duesMapForSelectedMonth.get(`${st.id}_${enr.batch_id}`)

        const billed = dueObj ? Number(dueObj.due_amount) : fee
        const paid = dueObj ? Number(dueObj.paid_amount || 0) : 0
        const outstanding = Math.max(0, billed - paid)

        studentMonthBilled += billed
        studentMonthPaid += paid
        studentMonthDue += outstanding
      }

      expectedRevenue += studentMonthBilled
      totalCollected += studentMonthPaid
      totalDue += studentMonthDue

      if (studentMonthBilled > 0) {
        if (studentMonthDue <= 0) {
          paidStudentsCount++
        } else {
          dueStudentsCount++
        }
      }
    }

    enrolledStudentCount = seenStudentIds.size
    const collectionRate = expectedRevenue > 0 ? Math.round((totalCollected / expectedRevenue) * 100) : 0

    return {
      totalStudents: enrolledStudentCount,
      expectedRevenue,
      totalCollected,
      totalDue,
      paidStudentsCount,
      dueStudentsCount,
      collectionRate,
    }
  }, [students, duesMapForSelectedMonth, selectedBatchId, selectedBranchId])

  // Filtered Students list
  const filteredStudents = useMemo(() => {
    return students.filter((st) => {
      // 1. Must be in a monthly batch
      const activeMonthlyEnrs = (st.enrollments || []).filter(
        (e) => e.status === "active" && e.batch && (Number(e.batch.monthly_fee) || 0) > 0
      )
      if (activeMonthlyEnrs.length === 0) return false

      // 2. Branch Filter
      if (selectedBranchId !== "all" && st.branch_id !== selectedBranchId) return false

      // 3. Batch Filter
      if (selectedBatchId !== "all" && !activeMonthlyEnrs.some((e) => e.batch_id === selectedBatchId)) {
        return false
      }

      // 4. Status Filter (Paid / Partial / Due)
      let totalDueForStudent = 0
      let totalPaidForStudent = 0
      let totalBilledForStudent = 0

      for (const enr of activeMonthlyEnrs) {
        if (selectedBatchId !== "all" && enr.batch_id !== selectedBatchId) continue
        const fee = Number(enr.batch?.monthly_fee) || 0
        const dueObj = duesMapForSelectedMonth.get(`${st.id}_${enr.batch_id}`)
        const billed = dueObj ? Number(dueObj.due_amount) : fee
        const paid = dueObj ? Number(dueObj.paid_amount || 0) : 0
        totalBilledForStudent += billed
        totalPaidForStudent += paid
        totalDueForStudent += Math.max(0, billed - paid)
      }

      if (statusFilter === "paid" && (totalDueForStudent > 0 || totalPaidForStudent === 0)) return false
      if (statusFilter === "partial" && (totalPaidForStudent === 0 || totalDueForStudent === 0)) return false
      if (statusFilter === "due" && totalDueForStudent === 0) return false

      // 5. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const nameMatch = st.name?.toLowerCase().includes(q)
        const rollMatch = st.student_id?.toLowerCase().includes(q)
        const phoneMatch = st.phone?.includes(q)
        const gPhoneMatch = st.guardian_phone?.includes(q)
        if (!nameMatch && !rollMatch && !phoneMatch && !gPhoneMatch) return false
      }

      return true
    })
  }, [students, duesMapForSelectedMonth, selectedBranchId, selectedBatchId, statusFilter, searchQuery])

  // Open Payment Collection Modal
  function openPayModal(student: StudentRow, batch: BatchRow, dueObj?: DueRow | null) {
    setPayModalStudent(student)
    setPayModalBatch(batch)
    setPayModalDue(dueObj || null)

    const expectedFee = dueObj ? Number(dueObj.due_amount) : Number(batch.monthly_fee) || 0
    const alreadyPaid = dueObj ? Number(dueObj.paid_amount) || 0 : 0
    const remaining = Math.max(0, expectedFee - alreadyPaid)

    setPayAmount(String(remaining > 0 ? remaining : expectedFee))
    setPayDiscount("0")
    setPayMethod("cash")
    setPayNotes(`Monthly Fee: ${selectedMonth}`)
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

    setPaySubmitting(true)
    try {
      const totalPaid = Math.max(0, amountNum - discountNum)
      const now = new Date()
      const receiptNo = `RCP-${now.getFullYear()}-${Date.now().toString().slice(-6)}`

      // 1. Insert Payment Record
      const { data: payRecord, error: payErr } = await supabase
        .from("payments")
        .insert({
          student_id: payModalStudent.id,
          batch_id: payModalBatch.id,
          amount: amountNum,
          discount: discountNum,
          total_paid: totalPaid,
          payment_method: payMethod,
          payment_for: "monthly",
          payment_month: selectedMonth,
          receipt_number: receiptNo,
          notes: payNotes.trim() || null,
        })
        .select("*, student:students(name, student_id), batch:batches(name)")
        .single()

      if (payErr) throw payErr

      // 2. Update or Insert Fee Due
      const existingDue = payModalDue || duesMapForSelectedMonth.get(`${payModalStudent.id}_${payModalBatch.id}`)
      let updatedDueObj: DueRow | null = null

      if (existingDue) {
        const newPaid = (Number(existingDue.paid_amount) || 0) + totalPaid
        const newStatus: "paid" | "partial" = newPaid >= Number(existingDue.due_amount) ? "paid" : "partial"

        const { data: updData, error: updErr } = await supabase
          .from("fee_dues")
          .update({
            paid_amount: newPaid,
            status: newStatus,
          })
          .eq("id", existingDue.id)
          .select("id, student_id, batch_id, due_month, due_amount, paid_amount, due_date, status, batch:batches(id, name, monthly_fee)")
          .single()

        if (updErr) throw updErr
        updatedDueObj = updData
        setDues((prev) => prev.map((d) => (d.id === existingDue.id ? updData : d)))
      } else {
        // Create new due record with this payment
        const targetDueDate = `${selectedMonth}-10`
        const fullFee = Number(payModalBatch.monthly_fee) || totalPaid
        const status: "paid" | "partial" = totalPaid >= fullFee ? "paid" : "partial"

        const { data: insData, error: insErr } = await supabase
          .from("fee_dues")
          .insert({
            student_id: payModalStudent.id,
            batch_id: payModalBatch.id,
            due_month: selectedMonth,
            due_amount: fullFee,
            paid_amount: totalPaid,
            due_date: targetDueDate,
            status: status,
          })
          .select("id, student_id, batch_id, due_month, due_amount, paid_amount, due_date, status, batch:batches(id, name, monthly_fee)")
          .single()

        if (insErr) throw insErr
        updatedDueObj = insData
        setDues((prev) => [insData, ...prev])
      }

      if (payRecord) {
        setPayments((prev) => [payRecord, ...prev])
      }

      toast.success(`Payment of ৳${totalPaid} recorded successfully for ${payModalStudent.name}!`)

      // Set receipt for instant preview / print
      setReceiptData({
        receiptNumber: receiptNo,
        studentName: payModalStudent.name,
        studentId: payModalStudent.student_id,
        batchName: payModalBatch.name,
        month: selectedMonth,
        amount: amountNum,
        discount: discountNum,
        totalPaid: totalPaid,
        method: payMethod,
        date: new Date().toLocaleDateString("en-GB"),
        recordedBy: currentStaff.name,
      })

      setPayModalStudent(null)
      setPayModalBatch(null)
      setPayModalDue(null)
    } catch (err: any) {
      toast.error(err?.message || "Failed to record payment")
    } finally {
      setPaySubmitting(false)
    }
  }

  // Print voucher
  function triggerPrint() {
    window.print()
  }

  return (
    <div className="space-y-6 pb-12">
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
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Accountant Desk
                <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-2.5 py-0.5 rounded-full">
                  Monthly Billing Cycle
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Financial control, automated recurring monthly dues, and real-time fee collection
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
            />
          </div>

          {/* Run Monthly Billing Cycle Action Button */}
          <button
            onClick={handleRunMonthlyBillingCycle}
            disabled={generatingBilling}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
            title="Automatically generates dues for all active students in monthly batches on the 1st of the month"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generatingBilling ? "animate-spin" : ""}`} />
            <span>{generatingBilling ? "Renewing..." : "⚡ Run Monthly Renewal"}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. FINANCIAL KPI STATS CARDS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Students */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Enrolled</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.totalStudents}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">In monthly batches</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Expected Monthly Revenue */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expected ({selectedMonth})</p>
            <h3 className="text-2xl font-black text-indigo-700 mt-1">{formatCurrency(stats.expectedRevenue)}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Total billing target</p>
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
            <p className="text-[11px] text-emerald-700 font-medium mt-0.5">{stats.paidStudentsCount} students paid</p>
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
            <p className="text-[11px] text-rose-700 font-medium mt-0.5">{stats.dueStudentsCount} students pending</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5" />
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
            {stats.paidStudentsCount} of {stats.totalStudents} completed
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. TABS & FILTER BAR */}
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
            <span>Student Billing Ledger ({filteredStudents.length})</span>
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
            <span>Monthly Batches ({monthlyBatches.length})</span>
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

        {/* Filter Controls (Visible on Students Tab) */}
        {activeTab === "students" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search student name, roll, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            {/* Batch Filter */}
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium py-2 px-3 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Monthly Batches</option>
              {monthlyBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({formatCurrency(b.monthly_fee)}/mo)
                </option>
              ))}
            </select>

            {/* Branch Filter */}
            {branches.length > 0 && (
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
            </select>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. TAB 1: STUDENT BILLING LEDGER TABLE */}
      {/* ========================================================================= */}
      {activeTab === "students" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Student Details</th>
                  <th className="px-4 py-3.5">Enrolled Batches</th>
                  <th className="px-4 py-3.5">Monthly Fee</th>
                  <th className="px-4 py-3.5">Status ({selectedMonth})</th>
                  <th className="px-4 py-3.5">Collected</th>
                  <th className="px-4 py-3.5">Due Amount</th>
                  <th className="px-4 py-3.5 text-right">Accounting Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-600">No students matching your filter</p>
                      <p className="text-xs text-slate-400 mt-0.5">Try selecting another month, batch, or status</p>
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st) => {
                    const monthlyEnrs = (st.enrollments || []).filter(
                      (e) => e.status === "active" && e.batch && (Number(e.batch.monthly_fee) || 0) > 0
                    )

                    return monthlyEnrs.map((enr, idx) => {
                      const batch = enr.batch!
                      const fullBatchObj = batches.find((b) => b.id === batch.id) || {
                        ...batch,
                        is_active: true,
                      }
                      const dueObj = duesMapForSelectedMonth.get(`${st.id}_${batch.id}`)

                      const expectedFee = dueObj ? Number(dueObj.due_amount) : Number(batch.monthly_fee) || 0
                      const paidAmount = dueObj ? Number(dueObj.paid_amount || 0) : 0
                      const outstanding = Math.max(0, expectedFee - paidAmount)

                      const isPaid = expectedFee > 0 && outstanding <= 0
                      const isPartial = paidAmount > 0 && outstanding > 0

                      return (
                        <tr key={`${st.id}-${batch.id}`} className="hover:bg-slate-50/70 transition-colors">
                          {/* Student Info */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-black text-xs flex items-center justify-center flex-shrink-0">
                                {st.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 truncate">{st.name}</p>
                                <p className="text-[11px] text-slate-400">
                                  ID: <span className="font-mono text-indigo-600 font-semibold">{st.student_id}</span>
                                  {st.phone && <span> • {st.phone}</span>}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Batch Name */}
                          <td className="px-4 py-3.5 font-medium text-slate-700">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold">
                              <BookOpen className="w-3 h-3 text-slate-500" />
                              {batch.name}
                            </span>
                          </td>

                          {/* Expected Monthly Fee */}
                          <td className="px-4 py-3.5 font-bold text-slate-900">{formatCurrency(expectedFee)}</td>

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
                          <td className="px-4 py-3.5 font-bold text-emerald-600">{formatCurrency(paidAmount)}</td>

                          {/* Outstanding Due */}
                          <td className="px-4 py-3.5 font-black text-rose-600">
                            {outstanding > 0 ? formatCurrency(outstanding) : "৳0"}
                          </td>

                          {/* Action Button */}
                          <td className="px-4 py-3.5 text-right">
                            {isPaid ? (
                              <button
                                onClick={() => openPayModal(st, fullBatchObj, dueObj)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                              >
                                <span>Record Extra</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => openPayModal(st, fullBatchObj, dueObj)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Pay Due (৳{outstanding})</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TAB 2: MONTHLY BATCHES BILLING OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === "batches" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {monthlyBatches.map((batch) => {
            // Compute batch financials for selected month
            const enrolled = students.filter((s) =>
              (s.enrollments || []).some((e) => e.batch_id === batch.id && e.status === "active")
            )
            const count = enrolled.length
            const fee = Number(batch.monthly_fee) || 0
            const expectedTotal = count * fee

            let collectedTotal = 0
            for (const s of enrolled) {
              const due = duesMapForSelectedMonth.get(`${s.id}_${batch.id}`)
              if (due) collectedTotal += Number(due.paid_amount) || 0
            }
            const dueTotal = Math.max(0, expectedTotal - collectedTotal)
            const pct = expectedTotal > 0 ? Math.round((collectedTotal / expectedTotal) * 100) : 0

            return (
              <div key={batch.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60">
                      Monthly Cycle
                    </span>
                    <h3 className="text-base font-black text-slate-900 mt-1">{batch.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {batch.class_level || "Class All"} • {batch.branch?.name || "Main Campus"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-400">Monthly Fee</p>
                    <p className="text-lg font-black text-indigo-700">{formatCurrency(fee)}</p>
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
                    <span>Month Recovery</span>
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
                  <span>View Batch Student Roster</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. TAB 3: RECENT PAYMENTS LOG */}
      {/* ========================================================================= */}
      {activeTab === "history" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Receipt #</th>
                  <th className="px-4 py-3.5">Student</th>
                  <th className="px-4 py-3.5">Batch</th>
                  <th className="px-4 py-3.5">Billed Month</th>
                  <th className="px-4 py-3.5">Method</th>
                  <th className="px-4 py-3.5">Paid Amount</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
                      No payment history recorded yet
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-indigo-600">{p.receipt_number}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{p.student?.name || "Student"}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">{p.batch?.name || "Monthly Batch"}</td>
                      <td className="px-4 py-3 text-slate-600 font-medium">{p.payment_month || "Current"}</td>
                      <td className="px-4 py-3">
                        <span className="capitalize px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-bold">
                          {p.payment_method}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-black text-emerald-600">{formatCurrency(p.total_paid || p.amount)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(p.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setReceiptData({
                              receiptNumber: p.receipt_number,
                              studentName: p.student?.name || "Student",
                              studentId: p.student_id,
                              batchName: p.batch?.name || "Monthly Fee",
                              month: p.payment_month || selectedMonth,
                              amount: p.amount,
                              discount: p.amount - (p.total_paid || p.amount),
                              totalPaid: p.total_paid || p.amount,
                              method: p.payment_method,
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. PAY DUE MODAL */}
      {/* ========================================================================= */}
      {payModalStudent && payModalBatch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  ৳
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Collect Monthly Fee</h3>
                  <p className="text-xs text-slate-500">Billing Cycle: {selectedMonth}</p>
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
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Student:</span>
                <span className="font-bold text-slate-900">{payModalStudent.name} ({payModalStudent.student_id})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Batch:</span>
                <span className="font-bold text-slate-800">{payModalBatch.name}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200/60 pt-1.5">
                <span className="text-slate-500 font-medium">Monthly Fee:</span>
                <span className="font-black text-indigo-700">{formatCurrency(payModalBatch.monthly_fee)}</span>
              </div>
              {payModalDue && (
                <div className="flex justify-between text-slate-600">
                  <span>Already Paid This Month:</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(payModalDue.paid_amount)}</span>
                </div>
              )}
            </div>

            {/* Payment Form */}
            <form onSubmit={handleRecordPaymentSubmit} className="space-y-3.5">
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

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Discount (৳)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={payDiscount}
                    onChange={(e) => setPayDiscount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="cash">Cash (নগদ)</option>
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                    <option value="rocket">Rocket</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Receipt Note / Memo</label>
                <input
                  type="text"
                  placeholder="Optional reference note..."
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
      {/* 8. PRINTABLE RECEIPT MODAL */}
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
            <div ref={printRef} className="bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-300 space-y-3 text-xs">
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
                  <span className="text-slate-500">Billing Month:</span>
                  <span className="font-bold text-slate-900">{receiptData.month}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Mode:</span>
                  <span className="uppercase font-bold text-slate-700">{receiptData.method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span className="text-slate-700">{receiptData.date}</span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-sm font-black text-slate-900">
                <span>Total Paid:</span>
                <span className="text-emerald-600 text-base">৳{receiptData.totalPaid}</span>
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
