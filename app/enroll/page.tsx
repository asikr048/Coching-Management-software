"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  GraduationCap, Loader2, CheckCircle, CreditCard, ArrowRight,
  Copy, Check, User, Phone, Mail, Calendar, BookOpen, Home, MapPin, Users
} from "lucide-react"
import Link from "next/link"

export default function PublicEnrollPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [alreadyEnrolled, setAlreadyEnrolled] = useState(false)
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
      const genId = `MS-${String(Math.floor(10000 + Math.random() * 90000))}`
      const { data, error } = await supabase.from("students").insert({
        student_id: genId,
        name: form.name, phone: form.phone || null, email: form.email || null,
        gender: form.gender, date_of_birth: form.date_of_birth || null,
        guardian_name: form.guardian_name || null, guardian_phone: form.guardian_phone,
        guardian_relation: form.guardian_relation, address: form.address || null,
        school_college: form.school_college || null, class_level: form.class_level || null,
        referred_by_code: form.referred_by_code || null,
      }).select("id, student_id").single()

      if (error) {
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
            const { data: activeEnrollment } = await supabase.from("enrollments").select("id").eq("student_id", existingStudent.id).eq("status", "active").maybeSingle()
            const { data: approvedPayment } = await supabase.from("payment_submissions").select("id").eq("student_id", existingStudent.id).eq("status", "approved").maybeSingle()
            setStudentId(existingStudent.student_id)
            setStudentDbId(existingStudent.id)
            if (activeEnrollment || approvedPayment) {
              setAlreadyEnrolled(true)
              setSuccess(true)
              toast.success("You're already enrolled! Go to your profile.")
            } else {
              setSuccess(true)
              toast.success("Student found! Proceed to payment.")
            }
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
    setCopied(true); toast.success("Student ID copied!")
    setTimeout(() => setCopied(false), 2000)
  }

  const inputClass = "w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400"
  const labelClass = "block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5"

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center p-4">
        {/* Logo */}
        <div className="absolute top-4 left-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-black bg-gradient-to-r from-indigo-700 to-violet-700 bg-clip-text text-transparent">MedhaShiree</span>
          </Link>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl shadow-indigo-100 p-10 max-w-md w-full text-center border border-gray-100 mt-12">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">
            {alreadyEnrolled ? "Already Enrolled! 🎓" : "Enrollment Submitted! 🎉"}
          </h2>
          <p className="text-gray-500 mb-4 text-sm">Your student ID is:</p>
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="text-2xl font-black font-mono text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-2xl py-3 px-6">{studentId}</div>
            <button onClick={copyId} className="p-2.5 rounded-xl hover:bg-gray-100 border border-gray-200 transition-colors" title="Copy ID">
              {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5 text-gray-400" />}
            </button>
          </div>

          {alreadyEnrolled ? (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-2">
                <p className="text-sm text-emerald-700">✅ You are already enrolled and your payment has been approved. View your courses in your profile.</p>
              </div>
              <Link href="/student/profile" className="flex items-center justify-center gap-2 w-full px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-bold hover:shadow-lg hover:shadow-emerald-200 transition-all">
                <User className="w-5 h-5" /> Go to My Profile <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/login" className="block text-sm text-indigo-600 hover:text-indigo-700 font-semibold mt-2">Sign In to your account</Link>
            </div>
          ) : (
            <div className="space-y-3">
              <Link
                href={`/enroll/payment?student_id=${studentDbId}&student_code=${studentId}&name=${encodeURIComponent(form.name)}`}
                className="flex items-center justify-center gap-2 w-full px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-bold hover:shadow-lg hover:shadow-indigo-200 transition-all"
              >
                <CreditCard className="w-5 h-5" /> Proceed to Payment <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="text-xs text-gray-400">Select a batch and complete your payment</p>
            </div>
          )}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <a href="/enroll" className="text-sm text-gray-500 hover:text-indigo-600 font-medium transition-colors">Enroll Another Student</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/40">
      {/* Top navbar */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10 px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200 group-hover:shadow-lg group-hover:shadow-indigo-300 transition-all">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-black bg-gradient-to-r from-indigo-700 to-violet-700 bg-clip-text text-transparent">MedhaShiree</span>
          </Link>
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">/ Student Enrollment</span>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Hero Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider">
            <GraduationCap className="w-3.5 h-3.5" /> Online Registration
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-3">Student <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Enrollment</span></h1>
          <p className="text-gray-500 text-base max-w-md mx-auto">Join MedhaShiree — fill the form below and proceed to select your batch & complete payment.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm shadow-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center"><User className="w-4 h-4 text-white" /></div>
              <h3 className="font-bold text-white text-lg">Personal Information</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-1">
                <label className={labelClass}>Full Name <span className="text-red-500">*</span></label>
                <div className="relative"><User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input required value={form.name} onChange={e => update("name", e.target.value)} className={`${inputClass} pl-10`} placeholder="Your full name" /></div>
              </div>
              <div>
                <label className={labelClass}>Gender</label>
                <select value={form.gender} onChange={e => update("gender", e.target.value)} className={inputClass}>
                  <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Phone Number</label>
                <div className="relative"><Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input value={form.phone} onChange={e => update("phone", e.target.value)} className={`${inputClass} pl-10`} placeholder="01XXXXXXXXX" /></div>
              </div>
              <div>
                <label className={labelClass}>Email Address</label>
                <div className="relative"><Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="email" value={form.email} onChange={e => update("email", e.target.value)} className={`${inputClass} pl-10`} placeholder="you@example.com" /></div>
              </div>
              <div>
                <label className={labelClass}>Date of Birth</label>
                <div className="relative"><Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="date" value={form.date_of_birth} onChange={e => update("date_of_birth", e.target.value)} className={`${inputClass} pl-10`} /></div>
              </div>
              <div>
                <label className={labelClass}>Class Level</label>
                <div className="relative"><BookOpen className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input value={form.class_level} onChange={e => update("class_level", e.target.value)} className={`${inputClass} pl-10`} placeholder="e.g., Class 9, HSC" /></div>
              </div>
              <div>
                <label className={labelClass}>School / College</label>
                <div className="relative"><BookOpen className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input value={form.school_college} onChange={e => update("school_college", e.target.value)} className={`${inputClass} pl-10`} placeholder="Name of institution" /></div>
              </div>
              <div>
                <label className={labelClass}>Address</label>
                <div className="relative"><MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input value={form.address} onChange={e => update("address", e.target.value)} className={`${inputClass} pl-10`} placeholder="Your address" /></div>
              </div>
            </div>
          </div>

          {/* Guardian Information */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm shadow-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center"><Users className="w-4 h-4 text-white" /></div>
              <h3 className="font-bold text-white text-lg">Guardian Information</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Guardian Name</label>
                <div className="relative"><User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input value={form.guardian_name} onChange={e => update("guardian_name", e.target.value)} className={`${inputClass} pl-10`} placeholder="Parent/Guardian name" /></div>
              </div>
              <div>
                <label className={labelClass}>Guardian Phone <span className="text-red-500">*</span></label>
                <div className="relative"><Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input required value={form.guardian_phone} onChange={e => update("guardian_phone", e.target.value)} className={`${inputClass} pl-10`} placeholder="01XXXXXXXXX" /></div>
              </div>
              <div>
                <label className={labelClass}>Relation</label>
                <select value={form.guardian_relation} onChange={e => update("guardian_relation", e.target.value)} className={inputClass}>
                  <option>Parent</option><option>Father</option><option>Mother</option><option>Guardian</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Referral Name / Code</label>
                <input value={form.referred_by_code} onChange={e => update("referred_by_code", e.target.value)} className={inputClass} placeholder="Referrer name or code (optional)" />
              </div>
            </div>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading} className="w-full py-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white rounded-2xl font-black text-lg hover:shadow-xl hover:shadow-indigo-200 transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:scale-[0.99]">
            {loading
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
              : <><GraduationCap className="w-5 h-5" /> Submit Enrollment <ArrowRight className="w-5 h-5" /></>
            }
          </button>
          <p className="text-center text-gray-400 text-xs">© {new Date().getFullYear()} MedhaShiree · All rights reserved</p>
        </form>
      </div>
    </div>
  )
}
