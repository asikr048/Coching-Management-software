"use client"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"

interface EnrollmentOption {
  id: string
  batch_id: string
  batch_name?: string
  roll_no: number | null
}

export default function EditStudentPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [enrollments, setEnrollments] = useState<EnrollmentOption[]>([])
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>("")
  const [form, setForm] = useState({
    name: "", phone: "", email: "", gender: "male", date_of_birth: "",
    guardian_name: "", guardian_phone: "", guardian_relation: "Parent",
    address: "", school_college: "", class_level: "", is_active: true,
    roll_no: "",
  })

  function update(field: string, value: string | boolean) { setForm(f => ({ ...f, [field]: value })) }

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("students")
        .select("*, enrollments(id, batch_id, roll_no, batch:batches(name))")
        .eq("id", params.id)
        .single()
      if (data) {
        const enrs: EnrollmentOption[] = ((data as any).enrollments || []).map((e: any) => ({
          id: e.id,
          batch_id: e.batch_id,
          batch_name: e.batch?.name,
          roll_no: e.roll_no != null ? Number(e.roll_no) : null,
        }))
        setEnrollments(enrs)
        const primary = enrs.find(e => e.roll_no != null) || enrs[0] || null
        setSelectedEnrollmentId(primary?.id || "")
        setForm({
          name: data.name || "", phone: data.phone || "", email: data.email || "",
          gender: data.gender || "male", date_of_birth: data.date_of_birth || "",
          guardian_name: data.guardian_name || "", guardian_phone: data.guardian_phone || "",
          guardian_relation: data.guardian_relation || "Parent", address: data.address || "",
          school_college: data.school_college || "", class_level: data.class_level || "",
          is_active: data.is_active,
          roll_no: primary?.roll_no != null
            ? String(primary.roll_no)
            : (data.roll_no != null ? String(data.roll_no) : (data.batch_roll != null ? String(data.batch_roll) : "")),
        })
      }
      setFetching(false)
    }
    load()
  }, [params.id, supabase])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    try {
      const trimmedRoll = form.roll_no.trim()
      const parsedRoll = trimmedRoll ? parseInt(trimmedRoll, 10) : null
      if (trimmedRoll && (parsedRoll == null || isNaN(parsedRoll) || parsedRoll <= 0)) {
        throw new Error("রোল নম্বর সঠিক নয় (Invalid roll number)")
      }

      const selectedEnr = enrollments.find(enr => enr.id === selectedEnrollmentId) || null

      // Roll is unique per batch: block a clash with another student before saving.
      if (parsedRoll != null && selectedEnr) {
        const { data: clash, error: clashErr } = await supabase
          .from("enrollments")
          .select("id, student:students(name, student_id)")
          .eq("batch_id", selectedEnr.batch_id)
          .eq("roll_no", parsedRoll)
          .neq("id", selectedEnr.id)
          .maybeSingle()
        if (!clashErr && clash) {
          const owner = (clash as any).student
          throw new Error(`রোল ${parsedRoll} এই ব্যাচে ইতিমধ্যে ব্যবহৃত (${owner?.name || "অন্য শিক্ষার্থী"}${owner?.student_id ? " — " + owner.student_id : ""})। অনুগ্রহ করে অন্য রোল দিন।`)
        }
      }

      const isPrimary = !selectedEnr || enrollments[0]?.id === selectedEnr.id
      const studentUpdate: Record<string, any> = {
        name: form.name, phone: form.phone || null, email: form.email || null,
        gender: form.gender, date_of_birth: form.date_of_birth || null,
        guardian_name: form.guardian_name || null, guardian_phone: form.guardian_phone || null,
        guardian_relation: form.guardian_relation, address: form.address || null,
        school_college: form.school_college || null, class_level: form.class_level || null,
        is_active: form.is_active,
      }
      // students.roll_no/batch_roll mirror the primary batch only.
      if (isPrimary) {
        studentUpdate.roll_no = parsedRoll
        studentUpdate.batch_roll = parsedRoll
      }

      const { error } = await supabase.from("students").update(studentUpdate).eq("id", params.id)
      if (error) throw error

      // Update this batch's enrollment roll only (never the student's other batches).
      if (selectedEnr) {
        const { error: enrError } = await supabase
          .from("enrollments")
          .update({ roll_no: parsedRoll })
          .eq("id", selectedEnr.id)
        if (enrError) {
          if ((enrError as any).code === "23505") {
            throw new Error(`রোল ${parsedRoll} এই ব্যাচে ইতিমধ্যে ব্যবহৃত। অনুগ্রহ করে অন্য রোল দিন।`)
          }
          throw enrError
        }
      }

      toast.success("Student updated!")
      router.push(`/dashboard/owner/students/${params.id}`)
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed") }
    finally { setLoading(false) }
  }

  const inputClass = "w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-2xs transition-all"

  if (fetching) return <div className="flex items-center justify-center h-64 text-slate-400"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Edit Student</h2>
        <p className="text-sm text-slate-400 mt-1">Update student information</p>
      </div>
      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 shadow-xl">
          <h3 className="font-black text-slate-900 text-base mb-4">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs font-bold text-slate-700 mb-1.5">Full Name *</label><input required value={form.name} onChange={e => update("name", e.target.value)} className={inputClass} /></div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Batch Roll No (রোল নম্বর)</label>
              {enrollments.length > 1 && (
                <select
                  value={selectedEnrollmentId}
                  onChange={e => {
                    const id = e.target.value
                    setSelectedEnrollmentId(id)
                    const enr = enrollments.find(x => x.id === id)
                    setForm(f => ({ ...f, roll_no: enr?.roll_no != null ? String(enr.roll_no) : "" }))
                  }}
                  className={`${inputClass} mb-2`}
                >
                  {enrollments.map(enr => (
                    <option key={enr.id} value={enr.id}>{enr.batch_name || "Batch"}</option>
                  ))}
                </select>
              )}
              <input type="number" min="1" placeholder="e.g. 1, 2, 3..." value={form.roll_no} onChange={e => update("roll_no", e.target.value)} className={inputClass} />
              <p className="text-[11px] text-slate-400 mt-1">রোল প্রতিটি ব্যাচের জন্য আলাদা ও অনন্য। খালি রাখলে রোল মুছে যাবে।</p>
            </div>
            <div><label className="block text-xs font-bold text-slate-700 mb-1.5">Gender</label><select value={form.gender} onChange={e => update("gender", e.target.value)} className={inputClass}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
            <div><label className="block text-xs font-bold text-slate-700 mb-1.5">Phone</label><input value={form.phone} onChange={e => update("phone", e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-bold text-slate-700 mb-1.5">Email</label><input type="email" value={form.email} onChange={e => update("email", e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-bold text-slate-700 mb-1.5">Date of Birth</label><input type="date" value={form.date_of_birth} onChange={e => update("date_of_birth", e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-bold text-slate-700 mb-1.5">Class Level</label><input value={form.class_level} onChange={e => update("class_level", e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-bold text-slate-700 mb-1.5">School / College</label><input value={form.school_college} onChange={e => update("school_college", e.target.value)} className={inputClass} /></div>
            <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-700 mb-1.5">Address</label><input value={form.address} onChange={e => update("address", e.target.value)} className={inputClass} /></div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 shadow-xl">
          <h3 className="font-black text-slate-900 text-base mb-4">Guardian Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs font-bold text-slate-700 mb-1.5">Guardian Name</label><input value={form.guardian_name} onChange={e => update("guardian_name", e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-bold text-slate-700 mb-1.5">Guardian Phone (ঐচ্ছিক)</label><input value={form.guardian_phone} onChange={e => update("guardian_phone", e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-bold text-slate-700 mb-1.5">Relation</label><select value={form.guardian_relation} onChange={e => update("guardian_relation", e.target.value)} className={inputClass}><option>Parent</option><option>Father</option><option>Mother</option><option>Guardian</option></select></div>
            <div className="flex items-center gap-2.5 pt-6"><input type="checkbox" checked={form.is_active} onChange={e => update("is_active", e.target.checked)} className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-400" /><label className="text-sm font-bold text-slate-900">Active Student</label></div>
          </div>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="flex-1 py-2.5 border border-slate-200 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl font-bold transition-colors cursor-pointer">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-black shadow-lg shadow-amber-500/20 disabled:opacity-40 flex items-center justify-center gap-2 transition-all cursor-pointer">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin text-slate-950" /> Saving...</> : <><Save className="w-4 h-4" /> Save Changes</>}
          </button>
        </div>
      </form>
    </div>
  )
}
