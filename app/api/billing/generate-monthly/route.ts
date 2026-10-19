import { NextRequest } from "next/server"
import { requireStaffRole, isAuthError } from "@/lib/api-auth"
import { generateMonthlyDues } from "@/lib/billing/generate-monthly"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(req: NextRequest) {
  const auth = await requireStaffRole(["owner", "super_manager", "manager", "accountant"]);
  if (isAuthError(auth)) return auth;

  return generateMonthlyDues(req)
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffRole(["owner", "super_manager", "manager", "accountant"]);
  if (isAuthError(auth)) return auth;

  return generateMonthlyDues(req)
}
