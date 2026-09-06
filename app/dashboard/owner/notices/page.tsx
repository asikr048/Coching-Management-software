import { createClient } from "@/lib/supabase/server"
import NoticesClient from "./NoticesClient"
import type { Branch } from "@/lib/supabase/types"

export const dynamic = "force-dynamic"

export default async function NoticesPage() {
  const supabase = await createClient()

  // 1. Fetch current caller session and staff profile
  const { data: { user } } = await supabase.auth.getUser()
  let currentStaff: any = null
  if (user?.id) {
    const { data: staffByAuth } = await supabase
      .from("staff")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle()
    if (staffByAuth) currentStaff = staffByAuth
  }

  if (!currentStaff && user?.email) {
    const { data: staffByEmail } = await supabase
      .from("staff")
      .select("*")
      .eq("email", user.email)
      .maybeSingle()
    if (staffByEmail) currentStaff = staffByEmail
  }

  // 2. Fetch site settings for roles, staff branch assignments, notice branch assignments, dates, and seeded flag
  let branchAssignmentsMap: Record<string, string[]> = {}
  let customRolesMap: Record<string, string> = {}
  let noticeBranchAssignments: Record<string, string[]> = {}
  let noticeDatesMap: Record<string, string> = {}
  let noticesSeeded = false

  try {
    const { data: settingRows } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", [
        "staff_branch_assignments",
        "staff_custom_roles",
        "notice_branch_assignments",
        "notice_dates",
        "notices_seeded",
      ])

    if (settingRows) {
      settingRows.forEach(row => {
        if (row.key === "staff_branch_assignments" && row.value) {
          try { branchAssignmentsMap = JSON.parse(row.value) } catch {}
        }
        if (row.key === "staff_custom_roles" && row.value) {
          try { customRolesMap = JSON.parse(row.value) } catch {}
        }
        if (row.key === "notice_branch_assignments" && row.value) {
          try { noticeBranchAssignments = JSON.parse(row.value) } catch {}
        }
        if (row.key === "notice_dates" && row.value) {
          try { noticeDatesMap = JSON.parse(row.value) } catch {}
        }
        if (row.key === "notices_seeded" && row.value === "true") {
          noticesSeeded = true
        }
      })
    }
  } catch {}

  const effectiveCallerRole = (currentStaff?.id && customRolesMap[currentStaff.id]) || currentStaff?.role || "owner"

  // 3. Determine branch permissions
  let isAllBranchesPermitted = false
  let myBranchIds: string[] = []

  if (effectiveCallerRole === "owner") {
    isAllBranchesPermitted = true
  } else {
    const staffBranches: string[] = []
    if (currentStaff?.branch_id) staffBranches.push(currentStaff.branch_id)
    if (Array.isArray(currentStaff?.branch_ids)) {
      currentStaff.branch_ids.forEach((b: string) => {
        if (!staffBranches.includes(b)) staffBranches.push(b)
      })
    }
    if (currentStaff?.id && Array.isArray(branchAssignmentsMap[currentStaff.id])) {
      branchAssignmentsMap[currentStaff.id].forEach((b: string) => {
        if (!staffBranches.includes(b)) staffBranches.push(b)
      })
    }

    if (effectiveCallerRole === "super_manager" && staffBranches.length === 0) {
      isAllBranchesPermitted = true
    } else {
      isAllBranchesPermitted = false
      myBranchIds = staffBranches
    }
  }

  // 4. Fetch branches
  const { data: rawBranches } = await supabase
    .from("branches")
    .select("*")
    .order("name", { ascending: true })

  const branches = (rawBranches || []) as Branch[]
  const branchesMap = new Map(branches.map(b => [b.id, b.name]))

  // Accessible branches for this user
  const accessibleBranches = isAllBranchesPermitted
    ? branches
    : branches.filter(b => myBranchIds.includes(b.id))

  // 5. Fetch notices safely without relationship joins
  let { data: notices } = await supabase
    .from("notices")
    .select("*")
    .order("created_at", { ascending: false })

  // 6. Auto-seed default notices if first time and no notices exist
  if ((!notices || notices.length === 0) && !noticesSeeded) {
    const defaults = [
      {
        title: "ভর্তি বিজ্ঞপ্তি : ২০২৫-২৬ সেশনে ভর্তি কার্যক্রম চলমান রয়েছে।",
        content: "সকল শাখার সকল ব্যাচে নতুন সেশনের ক্লাস আগামী ১০ তারিখ হতে শুরু হবে। আসন সংখ্যা সীমিত বিধায় দ্রুত যোগাযোগ করুন।",
        is_active: true,
      },
      {
        title: "এইচএসসি মডেল টেস্ট ২০২৬ এর সময়সূচি প্রকাশিত হয়েছে।",
        content: "আগামী রবিবার হতে পদার্থবিজ্ঞান ও রসায়ন মডেল টেস্টের চূড়ান্ত সময়সূচি অনুযায়ী পরীক্ষা গ্রহণ করা হবে।",
        is_active: true,
      },
      {
        title: "অভিভাবক সমাবেশ ও ত্রৈমাসিক ফলাফল প্রকাশ সংক্রান্ত নোটিশ।",
        content: "সকল অভিভাবকবৃন্দকে আগামী শুক্রবারে কোচিং অডিটোরিয়ামে উপস্থিত থাকার জন্য বিনীত অনুরোধ করা হচ্ছে।",
        is_active: true,
      },
    ]

    try {
      const { data: seeded } = await supabase
        .from("notices")
        .insert(defaults)
        .select("*")

      await supabase
        .from("site_settings")
        .upsert({ key: "notices_seeded", value: "true" }, { onConflict: "key" })

      if (seeded && seeded.length > 0) {
        notices = seeded
      }
    } catch (e) {
      console.error("Error auto-seeding default notices:", e)
    }
  }

  // 7. Enrich notices in memory with branch metadata and multi-branch support
  const enrichedNotices = (notices || []).map(notice => {
    const extraBranches = noticeBranchAssignments[notice.id] || []
    let assignedBranchIds: string[] = []

    if (Array.isArray(notice.branch_ids) && notice.branch_ids.length > 0) {
      assignedBranchIds = notice.branch_ids
    } else if (extraBranches.length > 0) {
      assignedBranchIds = extraBranches
    } else if (notice.branch_id) {
      assignedBranchIds = [notice.branch_id]
    }

    const isGlobal = assignedBranchIds.length === 0 && !notice.branch_id
    const primaryBranch = notice.branch_id ? branches.find(b => b.id === notice.branch_id) : null
    const effectiveNoticeDate =
      notice.notice_date ||
      noticeDatesMap[notice.id] ||
      (notice.created_at ? notice.created_at.split("T")[0] : new Date().toISOString().split("T")[0])

    return {
      ...notice,
      notice_date: effectiveNoticeDate,
      branch_id: notice.branch_id || (assignedBranchIds[0] || null),
      branch_ids: assignedBranchIds,
      branch_names: assignedBranchIds.map(bId => branchesMap.get(bId) || bId),
      is_global: isGlobal,
      branch: primaryBranch ? { id: primaryBranch.id, name: primaryBranch.name } : null,
    }
  })

  return (
    <div className="space-y-6">
      <NoticesClient
        initialNotices={enrichedNotices}
        branches={branches}
        accessibleBranches={accessibleBranches}
        isAllBranchesPermitted={isAllBranchesPermitted}
        myRole={effectiveCallerRole}
        myBranchIds={myBranchIds}
      />
    </div>
  )
}
