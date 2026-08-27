import { createClient } from "@/lib/supabase/server"
import SliderClient from "./SliderClient"

export default async function SliderPage() {
  const supabase = await createClient()
  const { data: slides } = await supabase.from("slider_images").select("*").order("sort_order")
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Homepage Slider</h1>
      <SliderClient slides={slides || []} />
    </div>
  )
}