import { createClient } from "@/lib/supabase/server"
import StaffClient from "./StaffClient"

export default async function StaffPage() {
  const supabase = await createClient()
  const { data: staff } = await supabase.from("staff").select("*").order("created_at", { ascending: false })
  const { data: { user } } = await supabase.auth.getUser()
  const { data: currentStaff } = await supabase.from("staff").select("role").eq("auth_user_id", user?.id || "").maybeSingle()
  const myRole = currentStaff?.role || "manager"

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-gray-900">Staff Management</h2><p className="text-sm text-gray-500 mt-1">Manage teachers, receptionists, accountants, and managers</p></div>
      <StaffClient staff={staff || []} myRole={myRole} />
    </div>
  )
}
