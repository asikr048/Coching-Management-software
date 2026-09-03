"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { GraduationCap, Eye, EyeOff, Loader2, Mail, Lock, User, Phone, Users, TrendingUp, Star, ArrowRight, BookOpen, Copy, CheckCircle } from "lucide-react"
import Link from "next/link"

export default function SignupPage() {
  const [form, setForm] = useState({ name: "", email: "", confirmEmail: "", phone: "", password: "", confirmPassword: "" })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [generatedId, setGeneratedId] = useState("")
  const [copied, setCopied] = useState(false)
  const supabase = createClient()

  function update(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (form.email !== form.confirmEmail) { setError("Emails do not match"); return }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match"); return }
    if (form.password.length < 6) { setError("Password must be at least 6 characters"); return }

    setLoading(true)
    try {
      // Generate unique ID locally (MS-10001 to MS-99999)
      const userId = "MS-" + (10001 + Math.floor(Math.random() * 89999))

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.name, user_id: userId, phone: form.phone } }
      })
      if (authError) throw authError

      // Try to save to user_profiles
      await supabase.from("user_profiles").insert({
        user_id: userId,
        email: form.email,
        name: form.name,
        phone: form.phone || null,
        auth_user_id: authData.user?.id || null,
      })

      // Also create student entry in students table
      try {
        await supabase.from("students").insert({
          student_id: userId,
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          guardian_phone: form.phone || "N/A",
          is_active: true,
        })
      } catch {}

      setGeneratedId(userId)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed")
    } finally { setLoading(false) }
  }

  async function copyId() {
    await navigator.clipboard.writeText(generatedId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Success screen
  if (generatedId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Account Created!</h2>
          <p className="text-gray-500">Your unique login ID has been generated. Save it carefully!</p>

          <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-6 space-y-3">
            <p className="text-sm font-medium text-indigo-600">Your Login ID</p>
            <div className="flex items-center justify-center gap-3">
              <p className="text-4xl font-extrabold text-indigo-700 tracking-wider">{generatedId}</p>
              <button onClick={copyId} className="p-2 bg-white rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors">
                {copied ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5 text-indigo-600" />}
              </button>
            </div>
            <p className="text-xs text-indigo-500">Use this ID along with your password to log in</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
            <p className="text-sm font-semibold text-amber-800">⚠️ Important</p>
            <p className="text-sm text-amber-700 mt-1">Save your ID <span className="font-bold">{generatedId}</span> somewhere safe. You will need it every time you log in.</p>
          </div>

          <Link href="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:opacity-95 shadow-lg shadow-indigo-200 transition-all">
            Go to Login <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* LEFT — Branding */}
      <div className="hidden lg:flex lg:w-[52%] relative bg-gradient-to-br from-indigo-900 via-violet-900 to-purple-900 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDgpIi8+PC9nPjwvc3ZnPg==')] opacity-60" />
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] bg-violet-500/20 rounded-full blur-[80px]" />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10"><GraduationCap className="w-6 h-6 text-white" /></div>
            <span className="text-2xl font-bold text-white">Medha<span className="text-indigo-300">Shiree</span></span>
          </div>
          <div className="space-y-8 max-w-md">
            <h2 className="text-4xl font-extrabold text-white leading-tight">Join the Future of Coaching Management</h2>
            <p className="text-indigo-200/80 text-lg">Create your account and get a unique ID for instant access.</p>
            <div className="bg-white/[0.08] backdrop-blur-xl border border-white/[0.12] rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3"><div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" /><span className="text-white/60 text-sm font-medium">How it works</span></div>
              <div className="space-y-3">
                {["Fill in your details below", "You will get a unique ID (e.g. MS-10245)", "Use your ID + password to log in anytime"].map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center text-white text-xs font-bold">{i + 1}</div>
                    <p className="text-white/70 text-sm">{s}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-white/30 text-xs">&copy; {new Date().getFullYear()} MedhaShiree. All rights reserved.</p>
        </div>
      </div>

      {/* RIGHT — Form */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-6 sm:p-8 lg:p-12">
        <div className="w-full max-w-[420px] space-y-6">
          <div className="lg:hidden text-center mb-4">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl mb-3"><GraduationCap className="w-6 h-6 text-white" /></div>
            <h1 className="text-2xl font-bold text-gray-900">Medha<span className="text-indigo-600">Shiree</span></h1>
          </div>

          <div className="flex items-center justify-between">
            <div><h2 className="text-2xl font-bold text-gray-900">Create Account</h2><p className="text-gray-500 text-sm mt-1">Fill in your details to get your ID</p></div>
            <Link href="/login" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Sign In &rarr;</Link>
          </div>

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <div className="relative"><User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input required value={form.name} onChange={e => update("name", e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200/80 rounded-xl text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" placeholder="Enter your full name" /></div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="relative"><Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="email" required value={form.email} onChange={e => update("email", e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200/80 rounded-xl text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" placeholder="your@email.com" /></div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Email</label>
              <div className="relative"><Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="email" required value={form.confirmEmail} onChange={e => update("confirmEmail", e.target.value)} className={`w-full pl-10 pr-4 py-3 bg-white border rounded-xl text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm ${form.confirmEmail && form.email !== form.confirmEmail ? "border-red-300" : "border-slate-200/80"}`} placeholder="Confirm your email" /></div>
              {form.confirmEmail && form.email !== form.confirmEmail && <p className="text-xs text-red-500 mt-1">Emails do not match</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
              <div className="relative"><Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={form.phone} onChange={e => update("phone", e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200/80 rounded-xl text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" placeholder="01XXXXXXXXX" /></div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative"><Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type={showPassword ? "text" : "password"} required value={form.password} onChange={e => update("password", e.target.value)} minLength={6} className="w-full pl-10 pr-12 py-3 bg-white border border-slate-200/80 rounded-xl text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" placeholder="Minimum 6 characters" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
              <div className="relative"><Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type={showPassword ? "text" : "password"} required value={form.confirmPassword} onChange={e => update("confirmPassword", e.target.value)} className={`w-full pl-10 pr-4 py-3 bg-white border rounded-xl text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm ${form.confirmPassword && form.password !== form.confirmPassword ? "border-red-300" : "border-slate-200/80"}`} placeholder="Re-enter your password" /></div>
              {form.confirmPassword && form.password !== form.confirmPassword && <p className="text-xs text-red-500 mt-1">Passwords do not match</p>}
            </div>

            <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-95 disabled:opacity-60 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 text-sm">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</> : <>Create Account <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500">Already have an account? <Link href="/login" className="text-indigo-600 font-semibold hover:text-indigo-700">Sign In</Link></p>
        </div>
      </div>
    </div>
  )
}