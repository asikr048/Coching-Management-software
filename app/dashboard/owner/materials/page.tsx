import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import MaterialsClient from "./MaterialsClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function MaterialsPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  // 1. Materials with automatic duplicate pruning
  let materials: any[] = []
  try {
    const { data } = await admin.from("materials").select("*").order("created_at", { ascending: false })
    const rawList = data && data.length > 0 ? data : (await supabase.from("materials").select("*").order("created_at", { ascending: false })).data || []

    if (rawList.length > 0) {
      const seenSignatures = new Map<string, string>()
      const duplicateIdsToDelete: string[] = []

      for (const m of rawList) {
        const sig = `${(m.name || "").trim().toLowerCase()}::${(m.type || "").trim()}::${(m.subject || "").trim().toLowerCase()}::${m.batch_id || ""}::${m.course_id || ""}`
        if (seenSignatures.has(sig)) {
          duplicateIdsToDelete.push(m.id)
        } else {
          seenSignatures.set(sig, m.id)
          materials.push(m)
        }
      }

      // Automatically remove duplicate ghost rows from Supabase database in background
      if (duplicateIdsToDelete.length > 0) {
        try {
          await admin.from("material_issues").delete().in("material_id", duplicateIdsToDelete)
          await admin.from("materials").delete().in("id", duplicateIdsToDelete)
        } catch (delErr) {
          console.warn("Notice pruning duplicate materials:", delErr)
        }
      }
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

  // 2b. Dynamic stock synchronization: compute available_stock directly from active issues
  const activeIssuesByMatId = new Map<string, number>()
  const activeIssuesByMatName = new Map<string, number>()

  issues.forEach((iss: any) => {
    if (iss.status === "issued") {
      if (iss.material_id) {
        activeIssuesByMatId.set(iss.material_id, (activeIssuesByMatId.get(iss.material_id) || 0) + 1)
      }
      const matName = (iss.material?.name || (iss as any).material_name || "").trim().toLowerCase()
      if (matName) {
        activeIssuesByMatName.set(matName, (activeIssuesByMatName.get(matName) || 0) + 1)
      }
    }
  })

  materials = materials.map((m: any) => {
    const byId = activeIssuesByMatId.get(m.id) || 0
    const byName = activeIssuesByMatName.get((m.name || "").trim().toLowerCase()) || 0
    const activeCount = Math.max(byId, byName)
    const totalStock = Number(m.total_stock) || 0
    const dynamicAvailable = Math.max(0, totalStock - activeCount)

    // In the background, ensure Supabase DB column reflects the exact dynamic stock
    if (m.available_stock !== dynamicAvailable) {
      admin.from("materials").update({ available_stock: dynamicAvailable }).eq("id", m.id).then(() => {})
    }

    return {
      ...m,
      available_stock: dynamicAvailable
    }
  })

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
      .select("id, name, student_id, roll_no, batch_roll, phone, guardian_phone, is_active, enrollments(batch_id, roll_no, status, batch:batches(name))")
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
