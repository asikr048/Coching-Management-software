import { createClient } from "@/lib/supabase/server"
import SettingsClient from "./SettingsClient"

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: staff } = await supabase.from("staff").select("role").eq("auth_user_id", user?.id || "").maybeSingle()

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-gray-900">Settings</h2><p className="text-sm text-gray-500 mt-1">Manage system configuration, payment accounts, and approvers</p></div>
      <SettingsClient myRole={staff?.role || "manager"} />
    </div>
  )
}
