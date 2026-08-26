"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Loader2, UserPlus } from "lucide-react"

interface Batch {
  id: string; name: string; subject?: string; class_level?: string
  max_seats: number; current_seats: number; monthly_fee: number; admission_fee: number
}

export default function NewStudentForm({ batches }: { batches: Batch[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: "", phone: "", email: "", gender: "male", date_of_birth: "",
    guardian_name: "", guardian_phone: "", guardian_relation: "Parent",
    address: "", school_college: "", class_level: "",
    referred_by_code: "", batch_id: "",
  })

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data: student, error: sErr } = await supabase
        .from("students")
        .insert({
          name: form.name, phone: form.phone || null, email: form.email || null,
          gender: form.gender, date_of_birth: form.date_of_birth || null,
          guardian_name: form.guardian_name || null, guardian_phone: form.guardian_phone,
          guardian_relation: form.guardian_relation, address: form.address || null,
          school_college: form.school_college || null, class_level: form.class_level || null,
          referred_by_code: form.referred_by_code || null,
        })
        .select()
        .single()

      if (sErr) throw sErr

      if (form.batch_id && student) {
        const { error: eErr } = await supabase.from("enrollments").insert({ student_id: student.id, batch_id: form.batch_id })
        if (eErr) throw eErr

        const selectedBatch = batches.find(b => b.id === form.batch_id)
        if (selectedBatch && selectedBatch.monthly_fee > 0) {
          const now = new Date()
          const dueMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
          await supabase.from("fee_dues").insert({
            student_id: student.id, batch_id: form.batch_id, due_month: dueMonth,
            due_amount: selectedBatch.monthly_fee,
            due_date: new Date(now.getFullYear(), now.getMonth(), 10).toISOString().split("T")[0],
          })
        }

        if (form.referred_by_code) {
          const { data: referrer } = await supabase.from("students").select("id").eq("referral_code", form.referred_by_code).single()
          if (referrer) {
            await supabase.from("referrals").insert({ referrer_id: referrer.id, referee_id: student.id, commission_rate: 10 })
            await supabase.from("students").update({ referred_by_student_id: referrer.id }).eq("id", student.id)
          }
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

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Personal Information</h3>
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
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Enrollment Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Select Batch</label>
            <select value={form.batch_id} onChange={e => update("batch_id", e.target.value)} className={inputClass}>
              <option value="">-- Select Batch --</option>
              {batches.map(b => (<option key={b.id} value={b.id} disabled={b.current_seats >= b.max_seats}>{b.name} ({b.current_seats}/{b.max_seats}) - ৳{b.monthly_fee}/mo</option>))}
            </select>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Referral Code</label><input value={form.referred_by_code} onChange={e => update("referred_by_code", e.target.value)} className={inputClass} placeholder="Enter referrer code" /></div>
        </div>
        {form.batch_id && (() => { const b = batches.find(x => x.id === form.batch_id); return b ? (<div className="mt-3 p-3 bg-indigo-50 rounded-lg text-sm"><p className="font-medium text-indigo-800">Batch: {b.name}</p><p className="text-indigo-600">Monthly: ৳{b.monthly_fee} | Admission: ৳{b.admission_fee}</p></div>) : null })()}
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={() => router.back()} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors">Cancel</button>
        <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-indigo-400 transition-colors flex items-center justify-center gap-2">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</> : <><UserPlus className="w-4 h-4" /> Add Student</>}
        </button>
      </div>
    </form>
  )
}
