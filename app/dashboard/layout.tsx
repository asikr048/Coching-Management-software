import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import DashboardSidebar from "@/components/layout/DashboardSidebar"
import DashboardHeader from "@/components/layout/DashboardHeader"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data: staff } = await supabase.from("staff").select("*").eq("auth_user_id", user.id).maybeSingle()
  if (!staff) redirect("/student/profile")
  return (
    <div className="flex h-screen bg-gray-50">
      <DashboardSidebar role={staff.role} name={staff.name} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader user={staff} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
