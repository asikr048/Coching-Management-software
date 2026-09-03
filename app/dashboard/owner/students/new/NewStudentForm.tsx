"use client"
import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Loader2, UserPlus, User, BookOpen, CreditCard, Check, Calendar, DollarSign, ShieldAlert, Search, Lock } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { checkFinancialAccess } from "@/lib/financial-access"

interface Batch {
  id: string; name: string; subject?: string; class_level?: string
  max_seats: number; current_seats: number; monthly_fee: number; admission_fee: number
}
interface StudentOpt { id: string; name: string; student_id: string; phone?: string; email?: string; guardian_name?: string; guardian_phone?: string }

export default function NewStudentForm({ batches, students }: { batches: Batch[]; students: StudentOpt[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [financialAccess, setFinancialAccess] = useState<boolean | null>(null)
  const [mode, setMode] = useState<"new" | "existing">("new")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStudent, setSelectedStudent] = useState<StudentOpt | null>(null)

  useEffect(() => {
    checkFinancialAccess().then(({ hasAccess }) => setFinancialAccess(hasAccess))
  }, [])

  if (financialAccess === false) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
        <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-red-700 mb-1">Financial Access Required</h3>
        <p className="text-sm text-red-600">You don&apos;t have financial access permission. Only the Owner can grant this.</p>
        <p className="text-xs text-red-500 mt-2">Contact the owner to get financial access to enroll students.</p>
      </div>
    )
  }

  // New student form fields
  const [form, setForm] = useState({
    name: "", phone: "", email: "", gender: "male", date_of_birth: "",
    guardian_name: "", guardian_phone: "", guardian_relation: "Parent",
    address: "", school_college: "", class_level: "",
    referred_by_code: "", batch_id: "", password: "",
  })

  const [paidAmount, setPaidAmount] = useState("")
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(10)
    return d.toISOString().split("T")[0]
  })

  function update(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  // Search existing students
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return students.filter(s =>
      s.name.toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q) || (s.phone && s.phone.includes(q))
    ).slice(0, 8)
  }, [searchQuery, students])

  const selectedBatch = batches.find(b => b.id === form.batch_id)
  const totalFee = selectedBatch ? (selectedBatch.monthly_fee + selectedBatch.admission_fee) : 0
  const paid = parseFloat(paidAmount) || 0
  const dueAmount = Math.max(0, totalFee - paid)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.batch_id) { toast.error("Please select a batch"); return }
    setLoading(true)

    try {
      let studentId: string
      let studentDisplayId: string

      if (mode === "existing") {
        // Existing student — just enroll
        if (!selectedStudent) { toast.error("Please select a student"); setLoading(false); return }
        studentId = selectedStudent.id
        studentDisplayId = selectedStudent.student_id
      } else {
        // New student — create auth + student record
        if (!form.name.trim()) { toast.error("Name is required"); setLoading(false); return }
        if (!form.guardian_phone.trim()) { toast.error("Guardian phone is required"); setLoading(false); return }
        if (!form.password || form.password.length < 6) { toast.error("Password must be at least 6 characters"); setLoading(false); return }

        // Create auth account
        const loginEmail = form.email.trim() || `student_${Date.now()}@medhashiree.local`
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: loginEmail,
          password: form.password,
        })
        if (authErr) throw new Error(authErr.message || "Failed to create account")

        // Create student record
        const { data: student, error: sErr } = await supabase.from("students").insert({
          auth_user_id: authData.user?.id || null,
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          gender: form.gender,
          date_of_birth: form.date_of_birth || null,
          guardian_name: form.guardian_name.trim() || null,
          guardian_phone: form.guardian_phone.trim(),
          guardian_relation: form.guardian_relation,
          address: form.address.trim() || null,
          school_college: form.school_college.trim() || null,
          class_level: form.class_level.trim() || null,
        }).select().single()
        if (sErr) throw new Error(sErr.message || "Failed to create student")

        studentId = student.id
        studentDisplayId = student.student_id
      }

      // Enroll in batch
      const { error: eErr } = await supabase.from("enrollments").insert({ student_id: studentId, batch_id: form.batch_id })
      if (eErr) throw new Error(eErr.message || "Failed to enroll")

      // Increment seats
      if (selectedBatch) {
        await supabase.from("batches").update({ current_seats: selectedBatch.current_seats + 1 }).eq("id", form.batch_id)
      }

      // Record payment
      if (paid > 0) {
        const { error: pErr } = await supabase.from("payments").insert({
          student_id: studentId, batch_id: form.batch_id, amount: totalFee, total_paid: paid,
          payment_method: "cash", payment_for: "admission",
          payment_month: new Date().toISOString().slice(0, 7),
          notes: `Admission - Paid: ${formatCurrency(paid)}, Due: ${formatCurrency(dueAmount)}`,
        })
        if (pErr) console.error("Payment error:", pErr.message)
      }

      // Create fee due
      if (dueAmount > 0) {
        const now = new Date()
        const { error: fErr } = await supabase.from("fee_dues").insert({
          student_id: studentId, batch_id: form.batch_id,
          due_month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
          due_amount: totalFee, paid_amount: paid, due_date: dueDate,
          status: paid > 0 ? "partial" : "pending",
        })
        if (fErr) console.error("Fee due error:", fErr.message)
      }

      // Handle referral
      if (form.referred_by_code.trim()) {
        const { data: referrer } = await supabase.from("students").select("id").eq("referral_code", form.referred_by_code.trim()).maybeSingle()
        if (referrer) {
          await supabase.from("referrals").insert({ referrer_id: referrer.id, referee_id: studentId, commission_rate: 10 })
          await supabase.from("students").update({ referred_by_student_id: referrer.id }).eq("id", studentId)
        }
      }

      const name = mode === "existing" ? selectedStudent!.name : form.name
      toast.success(`${name} enrolled! ID: ${studentDisplayId}`)
      router.push("/dashboard/owner/students")
    } catch (err: any) {
      toast.error(err?.message || "Failed")
      console.error("Enroll error:", err)
    } finally { setLoading(false) }
  }

  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Mode Selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><User className="w-4 h-4" /> Student Type</label>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => { setMode("existing"); setSelectedStudent(null); setSearchQuery("") }}
            className={`p-4 rounded-xl border-2 text-center transition-all ${mode === "existing" ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}>
            <Search className={`w-6 h-6 mx-auto mb-1 ${mode === "existing" ? "text-indigo-600" : "text-gray-400"}`} />
            <p className={`text-sm font-semibold ${mode === "existing" ? "text-indigo-700" : "text-gray-600"}`}>Existing Student</p>
            <p className="text-xs text-gray-400 mt-0.5">Search & select</p>
          </button>
          <button type="button" onClick={() => { setMode("new"); setSelectedStudent(null) }}
            className={`p-4 rounded-xl border-2 text-center transition-all ${mode === "new" ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}>
            <UserPlus className={`w-6 h-6 mx-auto mb-1 ${mode === "new" ? "text-indigo-600" : "text-gray-400"}`} />
            <p className={`text-sm font-semibold ${mode === "new" ? "text-indigo-700" : "text-gray-600"}`}>New Student</p>
            <p className="text-xs text-gray-400 mt-0.5">Create account</p>
          </button>
        </div>
      </div>

      {/* Existing Student — Search */}
      {mode === "existing" && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Search className="w-4 h-4" /> Search Student</label>
          {!selectedStudent ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name, ID, or phone..."
                className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
              {filteredStudents.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg max-h-56 overflow-y-auto">
                  {filteredStudents.map(s => (
                    <button type="button" key={s.id} onClick={() => { setSelectedStudent(s); setSearchQuery("") }}
                      className="w-full text-left px-4 py-3 hover:bg-indigo-50 flex items-center justify-between border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.student_id} {s.phone ? `• ${s.phone}` : ""}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {searchQuery.trim() && filteredStudents.length === 0 && (
                <p className="text-xs text-gray-400 mt-2">No student found. Try a different search or select &quot;New Student&quot;.</p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-xl border border-indigo-200">
              <div>
                <p className="text-sm font-bold text-indigo-800">{selectedStudent.name}</p>
                <p className="text-xs text-indigo-600">{selectedStudent.student_id} {selectedStudent.phone ? `• ${selectedStudent.phone}` : ""}</p>
                {selectedStudent.guardian_name && <p className="text-xs text-gray-500 mt-0.5">Guardian: {selectedStudent.guardian_name} ({selectedStudent.guardian_phone})</p>}
              </div>
              <button type="button" onClick={() => setSelectedStudent(null)} className="text-xs text-red-500 font-semibold hover:text-red-700 px-3 py-1 rounded-lg hover:bg-red-50">Change</button>
            </div>
          )}
        </div>
      )}

      {/* New Student — Personal Info */}
      {mode === "new" && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><User className="w-4 h-4" /> Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label><input required value={form.name} onChange={e => update("name", e.target.value)} className={inputClass} placeholder="Student full name" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Phone</label><input value={form.phone} onChange={e => update("phone", e.target.value)} className={inputClass} placeholder="01XXXXXXXXX" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Email</label><input type="email" value={form.email} onChange={e => update("email", e.target.value)} className={inputClass} placeholder="Optional" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Gender</label><select value={form.gender} onChange={e => update("gender", e.target.value)} className={inputClass}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Date of Birth</label><input type="date" value={form.date_of_birth} onChange={e => update("date_of_birth", e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Class / Level</label><input value={form.class_level} onChange={e => update("class_level", e.target.value)} className={inputClass} placeholder="e.g. HSC 2025" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">School / College</label><input value={form.school_college} onChange={e => update("school_college", e.target.value)} className={inputClass} /></div>
          </div>

          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 pt-2 border-t border-gray-100"><User className="w-4 h-4" /> Guardian Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Guardian Name</label><input value={form.guardian_name} onChange={e => update("guardian_name", e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Guardian Phone *</label><input required value={form.guardian_phone} onChange={e => update("guardian_phone", e.target.value)} className={inputClass} placeholder="01XXXXXXXXX" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Relation</label><select value={form.guardian_relation} onChange={e => update("guardian_relation", e.target.value)} className={inputClass}><option>Parent</option><option>Father</option><option>Mother</option><option>Uncle</option><option>Sibling</option><option>Other</option></select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Address</label><input value={form.address} onChange={e => update("address", e.target.value)} className={inputClass} /></div>
          </div>

          {/* Login Password */}
          <div className="pt-3 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3"><Lock className="w-4 h-4" /> Login Account</h3>
            <div className="max-w-sm">
              <label className="block text-xs font-medium text-gray-600 mb-1">Password * <span className="text-gray-400">(min 6 characters)</span></label>
              <input type="password" required value={form.password} onChange={e => update("password", e.target.value)} className={inputClass} placeholder="Student login password" minLength={6} />
              <p className="text-xs text-gray-400 mt-1">Student will login with their Student ID + this password</p>
            </div>
          </div>
        </div>
      )}

      {/* Referral Code */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <label className="block text-xs font-medium text-gray-600 mb-1">Referral Code (optional)</label>
        <input value={form.referred_by_code} onChange={e => update("referred_by_code", e.target.value)} className={`${inputClass} max-w-xs`} placeholder="e.g. A1B2C3D4" />
      </div>

      {/* Batch Selection */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3"><BookOpen className="w-4 h-4" /> Select Batch *</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {batches.map(b => {
            const isSel = form.batch_id === b.id
            const full = b.current_seats >= b.max_seats
            return (
              <button type="button" key={b.id} disabled={full}
                onClick={() => { update("batch_id", isSel ? "" : b.id); if (!isSel) setPaidAmount("") }}
                className={`relative p-4 rounded-xl border-2 text-left transition-all ${isSel ? "border-indigo-500 bg-indigo-50 shadow-md" : full ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed" : "border-gray-200 hover:border-indigo-300 hover:shadow-sm"}`}>
                {isSel && <Check className="absolute top-2 right-2 w-5 h-5 text-indigo-600" />}
                <p className="font-semibold text-gray-800 text-sm">{b.name}</p>
                <p className="text-xs text-gray-500">{b.subject || b.class_level || "General"}</p>
                <p className="text-xs text-gray-400 mt-1">{b.current_seats}/{b.max_seats} seats • {formatCurrency(b.monthly_fee)}/mo {b.admission_fee > 0 && `• +${formatCurrency(b.admission_fee)} adm`}</p>
                {full && <span className="text-xs text-red-500 font-semibold">Full</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Payment Section */}
      {selectedBatch && (mode === "new" || selectedStudent) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><CreditCard className="w-4 h-4" /> Payment</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Monthly Fee</span><span className="font-medium">{formatCurrency(selectedBatch.monthly_fee)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Admission Fee</span><span className="font-medium">{formatCurrency(selectedBatch.admission_fee)}</span></div>
            <div className="flex justify-between border-t border-gray-100 pt-2"><span className="font-semibold text-gray-700">Total</span><span className="font-bold text-indigo-700">{formatCurrency(totalFee)}</span></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Paid Amount (৳)</label>
              <input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} className={inputClass} placeholder="0" min="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Due Amount</label>
              <div className={`px-3 py-2.5 rounded-lg text-sm font-bold ${dueAmount > 0 ? "bg-red-50 text-red-600 border border-red-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"}`}>{formatCurrency(dueAmount)}</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="flex gap-4">
        <button type="button" onClick={() => router.back()} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={loading || !form.batch_id || (mode === "existing" && !selectedStudent)}
          className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center justify-center gap-2 shadow-lg">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <><UserPlus className="w-4 h-4" /> {mode === "new" ? "Create & Enroll" : "Enroll Student"}</>}
        </button>
      </div>
    </form>
  )
}
