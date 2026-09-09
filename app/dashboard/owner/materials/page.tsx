import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import MaterialsClient from "./MaterialsClient"

export default async function MaterialsPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  // 1. Materials
  let materials: any[] = []
  try {
    const { data } = await admin.from("materials").select("*").order("created_at", { ascending: false })
    if (data && data.length > 0) {
      materials = data
    } else {
      const { data: cData } = await supabase.from("materials").select("*").order("created_at", { ascending: false })
      if (cData && cData.length > 0) materials = cData
    }
  } catch (e) {
    console.warn("Could not load materials from supabase:", e)
  }

  // 2. Material issues
  let issues: any[] = []
  try {
    const { data } = await admin
      .from("material_issues")
      .select("*, student:students(id, name, student_id, phone), batch:batches(id, name)")
      .order("issued_at", { ascending: false })
    if (data && data.length > 0) {
      issues = data
    } else {
      const { data: cIssues } = await supabase
        .from("material_issues")
        .select("*, student:students(id, name, student_id, phone), batch:batches(id, name)")
        .order("issued_at", { ascending: false })
      if (cIssues && cIssues.length > 0) issues = cIssues
    }
  } catch (e) {
    console.warn("Could not load material_issues from supabase:", e)
  }

  // 3. Batches with branch_id
  let batches: any[] = []
  try {
    const { data } = await supabase.from("batches").select("id, name, subject, is_active, branch_id").order("name")
    if (data) batches = data
  } catch (e) {
    console.warn("Could not load batches from supabase:", e)
  }

  // 3b. Branches
  let branches: any[] = []
  try {
    const { data: bData } = await supabase.from("branches").select("*").eq("is_active", true).order("name")
    if (bData) branches = bData
  } catch (e) {
    console.warn("Could not load branches from supabase:", e)
  }

  // 3c. Courses
  let courses: any[] = []
  try {
    const { data: cData } = await admin
      .from("courses")
      .select("id, title, category, branch_id, price")
      .order("title")
    if (cData) courses = cData
  } catch (e) {
    console.warn("Could not load courses from supabase:", e)
  }

  // 4. Students
  let students: any[] = []
  try {
    const { data } = await supabase
      .from("students")
      .select("id, name, student_id, phone, guardian_phone, is_active, enrollments(batch_id, status, batch:batches(name))")
      .order("name")
    if (data) students = data
  } catch (e) {
    console.warn("Could not load students from supabase:", e)
  }

  // 5. Current staff
  const { data: { user } } = await supabase.auth.getUser()
  let staff: any = null
  if (user) {
    const { data: s } = await supabase.from("staff").select("id, name, email, role").eq("auth_user_id", user.id).maybeSingle()
    if (s) staff = s
  }
  const currentStaff = staff || {
    id: user?.id || "admin-owner",
    name: user?.user_metadata?.name || "Admin Owner",
    email: user?.email || "admin@medhashiree.com",
    role: "owner"
  }

  return (
    <MaterialsClient 
      initialMaterials={materials}
      initialIssues={issues}
      batches={batches}
      branches={branches}
      courses={courses}
      students={students}
      currentStaff={currentStaff}
    />
  )
}
