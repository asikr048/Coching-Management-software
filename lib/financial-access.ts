import { createClient } from "@/lib/supabase/client"

/**
 * Check if the current logged-in staff has financial access.
 * - Owner always has financial access.
 * - Others need has_financial_access = true, granted by Owner or authorized Super Manager.
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

/**
 * Check if the current logged-in staff has Super Financial Access.
 * - Owner always has super financial access.
 * - Super Managers can be granted has_super_financial_access = true by Owner.
 * - With this permission, Super Managers can grant/revoke regular financial access to staff within their branches.
 */
export async function checkSuperFinancialAccess(): Promise<{
  hasSuperAccess: boolean
  role: string | null
  staffId?: string
  branchIds?: string[]
}> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { hasSuperAccess: false, role: null }

  const { data: staffRow } = await supabase
    .from("staff")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (!staffRow) return { hasSuperAccess: false, role: null }

  if (staffRow.role === "owner") {
    return {
      hasSuperAccess: true,
      role: "owner",
      staffId: staffRow.id,
      branchIds: [], // Empty means all branches
    }
  }

  const branches: string[] = []
  if (staffRow.branch_id) branches.push(staffRow.branch_id)
  if (Array.isArray(staffRow.branch_ids)) {
    staffRow.branch_ids.forEach((b: string) => {
      if (!branches.includes(b)) branches.push(b)
    })
  }

  const isSuperManagerWithAccess = staffRow.role === "super_manager" && !!staffRow.has_super_financial_access

  return {
    hasSuperAccess: isSuperManagerWithAccess,
    role: staffRow.role,
    staffId: staffRow.id,
    branchIds: branches,
  }
}

/**
 * Retrieve permitted branch IDs for the current staff.
 * - Owner: can access all branches (isAllBranches = true).
 * - Super Manager: can access all branches if branch_ids is empty or includes all, or assigned branches.
 * - Manager / Staff: can access their primary branch_id or branch_ids.
 */
export async function getStaffBranchAccess(): Promise<{
  isAllBranches: boolean
  permittedBranchIds: string[]
  role: string | null
}> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { isAllBranches: true, permittedBranchIds: [], role: null }

  const { data: staffRow } = await supabase
    .from("staff")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (!staffRow) return { isAllBranches: true, permittedBranchIds: [], role: null }

  if (staffRow.role === "owner") {
    return { isAllBranches: true, permittedBranchIds: [], role: "owner" }
  }

  const branches: string[] = []
  if (staffRow.branch_id) branches.push(staffRow.branch_id)
  if (Array.isArray(staffRow.branch_ids)) {
    staffRow.branch_ids.forEach((b: string) => {
      if (!branches.includes(b)) branches.push(b)
    })
  }

  // If super manager has no restriction specified, default to all branches
  if (staffRow.role === "super_manager" && branches.length === 0) {
    return { isAllBranches: true, permittedBranchIds: [], role: staffRow.role }
  }

  return {
    isAllBranches: false,
    permittedBranchIds: branches,
    role: staffRow.role,
  }
}
