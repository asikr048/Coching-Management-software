import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/utils"
import { Package } from "lucide-react"

export default async function MaterialsPage() {
  const supabase = await createClient()
  const { data: materials } = await supabase.from("materials").select("*").order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-gray-900">Study Materials & Inventory</h2><p className="text-sm text-gray-500 mt-1">Manage books, notes, and worksheets</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(materials || []).map(m => (
          <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-orange-50 rounded-lg"><Package className="w-5 h-5 text-orange-600" /></div>
              <div><p className="font-semibold text-gray-800">{m.name}</p><p className="text-xs text-gray-500 capitalize">{m.type} • {m.subject || "General"}</p></div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Stock: <strong>{m.available_stock}</strong>/{m.total_stock}</span>
              <span className="font-medium text-gray-700">{formatCurrency(m.price)}</span>
            </div>
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${m.available_stock <= 5 ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${(m.available_stock / Math.max(m.total_stock, 1)) * 100}%` }} />
            </div>
          </div>
        ))}
        {(!materials || materials.length === 0) && <div className="col-span-full text-center py-12 text-gray-400">No materials added yet.</div>}
      </div>
    </div>
  )
}
