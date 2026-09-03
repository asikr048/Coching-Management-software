import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import StudentsClient from "./StudentsClient"

export default async function StudentsPage() {
  const supabase = await createClient()
  const { data: students } = await supabase
    .from("students")
    .select("*, enrollments(batch_id, status, batch:batches(name))")
    .order("created_at", { ascending: false })

  const { data: batches } = await supabase
    .from("batches")
    .select("id, name")
    .eq("is_active", true)

  const { data: feeDues } = await supabase
    .from("fee_dues")
    .select("student_id, due_amount, paid_amount, due_date, status")
    .in("status", ["pending", "partial"])

  const { data: examResults } = await supabase
    .from("exam_results")
    .select("student_id, obtained_marks, exams(total_marks)")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Students</h2>
          <p className="text-sm text-gray-500 mt-1">{students?.length || 0} total students</p>
        </div>
        <div className="flex gap-3">
          <Link href="/enroll" target="_blank" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
            Public Enroll Form
          </Link>
          <Link href="/dashboard/owner/students/new" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
            + Add Student
          </Link>
        </div>
      </div>
      <StudentsClient 
        students={students || []} 
        batches={batches || []}
        dueData={feeDues || []}
        examData={examResults as any || []}
      />
    </div>
  )
}
