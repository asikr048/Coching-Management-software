import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import DashboardShell from "@/components/layout/DashboardShell"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data: staff } = await supabase.from("staff").select("*").eq("auth_user_id", user.id).maybeSingle()
  if (!staff) redirect("/student/profile")
  return (
    <DashboardShell staff={staff}>
      {children}
    </DashboardShell>
  )
}
