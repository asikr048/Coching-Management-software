import { createClient } from "@/lib/supabase/server"
import PublicNavbar from "@/components/layout/PublicNavbar"
import MarketplaceBrowseClient from "./MarketplaceBrowseClient"

export const metadata = {
  title: "Browse Batches & Courses | MedhaShiree",
  description: "Explore all active coaching classroom batches and online courses with expert faculty.",
}

export default async function PublicMarketplace() {
  const supabase = await createClient()

  const [batchesRes, coursesRes, settingsRes] = await Promise.all([
    supabase
      .from("batches")
      .select("id, name, subject, class_level, max_seats, current_seats, monthly_fee, admission_fee, schedule_days, schedule_time, description, teacher:staff(name, subject)")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("courses")
      .select("id, title, description, price, discount_price, status, total_sales, rating, rating_count, teacher:staff(name, subject)")
      .eq("status", "published")
      .order("total_sales", { ascending: false }),
    supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["contact_phone", "contact_whatsapp", "contact_number"]),
  ])

  const settingsMap = (settingsRes.data || []).reduce((acc: Record<string, string>, item) => {
    acc[item.key] = item.value
    return acc
  }, {})

  const contactPhone = settingsMap["contact_phone"] || settingsMap["contact_number"] || "01302201431"
  const contactWhatsApp = settingsMap["contact_whatsapp"] || contactPhone

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicNavbar />
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <MarketplaceBrowseClient
          batches={batchesRes.data || []}
          courses={coursesRes.data || []}
          contactPhone={contactPhone}
          contactWhatsApp={contactWhatsApp}
        />
      </main>
    </div>
  )
}
