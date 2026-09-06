import { createClient } from "@/lib/supabase/server"
import NoticesClient from "./NoticesClient"

export const dynamic = "force-dynamic"

export default async function NoticesPage() {
  const supabase = await createClient()

  // 1. Fetch site settings to check if seeded
  const { data: settingRow } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "notices_seeded")
    .maybeSingle()

  // 2. Fetch notices
  let { data: notices } = await supabase
    .from("notices")
    .select("*, branch:branches(id, name)")
    .order("created_at", { ascending: false })

  // 3. Fetch branches
  const { data: branches } = await supabase
    .from("branches")
    .select("*")
    .order("name", { ascending: true })

  // 4. Auto-seed the 3 default notices into Supabase if first time so admin can delete/manage them
  if ((!notices || notices.length === 0) && (!settingRow || settingRow.value !== "true")) {
    const defaults = [
      {
        title: "ভর্তি বিজ্ঞপ্তি : ২০২৫-২৬ সেশনে ভর্তি কার্যক্রম চলমান রয়েছে।",
        content: "সকল শাখার সকল ব্যাচে নতুন সেশনের ক্লাস আগামী ১০ তারিখ হতে শুরু হবে। আসন সংখ্যা সীমিত বিধায় দ্রুত যোগাযোগ করুন।",
        is_active: true,
        notice_date: new Date().toISOString().split("T")[0],
      },
      {
        title: "এইচএসসি মডেল টেস্ট ২০২৬ এর সময়সূচি প্রকাশিত হয়েছে।",
        content: "আগামী রবিবার হতে পদার্থবিজ্ঞান ও রসায়ন মডেল টেস্টের চূড়ান্ত সময়সূচি অনুযায়ী পরীক্ষা গ্রহণ করা হবে।",
        is_active: true,
        notice_date: new Date(Date.now() - 86400000 * 2).toISOString().split("T")[0],
      },
      {
        title: "অভিভাবক সমাবেশ ও ত্রৈমাসিক ফলাফল প্রকাশ সংক্রান্ত নোটিশ।",
        content: "সকল অভিভাবকবৃন্দকে আগামী শুক্রবারে কোচিং অডিটোরিয়ামে উপস্থিত থাকার জন্য বিনীত অনুরোধ করা হচ্ছে।",
        is_active: true,
        notice_date: new Date(Date.now() - 86400000 * 5).toISOString().split("T")[0],
      },
    ]

    try {
      const { data: seeded } = await supabase
        .from("notices")
        .insert(defaults)
        .select("*, branch:branches(id, name)")

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

  return (
    <div className="space-y-6">
      <NoticesClient
        initialNotices={notices || []}
        branches={branches || []}
      />
    </div>
  )
}
