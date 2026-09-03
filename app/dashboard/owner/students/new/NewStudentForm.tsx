"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Loader2, UserPlus, User, BookOpen, CreditCard, Check, Calendar, DollarSign, ShieldAlert } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { checkFinancialAccess } from "@/lib/financial-access"

interface Batch {
  id: string; name: string; subject?: string; class_level?: string
  max_seats: number; current_seats: number; monthly_fee: number; admission_fee: number
}

export default function NewStudentForm({ batches }: { batches: Batch[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [financialAccess, setFinancialAccess] = useState<boolean | null>(null)

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

  const [form, setForm] = useState({
    name: "", phone: "", email: "", gender: "male", date_of_birth: "",
    guardian_name: "", guardian_phone: "", guardian_relation: "Parent",
    address: "", school_college: "", class_level: "",
    referred_by_code: "", batch_id: "",
  })

  const [paidAmount, setPaidAmount] = useState("")
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(10)
    return d.toISOString().split("T")[0]
  })

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const selectedBatch = batches.find(b => b.id === form.batch_id)
  const totalFee = selectedBatch ? (selectedBatch.monthly_fee + selectedBatch.admission_fee) : 0
  const paid = parseFloat(paidAmount) || 0
  const dueAmount = Math.max(0, totalFee - paid)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.batch_id) { toast.error("Please select a batch"); return }
    setLoading(true)
    try {
      const { data: student, error: sErr } = await supabase.from("students").insert({
        name: form.name, phone: form.phone || null, email: form.email || null,
        gender: form.gender, date_of_birth: form.date_of_birth || null,
        guardian_name: form.guardian_name || null, guardian_phone: form.guardian_phone,
        guardian_relation: form.guardian_relation, address: form.address || null,
        school_college: form.school_college || null, class_level: form.class_level || null,
      }).select().single()
      if (sErr) throw sErr

      const { error: eErr } = await supabase.from("enrollments").insert({ student_id: student.id, batch_id: form.batch_id })
      if (eErr) throw eErr

      try {
        const { error: rpcErr } = await supabase.rpc("increment_batch_seats", { batch_id_input: form.batch_id })
        if (rpcErr && selectedBatch) await supabase.from("batches").update({ current_seats: selectedBatch.current_seats + 1 }).eq("id", form.batch_id)
      } catch { if (selectedBatch) await supabase.from("batches").update({ current_seats: selectedBatch.current_seats + 1 }).eq("id", form.batch_id) }

      if (paid > 0) {
        await supabase.from("payments").insert({
          student_id: student.id, batch_id: form.batch_id, amount: totalFee, total_paid: paid,
          payment_method: "cash", payment_for: "admission",
          payment_month: new Date().toISOString().slice(0, 7),
          notes: `Admission - Paid: ${formatCurrency(paid)}, Due: ${formatCurrency(dueAmount)}`,
        })
      }

      if (dueAmount > 0) {
        const now = new Date()
        await supabase.from("fee_dues").insert({
          student_id: student.id, batch_id: form.batch_id,
          due_month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
          due_amount: totalFee, paid_amount: paid, due_date: dueDate,
          status: paid > 0 ? "partial" : "pending",
        })
      }

      if (form.referred_by_code) {
        const { data: referrer } = await supabase.from("students").select("id").eq("referral_code", form.referred_by_code).maybeSingle()
        if (referrer) {
          await supabase.from("referrals").insert({ referrer_id: referrer.id, referee_id: student.id, commission_rate: 10 })
          await supabase.from("students").update({ referred_by_student_id: referrer.id }).eq("id", student.id)
        }
      }

      toast.success(`Student ${form.name} added! ID: ${student?.student_id}`)
      router.push("/dashboard/owner/students")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add student")
    } finally { setLoading(false) }
  }

  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Personal Information */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><User className="w-4 h-4 text-indigo-600" /> Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label><input required value={form.name} onChange={e => update("name", e.target.value)} className={inputClass} placeholder="Student full name" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Gender</label><select value={form.gender} onChange={e => update("gender", e.target.value)} className={inputClass}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input value={form.phone} onChange={e => update("phone", e.target.value)} className={inputClass} placeholder="01XXXXXXXXX" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" value={form.email} onChange={e => update("email", e.target.value)} className={inputClass} placeholder="email@example.com" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label><input type="date" value={form.date_of_birth} onChange={e => update("date_of_birth", e.target.value)} className={inputClass} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Class / Level</label><input value={form.class_level} onChange={e => update("class_level", e.target.value)} className={inputClass} placeholder="e.g., Class 9, HSC" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">School / College</label><input value={form.school_college} onChange={e => update("school_college", e.target.value)} className={inputClass} /></div>
        </div>
      </div>

      {/* Guardian + Referral */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Guardian Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Guardian Name</label><input value={form.guardian_name} onChange={e => update("guardian_name", e.target.value)} className={inputClass} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Guardian Phone <span className="text-red-500">*</span></label><input required value={form.guardian_phone} onChange={e => update("guardian_phone", e.target.value)} className={inputClass} placeholder="01XXXXXXXXX" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Relation</label><select value={form.guardian_relation} onChange={e => update("guardian_relation", e.target.value)} className={inputClass}><option>Parent</option><option>Father</option><option>Mother</option><option>Guardian</option><option>Sibling</option></select></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Address</label><input value={form.address} onChange={e => update("address", e.target.value)} className={inputClass} /></div>
        </div>
      </div>

      {/* Batch Selection */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><BookOpen className="w-4 h-4 text-indigo-600" /> Select Batch <span className="text-red-500">*</span></h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {batches.map(b => {
            const isFull = b.current_seats >= b.max_seats
            const isSelected = form.batch_id === b.id
            return (
              <button key={b.id} type="button" disabled={isFull} onClick={() => update("batch_id", isSelected ? "" : b.id)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  isSelected ? "border-indigo-600 bg-indigo-50 shadow-md shadow-indigo-100" :
                  isFull ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed" :
                  "border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30"
                }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{b.name}</p>
                    <p className="text-xs text-gray-500">{b.subject || b.class_level || "General"}</p>
                  </div>
                  {isSelected && <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
                  {isFull && <span className="text-xs text-red-500 font-medium">Full</span>}
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span>{b.current_seats}/{b.max_seats} seats</span>
                  <span>{formatCurrency(b.monthly_fee)}/mo</span>
                  {b.admission_fee > 0 && <span>+{formatCurrency(b.admission_fee)} adm</span>}
                </div>
              </button>
            )
          })}
        </div>
        {batches.length === 0 && <p className="text-gray-400 text-center py-6">No active batches available.</p>}

        {/* Referral */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-1">Referral Code (optional)</label>
          <input value={form.referred_by_code} onChange={e => update("referred_by_code", e.target.value)} className={`${inputClass} max-w-xs`} placeholder="Enter referrer code" />
        </div>
      </div>

      {/* Payment Section — only visible when batch is selected */}
      {selectedBatch && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4 text-indigo-600" /> Payment</h3>

          {/* Fee Breakdown */}
          <div className="bg-gray-50 rounded-lg p-3 mb-5 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-600">Monthly Fee</span><span className="font-medium">{formatCurrency(selectedBatch.monthly_fee)}</span></div>
            {selectedBatch.admission_fee > 0 && <div className="flex justify-between"><span className="text-gray-600">Admission Fee</span><span className="font-medium">{formatCurrency(selectedBatch.admission_fee)}</span></div>}
            <div className="flex justify-between font-bold border-t border-gray-200 pt-1 mt-1"><span>Total</span><span className="text-indigo-700">{formatCurrency(totalFee)}</span></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Paid Amount (৳)</label>
              <input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} min="0" max={totalFee}
                className={`${inputClass} text-lg font-semibold`} placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><DollarSign className="w-3.5 h-3.5 text-red-500" /> Due Amount</label>
              <div className={`px-3 py-2.5 rounded-lg border border-gray-300 text-lg font-semibold bg-gray-50 ${dueAmount > 0 ? "text-red-600" : "text-emerald-600"}`}>
                {formatCurrency(dueAmount)}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-blue-600" /> Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          {dueAmount === 0 && paid >= totalFee && (
            <div className="mt-3 flex items-center gap-2 text-emerald-600 font-bold text-sm"><Check className="w-4 h-4" /> Fully Paid!</div>
          )}
        </div>
      )}

      {/* Submit */}
      <div className="flex gap-3">
        <button type="button" onClick={() => router.back()} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={loading}
          className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-indigo-200 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><UserPlus className="w-4 h-4" /> Add Student</>}
        </button>
      </div>
    </form>
  )
}
