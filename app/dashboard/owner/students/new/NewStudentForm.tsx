"use client"
import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Loader2, UserPlus, BookOpen, CreditCard, Check, Lock, Search, ShieldAlert, AlertCircle } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { checkFinancialAccess } from "@/lib/financial-access"

interface Batch { id: string; name: string; subject?: string; class_level?: string; max_seats: number; current_seats: number; monthly_fee: number; admission_fee: number }
interface StudentOpt { id: string; name: string; student_id: string; phone?: string; email?: string; guardian_name?: string; guardian_phone?: string; address?: string; class_level?: string; school_college?: string }

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

  useEffect(() => { checkFinancialAccess().then(({ hasAccess }) => setFinancialAccess(hasAccess)) }, [])

  function update(f: string, v: string) { setForm(prev => ({ ...prev, [f]: v })) }

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
      if (mode === "existing") {
        if (!selectedStudent) { toast.error("Select a student"); setLoading(false); return }
        if (missingFields.includes("guardian_phone") && !existingFix.guardian_phone.trim()) { toast.error("Guardian phone is required"); setLoading(false); return }
        sid = selectedStudent.id; dispId = selectedStudent.student_id
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
        const email = form.email.trim() || `student_${Date.now()}@medhashiree.local`
        const { error: aErr } = await supabase.auth.signUp({ email, password: form.password })
        if (aErr) throw new Error(aErr.message)

        // Generate unique student ID (MS-XXXXX)
        const { count } = await supabase.from("students").select("*", { count: "exact", head: true })
        const seq = (count || 0) + 1
        const studentIdStr = `MS-${String(seq).padStart(5, "0")}`

        const { data: st, error: sErr } = await supabase.from("students").insert({
          student_id: studentIdStr,
          name: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null,
          gender: form.gender, date_of_birth: form.date_of_birth || null,
          guardian_name: form.guardian_name.trim() || null, guardian_phone: form.guardian_phone.trim(),
          guardian_relation: form.guardian_relation, address: form.address.trim() || null,
          school_college: form.school_college.trim() || null, class_level: form.class_level.trim() || null,
        }).select().single()
        if (sErr) throw new Error(sErr.message)
        sid = st.id; dispId = st.student_id
      }
      const { error: eErr } = await supabase.from("enrollments").insert({ student_id: sid, batch_id: form.batch_id })
      if (eErr) throw new Error(eErr.message)
      if (batch) await supabase.from("batches").update({ current_seats: batch.current_seats + 1 }).eq("id", form.batch_id)
      if (paid > 0) await supabase.from("payments").insert({ student_id: sid, batch_id: form.batch_id, amount: total, total_paid: paid, payment_method: "cash", payment_for: "admission", payment_month: new Date().toISOString().slice(0, 7) })
      if (due > 0) { const n = new Date(); await supabase.from("fee_dues").insert({ student_id: sid, batch_id: form.batch_id, due_month: `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`, due_amount: total, paid_amount: paid, due_date: dueDate, status: paid > 0 ? "partial" : "pending" }) }
      if (form.referred_by_code.trim()) { const { data: r } = await supabase.from("students").select("id").eq("referral_code", form.referred_by_code.trim()).maybeSingle(); if (r) { await supabase.from("referrals").insert({ referrer_id: r.id, referee_id: sid, commission_rate: 10 }); await supabase.from("students").update({ referred_by_student_id: r.id }).eq("id", sid) } }
      toast.success(`Enrolled! ID: ${dispId}`)
      router.push("/dashboard/owner/students")
    } catch (err: any) { toast.error(err?.message || "Failed"); console.error(err) } finally { setLoading(false) }
  }

  const ic = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-shadow"
  const labelCls = "block text-xs font-medium text-gray-500 mb-1"

  return (
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
                  <button type="button" key={s.id} onClick={() => { setSelectedStudent(s); setSearchQuery(""); setExistingFix({ guardian_name: s.guardian_name || "", guardian_phone: s.guardian_phone || "", address: s.address || "", class_level: s.class_level || "", school_college: s.school_college || "" }) }}
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
            <button type="button" onClick={() => { setSelectedStudent(null); setSearchQuery("") }} className="text-red-400 hover:text-red-600 text-sm font-bold ml-2 transition-colors">✕</button>
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
            const sel = form.batch_id === b.id, full = b.current_seats >= b.max_seats
            return (
              <button type="button" key={b.id} disabled={full} onClick={() => { update("batch_id", sel ? "" : b.id); if (!sel) setPaidAmount("") }}
                className={`px-3 py-2.5 rounded-xl border text-left text-xs transition-all ${sel ? "border-indigo-400 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-md ring-1 ring-indigo-200" : full ? "border-gray-100 opacity-40" : "border-gray-200 hover:border-indigo-200 hover:shadow-sm"}`}>
                {sel && <Check className="float-right w-4 h-4 text-indigo-600" />}
                <p className="font-bold text-gray-800 text-[12px]">{b.name}</p>
                <p className="text-gray-400 text-[10px] mt-0.5">{b.current_seats}/{b.max_seats} seats • {formatCurrency(b.monthly_fee)}/mo{b.admission_fee > 0 ? ` +${formatCurrency(b.admission_fee)}` : ""}</p>
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
  )
}
