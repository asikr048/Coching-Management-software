"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Loader2, GraduationCap } from "lucide-react"

export default function AuthHandlerPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function handleAuth() {
      // Wait a moment for Supabase to detect session from URL hash
      await new Promise(r => setTimeout(r, 1000))

      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login?error=auth_failed")
        return
      }

      // Auto-link staff record by email
      if (user.email) {
        const { data: matchingStaff } = await supabase.from("staff").select("*").eq("email", user.email).single()
        if (matchingStaff && matchingStaff.auth_user_id !== user.id) {
          await supabase.from("staff").update({ auth_user_id: user.id }).eq("id", matchingStaff.id)
        }
      }

      // Check role and redirect
      const { data: staff } = await supabase.from("staff").select("role").eq("auth_user_id", user.id).maybeSingle()
      const role = staff?.role
      if (role === "owner" || role === "super_manager" || role === "manager") { router.push("/dashboard/owner"); return }
      if (role === "receptionist") { router.push("/dashboard/reception"); return }
      if (role === "teacher") { router.push("/dashboard/teacher"); return }
      if (role === "accountant") { router.push("/dashboard/accountant"); return }

      // Non-staff user
      router.push("/student/profile")
    }

    handleAuth()
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center">
        <GraduationCap className="w-6 h-6 text-white" />
      </div>
      <div className="flex items-center gap-2 text-gray-600">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
        <span className="font-medium">Signing you in...</span>
      </div>
    </div>
  )
}