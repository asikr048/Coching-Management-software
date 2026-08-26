import { createClient } from "@/lib/supabase/server"
import { formatCurrency, formatDate } from "@/lib/utils"
import { ShoppingBag, Star } from "lucide-react"

export default async function MarketplacePage() {
  const supabase = await createClient()
  const { data: courses } = await supabase.from("courses").select("*, teacher:staff(name)").order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-gray-900">Course Marketplace</h2><p className="text-sm text-gray-500 mt-1">Manage courses and approve teacher uploads</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(courses || []).map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
            <div className="h-32 bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center"><ShoppingBag className="w-10 h-10 text-white/50" /></div>
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div><p className="font-semibold text-gray-800">{c.title}</p><p className="text-xs text-gray-500 mt-0.5">by {c.teacher?.name}</p></div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === "published" ? "bg-emerald-100 text-emerald-700" : c.status === "pending_review" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>{c.status}</span>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" /><span className="text-sm text-gray-600">{c.rating || 0} ({c.rating_count})</span></div>
                <p className="font-bold text-indigo-600">{formatCurrency(c.price)}</p>
              </div>
              <p className="text-xs text-gray-400 mt-2">{c.total_sales} sales • {c.level}</p>
            </div>
          </div>
        ))}
        {(!courses || courses.length === 0) && <div className="col-span-full text-center py-12 text-gray-400">No courses yet.</div>}
      </div>
    </div>
  )
}
