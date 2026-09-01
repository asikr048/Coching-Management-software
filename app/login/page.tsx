"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { GraduationCap, Eye, EyeOff, Loader2, Lock, Users, TrendingUp, Star, ArrowRight, UserPlus, BookOpen, IdCard } from "lucide-react"
import Link from "next/link"

export default function LoginPage() {
  const [userId, setUserId] = useState("")
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
      let email = userId.trim()

      // If input looks like an ID (e.g. MS-10234), look up the email
      if (!email.includes("@")) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("email")
          .eq("user_id", email.toUpperCase())
          .maybeSingle()
        if (!profile) {
          setError("User ID not found. Please check your ID or use your email.")
          setLoading(false)
          return
        }
        email = profile.email
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (authError) throw authError

      const user = authData.user
      if (user) {
        // Auto-link staff record if auth_user_id is not set
        let { data: staff } = await supabase
          .from("staff")
          .select("id, role, auth_user_id")
          .eq("auth_user_id", user.id)
          .maybeSingle()

        if (!staff && user.email) {
          const { data: staffByEmail } = await supabase
            .from("staff")
            .select("id, role, auth_user_id")
            .eq("email", user.email)
            .maybeSingle()
          if (staffByEmail) {
            await supabase.from("staff").update({ auth_user_id: user.id }).eq("id", staffByEmail.id)
            staff = staffByEmail
          }
        }

        const r = staff?.role
        if (r === "owner") window.location.href = "/dashboard/owner"
        else if (r === "receptionist") window.location.href = "/dashboard/reception"
        else if (r === "teacher") window.location.href = "/dashboard/teacher"
        else if (r === "accountant") window.location.href = "/dashboard/accountant"
        else window.location.href = "/student/profile"
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* LEFT — Branding Panel */}
      <div className="hidden lg:flex lg:w-[52%] relative bg-gradient-to-br from-indigo-900 via-violet-900 to-purple-900 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDgpIi8+PC9nPjwvc3ZnPg==')] opacity-60" />
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] bg-violet-500/20 rounded-full blur-[80px]" />
        <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] bg-purple-400/10 rounded-full blur-[60px]" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10"><GraduationCap className="w-6 h-6 text-white" /></div>
            <span className="text-2xl font-bold text-white tracking-tight">Medha<span className="text-indigo-300">Shiri</span></span>
          </div>

          <div className="space-y-8 max-w-md">
            <h2 className="text-4xl font-extrabold text-white leading-tight">Empowering Modern Education &amp; Streamlined Coaching</h2>
            <p className="text-indigo-200/80 text-lg leading-relaxed">Manage batches, track attendance, handle fees, and monitor student progress — all from one powerful platform.</p>

            <div className="bg-white/[0.08] backdrop-blur-xl border border-white/[0.12] rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3"><div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" /><span className="text-white/60 text-sm font-medium">Platform Statistics</span></div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Attendance Rate", value: "99.4%", icon: TrendingUp, color: "text-emerald-400" },
                  { label: "Active Students", value: "500+", icon: Users, color: "text-blue-400" },
                  { label: "Active Batches", value: "25+", icon: BookOpen, color: "text-violet-400" },
                  { label: "Pass Rate", value: "95%", icon: Star, color: "text-amber-400" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white/[0.08] rounded-lg flex items-center justify-center"><s.icon className={`w-4 h-4 ${s.color}`} /></div>
                    <div><p className="text-white font-bold text-sm">{s.value}</p><p className="text-white/40 text-xs">{s.label}</p></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/[0.05] backdrop-blur border border-white/[0.08] rounded-xl p-5">
              <div className="flex gap-0.5 mb-2">{[0,1,2,3,4].map(i => <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />)}</div>
              <p className="text-white/70 text-sm italic leading-relaxed">&ldquo;MedhaShiri transformed how we manage our coaching center. Attendance, fees, and results — everything is automated now.&rdquo;</p>
              <p className="text-white/40 text-xs mt-3">&mdash; Coaching Center Director, Rajshahi</p>
            </div>
          </div>

          <p className="text-white/30 text-xs">&copy; 2026 MedhaShiri. All rights reserved.</p>
        </div>
      </div>

      {/* RIGHT — Auth Form */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-6 sm:p-8 lg:p-12">
        <div className="w-full max-w-[420px] space-y-8">
          <div className="lg:hidden text-center mb-4">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl mb-3"><GraduationCap className="w-6 h-6 text-white" /></div>
            <h1 className="text-2xl font-bold text-gray-900">Medha<span className="text-indigo-600">Shiri</span></h1>
          </div>

          <div className="flex items-center justify-between">
            <div><h2 className="text-2xl font-bold text-gray-900">Welcome back</h2><p className="text-gray-500 text-sm mt-1">Enter your ID and password to sign in</p></div>
            <Link href="/signup" className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-semibold hover:bg-indigo-100 transition-colors"><UserPlus className="w-4 h-4" /> Sign Up</Link>
          </div>

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">User ID or Email</label>
              <div className="relative">
                <IdCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={userId} onChange={e => setUserId(e.target.value)} required
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200/80 rounded-xl text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition-shadow focus:shadow-md"
                  placeholder="MS-10001 or your@email.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required
                  className="w-full pl-10 pr-12 py-3 bg-white border border-slate-200/80 rounded-xl text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition-shadow focus:shadow-md"
                  placeholder="Enter your password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm text-gray-600">Remember me</span>
              </label>
              <button type="button" className="text-sm text-indigo-600 font-medium hover:text-indigo-700">Forgot password?</button>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-95 disabled:opacity-60 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 text-sm">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>


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