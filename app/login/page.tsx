"use client"
import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Eye, EyeOff, Loader2, Lock, Users, TrendingUp, Star, ArrowRight, UserPlus, BookOpen, IdCard, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useBranding } from "@/components/providers/BrandingContext"
import { useLanguage } from "@/components/providers/LanguageContext"
import LanguageSelector from "@/components/ui/LanguageSelector"

function LoginFormContent() {
  const searchParams = useSearchParams()
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
      setError("Please enter your User ID or Email")
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

      // If authenticated user is Staff / Admin / Owner:
      if (role) {
        if (role === "owner" || role === "branch_director" || role === "super_manager" || role === "manager") {
          window.location.href = "/dashboard/owner"
        } else if (role === "receptionist") {
          window.location.href = "/dashboard/reception"
        } else if (role === "teacher") {
          window.location.href = "/dashboard/teacher"
        } else if (role === "accountant") {
          window.location.href = "/dashboard/accountant"
        } else {
          window.location.href = "/dashboard/owner"
        }
        return
      }

      // Non-staff accounts go to Student Portal
      window.location.href = "/student/profile"
    } catch (err: unknown) {
      console.error("Login error:", err)
      setError(err instanceof Error ? err.message : "Login failed. Please try again.")
      setLoading(false)
    }
  }

    const { branding } = useBranding()
    const { t } = useLanguage()

    return (
      <div className="w-full max-w-[420px] space-y-7">
        <div className="lg:hidden text-center mb-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full overflow-hidden mb-3 border border-slate-200 bg-white shadow-sm">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={`${branding.name} Logo`} className="w-full h-full object-cover rounded-full" />
            ) : null}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{branding.name}</h1>
        </div>
        {/* Header with Language Selector & Sign Up */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
              {t("welcome_back", { bn: "স্বাগতম", en: "Welcome back", mix: "Welcome back" })}
            </h2>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1 truncate">
              {t("sign_in_subtitle", {
                bn: `${branding.name} পোর্টালে প্রবেশ করুন`,
                en: `Sign in to your ${branding.name} portal`,
                mix: `Sign in to your ${branding.name} portal`,
              })}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <LanguageSelector variant="compact" />
            <Link
              href="/signup"
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs sm:text-sm font-semibold hover:bg-indigo-100 transition-colors shrink-0"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              <span className="hidden xs:inline">{t("sign_up", { bn: "সাইন আপ", en: "Sign Up", mix: "Sign Up" })}</span>
              <span className="xs:hidden">{t("join_now", { bn: "যুক্ত হোন", en: "Join", mix: "Join" })}</span>
            </Link>
          </div>
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
            {t("user_id_or_email", { bn: "ইউজার আইডি বা ইমেইল", en: "User ID or Email", mix: "User ID or Email" })}
          </label>
          <div className="relative">
            <IdCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={userId}
              onChange={e => setUserId(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200/80 rounded-xl text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition-shadow focus:shadow-md"
              placeholder="MS-00001 or your@email.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t("password", { bn: "পাসওয়ার্ড", en: "Password", mix: "Password" })}
          </label>
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
            <span className="text-sm text-gray-600">
              {t("remember_me", { bn: "মনে রাখুন", en: "Remember me", mix: "Remember me" })}
            </span>
          </label>
          <button type="button" className="text-sm text-brand-primary font-medium hover:underline">
            {t("forgot_password", { bn: "পাসওয়ার্ড ভুলে গেছেন?", en: "Forgot password?", mix: "Forgot password?" })}
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 brand-btn-primary disabled:opacity-60 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> {t("logging_in", { bn: "প্রবেশ করা হচ্ছে...", en: "Signing in...", mix: "Signing in..." })}
            </>
          ) : (
            <>
              {t("sign_in", { bn: "সাইন ইন", en: "Sign In", mix: "Sign In" })} <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="flex items-center justify-center gap-3 pt-2">
        <Link
          href="/parent-portal"
          className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-brand-primary hover:text-brand-primary transition-all"
        >
          Parent Portal
        </Link>
        <Link
          href="/marketplace"
          className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-brand-primary hover:text-brand-primary transition-all"
        >
          Courses
        </Link>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const { branding, theme } = useBranding()

  return (
    <div className="min-h-screen flex">
      {/* LEFT — Branding Panel */}
      <div className="hidden lg:flex lg:w-[52%] relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDgpIi8+PC9nPjwvc3ZnPg==')] opacity-60" />
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[100px]" style={{ backgroundColor: `${theme.primaryHex}35` }} />
        <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] rounded-full blur-[80px]" style={{ backgroundColor: `${theme.secondaryHex}35` }} />
        <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] rounded-full blur-[60px]" style={{ backgroundColor: `${theme.primaryHex}20` }} />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center border border-white/20 bg-white">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt={`${branding.name} Logo`} className="w-full h-full object-cover rounded-full" />
              ) : null}
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">{branding.name}</span>
          </div>

          <div className="space-y-8 max-w-md">
            <h2 className="text-4xl font-extrabold text-white leading-tight">Empowering Modern Education &amp; Streamlined Coaching</h2>
            <p className="text-slate-300 text-lg leading-relaxed">Manage batches, track attendance, handle fees, and monitor student progress — all from one powerful platform.</p>

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
              <p className="text-white/70 text-sm italic leading-relaxed">&ldquo;{branding.name} transformed how we manage our coaching center. Attendance, fees, and results — everything is automated now.&rdquo;</p>
              <p className="text-white/40 text-xs mt-3">&mdash; Academic Administration</p>
            </div>
          </div>

          <p className="text-white/30 text-xs">&copy; {new Date().getFullYear()} {branding.name}. All rights reserved.</p>
        </div>
      </div>

      {/* RIGHT — Auth Form */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-4 sm:p-8 lg:p-12">
        <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>}>
          <LoginFormContent />
        </Suspense>
      </div>
    </div>
  )
}