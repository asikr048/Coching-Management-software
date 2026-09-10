"use client"
import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { GraduationCap, Eye, EyeOff, Loader2, Lock, Users, TrendingUp, Star, ArrowRight, UserPlus, BookOpen, IdCard, AlertCircle } from "lucide-react"
import Link from "next/link"

function LoginFormContent() {
  const searchParams = useSearchParams()
  const [loginTab, setLoginTab] = useState<"student" | "staff">(() => {
    const roleParam = searchParams.get("role")
    return roleParam === "staff" ? "staff" : "student"
  })
  const [userId, setUserId] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [remember, setRemember] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const emailParam = searchParams.get("email")
    const idParam = searchParams.get("id")
    const roleParam = searchParams.get("role")
    if (roleParam === "staff") {
      setLoginTab("staff")
    } else if (idParam || roleParam === "student") {
      setLoginTab("student")
    }
    if (emailParam) {
      setUserId(emailParam)
    } else if (idParam) {
      setUserId(idParam)
    }
  }, [searchParams])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const rawInput = userId.trim()
    if (!rawInput) {
      setError(loginTab === "student" ? "Please enter your Student ID or Email" : "Please enter your Staff Email or User ID")
      setLoading(false)
      return
    }
    if (!password) {
      setError("Please enter your password")
      setLoading(false)
      return
    }

    try {
      let candidateEmails: string[] = []

      // 1. Try to resolve identity via backend API
      try {
        const resolveRes = await fetch("/api/auth/resolve-identity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: rawInput }),
        })
        if (resolveRes.ok) {
          const resolveData = await resolveRes.json()
          if (Array.isArray(resolveData.candidateEmails) && resolveData.candidateEmails.length > 0) {
            candidateEmails = resolveData.candidateEmails
          }
        }
      } catch {
        // Fall back to client-side resolution if network fails
      }

      // 2. Client-side fallback if candidateEmails is empty
      if (candidateEmails.length === 0) {
        if (rawInput.includes("@")) {
          candidateEmails.push(rawInput.toLowerCase())
        } else {
          const cleanId = rawInput.toUpperCase().startsWith("MS-")
            ? rawInput.toUpperCase()
            : `MS-${rawInput.toUpperCase()}`

          const { data: profile } = await supabase
            .from("user_profiles")
            .select("email")
            .ilike("user_id", cleanId)
            .maybeSingle()

          if (profile?.email) {
            candidateEmails.push(profile.email.toLowerCase())
          }

          const { data: student } = await supabase
            .from("students")
            .select("email")
            .ilike("student_id", cleanId)
            .maybeSingle()

          if (student?.email && !candidateEmails.includes(student.email.toLowerCase())) {
            candidateEmails.push(student.email.toLowerCase())
          }

          const synthetic = `${cleanId.toLowerCase()}@medhashiree.local`
          if (!candidateEmails.includes(synthetic)) {
            candidateEmails.push(synthetic)
          }
        }
      }

      // 3. Attempt signInWithPassword across candidate emails
      let authUser = null
      let lastAuthError: Error | null = null

      for (const email of candidateEmails) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (!authError && authData.user) {
          authUser = authData.user
          break
        }

        if (authError) {
          lastAuthError = authError
          // If unconfirmed, resolve-identity already triggered confirmation; retry this email once
          if (authError.message.toLowerCase().includes("email not confirmed")) {
            try {
              await fetch("/api/auth/resolve-identity", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier: email }),
              })
              const retry = await supabase.auth.signInWithPassword({ email, password })
              if (!retry.error && retry.data.user) {
                authUser = retry.data.user
                break
              }
            } catch {}
          }
        }
      }

      if (!authUser) {
        if (lastAuthError) {
          const msg = lastAuthError.message.toLowerCase()
          if (msg.includes("invalid login credentials") || msg.includes("invalid password")) {
            setError("Incorrect password or login details. Please check your credentials.")
          } else if (msg.includes("email not confirmed")) {
            setError("Your account email is being verified. Please try again.")
          } else {
            setError(lastAuthError.message)
          }
        } else {
          setError("No account found with this ID or Email. Please check your input or sign up.")
        }
        setLoading(false)
        return
      }

      // Clear any cached student profile in sessionStorage to prevent stale data
      try {
        sessionStorage.removeItem("ms_student_profile_cache")
      } catch {}

      // 4. Successful login: auto-link staff record if applicable and redirect
      let { data: staff } = await supabase
        .from("staff")
        .select("id, role, auth_user_id")
        .eq("auth_user_id", authUser.id)
        .maybeSingle()

      if (!staff && authUser.email) {
        const { data: staffByEmail } = await supabase
          .from("staff")
          .select("id, role, auth_user_id")
          .ilike("email", authUser.email)
          .maybeSingle()

        if (staffByEmail) {
          await supabase.from("staff").update({ auth_user_id: authUser.id }).eq("id", staffByEmail.id)
          staff = staffByEmail
        }
      }

      const role = staff?.role
      const redirectParam = searchParams.get("redirect")
      if (redirectParam && redirectParam.startsWith("/")) {
        window.location.href = redirectParam
        return
      }

      // Check if user logged in using a Student ID (e.g. MS-00001, 00001) or explicit Student Portal tab
      const isStudentIdInput = !rawInput.includes("@") || /^MS-/i.test(rawInput)

      if (loginTab === "student" || isStudentIdInput) {
        // Direct to Student Portal immediately
        window.location.href = "/student/profile"
        return
      }

      if (role === "owner" || role === "branch_director" || role === "super_manager" || role === "manager") {
        window.location.href = "/dashboard/owner"
      } else if (role === "receptionist") {
        window.location.href = "/dashboard/reception"
      } else if (role === "teacher") {
        window.location.href = "/dashboard/teacher"
      } else if (role === "accountant") {
        window.location.href = "/dashboard/accountant"
      } else {
        window.location.href = "/student/profile"
      }
    } catch (err: unknown) {
      console.error("Login error:", err)
      setError(err instanceof Error ? err.message : "Login failed. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-[420px] space-y-7">
      <div className="lg:hidden text-center mb-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full overflow-hidden mb-3 border border-indigo-200 bg-white shadow-sm">
          <img src="/logo.jpg" alt="MedhaShiree Logo" className="w-full h-full object-cover rounded-full" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Medha<span className="text-indigo-600">Shiree</span></h1>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
          <p className="text-gray-500 text-sm mt-1">Sign in to your MedhaShiree portal</p>
        </div>
        <Link
          href="/signup"
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-semibold hover:bg-indigo-100 transition-colors"
        >
          <UserPlus className="w-4 h-4" /> Sign Up
        </Link>
      </div>

      {/* Role Selection Tabs */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/80 shadow-2xs">
        <button
          type="button"
          onClick={() => {
            setLoginTab("student")
            setError("")
          }}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            loginTab === "student"
              ? "bg-white text-indigo-700 shadow-xs border border-indigo-100 font-extrabold"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
          }`}
        >
          <GraduationCap className="w-4 h-4 text-indigo-600" />
          <span>Student (শিক্ষার্থী)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setLoginTab("staff")
            setError("")
          }}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            loginTab === "staff"
              ? "bg-white text-amber-900 shadow-xs border border-amber-200 font-extrabold"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
          }`}
        >
          <Lock className="w-4 h-4 text-amber-600" />
          <span>Staff / Admin (ম্যানেজমেন্ট)</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {loginTab === "student" ? "Student ID or Registered Email" : "Staff Email or Admin ID"}
          </label>
          <div className="relative">
            <IdCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={userId}
              onChange={e => setUserId(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200/80 rounded-xl text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition-shadow focus:shadow-md"
              placeholder={loginTab === "student" ? "e.g. MS-00001 or your@email.com" : "e.g. asikr048@gmail.com or admin ID"}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full pl-10 pr-12 py-3 bg-white border border-slate-200/80 rounded-xl text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition-shadow focus:shadow-md"
              placeholder="Enter your password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-600">Remember me</span>
          </label>
          <button type="button" className="text-sm text-indigo-600 font-medium hover:text-indigo-700">
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-95 disabled:opacity-60 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 text-sm"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Signing in...
            </>
          ) : (
            <>
              Sign In <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="flex items-center justify-center gap-3 pt-2">
        <Link
          href="/parent-portal"
          className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-indigo-200 hover:text-indigo-600 transition-all"
        >
          Parent Portal
        </Link>
        <Link
          href="/marketplace"
          className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-indigo-200 hover:text-indigo-600 transition-all"
        >
          Courses
        </Link>
      </div>
    </div>
  )
}

export default function LoginPage() {
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
            <div className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center border border-white/20 bg-white">
              <img src="/logo.jpg" alt="MedhaShiree Logo" className="w-full h-full object-cover rounded-full" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">Medha<span className="text-indigo-300">Shiree</span></span>
          </div>

          <div className="space-y-8 max-w-md">
            <h2 className="text-4xl font-extrabold text-white leading-tight">Empowering Modern Education &amp; Streamlined Coaching</h2>
            <p className="text-indigo-200/80 text-lg leading-relaxed">Manage batches, track attendance, handle fees, and monitor student progress — all from one powerful platform.</p>

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

            <div className="bg-white/[0.05] backdrop-blur border border-white/[0.08] rounded-xl p-5">
              <div className="flex gap-0.5 mb-2">
                {[0, 1, 2, 3, 4].map(i => (
                  <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-white/70 text-sm italic leading-relaxed">&ldquo;MedhaShiree transformed how we manage our coaching center. Attendance, fees, and results — everything is automated now.&rdquo;</p>
              <p className="text-white/40 text-xs mt-3">&mdash; Coaching Center Director, Rajshahi</p>
            </div>
          </div>

          <p className="text-white/30 text-xs">&copy; {new Date().getFullYear()} MedhaShiree. All rights reserved.</p>
        </div>
      </div>

      {/* RIGHT — Auth Form */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-6 sm:p-8 lg:p-12">
        <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>}>
          <LoginFormContent />
        </Suspense>
      </div>
    </div>
  )
}