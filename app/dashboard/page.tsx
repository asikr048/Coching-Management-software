import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

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

  const role = staff?.role
  if (role === "owner" || role === "branch_director" || role === "super_manager" || role === "manager") redirect("/dashboard/owner")
  else if (role === "receptionist") redirect("/dashboard/reception")
  else if (role === "teacher") redirect("/dashboard/teacher")
  else if (role === "accountant") redirect("/dashboard/accountant")
  else redirect("/student/profile")
}
