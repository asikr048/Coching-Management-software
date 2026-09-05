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
  ] = await Promise.all([
    supabase.from("slider_images").select("*").order("sort_order"),
    supabase.from("site_settings").select("key, value"),
    supabase.from("blogs").select("*").order("created_at", { ascending: false }),
    supabase.from("achievements").select("*").order("sort_order", { ascending: true }),
    supabase.from("notices").select("*").order("created_at", { ascending: false }),
    supabase.from("branches").select("*").order("name", { ascending: true }),
  ])

  const settingsMap = (settings || []).reduce((acc: Record<string, string>, item: any) => {
    acc[item.key] = item.value
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Homepage Content Editor (ওয়েবসাইট ও কনটেন্ট সম্পাদক)
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage Hero image slider, Notice Board, Student Achievements, Educational Blogs, and Institutional Branding.
        </p>
      </div>
      <SliderClient
        slides={slides || []}
        initialSettings={settingsMap}
        initialBlogs={blogs || []}
        initialAchievements={achievements || []}
        initialNotices={notices || []}
        branches={branches || []}
      />
    </div>
  )
}