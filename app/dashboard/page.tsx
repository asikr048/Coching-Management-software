import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data: staff } = await supabase.from("staff").select("role").eq("auth_user_id", user.id).single()
  const role = staff?.role
  if (role === "owner") redirect("/dashboard/owner")
  else if (role === "receptionist") redirect("/dashboard/reception")
  else if (role === "teacher") redirect("/dashboard/teacher")
  else if (role === "accountant") redirect("/dashboard/accountant")
  else redirect("/login")
}
