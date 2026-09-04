"use client"
import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Loader2, UserPlus, BookOpen, CreditCard, Check, Lock, Search, ShieldAlert, AlertCircle, Printer, Download, RefreshCw } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { checkFinancialAccess } from "@/lib/financial-access"

interface Batch { id: string; name: string; subject?: string; class_level?: string; max_seats: number; current_seats: number; monthly_fee: number; admission_fee: number }
interface StudentOpt { id: string; name: string; student_id: string; phone?: string; email?: string; guardian_name?: string; guardian_phone?: string; address?: string; class_level?: string; school_college?: string }

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

export default function NewStudentForm({ batches, students }: { batches: Batch[]; students: StudentOpt[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [financialAccess, setFinancialAccess] = useState<boolean | null>(null)
  const [mode, setMode] = useState<"new" | "existing">("new")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStudent, setSelectedStudent] = useState<StudentOpt | null>(null)
  const [form, setForm] = useState({ name: "", phone: "", email: "", gender: "male", date_of_birth: "", guardian_name: "", guardian_phone: "", guardian_relation: "Parent", address: "", school_college: "", class_level: "", referred_by_code: "", batch_id: "", password: "", confirmPassword: "" })
  const [existingFix, setExistingFix] = useState({ guardian_name: "", guardian_phone: "", address: "", class_level: "", school_college: "" })
  const [paidAmount, setPaidAmount] = useState("")
  const [dueDate, setDueDate] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(10); return d.toISOString().split("T")[0] })
  
  const [enrolledBatchIds, setEnrolledBatchIds] = useState<string[]>([])
  
  // Post-enrollment receipt modal
  const [receipt, setReceipt] = useState<EnrollmentReceipt | null>(null)
  const receiptRef = useRef<HTMLDivElement>(null)

  useEffect(() => { checkFinancialAccess().then(({ hasAccess }) => setFinancialAccess(hasAccess)) }, [])

  // When selected student changes, fetch their enrolled batch IDs
  async function handleSelectStudent(s: StudentOpt | null) {
    setSelectedStudent(s)
    setForm(prev => ({ ...prev, batch_id: "" }))
    if (!s) {
      setEnrolledBatchIds([])
      return
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

  const batch = batches.find(b => b.id === form.batch_id)
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

  if (financialAccess === false) return (
    <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-2xl p-8 text-center shadow-sm">
      <ShieldAlert className="w-10 h-10 text-red-400 mx-auto mb-2" />
      <h3 className="font-bold text-red-700">Financial Access Required</h3>
      <p className="text-sm text-red-600 mt-1">Contact the owner to get financial access.</p>
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

      // Add enrollment
      const { error: eErr } = await supabase.from("enrollments").insert({ student_id: sid, batch_id: form.batch_id })
      if (eErr) {
        if (eErr.code === "23505" || eErr.message.includes("unique constraint") || eErr.message.includes("duplicate key")) {
          toast.error(`Student is already enrolled in ${batch?.name || "this batch"}!`)
          setLoading(false)
          return
        }
        throw new Error(eErr.message)
      }

      // Update seats count
      if (batch) await supabase.from("batches").update({ current_seats: batch.current_seats + 1 }).eq("id", form.batch_id)

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
        const { data: r } = await supabase.from("students").select("id").eq("referral_code", form.referred_by_code.trim()).maybeSingle()
        if (r) {
          await supabase.from("referrals").insert({ referrer_id: r.id, referee_id: sid, commission_rate: 10 })
          await supabase.from("students").update({ referred_by_student_id: r.id }).eq("id", sid)
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

    } catch (err: any) {
      toast.error(err?.message || "Failed")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Print function
  function handlePrint() {
    if (!receipt) return
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(receipt.qr_data)}`
    const win = window.open("", "_blank", "width=650,height=800")
    if (!win) return
    win.document.write(`<html><head><title>Admission Document - ${receipt.student_id}</title><style>
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
      <div class="row"><span class="label">Student ID:</span><span class="value">${receipt.student_id}</span></div>
      <div class="row"><span class="label">Full Name:</span><span class="value">${receipt.student_name}</span></div>
      ${receipt.student_phone ? `<div class="row"><span class="label">Phone:</span><span class="value">${receipt.student_phone}</span></div>` : ''}
      ${receipt.guardian_name ? `<div class="row"><span class="label">Guardian:</span><span class="value">${receipt.guardian_name}</span></div>` : ''}
      ${receipt.guardian_phone ? `<div class="row"><span class="label">Guardian Phone:</span><span class="value">${receipt.guardian_phone}</span></div>` : ''}

      ${receipt.password ? `
      <div class="cred-box">
        <div class="row"><span class="label" style="color: #4338ca; font-weight: 600;">Student Portal Login ID:</span><span class="value">${receipt.student_id}</span></div>
        <div class="row"><span class="label" style="color: #4338ca; font-weight: 600;">Account Password:</span><span class="value font-mono" style="color: #4338ca;">${receipt.password}</span></div>
      </div>
      ` : ''}

      <div class="section-title">Enrolled Program</div>
      <div class="row"><span class="label">Batch:</span><span class="value">${receipt.batch_name}</span></div>
      <div class="row"><span class="label">Subject/Class:</span><span class="value">${receipt.subject}</span></div>
      <div class="row"><span class="label">Enrollment Date:</span><span class="value">${receipt.date}</span></div>

      <div class="section-title">Payment Breakdown</div>
      <div class="summary-box">
        <div class="row"><span class="label">Total Fee:</span><span class="value">৳${receipt.total_fee.toLocaleString("en-BD")}</span></div>
        <div class="row"><span class="label">Paid Amount:</span><span class="value paid-text">৳${receipt.paid_amount.toLocaleString("en-BD")}</span></div>
        <div class="total-row"><span class="label">Due Amount:</span><span class="value ${receipt.due_amount > 0 ? 'due-text' : 'paid-text'}">৳${receipt.due_amount.toLocaleString("en-BD")}</span></div>
        ${receipt.due_date ? `<div class="row"><span class="label">Due Date:</span><span class="value due-text">${receipt.due_date}</span></div>` : ''}
        <div class="row" style="margin-top: 5px; font-size: 11px; color: #64748b;"><span class="label">Receipt Ref:</span><span>${receipt.receipt_number}</span></div>
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
  async function handleSavePDF() {
    if (!receipt) return
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
      doc.text("Student ID: " + receipt.student_id, 10, y)
      y += 5
      doc.setFont("helvetica", "normal")
      doc.text("Name: " + receipt.student_name, 10, y)
      y += 5
      if (receipt.student_phone) {
        doc.text("Phone: " + receipt.student_phone, 10, y)
        y += 5
      }
      if (receipt.guardian_phone) {
        doc.text("Guardian Phone: " + receipt.guardian_phone, 10, y)
        y += 5
      }

      if (receipt.password) {
        doc.setFillColor(238, 242, 255)
        doc.roundedRect(10, y, 85, 10, 2, 2, "F")
        doc.setFont("helvetica", "bold")
        doc.setTextColor(67, 56, 202)
        doc.text("Login ID: " + receipt.student_id + "  |  Password: " + receipt.password, 13, y + 6)
        doc.setTextColor(15, 23, 42)
        y += 14
      }

      doc.setFont("helvetica", "bold")
      doc.text("Batch: " + receipt.batch_name, 10, y)
      y += 5
      doc.setFont("helvetica", "normal")
      doc.text("Date: " + receipt.date, 10, y)
      y += 6

      doc.setFillColor(248, 250, 252)
      doc.roundedRect(10, y, 85, 22, 2, 2, "F")
      doc.text("Total Fee: ৳" + receipt.total_fee.toLocaleString("en-BD"), 13, y + 6)
      doc.setTextColor(22, 163, 74)
      doc.text("Paid: ৳" + receipt.paid_amount.toLocaleString("en-BD"), 13, y + 11)
      doc.setTextColor(receipt.due_amount > 0 ? 220 : 22, receipt.due_amount > 0 ? 38 : 163, receipt.due_amount > 0 ? 38 : 74)
      doc.setFont("helvetica", "bold")
      doc.text("Due: ৳" + receipt.due_amount.toLocaleString("en-BD"), 13, y + 17)
      if (receipt.due_date) {
        doc.setFontSize(7)
        doc.setTextColor(180, 83, 9)
        doc.text("Due Date: " + receipt.due_date, 55, y + 17)
      }

      y += 26
      // Add QR code image
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(receipt.qr_data)}`
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

      doc.save(`Enrollment_${receipt.student_id}.pdf`)
      toast.success("PDF document downloaded!")
    } catch (e: any) {
      toast.error("Could not generate PDF: " + (e?.message || "Please use print option"))
    }
  }

  const ic = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-shadow"
  const labelCls = "block text-xs font-medium text-gray-500 mb-1"

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Mode selector */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
          <select value={mode} onChange={e => { setMode(e.target.value as "new"|"existing"); setSelectedStudent(null); setSearchQuery(""); setExistingFix({ guardian_name: "", guardian_phone: "", address: "", class_level: "", school_college: "" }) }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 bg-gradient-to-r from-indigo-50 to-white focus:ring-2 focus:ring-indigo-400 focus:outline-none cursor-pointer">
            <option value="new">➕ New Student</option>
            <option value="existing">🔍 Existing Student</option>
          </select>

          {mode === "existing" && !selectedStudent && (
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search name, ID, phone..."
                className="w-full pl-8 pr-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white" autoFocus />
              {filtered.length > 0 && (
                <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-100 shadow-xl max-h-52 overflow-y-auto">
                  {filtered.map(s => (
                    <button type="button" key={s.id} onClick={() => { handleSelectStudent(s); setSearchQuery("") }}
                      className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 text-sm border-b border-gray-50 last:border-0 transition-colors">
                      <span className="font-semibold text-gray-800">{s.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{s.student_id}</span>
                      {s.phone && <span className="text-xs text-gray-400 ml-2">• {s.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === "existing" && selectedStudent && (
            <div className="flex-1 flex items-center justify-between px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
              <div>
                <span className="text-sm font-bold text-indigo-800">{selectedStudent.name}</span>
                <span className="text-xs text-indigo-500 ml-2">{selectedStudent.student_id}</span>
                {selectedStudent.phone && <span className="text-xs text-gray-400 ml-2">• {selectedStudent.phone}</span>}
              </div>
              <button type="button" onClick={() => handleSelectStudent(null)} className="text-red-400 hover:text-red-600 text-sm font-bold ml-2 transition-colors">✕</button>
            </div>
          )}
        </div>

        {/* Existing student — missing info prompt */}
        {mode === "existing" && selectedStudent && missingFields.length > 0 && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5 mb-2"><AlertCircle className="w-3.5 h-3.5" /> Missing information — please fill in:</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
              {missingFields.includes("guardian_name") && (
                <div><label className={labelCls}>Guardian Name</label><input value={existingFix.guardian_name} onChange={e => setExistingFix(f => ({...f, guardian_name: e.target.value}))} className={ic} placeholder="Guardian name" /></div>
              )}
              {missingFields.includes("guardian_phone") && (
                <div><label className={`${labelCls} text-red-500`}>Guardian Phone *</label><input required value={existingFix.guardian_phone} onChange={e => setExistingFix(f => ({...f, guardian_phone: e.target.value}))} className={`${ic} border-red-200 focus:ring-red-400`} placeholder="01..." /></div>
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
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 space-y-3">
            {/* Personal */}
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Personal Info</p>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="col-span-2"><label className={labelCls}>Full Name *</label><input required value={form.name} onChange={e => update("name", e.target.value)} className={ic} placeholder="Student full name" /></div>
              <div><label className={labelCls}>Phone</label><input value={form.phone} onChange={e => update("phone", e.target.value)} className={ic} placeholder="01..." /></div>
            </div>
            <div className="grid grid-cols-4 gap-2.5">
              <div><label className={labelCls}>Email</label><input type="email" value={form.email} onChange={e => update("email", e.target.value)} className={ic} placeholder="Optional" /></div>
              <div><label className={labelCls}>Gender</label><select value={form.gender} onChange={e => update("gender", e.target.value)} className={ic}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
              <div><label className={labelCls}>Date of Birth</label><input type="date" value={form.date_of_birth} onChange={e => update("date_of_birth", e.target.value)} className={ic} /></div>
              <div><label className={labelCls}>Class</label><input value={form.class_level} onChange={e => update("class_level", e.target.value)} className={ic} placeholder="HSC 2025" /></div>
            </div>

            {/* Guardian */}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">Guardian</p>
              <div className="grid grid-cols-4 gap-2.5">
                <div><label className={labelCls}>Name</label><input value={form.guardian_name} onChange={e => update("guardian_name", e.target.value)} className={ic} /></div>
                <div><label className={labelCls}>Phone *</label><input required value={form.guardian_phone} onChange={e => update("guardian_phone", e.target.value)} className={ic} placeholder="01..." /></div>
                <div><label className={labelCls}>Relation</label><select value={form.guardian_relation} onChange={e => update("guardian_relation", e.target.value)} className={ic}><option>Parent</option><option>Father</option><option>Mother</option><option>Uncle</option><option>Other</option></select></div>
                <div><label className={labelCls}>Address</label><input value={form.address} onChange={e => update("address", e.target.value)} className={ic} /></div>
              </div>
            </div>

            {/* Account */}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-2 flex items-center gap-1"><Lock className="w-3 h-3" /> Login Account</p>
              <div className="grid grid-cols-4 gap-2.5">
                <div><label className={labelCls}>School / College</label><input value={form.school_college} onChange={e => update("school_college", e.target.value)} className={ic} /></div>
                <div><label className={labelCls}>Referral Code</label><input value={form.referred_by_code} onChange={e => update("referred_by_code", e.target.value)} className={ic} placeholder="Optional" /></div>
                <div><label className={labelCls}>Password *</label><input type="password" required value={form.password} onChange={e => update("password", e.target.value)} className={ic} placeholder="Min 6 chars" minLength={6} /></div>
                <div><label className={labelCls}>Confirm Password *</label><input type="password" required value={form.confirmPassword} onChange={e => update("confirmPassword", e.target.value)} className={`${ic} ${form.confirmPassword && form.password !== form.confirmPassword ? "border-red-300 focus:ring-red-400" : ""}`} placeholder="Re-enter" />
                  {form.confirmPassword && form.password !== form.confirmPassword && <p className="text-[10px] text-red-500 mt-0.5">Passwords don&apos;t match</p>}
                  {form.confirmPassword && form.password === form.confirmPassword && form.password.length >= 6 && <p className="text-[10px] text-emerald-500 mt-0.5">✓ Match</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Batch selection */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
          <p className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5 text-indigo-500" /> Select Batch *</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {batches.map(b => {
              const isEnrolled = enrolledBatchIds.includes(b.id)
              const sel = form.batch_id === b.id, full = b.current_seats >= b.max_seats
              const disabled = full || isEnrolled
              return (
                <button
                  type="button"
                  key={b.id}
                  disabled={disabled}
                  onClick={() => {
                    if (isEnrolled) return
                    update("batch_id", sel ? "" : b.id)
                    if (!sel) setPaidAmount("")
                  }}
                  className={`px-3 py-2.5 rounded-xl border text-left text-xs transition-all relative ${
                    sel
                      ? "border-indigo-400 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-md ring-1 ring-indigo-200"
                      : isEnrolled
                      ? "border-emerald-200 bg-emerald-50/60 opacity-80 cursor-not-allowed"
                      : full
                      ? "border-gray-100 opacity-40 cursor-not-allowed"
                      : "border-gray-200 hover:border-indigo-200 hover:shadow-sm"
                  }`}>
                  {sel && <Check className="float-right w-4 h-4 text-indigo-600" />}
                  {isEnrolled && (
                    <span className="float-right px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300">
                      ✓ Enrolled
                    </span>
                  )}
                  <p className={`font-bold text-[12px] ${isEnrolled ? "text-emerald-900" : "text-gray-800"}`}>{b.name}</p>
                  <p className="text-gray-400 text-[10px] mt-0.5">
                    {isEnrolled ? "Already enrolled in this batch" : `${b.current_seats}/${b.max_seats} seats • ${formatCurrency(b.monthly_fee)}/mo${b.admission_fee > 0 ? ` +${formatCurrency(b.admission_fee)}` : ""}`}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Payment */}
        {batch && (mode === "new" || selectedStudent) && (
          <div className="bg-gradient-to-r from-white to-indigo-50/30 rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
            <div className="flex items-center gap-3 text-xs mb-3">
              <CreditCard className="w-4 h-4 text-indigo-500" />
              <span className="text-gray-500">Monthly: <b className="text-gray-700">{formatCurrency(batch.monthly_fee)}</b></span>
              <span className="text-gray-500">Admission: <b className="text-gray-700">{formatCurrency(batch.admission_fee)}</b></span>
              <span className="ml-auto text-indigo-700 font-extrabold text-sm">Total: {formatCurrency(total)}</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelCls}>Paid (৳)</label><input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} className={`${ic} font-semibold`} placeholder="0" min="0" /></div>
              <div><label className={labelCls}>Due</label><div className={`px-3 py-2 rounded-lg text-sm font-bold text-center ${due > 0 ? "bg-red-50 text-red-600 border border-red-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"}`}>{formatCurrency(due)}</div></div>
              <div><label className={labelCls}>Due Date</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={ic} /></div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={() => router.back()} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 text-sm transition-colors">Cancel</button>
          <button type="submit" disabled={loading || !form.batch_id || (mode === "existing" && !selectedStudent) || (mode === "new" && form.password !== form.confirmPassword)}
            className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 disabled:opacity-40 flex items-center justify-center gap-2 text-sm shadow-lg shadow-indigo-200 transition-all">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <><UserPlus className="w-4 h-4" /> {mode === "new" ? "Create & Enroll" : "Enroll Student"}</>}
          </button>
        </div>
      </form>

      {/* Confirmation & Printable PDF Modal with QR Code */}
      {receipt && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white text-center relative">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-2 border border-white/20">
                <Check className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold">Enrollment Confirmed!</h3>
              <p className="text-xs text-indigo-100 mt-1">Ready to print, download PDF, or start next enrollment</p>
            </div>

            {/* Printable preview card */}
            <div className="p-6 space-y-4">
              <div ref={receiptRef} className="border border-indigo-100 rounded-2xl p-5 bg-slate-50 space-y-3">
                <div className="text-center border-b border-dashed border-gray-300 pb-3">
                  <h4 className="font-extrabold text-indigo-900 text-base">MedhaShiree Coaching</h4>
                  <p className="text-[11px] text-gray-500">Official Enrollment & Clearance Receipt</p>
                  <span className="inline-block bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full mt-1">
                    ID: {receipt.student_id}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-gray-500">Student Name:</span><span className="font-semibold text-gray-800">{receipt.student_name}</span></div>
                  {receipt.student_phone && <div className="flex justify-between"><span className="text-gray-500">Phone:</span><span className="font-medium text-gray-700">{receipt.student_phone}</span></div>}
                  {receipt.guardian_phone && <div className="flex justify-between"><span className="text-gray-500">Guardian Contact:</span><span className="font-medium text-gray-700">{receipt.guardian_phone}</span></div>}
                  <div className="flex justify-between"><span className="text-gray-500">Batch Enrolled:</span><span className="font-semibold text-indigo-700">{receipt.batch_name}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Date:</span><span className="text-gray-700">{receipt.date}</span></div>
                </div>

                {/* Account credentials box */}
                {receipt.password && (
                  <div className="bg-indigo-50/80 border border-indigo-100 rounded-xl p-2.5 text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-indigo-600 font-medium">Login User ID:</span><span className="font-bold text-indigo-900">{receipt.student_id}</span></div>
                    <div className="flex justify-between"><span className="text-indigo-600 font-medium">Password:</span><span className="font-mono font-bold text-indigo-900">{receipt.password}</span></div>
                  </div>
                )}

                <div className="border-t border-dashed border-gray-300 pt-3 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-gray-500">Total Program Fee:</span><span className="font-semibold">{formatCurrency(receipt.total_fee)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Amount Paid:</span><span className="font-bold text-emerald-600">{formatCurrency(receipt.paid_amount)}</span></div>
                  <div className="flex justify-between text-sm font-extrabold pt-1">
                    <span>Due Remaining:</span>
                    <span className={receipt.due_amount > 0 ? "text-red-600" : "text-emerald-600"}>{formatCurrency(receipt.due_amount)}</span>
                  </div>
                  {receipt.due_date && (
                    <div className="flex justify-between text-[11px] text-amber-700 pt-0.5">
                      <span>Due Date:</span><span>{receipt.due_date}</span>
                    </div>
                  )}
                </div>

                {/* QR Code section */}
                <div className="pt-2 border-t border-dashed border-gray-300 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-gray-700">Verification QR</p>
                    <p className="text-[10px] text-gray-400">Scan for student credentials</p>
                  </div>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(receipt.qr_data)}`}
                    alt="QR Verification"
                    className="w-16 h-16 border border-gray-200 rounded-lg p-0.5 bg-white"
                  />
                </div>
              </div>

              {/* Modal Buttons: Print, Save, New Enrollment */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 text-sm shadow-md shadow-indigo-100 transition-all">
                  <Printer className="w-4 h-4" /> Print Receipt
                </button>
                <button
                  type="button"
                  onClick={handleSavePDF}
                  className="py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 flex items-center justify-center gap-2 text-sm shadow-md shadow-emerald-100 transition-all">
                  <Download className="w-4 h-4" /> Save PDF
                </button>
              </div>

              <button
                type="button"
                onClick={resetForm}
                className="w-full py-2.5 border border-indigo-200 text-indigo-700 rounded-xl font-semibold hover:bg-indigo-50 text-sm flex items-center justify-center gap-2 transition-colors">
                <RefreshCw className="w-4 h-4" /> Enroll Another Student
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
