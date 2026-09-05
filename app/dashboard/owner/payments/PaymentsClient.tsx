"use client"
import { useState, useEffect, useMemo, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { 
  Plus, X, Loader2, CreditCard, Printer, Search, ShieldAlert, 
  AlertCircle, Check, DollarSign, Calendar, Edit2, Download, 
  User, RefreshCw, CheckCircle2, ArrowRight, Eye, ChevronDown, Clock, History,
  Smartphone, Settings, Save
} from "lucide-react"
import { formatCurrency, formatDateTime, formatDate } from "@/lib/utils"
import { checkFinancialAccess } from "@/lib/financial-access"
import Link from "next/link"

interface StudentOpt { 
  id: string; 
  name: string; 
  student_id: string; 
  phone?: string; 
  email?: string; 
  guardian_phone?: string;
}

interface BatchOpt { 
  id: string; 
  name: string; 
  monthly_fee: number;
}

interface DueRow { 
  id: string; 
  student_id: string; 
  batch_id: string; 
  due_month: string; 
  due_amount: number; 
  paid_amount: number; 
  due_date: string; 
  status: string; 
  batch?: { name: string } | { name: string }[] | null;
}

interface PaymentRow { 
  id: string; 
  amount: number; 
  discount: number; 
  total_paid: number; 
  payment_method: string; 
  payment_for: string; 
  payment_month?: string; 
  receipt_number: string; 
  paid_at: string; 
  student_id?: string;
  notes?: string;
  student?: { name: string; student_id: string; phone?: string; email?: string; guardian_phone?: string }; 
  batch?: { name: string };
}

interface PrintableReceipt {
  receipt_number: string
  student_name: string
  student_id: string
  student_phone?: string
  student_email?: string
  guardian_phone?: string
  batch_name: string
  paid_amount: number
  total_amount: number
  discount: number
  payment_method: string
  payment_for: string
  payment_month?: string
  paid_at: string
  qr_data: string
  referral_name?: string
  referral_reason?: string
}

export function parseReferralNotes(notes?: string | null): { referral_name?: string; referral_reason?: string } {
  if (!notes) return {}
  const matchName = notes.match(/Referral:\s*([^|]+)/i)
  const matchReason = notes.match(/Reason:\s*(.+)/i)
  return {
    referral_name: matchName ? matchName[1].trim() : undefined,
    referral_reason: matchReason ? matchReason[1].trim() : undefined,
  }
}

export default function PaymentsClient({ 
  payments: initial, 
  students, 
  batches, 
  dues: initialDues = [] 
}: { 
  payments: PaymentRow[]; 
  students: StudentOpt[]; 
  batches: BatchOpt[]; 
  dues?: DueRow[];
}) {
  const [payments, setPayments] = useState(initial)
  const [dues, setDues] = useState(initialDues)
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hasAccess, setHasAccess] = useState(true)

  // Top search state
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStudent, setSelectedStudent] = useState<StudentOpt | null>(null)
  const [payingDue, setPayingDue] = useState<DueRow | null>(null)

  // Modal search state for Record Payment modal
  const [modalSearchQuery, setModalSearchQuery] = useState("")
  const [modalSelectedStudent, setModalSelectedStudent] = useState<StudentOpt | null>(null)

  // Due adjustment modal (edit due amount or date)
  const [editingDue, setEditingDue] = useState<DueRow | null>(null)
  const [editDueAmount, setEditDueAmount] = useState("")
  const [editDueDate, setEditDueDate] = useState("")
  const [dueUpdating, setDueUpdating] = useState(false)

  // Payment receipt modal for printing and saving PDF
  const [receiptModal, setReceiptModal] = useState<PrintableReceipt | null>(null)
  const receiptRef = useRef<HTMLDivElement>(null)

  const supabase = createClient()

  // Form state
  const [form, setForm] = useState({ 
    student_id: "", 
    batch_id: "", 
    amount: "", 
    discount: "0", 
    payment_method: "cash", 
    payment_for: "monthly", 
    payment_month: "",
    referral_name: "",
    referral_reason: "",
  })

  // Payment Gateway Numbers (Owner Configurable)
  const [showGatewayModal, setShowGatewayModal] = useState(false)
  const [savingGateways, setSavingGateways] = useState(false)
  const [gatewayNumbers, setGatewayNumbers] = useState({
    bkash: "01302201431",
    bkash_type: "Send Money (Personal)",
    nagad: "01302201431",
    nagad_type: "Send Money (Personal)",
    rocket: "01302201431",
    rocket_type: "Send Money (Personal)",
    upay: "01302201431",
    upay_type: "Send Money (Personal)",
  })

  // Load gateway numbers on mount
  useEffect(() => {
    async function loadGatewayNumbers() {
      try {
        const { data: settings } = await supabase
          .from("site_settings")
          .select("key, value")
          .in("key", [
            "payment_number_bkash", "payment_number_nagad", "payment_number_rocket", "payment_number_upay",
            "payment_type_bkash", "payment_type_nagad", "payment_type_rocket", "payment_type_upay"
          ])

        if (settings && settings.length > 0) {
          const map: Record<string, string> = {}
          settings.forEach(s => { map[s.key] = s.value })
          setGatewayNumbers(prev => ({
            bkash: map["payment_number_bkash"] || prev.bkash,
            bkash_type: map["payment_type_bkash"] || prev.bkash_type,
            nagad: map["payment_number_nagad"] || prev.nagad,
            nagad_type: map["payment_type_nagad"] || prev.nagad_type,
            rocket: map["payment_number_rocket"] || prev.rocket,
            rocket_type: map["payment_type_rocket"] || prev.rocket_type,
            upay: map["payment_number_upay"] || prev.upay,
            upay_type: map["payment_type_upay"] || prev.upay_type,
          }))
        }

        const { data: accounts } = await supabase
          .from("payment_accounts")
          .select("method, account_number, account_name")
          .eq("is_active", true)

        if (accounts && accounts.length > 0) {
          accounts.forEach(acc => {
            const m = acc.method?.toLowerCase()
            if (m === "bkash" && acc.account_number) {
              setGatewayNumbers(prev => ({ ...prev, bkash: acc.account_number, bkash_type: acc.account_name || prev.bkash_type }))
            } else if (m === "nagad" && acc.account_number) {
              setGatewayNumbers(prev => ({ ...prev, nagad: acc.account_number, nagad_type: acc.account_name || prev.nagad_type }))
            } else if (m === "rocket" && acc.account_number) {
              setGatewayNumbers(prev => ({ ...prev, rocket: acc.account_number, rocket_type: acc.account_name || prev.rocket_type }))
            } else if (m === "upay" && acc.account_number) {
              setGatewayNumbers(prev => ({ ...prev, upay: acc.account_number, upay_type: acc.account_name || prev.upay_type }))
            }
          })
        }
      } catch (err) {
        console.warn("Could not load gateway numbers:", err)
      }
    }
    loadGatewayNumbers()
  }, [])

  async function handleSaveGatewayNumbers(e: React.FormEvent) {
    e.preventDefault()
    setSavingGateways(true)
    try {
      // 1. Save to site_settings
      const settingsEntries = [
        { key: "payment_number_bkash", value: gatewayNumbers.bkash },
        { key: "payment_type_bkash", value: gatewayNumbers.bkash_type },
        { key: "payment_number_nagad", value: gatewayNumbers.nagad },
        { key: "payment_type_nagad", value: gatewayNumbers.nagad_type },
        { key: "payment_number_rocket", value: gatewayNumbers.rocket },
        { key: "payment_type_rocket", value: gatewayNumbers.rocket_type },
        { key: "payment_number_upay", value: gatewayNumbers.upay },
        { key: "payment_type_upay", value: gatewayNumbers.upay_type },
      ]
      for (const entry of settingsEntries) {
        await supabase.from("site_settings").upsert(entry, { onConflict: "key" })
      }

      // 2. Save/upsert to payment_accounts
      const accountsList = [
        { method: "bkash", account_number: gatewayNumbers.bkash, account_name: gatewayNumbers.bkash_type, is_active: true },
        { method: "nagad", account_number: gatewayNumbers.nagad, account_name: gatewayNumbers.nagad_type, is_active: true },
        { method: "rocket", account_number: gatewayNumbers.rocket, account_name: gatewayNumbers.rocket_type, is_active: true },
        { method: "upay", account_number: gatewayNumbers.upay, account_name: gatewayNumbers.upay_type, is_active: true },
      ]
      for (const acc of accountsList) {
        const { data: existing } = await supabase.from("payment_accounts").select("id").eq("method", acc.method).maybeSingle()
        if (existing) {
          await supabase.from("payment_accounts").update({
            account_number: acc.account_number,
            account_name: acc.account_name,
            is_active: true,
          }).eq("id", existing.id)
        } else {
          await supabase.from("payment_accounts").insert(acc)
        }
      }

      toast.success("Payment numbers updated successfully! Student payment form will reflect these immediately.")
      setShowGatewayModal(false)
    } catch (err: unknown) {
      console.error("Save gateway numbers error:", err)
      toast.error(err instanceof Error ? err.message : "Failed to save gateway numbers")
    } finally {
      setSavingGateways(false)
    }
  }

  function update(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  function getBatchName(batch: { name: string } | { name: string }[] | null | undefined): string {
    if (!batch) return "—"
    if (Array.isArray(batch)) return batch[0]?.name || "—"
    return batch.name || "—"
  }

  useEffect(() => {
    checkFinancialAccess().then(({ hasAccess: a }) => setHasAccess(a))
  }, [])

  // Top search filter for students
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return students.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.student_id.toLowerCase().includes(q) || 
      (s.phone && s.phone.includes(q))
    ).slice(0, 8)
  }, [searchQuery, students])

  // Modal search filter for students
  const modalFilteredStudents = useMemo(() => {
    if (!modalSearchQuery.trim()) return []
    const q = modalSearchQuery.toLowerCase()
    return students.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.student_id.toLowerCase().includes(q) || 
      (s.phone && s.phone.includes(q))
    ).slice(0, 8)
  }, [modalSearchQuery, students])

  // Dues of selected student
  const studentDues = useMemo(() => {
    if (!selectedStudent) return []
    return dues.filter(d => d.student_id === selectedStudent.id)
  }, [selectedStudent, dues])

  // Payments history of selected student
  const studentPayments = useMemo(() => {
    if (!selectedStudent) return []
    return payments.filter(p => 
      p.student_id === selectedStudent.id || 
      p.student?.student_id === selectedStudent.student_id
    )
  }, [selectedStudent, payments])

  function handleSelectStudent(s: StudentOpt) {
    setSelectedStudent(s)
    setSearchQuery("")
    setForm(f => ({ ...f, student_id: s.id }))
    setPayingDue(null)
  }

  function handleModalSelectStudent(s: StudentOpt) {
    setModalSelectedStudent(s)
    setModalSearchQuery("")
    setForm(f => ({ ...f, student_id: s.id }))
  }

  function selectDueToPay(d: DueRow) {
    setPayingDue(d)
    const outstanding = Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0))
    setForm(f => ({ 
      ...f, 
      student_id: d.student_id, 
      batch_id: d.batch_id, 
      amount: String(outstanding), 
      discount: "0",
      payment_for: "monthly", 
      payment_month: d.due_month,
      referral_name: "",
      referral_reason: "",
    }))
  }

  function openRecordModal() {
    setForm({ 
      student_id: selectedStudent?.id || "", 
      batch_id: "", 
      amount: "", 
      discount: "0", 
      payment_method: "cash", 
      payment_for: "monthly", 
      payment_month: "",
      referral_name: "",
      referral_reason: "",
    })
    setModalSelectedStudent(selectedStudent || null)
    setModalSearchQuery("")
    setShowRecordModal(true)
  }

  // Open due editing modal
  function openEditDue(d: DueRow) {
    setEditingDue(d)
    setEditDueAmount(String(d.due_amount))
    setEditDueDate(d.due_date ? d.due_date.split("T")[0] : "")
  }

  // Save modified due details (due_amount, due_date, status)
  async function handleSaveDueEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingDue) return
    const newAmt = parseFloat(editDueAmount)
    if (isNaN(newAmt) || newAmt < 0) {
      toast.error("Please enter a valid due amount")
      return
    }
    setDueUpdating(true)
    try {
      const newStatus = newAmt <= (editingDue.paid_amount || 0) ? "paid" : editingDue.status
      const { error } = await supabase
        .from("fee_dues")
        .update({
          due_amount: newAmt,
          due_date: editDueDate || null,
          status: newStatus
        })
        .eq("id", editingDue.id)

      if (error) throw error

      setDues(prev => prev.map(d => d.id === editingDue.id ? { 
        ...d, 
        due_amount: newAmt, 
        due_date: editDueDate, 
        status: newStatus 
      } : d))

      toast.success("Due record updated successfully!")
      setEditingDue(null)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update due")
    } finally {
      setDueUpdating(false)
    }
  }

  // Record payment handler (used both inline and in modal)
  async function handlePay(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!hasAccess) { toast.error("Financial access required"); return }
    const stId = form.student_id || modalSelectedStudent?.id || selectedStudent?.id
    if (!stId) {
      toast.error("Please select a student")
      return
    }
    const amt = parseFloat(form.amount)
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid amount")
      return
    }

    if (form.payment_method === "referral") {
      if (!form.referral_name.trim()) {
        toast.error("Please enter the Referral Student Name or ID")
        return
      }
      if (!form.referral_reason.trim()) {
        toast.error("Please enter the reason for the referral payment")
        return
      }
    }

    setLoading(true)
    try {
      const disc = parseFloat(form.discount || "0")
      const total = Math.max(0, amt - disc)
      const now = new Date()
      const month = form.payment_month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

      // Receipt number
      const receiptNo = `RCP-${now.getFullYear()}-${Date.now().toString().slice(-6)}`

      let paymentNotes: string | null = null
      if (form.payment_method === "referral") {
        paymentNotes = `Referral: ${form.referral_name.trim()} | Reason: ${form.referral_reason.trim()}`
      }

      const { data, error } = await supabase.from("payments").insert({
        student_id: stId,
        batch_id: form.batch_id || null,
        amount: amt,
        discount: disc,
        total_paid: total,
        payment_method: form.payment_method,
        payment_for: form.payment_for,
        payment_month: month,
        receipt_number: receiptNo,
        notes: paymentNotes,
      }).select("*, student:students(name, student_id, phone, email, guardian_phone), batch:batches(name)").single()

      if (error) throw error

      // Update or create fee_due if paying a due or partial payment
      if (payingDue) {
        const newPaid = (payingDue.paid_amount || 0) + total
        const newStatus = newPaid >= payingDue.due_amount ? "paid" : "partial"
        await supabase.from("fee_dues").update({ paid_amount: newPaid, status: newStatus }).eq("id", payingDue.id)
        setDues(prev => prev.map(d => d.id === payingDue.id ? { ...d, paid_amount: newPaid, status: newStatus } : d).filter(d => d.status !== "paid"))
      } else if (form.batch_id) {
        const b = batches.find(x => x.id === form.batch_id)
        const bFee = b ? Number(b.monthly_fee) || 0 : 0
        const { data: existingDue } = await supabase
          .from("fee_dues")
          .select("id, due_amount, paid_amount")
          .eq("student_id", stId)
          .eq("batch_id", form.batch_id)
          .eq("due_month", month)
          .maybeSingle()

        if (existingDue) {
          const newPaid = (Number(existingDue.paid_amount) || 0) + total
          const newStatus = newPaid >= Number(existingDue.due_amount) ? "paid" : "partial"
          await supabase.from("fee_dues").update({ paid_amount: newPaid, status: newStatus }).eq("id", existingDue.id)
          setDues(prev => prev.map(d => d.id === existingDue.id ? { ...d, paid_amount: newPaid, status: newStatus } : d).filter(d => d.status !== "paid"))
        } else if (bFee > total) {
          const targetDueDate = (() => {
            const d = new Date()
            d.setMonth(d.getMonth() + 1)
            d.setDate(10)
            return d.toISOString().split("T")[0]
          })()
          const { data: newDue } = await supabase.from("fee_dues").insert({
            student_id: stId,
            batch_id: form.batch_id,
            due_month: month,
            due_amount: bFee,
            paid_amount: total,
            due_date: targetDueDate,
            status: total > 0 ? "partial" : "pending"
          }).select("id, student_id, batch_id, due_month, due_amount, paid_amount, due_date, status, batch:batches(name)").maybeSingle()

          if (newDue) {
            setDues(prev => [...prev, newDue])
          }
        }
      }

      setPayments([data, ...payments])
      setShowRecordModal(false)
      setPayingDue(null)

      const stObj = students.find(s => s.id === stId) || data.student
      const batchObj = batches.find(b => b.id === form.batch_id) || data.batch

      // Open printable / downloadable PDF modal immediately
      const qrData = `Receipt: ${data.receipt_number} | Student: ${stObj?.name} (${stObj?.student_id}) | Paid: ৳${total} | Date: ${new Date().toLocaleDateString()}`
      setReceiptModal({
        receipt_number: data.receipt_number,
        student_name: stObj?.name || "Student",
        student_id: stObj?.student_id || "N/A",
        student_phone: stObj?.phone || undefined,
        guardian_phone: stObj?.guardian_phone || undefined,
        batch_name: batchObj?.name || "General Program",
        paid_amount: total,
        total_amount: amt,
        discount: disc,
        payment_method: form.payment_method.toUpperCase(),
        payment_for: form.payment_for,
        payment_month: month,
        paid_at: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        qr_data: qrData,
        referral_name: form.payment_method === "referral" ? form.referral_name.trim() : undefined,
        referral_reason: form.payment_method === "referral" ? form.referral_reason.trim() : undefined,
      })

      toast.success(`Payment of ${formatCurrency(total)} recorded! Receipt: ${data.receipt_number}`)
    } catch (err: unknown) { 
      toast.error(err instanceof Error ? err.message : "Payment failed") 
    } finally { 
      setLoading(false) 
    }
  }

  // Print existing payment receipt from history table
  function printExistingReceipt(p: PaymentRow) {
    const qrData = `Receipt: ${p.receipt_number} | Student: ${p.student?.name} (${p.student?.student_id}) | Amount: ৳${p.total_paid} | Date: ${formatDate(p.paid_at)}`
    const refInfo = parseReferralNotes(p.notes)
    setReceiptModal({
      receipt_number: p.receipt_number,
      student_name: p.student?.name || "Student",
      student_id: p.student?.student_id || "N/A",
      student_phone: p.student?.phone || undefined,
      guardian_phone: p.student?.guardian_phone || undefined,
      batch_name: p.batch?.name || "General Program",
      paid_amount: p.total_paid,
      total_amount: p.amount,
      discount: p.discount || 0,
      payment_method: p.payment_method.toUpperCase(),
      payment_for: p.payment_for,
      payment_month: p.payment_month,
      paid_at: formatDateTime(p.paid_at),
      qr_data: qrData,
      referral_name: refInfo.referral_name,
      referral_reason: refInfo.referral_reason,
    })
  }

  // Print slip popup
  function handlePrintReceipt() {
    if (!receiptModal) return
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(receiptModal.qr_data)}`
    const win = window.open("", "_blank", "width=650,height=800")
    if (!win) return
    win.document.write(`<html><head><title>Receipt - ${receiptModal.receipt_number}</title><style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px; max-width: 500px; margin: 0 auto; color: #1e293b; background: #fff; }
      .header { text-align: center; border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 15px; }
      .header h1 { margin: 0; font-size: 22px; color: #047857; text-transform: uppercase; letter-spacing: 1px; }
      .header p { margin: 3px 0; font-size: 12px; color: #64748b; }
      .badge { display: inline-block; background: #d1fae5; color: #065f46; padding: 3px 12px; border-radius: 9999px; font-weight: bold; font-size: 11px; margin-top: 5px; }
      .section-title { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #059669; margin: 14px 0 6px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 3px; }
      .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
      .label { color: #64748b; }
      .value { font-weight: 600; color: #0f172a; text-align: right; }
      .summary-box { background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 8px; padding: 12px; margin-top: 10px; }
      .total-row { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; padding: 6px 0; color: #047857; }
      .qr-container { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-top: 1px dashed #cbd5e1; margin-top: 15px; }
      .footer { text-align: center; margin-top: 15px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    </style></head><body>
      <div class="header">
        <h1>MedhaShiree Coaching</h1>
        <p>Official Fee Payment Receipt</p>
        <span class="badge">${receiptModal.receipt_number}</span>
      </div>

      <div class="section-title">Student Details</div>
      <div class="row"><span class="label">Student Name:</span><span class="value">${receiptModal.student_name}</span></div>
      <div class="row"><span class="label">Student ID:</span><span class="value" style="font-family: monospace;">${receiptModal.student_id}</span></div>
      ${receiptModal.student_phone ? `<div class="row"><span class="label">Phone:</span><span class="value">${receiptModal.student_phone}</span></div>` : ''}
      ${receiptModal.guardian_phone ? `<div class="row"><span class="label">Guardian Phone:</span><span class="value">${receiptModal.guardian_phone}</span></div>` : ''}

      <div class="section-title">Payment Info</div>
      <div class="row"><span class="label">Batch / Program:</span><span class="value">${receiptModal.batch_name}</span></div>
      <div class="row"><span class="label">Payment Type:</span><span class="value" style="text-transform: capitalize;">${receiptModal.payment_for} Fee</span></div>
      ${receiptModal.payment_month ? `<div class="row"><span class="label">Month:</span><span class="value">${receiptModal.payment_month}</span></div>` : ''}
      <div class="row"><span class="label">Payment Method:</span><span class="value">${receiptModal.payment_method}</span></div>
      ${receiptModal.referral_name ? `<div class="row"><span class="label">Referral By:</span><span class="value" style="color: #7e22ce; font-weight: bold;">${receiptModal.referral_name}</span></div>` : ''}
      ${receiptModal.referral_reason ? `<div class="row"><span class="label">Referral Reason:</span><span class="value" style="color: #6b21a8; font-style: italic;">${receiptModal.referral_reason}</span></div>` : ''}
      <div class="row"><span class="label">Payment Date:</span><span class="value">${receiptModal.paid_at}</span></div>

      <div class="summary-box">
        <div class="row"><span class="label">Billed Amount:</span><span class="value">৳${receiptModal.total_amount.toLocaleString("en-BD")}</span></div>
        ${receiptModal.discount > 0 ? `<div class="row"><span class="label">Discount:</span><span class="value" style="color: #dc2626;">-৳${receiptModal.discount.toLocaleString("en-BD")}</span></div>` : ''}
        <div class="total-row"><span>Total Paid:</span><span>৳${receiptModal.paid_amount.toLocaleString("en-BD")}</span></div>
      </div>

      <div class="qr-container">
        <div>
          <p style="margin: 0; font-size: 11px; font-weight: bold; color: #334155;">Verification QR</p>
          <p style="margin: 3px 0 0; font-size: 10px; color: #64748b;">Scan to verify receipt authenticity</p>
        </div>
        <img src="${qrUrl}" width="80" height="80" alt="QR Code" style="border-radius: 6px; border: 1px solid #cbd5e1;" />
      </div>

      <div class="footer">
        <p>Thank you for your payment!</p>
        <p>MedhaShiree — Empowering Modern Education</p>
      </div>
    </body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 300)
  }

  // Download PDF using jsPDF
  async function handleDownloadPDF() {
    if (!receiptModal) return
    try {
      const { jsPDF } = await import("jspdf")
      const doc = new jsPDF({ unit: "mm", format: [105, 148] }) // A6 size receipt

      doc.setFont("helvetica", "bold")
      doc.setFontSize(14)
      doc.setTextColor(5, 150, 105)
      doc.text("MedhaShiree Coaching", 52.5, 12, { align: "center" })

      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text("Official Fee Payment Receipt", 52.5, 17, { align: "center" })
      doc.line(10, 20, 95, 20)

      let y = 26
      doc.setFontSize(9)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(15, 23, 42)
      doc.text("Receipt No: " + receiptModal.receipt_number, 10, y)
      y += 5
      doc.setFont("helvetica", "normal")
      doc.text("Student ID: " + receiptModal.student_id, 10, y)
      y += 5
      doc.text("Name: " + receiptModal.student_name, 10, y)
      y += 5
      if (receiptModal.student_phone) {
        doc.text("Phone: " + receiptModal.student_phone, 10, y)
        y += 5
      }

      doc.setFont("helvetica", "bold")
      doc.text("Batch: " + receiptModal.batch_name, 10, y)
      y += 5
      doc.setFont("helvetica", "normal")
      doc.text("Payment For: " + receiptModal.payment_for.toUpperCase() + (receiptModal.payment_month ? ` (${receiptModal.payment_month})` : ""), 10, y)
      y += 5
      doc.text("Method: " + receiptModal.payment_method + "  |  Date: " + receiptModal.paid_at, 10, y)
      y += 5

      if (receiptModal.referral_name) {
        doc.setFont("helvetica", "bold")
        doc.setTextColor(126, 34, 206)
        doc.text("Referral By: " + receiptModal.referral_name, 10, y)
        y += 4
        if (receiptModal.referral_reason) {
          doc.setFont("helvetica", "italic")
          doc.text("Reason: " + receiptModal.referral_reason, 10, y)
          y += 4
        }
        doc.setFont("helvetica", "normal")
        doc.setTextColor(15, 23, 42)
      }
      y += 2

      doc.setFillColor(240, 253, 244)
      doc.roundedRect(10, y, 85, 20, 2, 2, "F")
      doc.text("Amount Billed: ৳" + receiptModal.total_amount.toLocaleString("en-BD"), 13, y + 6)
      if (receiptModal.discount > 0) {
        doc.setTextColor(220, 38, 38)
        doc.text("Discount: -৳" + receiptModal.discount.toLocaleString("en-BD"), 13, y + 11)
        doc.setTextColor(5, 150, 105)
      } else {
        doc.setTextColor(5, 150, 105)
      }
      doc.setFont("helvetica", "bold")
      doc.text("Total Paid: ৳" + receiptModal.paid_amount.toLocaleString("en-BD"), 13, y + 16)

      y += 24
      // QR Code
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(receiptModal.qr_data)}`
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

      doc.save(`Receipt_${receiptModal.receipt_number}.pdf`)
      toast.success("Receipt PDF downloaded!")
    } catch (e: any) {
      toast.error("Could not download PDF: " + (e?.message || "Please use print"))
    }
  }

  const inputClass = "w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-2xs transition-all"

  // Financial access guard
  if (!hasAccess) {
    return (
      <div className="bg-white border border-red-500/30 rounded-2xl p-8 text-center shadow-xl backdrop-blur-md">
        <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-red-400 mb-1">Financial Access Required</h3>
        <p className="text-sm text-slate-400">You don&apos;t have financial access to record payments. Contact the Owner.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Search & Record Payment Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 shadow-xl flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={searchQuery}
            onChange={e => { 
              setSearchQuery(e.target.value)
              setSelectedStudent(null)
              setPayingDue(null) 
            }}
            placeholder="Search student by name, student ID (MS-XXXXX), or phone..."
            className="w-full pl-10 pr-4 py-2.5 text-sm text-white border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-950 placeholder:text-slate-500 hover:border-slate-600 transition-all"
          />

          {/* Search dropdown results */}
          {filteredStudents.length > 0 && !selectedStudent && (
            <div className="absolute z-30 top-full left-0 right-0 mt-1.5 bg-slate-900 rounded-2xl border border-slate-200 shadow-2xl max-h-72 overflow-y-auto divide-y divide-slate-100">
              {filteredStudents.map(s => {
                const sDues = dues.filter(d => d.student_id === s.id)
                const totalDue = sDues.reduce((sum, d) => sum + Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0)), 0)
                return (
                  <button 
                    key={s.id} 
                    type="button"
                    onClick={() => handleSelectStudent(s)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-800/80 flex items-center justify-between transition-colors"
                  >
                    <div>
                      <p className="text-sm font-bold text-white">{s.name}</p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        <span className="text-amber-400 font-semibold">{s.student_id}</span> {s.phone ? `• ${s.phone}` : ""}
                      </p>
                    </div>
                    {totalDue > 0 ? (
                      <span className="text-xs font-bold text-red-400 bg-red-950/40 border border-red-800/50 px-2.5 py-1 rounded-lg">
                        Due: {formatCurrency(totalDue)}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-lg">
                        Clear
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <button 
          type="button"
          onClick={() => setShowGatewayModal(true)} 
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-purple-900/30 hover:shadow-xl transition-all whitespace-nowrap cursor-pointer"
        >
          <Smartphone className="w-4 h-4" /> Payment Numbers (bKash/Nagad)
        </button>

        <button 
          type="button"
          onClick={openRecordModal} 
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-500/20 hover:shadow-xl transition-all whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Record Payment
        </button>
      </div>

      {/* Selected Student Hub: Dues, Due Modifier, & Payment History */}
      {selectedStudent && (
        <div className="bg-slate-900/95 rounded-3xl border border-amber-500/30 shadow-2xl overflow-hidden space-y-5 animate-in fade-in zoom-in-98 duration-150 backdrop-blur-md">
          {/* Student Header Bar */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-amber-500/30 p-5 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center font-bold text-lg text-amber-400 shadow-inner">
                <User className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-xl text-slate-900">{selectedStudent.name}</h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-xs font-semibold border border-amber-500/30">
                    {selectedStudent.student_id}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedStudent.phone ? `Phone: ${selectedStudent.phone}` : "No phone"} 
                  {selectedStudent.guardian_phone ? ` • Guardian: ${selectedStudent.guardian_phone}` : ""}
                </p>
              </div>
            </div>
            <button 
              type="button"
              onClick={() => { setSelectedStudent(null); setPayingDue(null) }} 
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-white"
              title="Clear Selection"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* 1. Pending Dues Section with Edit / Change Dues */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Pending Dues ({studentDues.length})
                  </h4>
                </div>
                <span className="text-xs text-slate-400">Click a due to collect payment or modify its terms</span>
              </div>

              {studentDues.length === 0 ? (
                <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-2xl p-4 flex items-center gap-2.5 text-emerald-300 text-sm font-semibold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  No outstanding dues for {selectedStudent.name}! All fee payments are up to date.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {studentDues.map(d => {
                    const outstanding = Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0))
                    const isSelected = payingDue?.id === d.id
                    return (
                      <div 
                        key={d.id} 
                        className={`p-4 rounded-2xl border transition-all relative ${
                          isSelected 
                            ? "border-amber-500 bg-amber-500/10 shadow-lg ring-2 ring-amber-500/30 text-white" 
                            : "border-slate-200 bg-slate-50 hover:border-amber-500/40 hover:shadow-md text-white"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="cursor-pointer flex-1" onClick={() => selectDueToPay(d)}>
                            <p className="font-bold text-slate-900 text-sm">{getBatchName(d.batch)}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Month: <b className="text-slate-200">{d.due_month}</b> • Deadline: <span className="text-amber-400 font-medium">{formatDate(d.due_date)}</span>
                            </p>
                            <div className="mt-2 flex items-baseline gap-2">
                              <span className="text-base font-extrabold text-red-400">{formatCurrency(outstanding)}</span>
                              <span className="text-xs text-slate-500">total due: {formatCurrency(d.due_amount)}</span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2 shrink-0">
                            {/* Edit / Change Due Button */}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openEditDue(d) }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-950/50 hover:bg-indigo-900/60 px-2.5 py-1 rounded-lg border border-indigo-800/50 transition-colors"
                              title="Modify due amount or deadline"
                            >
                              <Edit2 className="w-3 h-3" /> Change Due
                            </button>

                            <button
                              type="button"
                              onClick={() => selectDueToPay(d)}
                              className={`text-[11px] font-bold px-3 py-1 rounded-lg transition-colors ${
                                isSelected 
                                  ? "bg-amber-500 text-slate-950" 
                                  : "bg-slate-800 text-slate-200 hover:bg-amber-500 hover:text-slate-950"
                              }`}
                            >
                              {isSelected ? "Selected ✓" : "Pay Due"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Pay Selected Due Form (when due clicked) */}
            {payingDue && (
              <div className="bg-white border border-slate-300 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-amber-400">
                    <DollarSign className="w-4 h-4 text-amber-400" />
                    Pay Due for {getBatchName(payingDue.batch)} ({payingDue.due_month})
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setPayingDue(null)}
                    className="text-xs text-slate-400 hover:text-slate-200 font-bold"
                  >
                    Cancel Selection ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Pay Amount (৳)</label>
                    <input 
                       type="number" 
                      value={form.amount} 
                      onChange={e => update("amount", e.target.value)} 
                      className={`${inputClass} font-bold text-emerald-400`} 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Discount (৳)</label>
                    <input 
                      type="number" 
                      value={form.discount} 
                      onChange={e => update("discount", e.target.value)} 
                      className={inputClass} 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Method</label>
                    <select 
                      value={form.payment_method} 
                      onChange={e => update("payment_method", e.target.value)} 
                      className={inputClass}
                    >
                      <option value="cash">Cash</option>
                      <option value="bkash">bKash</option>
                      <option value="nagad">Nagad</option>
                      <option value="card">Card</option>
                      <option value="bank">Bank Transfer</option>
                      <option value="referral">Referral (রেফারেল)</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button 
                      type="button"
                      onClick={() => handlePay()} 
                      disabled={loading} 
                      className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl text-sm font-bold hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {loading ? "Processing..." : `Record & Get PDF`}
                    </button>
                  </div>
                </div>

                {form.payment_method === "referral" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-purple-950/30 rounded-2xl border border-purple-800/50 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider mb-1">
                        Referral Name / Student ID *
                      </label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. Tanvir Ahmed (MS-10023)"
                        value={form.referral_name} 
                        onChange={e => update("referral_name", e.target.value)} 
                        className="w-full px-3 py-2 bg-slate-900 border border-purple-700/60 rounded-xl text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-purple-500" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider mb-1">
                        Reason for Referral Payment *
                      </label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. Referral reward / discount / bonus adjustment"
                        value={form.referral_reason} 
                        onChange={e => update("referral_reason", e.target.value)} 
                        className="w-full px-3 py-2 bg-slate-900 border border-purple-700/60 rounded-xl text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-purple-500" 
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. All Payment History of This Student */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Payment History of {selectedStudent.name} ({studentPayments.length})
                </h4>
              </div>

              {studentPayments.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  No payment records found for this student.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-lg bg-slate-950">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 border-b border-slate-200 text-slate-400 uppercase font-semibold">
                      <tr>
                        <th className="px-3.5 py-2.5">Receipt #</th>
                        <th className="px-3.5 py-2.5">Batch</th>
                        <th className="px-3.5 py-2.5">Amount</th>
                        <th className="px-3.5 py-2.5">Method</th>
                        <th className="px-3.5 py-2.5">For</th>
                        <th className="px-3.5 py-2.5">Date</th>
                        <th className="px-3.5 py-2.5 text-right">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {studentPayments.map(p => (
                        <tr key={p.id} className="hover:bg-slate-900/50 transition-colors">
                          <td className="px-3.5 py-2.5 font-mono font-bold text-amber-400">{p.receipt_number}</td>
                          <td className="px-3.5 py-2.5 font-medium text-slate-200">{p.batch?.name || "—"}</td>
                          <td className="px-3.5 py-2.5 font-bold text-emerald-400">
                            {formatCurrency(p.total_paid)}
                            {p.discount > 0 && <span className="text-[10px] text-slate-500 block font-normal">disc: {formatCurrency(p.discount)}</span>}
                          </td>
                          <td className="px-3.5 py-2.5">
                            {(() => {
                              const isRef = p.payment_method?.toLowerCase() === "referral" || (p.notes && p.notes.toLowerCase().includes("referral"))
                              const refInfo = parseReferralNotes(p.notes)
                              return isRef ? (
                                <div className="space-y-0.5">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950/60 text-purple-300 uppercase border border-purple-800 inline-block">
                                    Referral
                                  </span>
                                  {refInfo.referral_name && (
                                    <p className="text-[10px] font-bold text-purple-300 leading-tight">
                                      Ref: {refInfo.referral_name}
                                    </p>
                                  )}
                                  {refInfo.referral_reason && (
                                    <p className="text-[9px] text-purple-400 italic leading-tight">
                                      {refInfo.referral_reason}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/60 text-blue-300 uppercase border border-blue-800/60">
                                  {p.payment_method}
                                </span>
                              )
                            })()}
                          </td>
                          <td className="px-3.5 py-2.5 capitalize text-slate-300">{p.payment_for}</td>
                          <td className="px-3.5 py-2.5 text-slate-400">{formatDateTime(p.paid_at)}</td>
                          <td className="px-3.5 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => printExistingReceipt(p)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 transition-all text-[11px]"
                            >
                              <Printer className="w-3.5 h-3.5" /> PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Payments History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden space-y-3">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Recent Payments Log</h3>
            <p className="text-xs text-slate-400 mt-0.5">Showing last 100 payments recorded across all batches</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="px-4 py-3">Receipt</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">For</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Print / Save</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {payments.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-500">No payments recorded yet</td></tr>
              ) : (
                payments.map(p => (
                  <tr key={p.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-amber-400">{p.receipt_number}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900 text-sm">{p.student?.name}</p>
                      <span className="text-xs font-mono text-slate-400">{p.student?.student_id}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{p.batch?.name || "—"}</td>
                    <td className="px-4 py-3 font-extrabold text-emerald-400">
                      {formatCurrency(p.total_paid)}
                      {p.discount > 0 && <span className="text-xs text-slate-500 block font-normal">disc: {formatCurrency(p.discount)}</span>}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const isRef = p.payment_method?.toLowerCase() === "referral" || (p.notes && p.notes.toLowerCase().includes("referral"))
                        const refInfo = parseReferralNotes(p.notes)
                        return isRef ? (
                          <div className="space-y-0.5">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-950/60 text-purple-300 border border-purple-800/60 uppercase inline-block">
                              Referral
                            </span>
                            {refInfo.referral_name && (
                              <p className="text-xs font-bold text-purple-300">
                                By: {refInfo.referral_name}
                              </p>
                            )}
                            {refInfo.referral_reason && (
                              <p className="text-[11px] text-purple-400 italic">
                                Reason: {refInfo.referral_reason}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-950/60 text-blue-300 border border-blue-800/60 uppercase">
                            {p.payment_method}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300 capitalize">{p.payment_for}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{formatDateTime(p.paid_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        type="button"
                        onClick={() => printExistingReceipt(p)}
                        className="p-2 text-slate-300 hover:text-amber-400 hover:bg-slate-800 border border-slate-700 rounded-xl transition-all"
                        title="Print / Download PDF"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal (Searchable Student Entry) */}
      {showRecordModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full text-slate-900 max-w-lg shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 text-white">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-200 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-amber-500/20 rounded-xl flex items-center justify-center border border-amber-500/30 text-amber-400">
                  <CreditCard className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Record Payment</h3>
                  <p className="text-xs text-slate-400">Search student and record counter payment</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowRecordModal(false)} 
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handlePay} className="p-6 space-y-4">
              {/* Searchable Student Field */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Search & Select Student *
                </label>
                
                {modalSelectedStudent ? (
                  <div className="flex items-center justify-between p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl">
                    <div>
                      <p className="text-sm font-bold text-emerald-300">{modalSelectedStudent.name}</p>
                      <p className="text-xs text-emerald-400 font-mono">{modalSelectedStudent.student_id} {modalSelectedStudent.phone ? `• ${modalSelectedStudent.phone}` : ""}</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => { setModalSelectedStudent(null); update("student_id", "") }}
                      className="text-red-400 hover:text-red-300 font-bold text-xs"
                    >
                      Change ✕
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={modalSearchQuery}
                      onChange={e => setModalSearchQuery(e.target.value)}
                      placeholder="Type student name or ID..."
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      autoFocus
                    />
                    {modalFilteredStudents.length > 0 && (
                      <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-slate-900 rounded-xl border border-slate-200 shadow-2xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {modalFilteredStudents.map(s => (
                          <button
                            type="button"
                            key={s.id}
                            onClick={() => handleModalSelectStudent(s)}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-slate-800 text-sm flex items-center justify-between"
                          >
                            <span className="font-bold text-slate-900">{s.name}</span>
                            <span className="text-xs text-amber-400 font-mono">{s.student_id}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Batch selection */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Batch / Program</label>
                <select 
                  value={form.batch_id} 
                  onChange={e => { 
                    update("batch_id", e.target.value)
                    const b = batches.find(x => x.id === e.target.value)
                    if (b) update("amount", String(b.monthly_fee))
                  }} 
                  className={inputClass}
                >
                  <option value="">-- General / Optional --</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({formatCurrency(b.monthly_fee)}/mo)
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount & Discount */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Amount (৳) *</label>
                  <input 
                    type="number" 
                    required 
                    value={form.amount} 
                    onChange={e => update("amount", e.target.value)} 
                    className={`${inputClass} font-bold text-emerald-400 text-base`} 
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Discount (৳)</label>
                  <input 
                    type="number" 
                    value={form.discount} 
                    onChange={e => update("discount", e.target.value)} 
                    className={inputClass} 
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Total Summary preview */}
              {form.amount && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-200 text-xs font-bold text-amber-400 flex items-center justify-between">
                  <span className="text-slate-400">Net Payable Amount:</span>
                  <span className="text-base text-amber-400">{formatCurrency(Math.max(0, parseFloat(form.amount || "0") - parseFloat(form.discount || "0")))}</span>
                </div>
              )}

              {/* Payment Method & Type */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Payment Method</label>
                  <select 
                    value={form.payment_method} 
                    onChange={e => update("payment_method", e.target.value)} 
                    className={inputClass}
                  >
                    <option value="cash">Cash Counter</option>
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                    <option value="card">Card POS</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="referral">Referral Adjustment (রেফারেল)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Payment For</label>
                  <select 
                    value={form.payment_for} 
                    onChange={e => update("payment_for", e.target.value)} 
                    className={inputClass}
                  >
                    <option value="monthly">Monthly Fee</option>
                    <option value="admission">Admission Fee</option>
                    <option value="quarterly">Quarterly Fee</option>
                    <option value="material">Exam / Material</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {form.payment_method === "referral" && (
                <div className="p-3.5 bg-purple-950/30 rounded-2xl border border-purple-800/50 space-y-3 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider mb-1">
                      Referral Student Name / ID *
                    </label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Tanvir Ahmed (MS-10023)"
                      value={form.referral_name} 
                      onChange={e => update("referral_name", e.target.value)} 
                      className="w-full px-3 py-2 bg-slate-900 border border-purple-700/60 rounded-xl text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-purple-500" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider mb-1">
                      Reason for Referral Payment *
                    </label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Referral reward / discount for student enrollment"
                      value={form.referral_reason} 
                      onChange={e => update("referral_reason", e.target.value)} 
                      className="w-full px-3 py-2 bg-slate-900 border border-purple-700/60 rounded-xl text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-purple-500" 
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowRecordModal(false)} 
                  className="flex-1 py-2.5 border border-slate-700 text-slate-300 rounded-xl font-semibold hover:bg-slate-800 text-sm transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading || (!form.student_id && !modalSelectedStudent)} 
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 text-sm transition-all disabled:opacity-40"
                >
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Recording...</> : "Record & Get PDF"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit / Change Due Modal */}
      {editingDue && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full text-slate-900 max-w-md shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 text-white">
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-200 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-indigo-500/20 border border-indigo-500/30 rounded-xl flex items-center justify-center text-indigo-400">
                  <Edit2 className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Change Student Due</h3>
                  <p className="text-xs text-slate-400">{getBatchName(editingDue.batch)} ({editingDue.due_month})</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setEditingDue(null)} 
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDueEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Due Amount (৳)</label>
                <input 
                  type="number" 
                  min="0"
                  required
                  value={editDueAmount} 
                  onChange={e => setEditDueAmount(e.target.value)} 
                  className={`${inputClass} font-bold text-amber-400 text-base`} 
                />
                <p className="text-[11px] text-slate-500 mt-1">Already paid towards this due: {formatCurrency(editingDue.paid_amount || 0)}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Deadline / Due Date</label>
                <input 
                  type="date" 
                  value={editDueDate} 
                  onChange={e => setEditDueDate(e.target.value)} 
                  className={inputClass} 
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setEditingDue(null)} 
                  className="flex-1 py-2.5 border border-slate-700 text-slate-300 rounded-xl font-semibold hover:bg-slate-800 text-sm transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={dueUpdating} 
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 text-sm transition-all disabled:opacity-50"
                >
                  {dueUpdating ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</> : "Update Due"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Instant Printable & Downloadable PDF Receipt Modal */}
      {receiptModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full text-slate-900 max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 text-white">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-200 p-5 text-white text-center relative">
              <button 
                type="button"
                onClick={() => setReceiptModal(null)}
                className="absolute right-4 top-4 p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-11 h-11 bg-amber-500/20 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-2 text-amber-400">
                <Check className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Payment Receipt Ready</h3>
              <p className="text-xs text-slate-400">Print receipt or download PDF for student records</p>
            </div>

            {/* Slip Preview (Optimized clean background for crystal clear print & PDF capture) */}
            <div className="p-6 space-y-4">
              <div ref={receiptRef} className="border border-slate-200 rounded-2xl p-4 bg-white text-slate-900 space-y-3 shadow-inner">
                <div className="text-center border-b border-dashed border-gray-300 pb-2.5">
                  <h4 className="font-extrabold text-slate-900 text-sm">MedhaShiree Coaching</h4>
                  <p className="text-[10px] text-gray-500">Official Fee Payment Receipt</p>
                  <span className="inline-block bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 font-mono">
                    {receiptModal.receipt_number}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-gray-500">Student Name:</span><span className="font-bold text-gray-800">{receiptModal.student_name}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Student ID:</span><span className="font-mono text-gray-700">{receiptModal.student_id}</span></div>
                  {receiptModal.student_phone && <div className="flex justify-between"><span className="text-gray-500">Phone:</span><span className="text-gray-700">{receiptModal.student_phone}</span></div>}
                  <div className="flex justify-between"><span className="text-gray-500">Program / Batch:</span><span className="font-semibold text-slate-800">{receiptModal.batch_name}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Payment For:</span><span className="text-gray-700 capitalize">{receiptModal.payment_for} Fee</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Method:</span><span className="font-medium text-gray-700">{receiptModal.payment_method}</span></div>
                  {receiptModal.referral_name && (
                    <div className="flex justify-between text-purple-800 font-semibold bg-purple-50 px-2 py-1 rounded-lg">
                      <span className="text-purple-600">Referral Name:</span>
                      <span>{receiptModal.referral_name}</span>
                    </div>
                  )}
                  {receiptModal.referral_reason && (
                    <div className="flex justify-between text-purple-800 text-[11px] bg-purple-50 px-2 py-1 rounded-lg">
                      <span className="text-purple-600">Reason:</span>
                      <span className="italic">{receiptModal.referral_reason}</span>
                    </div>
                  )}
                  <div className="flex justify-between"><span className="text-gray-500">Date:</span><span className="text-gray-700">{receiptModal.paid_at}</span></div>
                </div>

                <div className="border-t border-dashed border-gray-300 pt-2.5 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-gray-500">Amount Billed:</span><span>{formatCurrency(receiptModal.total_amount)}</span></div>
                  {receiptModal.discount > 0 && (
                    <div className="flex justify-between text-red-600 font-medium">
                      <span>Discount:</span><span>-{formatCurrency(receiptModal.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-extrabold text-emerald-700 pt-1">
                    <span>Total Paid:</span><span>{formatCurrency(receiptModal.paid_amount)}</span>
                  </div>
                </div>

                {/* QR Code */}
                <div className="pt-2 border-t border-dashed border-gray-300 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-700">Verification QR</p>
                    <p className="text-[9px] text-gray-400">Scan to verify receipt</p>
                  </div>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(receiptModal.qr_data)}`}
                    alt="Receipt QR"
                    className="w-14 h-14 border border-gray-200 rounded-lg p-0.5 bg-white"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="py-2.5 bg-slate-800 border border-slate-700 text-white rounded-xl font-bold hover:bg-slate-700 flex items-center justify-center gap-1.5 text-xs shadow-md transition-all"
                >
                  <Printer className="w-4 h-4" /> Print Receipt
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  className="py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 text-xs shadow-lg shadow-amber-500/20 transition-all"
                >
                  <Download className="w-4 h-4" /> Save PDF
                </button>
              </div>

              <button
                type="button"
                onClick={() => setReceiptModal(null)}
                className="w-full py-2 border border-slate-700 text-slate-300 rounded-xl font-semibold hover:bg-slate-100 text-xs text-slate-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Gateway Numbers Modal (Owner Configurable) */}
      {showGatewayModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 backdrop-blur-md">
          <div className="bg-slate-900 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 text-white">
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-200 p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                  <Smartphone className="w-5 h-5 text-purple-300" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Payment Gateway Numbers</h3>
                  <p className="text-xs text-slate-400">Shown to students on batch &amp; course checkout pages</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGatewayModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGatewayNumbers} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* bKash */}
              <div className="p-4 rounded-2xl border border-pink-900/40 bg-pink-950/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-pink-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-pink-500"></span>
                    bKash Number &amp; Account
                  </span>
                  <span className="text-[10px] font-semibold text-pink-300 bg-pink-900/40 px-2 py-0.5 rounded-md border border-pink-800/40">Dial *247#</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Account Number *</label>
                    <input
                      type="text"
                      required
                      value={gatewayNumbers.bkash}
                      onChange={e => setGatewayNumbers(prev => ({ ...prev, bkash: e.target.value }))}
                      placeholder="01XXXXXXXXX"
                      className="w-full px-3 py-2 text-sm font-mono border border-pink-900/60 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-pink-500 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Account Type</label>
                    <input
                      type="text"
                      value={gatewayNumbers.bkash_type}
                      onChange={e => setGatewayNumbers(prev => ({ ...prev, bkash_type: e.target.value }))}
                      placeholder="e.g. Send Money (Personal)"
                      className="w-full px-3 py-2 text-xs border border-pink-900/60 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-pink-500 text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>

              {/* Nagad */}
              <div className="p-4 rounded-2xl border border-orange-900/40 bg-orange-950/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    Nagad Number &amp; Account
                  </span>
                  <span className="text-[10px] font-semibold text-orange-300 bg-orange-900/40 px-2 py-0.5 rounded-md border border-orange-800/40">Dial *167#</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Account Number *</label>
                    <input
                      type="text"
                      required
                      value={gatewayNumbers.nagad}
                      onChange={e => setGatewayNumbers(prev => ({ ...prev, nagad: e.target.value }))}
                      placeholder="01XXXXXXXXX"
                      className="w-full px-3 py-2 text-sm font-mono border border-orange-900/60 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Account Type</label>
                    <input
                      type="text"
                      value={gatewayNumbers.nagad_type}
                      onChange={e => setGatewayNumbers(prev => ({ ...prev, nagad_type: e.target.value }))}
                      placeholder="e.g. Send Money (Personal)"
                      className="w-full px-3 py-2 text-xs border border-orange-900/60 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>

              {/* Rocket */}
              <div className="p-4 rounded-2xl border border-purple-900/40 bg-purple-950/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    Rocket Number &amp; Account
                  </span>
                  <span className="text-[10px] font-semibold text-purple-300 bg-purple-900/40 px-2 py-0.5 rounded-md border border-purple-800/40">Dial *322#</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Account Number *</label>
                    <input
                      type="text"
                      required
                      value={gatewayNumbers.rocket}
                      onChange={e => setGatewayNumbers(prev => ({ ...prev, rocket: e.target.value }))}
                      placeholder="01XXXXXXXXX"
                      className="w-full px-3 py-2 text-sm font-mono border border-purple-900/60 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Account Type</label>
                    <input
                      type="text"
                      value={gatewayNumbers.rocket_type}
                      onChange={e => setGatewayNumbers(prev => ({ ...prev, rocket_type: e.target.value }))}
                      placeholder="e.g. Send Money (Personal)"
                      className="w-full px-3 py-2 text-xs border border-purple-900/60 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>

              {/* Upay */}
              <div className="p-4 rounded-2xl border border-teal-900/40 bg-teal-950/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                    Upay Number &amp; Account
                  </span>
                  <span className="text-[10px] font-semibold text-teal-300 bg-teal-900/40 px-2 py-0.5 rounded-md border border-teal-800/40">Dial *268#</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Account Number *</label>
                    <input
                      type="text"
                      required
                      value={gatewayNumbers.upay}
                      onChange={e => setGatewayNumbers(prev => ({ ...prev, upay: e.target.value }))}
                      placeholder="01XXXXXXXXX"
                      className="w-full px-3 py-2 text-sm font-mono border border-teal-900/60 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-500 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Account Type</label>
                    <input
                      type="text"
                      value={gatewayNumbers.upay_type}
                      onChange={e => setGatewayNumbers(prev => ({ ...prev, upay_type: e.target.value }))}
                      placeholder="e.g. Send Money (Personal)"
                      className="w-full px-3 py-2 text-xs border border-teal-900/60 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-500 text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGatewayModal(false)}
                  className="flex-1 py-3 border border-slate-700 rounded-xl text-slate-300 font-semibold hover:bg-slate-800 transition-colors text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingGateways}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold shadow-lg shadow-amber-500/20 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingGateways ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Save Payment Numbers
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
