"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { GraduationCap, Users, BookOpen, Shield, ArrowRight, ArrowLeft, Loader2, Mail, Lock, User, Phone, Eye, EyeOff, Star } from "lucide-react"
import Link from "next/link"

type SignupType = null | "student" | "management"

export default function SignupPage() {
  const [type, setType] = useState<SignupType>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role: "teacher" })
  const supabase = createClient()
  const router = useRouter()

  function update(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({ email: form.email, password: form.password })
      if (authError) throw authError

      if (type === "student") {
        // Create student record
        await supabase.from("students").insert({
          name: form.name, email: form.email, phone: form.phone || null, is_active: true,
        })
      } else {
        // Create staff record (pending approval)
        if (authData.user) {
          await supabase.from("staff").insert({
            name: form.name, email: form.email, phone: form.phone || null,
            role: form.role, auth_user_id: authData.user.id, is_active: false,
          })
        }
      }
      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed")
    } finally { setLoading(false) }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Account Created!</h2>
          <p className="text-gray-500">
            {type === "student"
              ? "Your student account has been created. You can now log in."
              : "Your account has been created and is pending admin approval. You'll be notified once approved."}
          </p>
          <Link href="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors">
            Go to Login <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  // Type selection screen
  if (!type) {
    return (
      <div className="min-h-screen flex">
        {/* Left Panel */}
        <div className="hidden lg:flex lg:w-[48%] relative bg-gradient-to-br from-indigo-900 via-violet-900 to-purple-900 overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDgpIi8+PC9nPjwvc3ZnPg==')] opacity-60" />
          <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] bg-violet-500/20 rounded-full blur-[80px]" />
          <div className="relative z-10 flex flex-col justify-between p-12 w-full">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">Medha<span className="text-indigo-300">Shiri</span></span>
            </div>
            <div className="max-w-md space-y-6">
              <h2 className="text-4xl font-extrabold text-white leading-tight">Join the Future of Coaching Management</h2>
              <p className="text-indigo-200/80 text-lg">Create your account and start your journey with Rajshahi&apos;s most trusted coaching platform.</p>
              <div className="flex gap-0.5">{[0,1,2,3,4].map(i => <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />)}</div>
              <p className="text-white/50 text-sm italic">&ldquo;The best coaching management system I&apos;ve ever used.&rdquo;</p>
            </div>
            <p className="text-white/30 text-xs">&copy; 2026 MedhaShiri. All rights reserved.</p>
          </div>
        </div>

        {/* Right — Type Selection */}
        <div className="flex-1 flex items-center justify-center bg-slate-50 p-6 sm:p-8">
          <div className="w-full max-w-[480px] space-y-8">
            <div className="lg:hidden text-center mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl mb-3">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Medha<span className="text-indigo-600">Shiri</span></h1>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Create Account</h2>
                <p className="text-gray-500 text-sm mt-1">Choose your account type to get started</p>
              </div>
              <Link href="/login" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Sign In →</Link>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {/* Student Card */}
              <button onClick={() => setType("student")} className="group bg-white rounded-2xl border-2 border-gray-200 p-6 text-left hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-100/50 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200 group-hover:scale-110 transition-transform">
                    <BookOpen className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">I&apos;m a Student</h3>
                    <p className="text-sm text-gray-500 mt-1">Create a student account to enroll in batches, view results, access study materials, and track your progress.</p>
                    <div className="flex items-center gap-1 mt-3 text-sm font-semibold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      Continue <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </button>

              {/* Management Card */}
              <button onClick={() => setType("management")} className="group bg-white rounded-2xl border-2 border-gray-200 p-6 text-left hover:border-violet-400 hover:shadow-xl hover:shadow-violet-100/50 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-200 group-hover:scale-110 transition-transform">
                    <Shield className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-violet-700 transition-colors">I&apos;m Management / Staff</h3>
                    <p className="text-sm text-gray-500 mt-1">Create a staff account (Teacher, Receptionist, or Accountant). Your account will be activated after admin approval.</p>
                    <div className="flex items-center gap-1 mt-3 text-sm font-semibold text-violet-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      Continue <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </button>
            </div>

            <div className="flex items-center justify-center gap-3">
              <Link href="/parent-portal" className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-indigo-200 hover:text-indigo-600 transition-all">Parent Portal</Link>
              <Link href="/enroll" className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-indigo-200 hover:text-indigo-600 transition-all">Quick Enroll</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Registration form
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-[460px] space-y-6">
        <button onClick={() => setType(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xl p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${type === "student" ? "bg-emerald-100" : "bg-violet-100"}`}>
              {type === "student" ? <BookOpen className={`w-5 h-5 text-emerald-600`} /> : <Shield className="w-5 h-5 text-violet-600" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{type === "student" ? "Student Registration" : "Staff Registration"}</h2>
              <p className="text-xs text-gray-500">{type === "student" ? "Create your student account" : "Requires admin approval after registration"}</p>
            </div>
          </div>

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input required value={form.name} onChange={e => update("name", e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200/80 rounded-xl text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  placeholder="Enter your full name" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="email" required value={form.email} onChange={e => update("email", e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200/80 rounded-xl text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  placeholder="your@email.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={form.phone} onChange={e => update("phone", e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200/80 rounded-xl text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  placeholder="01XXXXXXXXX" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type={showPassword ? "text" : "password"} required value={form.password} onChange={e => update("password", e.target.value)} minLength={6}
                  className="w-full pl-10 pr-12 py-3 bg-white border border-slate-200/80 rounded-xl text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  placeholder="Minimum 6 characters" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {type === "management" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                <select value={form.role} onChange={e => update("role", e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm">
                  <option value="teacher">Teacher</option>
                  <option value="receptionist">Receptionist</option>
                  <option value="accountant">Accountant</option>
                </select>
              </div>
            )}

            <button type="submit" disabled={loading}
              className={`w-full py-3.5 font-semibold rounded-xl shadow-lg text-white text-sm transition-all flex items-center justify-center gap-2 ${
                type === "student"
                  ? "bg-gradient-to-r from-emerald-500 to-teal-600 shadow-emerald-200 hover:opacity-95"
                  : "bg-gradient-to-r from-violet-600 to-purple-600 shadow-violet-200 hover:opacity-95"
              } disabled:opacity-60`}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</> : <>Create Account <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500">Already have an account? <Link href="/login" className="text-indigo-600 font-semibold hover:text-indigo-700">Sign In</Link></p>
        </div>
      </div>
    </div>
  )
}