// Safe enrollment insertion and batch matching helpers

export interface BatchItem {
  id: string
  name?: string | null
  branch_id?: string | null
  origin_batch_id?: string | null
  class_level?: string | null
  monthly_fee?: number | null
  max_seats?: number | null
  current_seats?: number | null
  is_active?: boolean | null
}

export function isClassLevelMatch(
  studentClass?: string | null, 
  batchClass?: string | null, 
  batchName?: string | null
): boolean {
  if (!studentClass || !studentClass.trim()) return false
  const sNorm = studentClass.trim().toLowerCase().replace(/[-_\s]+/g, " ")
  const bNorm = (batchClass || "").trim().toLowerCase().replace(/[-_\s]+/g, " ")
  const nameNorm = (batchName || "").trim().toLowerCase().replace(/[-_\s]+/g, " ")

  // Direct exact or substring match with batch class_level
  if (bNorm && (sNorm === bNorm || sNorm.includes(bNorm) || bNorm.includes(sNorm))) {
    return true
  }

  // HSC variations: "hsc", "hsc 2027", "hsc 27", "hsc-2027", "class 11", "class 12"
  const isStudentHsc = sNorm.includes("hsc") || sNorm.includes("11") || sNorm.includes("12")
  const isBatchHsc = bNorm.includes("hsc") || nameNorm.includes("hsc") || nameNorm.includes("2027")
  if (isStudentHsc && isBatchHsc) {
    return true
  }

  // Specific class checks: Class 6 through Class 12
  for (const lvl of ["class 6", "class 7", "class 8", "class 9", "class 10", "class 11", "class 12"]) {
    if (sNorm.includes(lvl)) {
      if (bNorm.includes(lvl) || nameNorm.includes(lvl)) return true
      return false
    }
  }

  // Direct match with batch name if meaningful
  if (nameNorm && (nameNorm.includes(sNorm) || sNorm.includes(nameNorm))) {
    return true
  }

  return false
}

export function getBatchFamilyIds(
  batch: { id: string; origin_batch_id?: string | null; name?: string | null } | null | undefined, 
  allBatches: any[] = []
): Set<string> {
  const ids = new Set<string>()
  if (!batch || !batch.id) return ids
  ids.add(batch.id)
  if (batch.origin_batch_id) ids.add(batch.origin_batch_id)

  const bName = batch.name?.trim().toLowerCase()

  allBatches.forEach(b => {
    if (!b || !b.id) return
    if (b.origin_batch_id && (b.origin_batch_id === batch.id || (batch.origin_batch_id && b.origin_batch_id === batch.origin_batch_id))) {
      ids.add(b.id)
    }
    if (bName && b.name && b.name.trim().toLowerCase() === bName) {
      ids.add(b.id)
    }
  })

  return ids
}

export async function safeInsertEnrollments(db: any, enrollments: any[]) {
  if (!enrollments || enrollments.length === 0) return []

  const cleanItems = enrollments.map(item => {
    const entry: Record<string, any> = {
      student_id: item.student_id,
      batch_id: item.batch_id,
      status: item.status || "active"
    }
    if (item.branch_id) entry.branch_id = item.branch_id
    if (item.roll_no != null && Number(item.roll_no) > 0) entry.roll_no = Number(item.roll_no)
    if (item.enrollment_date) entry.enrollment_date = item.enrollment_date
    if (item.notes) entry.notes = item.notes
    if (item.final_monthly_fee != null) entry.final_monthly_fee = Number(item.final_monthly_fee)
    return entry
  })

  try {
    const { data, error } = await db.from("enrollments").insert(cleanItems).select()
    if (!error && data) return data

    // Retry 1: strip final_monthly_fee if that was rejected
    const withoutFee = cleanItems.map(({ final_monthly_fee, ...rest }) => rest)
    const retry1 = await db.from("enrollments").insert(withoutFee).select()
    if (!retry1.error && retry1.data) return retry1.data

    // Retry 2: minimal essential payload
    const minimal = cleanItems.map(x => ({
      student_id: x.student_id,
      batch_id: x.batch_id,
      status: x.status || "active"
    }))
    const retry2 = await db.from("enrollments").insert(minimal).select()
    return retry2.data || []
  } catch (err) {
    console.warn("safeInsertEnrollments catch:", err)
    return []
  }
}
