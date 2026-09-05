import { createClient } from "@/lib/supabase/server"
import SliderClient from "./SliderClient"

export default async function SliderPage() {
  const supabase = await createClient()
  const [{ data: slides }, { data: settings }] = await Promise.all([
    supabase.from("slider_images").select("*").order("sort_order"),
    supabase.from("site_settings").select("key, value")
  ])

  const settingsMap = (settings || []).reduce((acc: Record<string, string>, item: any) => {
    acc[item.key] = item.value
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Homepage Editor</h1>
        <p className="text-sm text-gray-500 mt-1">
          Customize your homepage hero image slider, navbar contact button, and footer contact details.
        </p>
      </div>
      <SliderClient slides={slides || []} initialSettings={settingsMap} />
    </div>
  )
}