"use client"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"

export default function EditStudentPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [form, setForm] = useState({
    name: "", phone: "", email: "", gender: "male", date_of_birth: "",
    guardian_name: "", guardian_phone: "", guardian_relation: "Parent",
    address: "", school_college: "", class_level: "", is_active: true,
  })

  function update(field: string, value: string | boolean) { setForm(f => ({ ...f, [field]: value })) }

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("students").select("*").eq("id", params.id).single()
      if (data) {
        setForm({
          name: data.name || "", phone: data.phone || "", email: data.email || "",
          gender: data.gender || "male", date_of_birth: data.date_of_birth || "",
          guardian_name: data.guardian_name || "", guardian_phone: data.guardian_phone || "",
          guardian_relation: data.guardian_relation || "Parent", address: data.address || "",
          school_college: data.school_college || "", class_level: data.class_level || "",
          is_active: data.is_active,
        })
      }
      setFetching(false)
    }
    load()
  }, [params.id, supabase])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    try {
      const { error } = await supabase.from("students").update({
        name: form.name, phone: form.phone || null, email: form.email || null,
        gender: form.gender, date_of_birth: form.date_of_birth || null,
        guardian_name: form.guardian_name || null, guardian_phone: form.guardian_phone,
        guardian_relation: form.guardian_relation, address: form.address || null,
        school_college: form.school_college || null, class_level: form.class_level || null,
        is_active: form.is_active,
      }).eq("id", params.id)
      if (error) throw error
      toast.success("Student updated!")
      router.push(`/dashboard/owner/students/${params.id}`)
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed") }
    finally { setLoading(false) }
  }

  const inputClass = "w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/10 transition-all"

  if (fetching) return <div className="flex items-center justify-center h-64 text-slate-400"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-black text-white tracking-tight">Edit Student</h2>
        <p className="text-sm text-slate-400 mt-1">Update student information</p>
      </div>
      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl">
          <h3 className="font-black text-white text-base mb-4">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs font-bold text-slate-300 mb-1.5">Full Name *</label><input required value={form.name} onChange={e => update("name", e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-bold text-slate-300 mb-1.5">Gender</label><select value={form.gender} onChange={e => update("gender", e.target.value)} className={inputClass}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
            <div><label className="block text-xs font-bold text-slate-300 mb-1.5">Phone</label><input value={form.phone} onChange={e => update("phone", e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-bold text-slate-300 mb-1.5">Email</label><input type="email" value={form.email} onChange={e => update("email", e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-bold text-slate-300 mb-1.5">Date of Birth</label><input type="date" value={form.date_of_birth} onChange={e => update("date_of_birth", e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-bold text-slate-300 mb-1.5">Class Level</label><input value={form.class_level} onChange={e => update("class_level", e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-bold text-slate-300 mb-1.5">School / College</label><input value={form.school_college} onChange={e => update("school_college", e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-bold text-slate-300 mb-1.5">Address</label><input value={form.address} onChange={e => update("address", e.target.value)} className={inputClass} /></div>
          </div>
        </div>
        <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl">
          <h3 className="font-black text-white text-base mb-4">Guardian Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs font-bold text-slate-300 mb-1.5">Guardian Name</label><input value={form.guardian_name} onChange={e => update("guardian_name", e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-bold text-slate-300 mb-1.5">Guardian Phone *</label><input required value={form.guardian_phone} onChange={e => update("guardian_phone", e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-bold text-slate-300 mb-1.5">Relation</label><select value={form.guardian_relation} onChange={e => update("guardian_relation", e.target.value)} className={inputClass}><option>Parent</option><option>Father</option><option>Mother</option><option>Guardian</option></select></div>
            <div className="flex items-center gap-2.5 pt-6"><input type="checkbox" checked={form.is_active} onChange={e => update("is_active", e.target.checked)} className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-400" /><label className="text-sm font-bold text-slate-200">Active Student</label></div>
          </div>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="flex-1 py-2.5 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl font-bold transition-colors cursor-pointer">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl font-black shadow-lg shadow-amber-500/20 disabled:opacity-40 flex items-center justify-center gap-2 transition-all cursor-pointer">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin text-slate-950" /> Saving...</> : <><Save className="w-4 h-4" /> Save Changes</>}
          </button>
        </div>
      </form>
    </div>
  )
}