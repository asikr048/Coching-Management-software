import NewStudentForm from "./NewStudentForm"
import { createClient } from "@/lib/supabase/server"

export default async function NewStudentPage() {
  const supabase = await createClient()
  const { data: batches } = await supabase
    .from("batches")
    .select("id, name, subject, class_level, max_seats, current_seats, monthly_fee, admission_fee")
    .eq("is_active", true)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Add New Student</h2>
        <p className="text-sm text-gray-500 mt-1">Fill in the student details and enroll them in a batch.</p>
      </div>
      <NewStudentForm batches={batches || []} />
    </div>
  )
}
