"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Loader2, UserPlus, ChevronRight, ChevronLeft, User, BookOpen, CreditCard, Check, Calendar, DollarSign } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface Batch {
  id: string; name: string; subject?: string; class_level?: string
  max_seats: number; current_seats: number; monthly_fee: number; admission_fee: number
}

export default function NewStudentForm({ batches }: { batches: Batch[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1) // 1=Personal, 2=Batch, 3=Payment

  const [form, setForm] = useState({
    name: "", phone: "", email: "", gender: "male", date_of_birth: "",
    guardian_name: "", guardian_phone: "", guardian_relation: "Parent",
    address: "", school_college: "", class_level: "",
    referred_by_code: "", batch_id: "",
  })

  // Payment step state
  const [paidAmount, setPaidAmount] = useState("")
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    d.setDate(10)
    return d.toISOString().split("T")[0]
  })

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const selectedBatch = batches.find(b => b.id === form.batch_id)
  const totalFee = selectedBatch ? (selectedBatch.monthly_fee + selectedBatch.admission_fee) : 0
  const paid = parseFloat(paidAmount) || 0
  const dueAmount = Math.max(0, totalFee - paid)

  function validateStep1() {
    if (!form.name.trim()) { toast.error("Name is required"); return false }
    if (!form.guardian_phone.trim()) { toast.error("Guardian phone is required"); return false }
    return true
  }

  function validateStep2() {
    if (!form.batch_id) { toast.error("Please select a batch"); return false }
    return true
  }

  async function handleSubmit() {
    setLoading(true)
    try {
      // 1. Create student
      const { data: student, error: sErr } = await supabase
        .from("students")
        .insert({
          name: form.name, phone: form.phone || null, email: form.email || null,
          gender: form.gender, date_of_birth: form.date_of_birth || null,
          guardian_name: form.guardian_name || null, guardian_phone: form.guardian_phone,
          guardian_relation: form.guardian_relation, address: form.address || null,
          school_college: form.school_college || null, class_level: form.class_level || null,
        })
        .select()
        .single()
      if (sErr) throw sErr

      // 2. Enroll in batch
      const { error: eErr } = await supabase.from("enrollments").insert({ student_id: student.id, batch_id: form.batch_id })
      if (eErr) throw eErr

      // 3. Increment batch seats
      try {
        const { error: rpcErr } = await supabase.rpc("increment_batch_seats", { batch_id_input: form.batch_id })
        if (rpcErr && selectedBatch) {
          await supabase.from("batches").update({ current_seats: selectedBatch.current_seats + 1 }).eq("id", form.batch_id)
        }
      } catch {
        if (selectedBatch) {
          await supabase.from("batches").update({ current_seats: selectedBatch.current_seats + 1 }).eq("id", form.batch_id)
        }
      }

      // 4. Record payment if paid > 0
      if (paid > 0) {
        await supabase.from("payments").insert({
          student_id: student.id,
          batch_id: form.batch_id,
          amount: totalFee,
          total_paid: paid,
          payment_method: "cash",
          payment_for: "admission",
          payment_month: new Date().toISOString().slice(0, 7),
          notes: `Admission payment - Paid: ${formatCurrency(paid)}, Due: ${formatCurrency(dueAmount)}`,
        })
      }

      // 5. Create fee due if there's outstanding amount
      if (dueAmount > 0) {
        const now = new Date()
        const dueMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
        await supabase.from("fee_dues").insert({
          student_id: student.id,
          batch_id: form.batch_id,
          due_month: dueMonth,
          due_amount: totalFee,
          paid_amount: paid,
          due_date: dueDate,
          status: paid > 0 ? "partial" : "pending",
        })
      }

      // 6. Handle referral
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
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"

  // Step indicator
  const steps = [
    { num: 1, label: "Personal Info", icon: User },
    { num: 2, label: "Select Batch", icon: BookOpen },
    { num: 3, label: "Payment", icon: CreditCard },
  ]

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center">
              <div className="flex items-center gap-2">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step > s.num ? "bg-emerald-500 text-white" :
                  step === s.num ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" :
                  "bg-gray-100 text-gray-400"
                }`}>
                  {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                </div>
                <span className={`text-sm font-medium hidden sm:block ${step >= s.num ? "text-gray-800" : "text-gray-400"}`}>{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-12 sm:w-24 h-0.5 mx-2 sm:mx-4 ${step > s.num ? "bg-emerald-500" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Personal & Guardian Info */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><User className="w-4 h-4 text-indigo-600" /> Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label><input required value={form.name} onChange={e => update("name", e.target.value)} className={inputClass} placeholder="Student full name" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Gender</label><select value={form.gender} onChange={e => update("gender", e.target.value)} className={inputClass}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input value={form.phone} onChange={e => update("phone", e.target.value)} className={inputClass} placeholder="01XXXXXXXXX" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" value={form.email} onChange={e => update("email", e.target.value)} className={inputClass} placeholder="email@example.com" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label><input type="date" value={form.date_of_birth} onChange={e => update("date_of_birth", e.target.value)} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Class / Level</label><input value={form.class_level} onChange={e => update("class_level", e.target.value)} className={inputClass} placeholder="e.g., Class 9, HSC" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">School / College</label><input value={form.school_college} onChange={e => update("school_college", e.target.value)} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Address</label><input value={form.address} onChange={e => update("address", e.target.value)} className={inputClass} /></div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Guardian Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Guardian Name</label><input value={form.guardian_name} onChange={e => update("guardian_name", e.target.value)} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Guardian Phone <span className="text-red-500">*</span></label><input required value={form.guardian_phone} onChange={e => update("guardian_phone", e.target.value)} className={inputClass} placeholder="01XXXXXXXXX" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Relation</label><select value={form.guardian_relation} onChange={e => update("guardian_relation", e.target.value)} className={inputClass}><option>Parent</option><option>Father</option><option>Mother</option><option>Guardian</option><option>Sibling</option></select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Referral Code</label><input value={form.referred_by_code} onChange={e => update("referred_by_code", e.target.value)} className={inputClass} placeholder="Enter referrer code (optional)" /></div>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
            <button type="button" onClick={() => { if (validateStep1()) setStep(2) }}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 flex items-center justify-center gap-2">
              Next: Select Batch <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Batch Selection */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><BookOpen className="w-4 h-4 text-indigo-600" /> Select Batch for {form.name}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {batches.map(b => {
                const isFull = b.current_seats >= b.max_seats
                const isSelected = form.batch_id === b.id
                return (
                  <button
                    key={b.id}
                    type="button"
                    disabled={isFull}
                    onClick={() => update("batch_id", b.id)}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected ? "border-indigo-600 bg-indigo-50 shadow-md shadow-indigo-100" :
                      isFull ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed" :
                      "border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-800">{b.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{b.subject || b.class_level || "General"}</p>
                      </div>
                      {isSelected && <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center"><Check className="w-3.5 h-3.5 text-white" /></div>}
                      {isFull && <span className="text-xs text-red-500 font-medium">Full</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><User className="w-3 h-3" /> {b.current_seats}/{b.max_seats}</span>
                      <span>Monthly: {formatCurrency(b.monthly_fee)}</span>
                      {b.admission_fee > 0 && <span>Admission: {formatCurrency(b.admission_fee)}</span>}
                    </div>
                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-indigo-200">
                        <div className="flex justify-between text-sm">
                          <span className="text-indigo-700 font-medium">Total Fee</span>
                          <span className="text-indigo-700 font-bold">{formatCurrency(b.monthly_fee + b.admission_fee)}</span>
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            {batches.length === 0 && <p className="text-gray-400 text-center py-8">No active batches. Create a batch first.</p>}
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 flex items-center justify-center gap-2">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button type="button" onClick={() => { if (validateStep2()) setStep(3) }}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 flex items-center justify-center gap-2">
              Next: Payment <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Payment */}
      {step === 3 && selectedBatch && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4 text-indigo-600" /> Payment Details</h3>

            {/* Student + Batch Summary */}
            <div className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-xl p-4 mb-6 border border-indigo-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-indigo-600 font-medium">Student</p>
                  <p className="text-lg font-bold text-gray-900">{form.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-indigo-600 font-medium">Batch</p>
                  <p className="text-lg font-bold text-gray-900">{selectedBatch.name}</p>
                </div>
              </div>
            </div>

            {/* Fee Breakdown */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Monthly Fee</span>
                <span className="font-medium text-gray-800">{formatCurrency(selectedBatch.monthly_fee)}</span>
              </div>
              {selectedBatch.admission_fee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Admission Fee</span>
                  <span className="font-medium text-gray-800">{formatCurrency(selectedBatch.admission_fee)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2 mt-2">
                <span className="text-gray-800">Total Fee</span>
                <span className="text-indigo-700 text-lg">{formatCurrency(totalFee)}</span>
              </div>
            </div>

            {/* Payment Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Paid Amount (৳)
                </label>
                <input
                  type="number"
                  value={paidAmount}
                  onChange={e => setPaidAmount(e.target.value)}
                  min="0"
                  max={totalFee}
                  className={`${inputClass} text-lg font-semibold`}
                  placeholder="0"
                />
                <p className="text-xs text-gray-400 mt-1">Enter amount received now</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-red-500" /> Due Amount (৳)
                </label>
                <div className={`${inputClass} text-lg font-semibold bg-gray-50 cursor-not-allowed ${dueAmount > 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {formatCurrency(dueAmount)}
                </div>
                <p className="text-xs text-gray-400 mt-1">Auto-calculated</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" /> Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className={inputClass}
                />
                <p className="text-xs text-gray-400 mt-1">Deadline for remaining payment</p>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="mt-6 p-4 rounded-xl border-2 border-dashed border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Summary</h4>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Total Fee</span><span className="font-medium">{formatCurrency(totalFee)}</span></div>
                <div className="flex justify-between"><span className="text-emerald-600">Paid Now</span><span className="font-bold text-emerald-600">{formatCurrency(paid)}</span></div>
                {dueAmount > 0 && (
                  <>
                    <div className="flex justify-between"><span className="text-red-600">Due Amount</span><span className="font-bold text-red-600">{formatCurrency(dueAmount)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Due By</span><span className="font-medium">{dueDate}</span></div>
                  </>
                )}
                {dueAmount === 0 && paid >= totalFee && (
                  <div className="flex items-center gap-2 text-emerald-600 font-bold pt-1"><Check className="w-4 h-4" /> Fully Paid!</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(2)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 flex items-center justify-center gap-2">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button type="button" onClick={handleSubmit} disabled={loading}
              className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-indigo-200 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><UserPlus className="w-4 h-4" /> Add Student & Complete</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
