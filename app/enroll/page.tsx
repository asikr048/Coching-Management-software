"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { GraduationCap, Loader2, CheckCircle, CreditCard, ArrowRight, Copy, Check } from "lucide-react"

export default function PublicEnrollPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [studentId, setStudentId] = useState("")
  const [studentDbId, setStudentDbId] = useState("")
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState({
    name: "", phone: "", email: "", gender: "male", date_of_birth: "",
    guardian_name: "", guardian_phone: "", guardian_relation: "Parent",
    address: "", school_college: "", class_level: "", referred_by_code: "",
  })
  function update(f: string, v: string) { setForm(x => ({ ...x, [f]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    try {
      const { data, error } = await supabase.from("students").insert({
        name: form.name, phone: form.phone || null, email: form.email || null,
        gender: form.gender, date_of_birth: form.date_of_birth || null,
        guardian_name: form.guardian_name || null, guardian_phone: form.guardian_phone,
        guardian_relation: form.guardian_relation, address: form.address || null,
        school_college: form.school_college || null, class_level: form.class_level || null,
        referred_by_code: form.referred_by_code || null,
      }).select("id, student_id").single()

      if (error) {
        // If duplicate error, try to find existing student by email or phone
        if (error.message.includes("duplicate") || error.code === "23505") {
          let existingStudent = null
          if (form.email) {
            const { data: byEmail } = await supabase.from("students").select("id, student_id").eq("email", form.email).maybeSingle()
            existingStudent = byEmail
          }
          if (!existingStudent && form.phone) {
            const { data: byPhone } = await supabase.from("students").select("id, student_id").eq("phone", form.phone).maybeSingle()
            existingStudent = byPhone
          }
          if (existingStudent) {
            setStudentId(existingStudent.student_id)
            setStudentDbId(existingStudent.id)
            setSuccess(true)
            toast.success("Student found! Proceed to payment.")
            return
          }
        }
        throw new Error(error.message)
      }
      setStudentId(data.student_id)
      setStudentDbId(data.id)
      setSuccess(true)
      toast.success("Enrollment submitted!")
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed to submit enrollment") }
    finally { setLoading(false) }
  }

  function copyId() {
    navigator.clipboard.writeText(studentId)
    setCopied(true)
    toast.success("Student ID copied!")
    setTimeout(() => setCopied(false), 2000)
  }

  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Enrollment Submitted!</h2>
          <p className="text-gray-600 mb-3">Your student ID is:</p>
          <div className="flex items-center justify-center gap-2 mb-6">
            <p className="text-3xl font-mono font-bold text-indigo-600 bg-indigo-50 rounded-xl py-3 px-6">{studentId}</p>
            <button onClick={copyId} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Copy ID">
              {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5 text-gray-400" />}
            </button>
          </div>

          <div className="border-t border-gray-100 pt-6 space-y-3">
            <a
              href={`/enroll/payment?student_id=${studentDbId}&student_code=${studentId}&name=${encodeURIComponent(form.name)}`}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-indigo-200 transition-all"
            >
              <CreditCard className="w-5 h-5" /> Proceed to Payment <ArrowRight className="w-4 h-4" />
            </a>
            <p className="text-xs text-gray-400">Select a batch and complete your payment</p>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <a href="/enroll" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">Enroll Another Student</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-3"><GraduationCap className="w-7 h-7 text-white" /></div>
          <h1 className="text-3xl font-bold text-gray-900">Student Enrollment</h1>
          <p className="text-gray-500 mt-1">MedhaShiri - Online Registration Form</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label><input required value={form.name} onChange={e => update("name", e.target.value)} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Gender</label><select value={form.gender} onChange={e => update("gender", e.target.value)} className={inputClass}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input value={form.phone} onChange={e => update("phone", e.target.value)} className={inputClass} placeholder="01XXXXXXXXX" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" value={form.email} onChange={e => update("email", e.target.value)} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label><input type="date" value={form.date_of_birth} onChange={e => update("date_of_birth", e.target.value)} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Class Level</label><input value={form.class_level} onChange={e => update("class_level", e.target.value)} className={inputClass} placeholder="e.g., Class 9, HSC" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">School / College</label><input value={form.school_college} onChange={e => update("school_college", e.target.value)} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Address</label><input value={form.address} onChange={e => update("address", e.target.value)} className={inputClass} /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Guardian Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Guardian Name</label><input value={form.guardian_name} onChange={e => update("guardian_name", e.target.value)} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Guardian Phone *</label><input required value={form.guardian_phone} onChange={e => update("guardian_phone", e.target.value)} className={inputClass} placeholder="01XXXXXXXXX" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Relation</label><select value={form.guardian_relation} onChange={e => update("guardian_relation", e.target.value)} className={inputClass}><option>Parent</option><option>Father</option><option>Mother</option><option>Guardian</option></select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Referral Code</label><input value={form.referred_by_code} onChange={e => update("referred_by_code", e.target.value)} className={inputClass} placeholder="If referred by someone" /></div>
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : "Submit Enrollment"}
          </button>
        </form>
        <p className="text-center text-gray-400 text-xs mt-6">© {new Date().getFullYear()} MedhaShiri</p>
      </div>
    </div>
  )
}
