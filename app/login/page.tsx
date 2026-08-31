"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { GraduationCap, Eye, EyeOff, Loader2, Mail, Lock, Users, TrendingUp, Star, ArrowRight, UserPlus, BookOpen } from "lucide-react"
import Link from "next/link"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [remember, setRemember] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw authError
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: staff } = await supabase.from("staff").select("role").eq("auth_user_id", user.id).single()
        const r = staff?.role
        if (r === "owner") router.push("/dashboard/owner")
        else if (r === "receptionist") router.push("/dashboard/reception")
        else if (r === "teacher") router.push("/dashboard/teacher")
        else if (r === "accountant") router.push("/dashboard/accountant")
        else router.push("/dashboard")
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.")
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex">
      {/* LEFT — Branding Panel */}
      <div className="hidden lg:flex lg:w-[52%] relative bg-gradient-to-br from-indigo-900 via-violet-900 to-purple-900 overflow-hidden">
        {/* Mesh / Grid texture */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDgpIi8+PC9nPjwvc3ZnPg==')] opacity-60" />
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] bg-violet-500/20 rounded-full blur-[80px]" />
        <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] bg-purple-400/10 rounded-full blur-[60px]" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">Medha<span className="text-indigo-300">Shiri</span></span>
          </div>

          {/* Headline */}
          <div className="space-y-8 max-w-md">
            <h2 className="text-4xl font-extrabold text-white leading-tight">
              Empowering Modern Education &amp; Streamlined Coaching
            </h2>
            <p className="text-indigo-200/80 text-lg leading-relaxed">
              Manage batches, track attendance, handle fees, and monitor student progress — all from one powerful platform.
            </p>

            {/* Glassmorphic Stats Card */}
            <div className="bg-white/[0.08] backdrop-blur-xl border border-white/[0.12] rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-white/60 text-sm font-medium">Platform Statistics</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Attendance Rate", value: "99.4%", icon: TrendingUp, color: "text-emerald-400" },
                  { label: "Active Students", value: "500+", icon: Users, color: "text-blue-400" },
                  { label: "Active Batches", value: "25+", icon: BookOpen, color: "text-violet-400" },
                  { label: "Pass Rate", value: "95%", icon: Star, color: "text-amber-400" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white/[0.08] rounded-lg flex items-center justify-center">
                      <s.icon className={`w-4 h-4 ${s.color}`} />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">{s.value}</p>
                      <p className="text-white/40 text-xs">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Testimonial */}
            <div className="bg-white/[0.05] backdrop-blur border border-white/[0.08] rounded-xl p-5">
              <div className="flex gap-0.5 mb-2">{[0,1,2,3,4].map(i => <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />)}</div>
              <p className="text-white/70 text-sm italic leading-relaxed">&ldquo;MedhaShiri transformed how we manage our coaching center. Attendance, fees, and results — everything is automated now.&rdquo;</p>
              <p className="text-white/40 text-xs mt-3">— Coaching Center Director, Rajshahi</p>
            </div>
          </div>

          {/* Footer */}
          <p className="text-white/30 text-xs">&copy; 2026 MedhaShiri. All rights reserved.</p>
        </div>
      </div>

      {/* RIGHT — Auth Form */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-6 sm:p-8 lg:p-12">
        <div className="w-full max-w-[420px] space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-4">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl mb-3">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Medha<span className="text-indigo-600">Shiri</span></h1>
          </div>

          {/* Header with Sign Up link */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
              <p className="text-gray-500 text-sm mt-1">Please enter your details to sign in</p>
            </div>
            <Link href="/signup" className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-semibold hover:bg-indigo-100 transition-colors">
              <UserPlus className="w-4 h-4" /> Sign Up
            </Link>
          </div>

          {/* Error */}
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200/80 rounded-xl text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition-shadow focus:shadow-md"
                  placeholder="your@email.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required
                  className="w-full pl-10 pr-12 py-3 bg-white border border-slate-200/80 rounded-xl text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition-shadow focus:shadow-md"
                  placeholder="Enter your password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm text-gray-600">Remember me</span>
              </label>
              <button type="button" className="text-sm text-indigo-600 font-medium hover:text-indigo-700">Forgot password?</button>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-95 disabled:opacity-60 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 text-sm">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center"><span className="bg-slate-50 px-3 text-xs text-gray-400">or continue with</span></div>
          </div>

          {/* Google Sign In */}
          <button onClick={async () => {
            const { error } = await supabase.auth.signInWithOAuth({
              provider: "google",
              options: { redirectTo: `${window.location.origin}/auth/callback` }
            })
            if (error) setError(error.message)
          }}
            className="w-full py-3 bg-white border border-slate-200/80 rounded-xl text-gray-700 font-medium text-sm hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-all flex items-center justify-center gap-3">
            <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 0 12c0 1.94.46 3.77 1.28 5.4l3.56-2.77v-.54Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"/></svg>
            Sign in with Google
          </button>

          {/* Footer Links */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link href="/parent-portal" className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-indigo-200 hover:text-indigo-600 transition-all">Parent Portal</Link>
            <Link href="/marketplace" className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-indigo-200 hover:text-indigo-600 transition-all">Courses</Link>
            <Link href="/enroll" className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-indigo-200 hover:text-indigo-600 transition-all">Enroll Now</Link>
          </div>
        </div>
      </div>
    </div>
  )
}