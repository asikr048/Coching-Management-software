import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const batchId = resolvedParams.id
    if (!batchId) {
      return NextResponse.json({ error: "Batch ID is required" }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1. Fetch batch information (or course information if ID is a course)
    const { data: bData } = await admin
      .from("batches")
      .select("id, name, subject, branch_id")
      .eq("id", batchId)
      .maybeSingle()

    let batchData = bData
    let courseData: any = null
    if (!batchData) {
      const { data: cData } = await admin
        .from("courses")
        .select("id, title, category, branch_id")
        .eq("id", batchId)
        .maybeSingle()
      courseData = cData
    }

    const batchName = batchData?.name || courseData?.title || ""
    const batchNameLower = batchName.trim().toLowerCase()
    const branchId = batchData?.branch_id || courseData?.branch_id || null

    // 2. Fetch all materials
    const { data: allMats, error: matErr } = await admin
      .from("materials")
      .select("*")
      .order("created_at", { ascending: false })

    if (matErr) {
      console.error("Error fetching materials for batch:", matErr)
      return NextResponse.json({ error: matErr.message }, { status: 500 })
    }

    const candidateMaterials = allMats || []
    const bIdStr = String(batchId)

    // Filter materials for this batch or course
    const batchMaterials = candidateMaterials.filter((m: any) => {
      if (!m) return false

      // Direct single batch match
      if (m.batch_id && String(m.batch_id) === bIdStr) return true

      // Multi batch match via batch_ids (JSONB or array or string)
      if (m.batch_ids) {
        if (Array.isArray(m.batch_ids)) {
          if (m.batch_ids.some((bid: any) => String(bid) === bIdStr)) return true
        } else if (typeof m.batch_ids === "string") {
          try {
            const parsed = JSON.parse(m.batch_ids)
            if (Array.isArray(parsed) && parsed.some((bid: any) => String(bid) === bIdStr)) return true
          } catch {
            if (m.batch_ids.includes(bIdStr)) return true
          }
        }
      }

      // Direct Course Match
      if (m.course_id && (String(m.course_id) === bIdStr || (courseData && String(m.course_id) === String(courseData.id)))) return true

      // Course Title Match
      if (courseData?.title) {
        const cTitleLower = courseData.title.trim().toLowerCase()
        if (m.subject && String(m.subject).trim().toLowerCase() === cTitleLower) return true
        if (m.name && String(m.name).trim().toLowerCase().includes(cTitleLower)) return true
      }

      // Batch Name Match (e.g. "Asik")
      if (batchNameLower) {
        if (m.batch_name && String(m.batch_name).trim().toLowerCase() === batchNameLower) return true
        if (m.subject && String(m.subject).trim().toLowerCase() === batchNameLower) return true
        if (Array.isArray(m.batch_names) && m.batch_names.some((bn: any) => String(bn).trim().toLowerCase() === batchNameLower)) return true
      }

      // Material with no specific batch or course (general material for branch or coaching)
      const hasNoTarget = (!m.batch_id || m.batch_id === "" || m.batch_id === "all") &&
        (!m.batch_ids || (Array.isArray(m.batch_ids) && m.batch_ids.length === 0) || m.batch_ids === "[]") &&
        !m.course_id

      if (hasNoTarget) {
        if (m.branch_id && branchId) {
          return String(m.branch_id) === String(branchId)
        }
        return true
      }

      return false
    })

    // 3. Resolve student identity to check distribution records (material_issues)
    let candidateSids: string[] = []
    try {
      const cookieStore = await cookies()
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (supabaseUrl && supabaseKey && !supabaseUrl.includes("placeholder")) {
        const client = createServerClient(supabaseUrl, supabaseKey, {
          cookies: {
            getAll() { return cookieStore.getAll() },
            setAll() {}
          }
        })
        const { data: { user } } = await client.auth.getUser()
        if (user) {
          candidateSids.push(user.id)
          const { data: up } = await admin.from("user_profiles").select("user_id").eq("auth_user_id", user.id).maybeSingle()
          if (up?.user_id) candidateSids.push(up.user_id)

          const { data: stList } = await admin
            .from("students")
            .select("id, student_id")
            .or(`auth_user_id.eq.${user.id},email.ilike.${user.email || 'nonexistent'}${up?.user_id ? `,student_id.eq.${up.user_id}` : ''}`)

          if (stList) {
            stList.forEach((s: any) => {
              if (s.id) candidateSids.push(s.id)
              if (s.student_id) candidateSids.push(s.student_id)
            })
          }
        }
      }
    } catch {}

    candidateSids = Array.from(new Set(candidateSids.filter(Boolean)))

    let studentIssues: any[] = []
    if (candidateSids.length > 0) {
      const { data: issueData } = await admin
        .from("material_issues")
        .select("*, material:materials(*)")
        .in("student_id", candidateSids)

      if (issueData) {
        studentIssues = issueData
      }
    }

    const issuesMap = new Map<string, any>()
    studentIssues.forEach((iss: any) => {
      if (iss.material_id) issuesMap.set(String(iss.material_id), iss)
    })

    const combinedMaterials = batchMaterials.map((mat: any) => {
      const iss = issuesMap.get(String(mat.id))
      return {
        id: mat.id,
        material: mat,
        is_received: !!iss && iss.status !== "returned",
        is_returned: !!iss?.returned_at || iss?.status === "returned",
        issue_record: iss || null,
        issued_at: iss?.issued_at || null,
        return_due_date: iss?.return_due_date || null,
        returned_at: iss?.returned_at || null,
      }
    })

    // Also include any materials that the student was directly issued for this batch
    const seenMatIds = new Set(batchMaterials.map((m: any) => String(m.id)))
    studentIssues.forEach((iss: any) => {
      if (iss.material_id && !seenMatIds.has(String(iss.material_id))) {
        const mat = iss.material
        const isThisBatch = iss.batch_id === batchId ||
          mat?.batch_id === batchId ||
          mat?.course_id === batchId ||
          (Array.isArray(mat?.batch_ids) && mat.batch_ids.includes(batchId))

        if (isThisBatch && mat) {
          seenMatIds.add(String(iss.material_id))
          combinedMaterials.push({
            id: mat.id,
            material: mat,
            is_received: iss.status !== "returned",
            is_returned: !!iss.returned_at || iss.status === "returned",
            issue_record: iss,
            issued_at: iss.issued_at,
            return_due_date: iss.return_due_date,
            returned_at: iss.returned_at,
          })
        }
      }
    })

    // Deduplicate materials by ID and by signature (name + type + subject)
    const dedupedMaterials: any[] = []
    const seenIds = new Set<string>()
    const seenSignatures = new Set<string>()

    for (const item of combinedMaterials) {
      const mat = item.material || item
      const mId = String(mat.id || item.id || "")
      const sig = `${String(mat.name || "").trim().toLowerCase()}::${String(mat.type || "").trim()}::${String(mat.subject || "").trim().toLowerCase()}`

      if (mId && seenIds.has(mId)) continue
      if (sig && seenSignatures.has(sig)) continue

      if (mId) seenIds.add(mId)
      if (sig) seenSignatures.add(sig)
      dedupedMaterials.push(item)
    }

    return NextResponse.json({
      success: true,
      batch_id: batchId,
      batch_name: batchName,
      materials: dedupedMaterials,
      total_count: dedupedMaterials.length,
      received_count: dedupedMaterials.filter(m => m.is_received).length,
      pending_count: dedupedMaterials.filter(m => !m.is_received).length,
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      }
    })
  } catch (err: any) {
    console.error("Error in /api/student/batch/[id]/materials:", err)
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}
