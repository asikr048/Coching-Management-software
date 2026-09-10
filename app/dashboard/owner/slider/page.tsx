import { createClient } from "@/lib/supabase/server"
import SliderClient from "./SliderClient"

export const dynamic = "force-dynamic"

export default async function SliderPage() {
  const supabase = await createClient()
  const [
    { data: slides },
    { data: settings },
    { data: blogs },
    { data: achievements },
    { data: notices },
    { data: branches },
    { data: feedback },
    { data: exams },
  ] = await Promise.all([
    supabase.from("slider_images").select("*").order("sort_order"),
    supabase.from("site_settings").select("key, value"),
    supabase.from("blogs").select("*").order("created_at", { ascending: false }),
    supabase.from("achievements").select("*").order("sort_order", { ascending: true }),
    supabase.from("notices").select("*").order("created_at", { ascending: false }),
    supabase.from("branches").select("*").order("name", { ascending: true }),
    supabase.from("feedback").select("*").order("created_at", { ascending: false }),
    supabase.from("exams").select("*, branch:branches(id, name), batch:batches(id, name)").order("created_at", { ascending: false }),
  ])

  const settingsMap = (settings || []).reduce((acc: Record<string, string>, item: any) => {
    acc[item.key] = item.value
    return acc
  }, {})

  let noticeList = notices || []
  if (noticeList.length === 0 && settingsMap['notices_seeded'] !== 'true') {
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
      const { data: seeded } = await supabase.from("notices").insert(defaults).select("*")
      await supabase.from("site_settings").upsert({ key: "notices_seeded", value: "true" }, { onConflict: "key" })
      if (seeded && seeded.length > 0) {
        noticeList = seeded
      }
    } catch {}
  }

  // Auto-seed default achievements if table is empty
  let achList = achievements || []
  if (achList.length === 0 && settingsMap['achievements_seeded'] !== 'true') {
    const defaultAchs = [
      {
        student_name: "তানভীর আহমেদ",
        title: "রাজশাহী মেডিকেল কলেজ (চান্স প্রাপ্ত)",
        description: "মেধাশিরী কোচিংয়ের নিয়মিত ক্লাস ও বিশেষ মডেল টেস্ট আমার মেডিকেল প্রস্তুতিতে সর্বোচ্চ ভূমিকা রেখেছে।",
        exam_year: "২০২৪",
        sort_order: 1,
        is_active: true,
      },
      {
        student_name: "নুসরাত জাহান",
        title: "এইচএসসি পরীক্ষায় গোল্ডেন জিপিএ ৫.০০",
        description: "শিক্ষকদের আন্তরিক পাঠদান ও নিয়মিত পরীক্ষা ভীতি দূর করতে সাহায্য করেছে।",
        exam_year: "২০২৪",
        sort_order: 2,
        is_active: true,
      },
      {
        student_name: "মাহমুদুল হাসান",
        title: "রুয়েট (CSE) চান্স প্রাপ্ত",
        description: "গণিত ও পদার্থবিজ্ঞানের কনসেপ্ট ক্লিয়ারিং ক্লাসের মাধ্যমে ইঞ্জিনিয়ারিং ভর্তি পরীক্ষায় সাফল্য পেয়েছি।",
        exam_year: "২০২৪",
        sort_order: 3,
        is_active: true,
      },
    ]
    try {
      const { data: seeded } = await supabase.from("achievements").insert(defaultAchs).select("*")
      await supabase.from("site_settings").upsert({ key: "achievements_seeded", value: "true" }, { onConflict: "key" })
      if (seeded && seeded.length > 0) {
        achList = seeded
      } else {
        achList = defaultAchs as any
      }
    } catch {
      achList = defaultAchs as any
    }
  }

  // Auto-seed default educational blogs if table is empty
  let blogList = blogs || []
  if (blogList.length === 0 && settingsMap['blogs_seeded'] !== 'true') {
    const defaultBlogs = [
      {
        title: "এইচএসসি পদার্থবিজ্ঞান পরীক্ষায় A+ পাওয়ার সহজ কৌশল",
        slug: "hsc-physics-a-plus-tips",
        excerpt: "পদার্থবিজ্ঞানে গাণিতিক সমস্যা সমাধান এবং সৃজনশীল অংশে সম্পূর্ণ নম্বর অর্জনের কার্যকর ফর্মুলা ও সময় বণ্টন গাইড।",
        content: "পদার্থবিজ্ঞানে ভালো করতে হলে মুখস্থ করার চেয়ে কনসেপ্ট ক্লিয়ার থাকা সবচেয়ে জরুরি। নিয়মিত গাণিতিক সূত্রাবলি অনুশীলন এবং বোর্ড প্রশ্নের ধরন বিশ্লেষণ শিক্ষার্থীদের পরীক্ষার জন্য আত্মবিশ্বাসী করে তোলে। প্রতিদিন নির্দিষ্ট সময় অধ্যায়ভিত্তিক সূত্রের চার্ট রিভিশন দেওয়া উচিত। বিশেষ করে নিউটনিয়ান বলবিদ্যা, কাজ-শক্তি-ক্ষমতা এবং স্থির তড়িৎ অধ্যায়গুলো বেশি অনুশীলন করুন।",
        author_name: "মেধাশিরী একাডেমিক টিম",
        tags: ["এইচএসসি", "পদার্থবিজ্ঞান", "টিপস"],
        is_published: true,
        published_at: new Date().toISOString(),
      },
      {
        title: "মেডিকেল ভর্তি পরীক্ষার শেষ মুহূর্তের কার্যকর রিভিশন প্ল্যান",
        slug: "medical-admission-revision-plan",
        excerpt: "প্রতিদিনের বিষয়ভিত্তিক টার্গেট নির্ধারণ এবং নেগেটিভ মার্কিং এড়ানোর মোক্ষম কৌশল নিয়ে বিশেষজ্ঞদের পরামর্শ।",
        content: "মেডিকেল ভর্তি পরীক্ষার ক্ষেত্রে নির্ভুলতা অত্যন্ত গুরুত্বপূর্ণ। শেষ মাসগুলোতে নতুন কোনো টপিক পড়ার চেয়ে পূর্বে পড়া নোট এবং মডেল টেস্টের ভুলগুলো বারবার সংশোধন করা সবচেয়ে বেশি কাজে দেয়। মূল পাঠ্যবই লাইন বাই লাইন পড়ার অভ্যাস গড়ে তুলুন এবং প্রতিদিন একটি করে পূর্ণাঙ্গ মডেল টেস্ট দিয়ে নিজের দুর্বলতা চিহ্নিত করুন।",
        author_name: "ডাঃ তাসনিম আহমেদ (পরামর্শক)",
        tags: ["মেডিকেল", "অ্যাডমিশন", "পরামর্শ"],
        is_published: true,
        published_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      },
    ]
    try {
      const { data: seeded } = await supabase.from("blogs").insert(defaultBlogs).select("*")
      await supabase.from("site_settings").upsert({ key: "blogs_seeded", value: "true" }, { onConflict: "key" })
      if (seeded && seeded.length > 0) {
        blogList = seeded
      } else {
        blogList = defaultBlogs as any
      }
    } catch {
      blogList = defaultBlogs as any
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Homepage Content Editor (ওয়েবসাইট ও কনটেন্ট সম্পাদক)
        </h1>
        <p className="text-sm text-slate-500 font-medium mt-1">
          Manage Hero image slider, Notice Board, Student Achievements, Educational Blogs, Feedback, and Institutional Branding.
        </p>
      </div>
      <SliderClient
        slides={slides || []}
        initialSettings={settingsMap}
        initialBlogs={blogList}
        initialAchievements={achList}
        initialNotices={noticeList}
        initialFeedback={feedback || []}
        initialExams={exams || []}
        branches={branches || []}
      />
    </div>
  )
}