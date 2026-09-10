import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import Link from "next/link"
import StudentsClient from "./StudentsClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function StudentsPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  // Query with admin client to bypass any RLS policy restrictions for owner dashboard
  const [studentsRes, batchesRes, feeDuesRes, examResultsRes, userRes] = await Promise.all([
    admin
      .from("students")
      .select("*, enrollments(batch_id, status, roll_no, batch:batches(name))")
      .order("created_at", { ascending: false }),
    admin
      .from("batches")
      .select("id, name")
      .eq("is_active", true),
    admin
      .from("fee_dues")
      .select("id, student_id, batch_id, due_month, due_amount, paid_amount, due_date, status, batch:batches(id, name)")
      .order("due_date", { ascending: true }),
    admin
      .from("exam_results")
      .select("student_id, obtained_marks, exams(total_marks)"),
    supabase.auth.getUser()
  ])

  let students = studentsRes.data || []
  if (students.length === 0) {
    // Fallback to supabase session client if admin returned empty
    const { data: fallbackStudents } = await supabase
      .from("students")
      .select("*, enrollments(batch_id, status, roll_no, batch:batches(name))")
      .order("created_at", { ascending: false })
    if (fallbackStudents && fallbackStudents.length > 0) {
      students = fallbackStudents
    }
  }

  const batches = batchesRes.data || []
  const feeDues = feeDuesRes.data || []
  const examResults = examResultsRes.data || []
  const user = userRes.data?.user

  const { data: staff } = user
    ? await admin.from("staff").select("id, name, email, role").eq("auth_user_id", user.id).maybeSingle()
    : { data: null }

  let initialDeletionRequests: any[] = []
  try {
    const { data: requests } = await admin
      .from("student_deletion_requests")
      .select("*")
      .order("created_at", { ascending: false })
    if (requests) initialDeletionRequests = requests
  } catch (e) {
    // Falls back gracefully
  }

  const currentStaff = staff || {
    id: user?.id || "admin-owner",
    name: user?.user_metadata?.name || "Admin Owner",
    email: user?.email || "admin@medhashiree.com",
    role: "owner" as const,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Students</h2>
          <p className="text-sm text-gray-500 mt-1">{students?.length || 0} total students</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/owner/students/new" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
            + Add Student
          </Link>
        </div>
      </div>
      <StudentsClient 
        students={students || []} 
        batches={batches || []}
        dueData={(feeDues as any) || []}
        examData={examResults as any || []}
        currentStaff={currentStaff}
        initialDeletionRequests={initialDeletionRequests}
      />
    </div>
  )
}
