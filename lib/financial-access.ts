import { createClient } from "@/lib/supabase/client"

/**
 * Check if the current logged-in staff has financial access.
 * Owner always has financial access.
 * Others need has_financial_access = true, granted by the owner.
 */
export async function checkFinancialAccess(): Promise<{ hasAccess: boolean; role: string | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { hasAccess: false, role: null }

  const { data: staffRow } = await supabase
    .from("staff")
    .select("role, has_financial_access")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (!staffRow) return { hasAccess: false, role: null }

  // Owner always has financial access
  if (staffRow.role === "owner") return { hasAccess: true, role: "owner" }

  return { hasAccess: !!staffRow.has_financial_access, role: staffRow.role }
}
