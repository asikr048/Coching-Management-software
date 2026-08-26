import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/utils"
import { GraduationCap, Star, ShoppingBag, BookOpen } from "lucide-react"
import Link from "next/link"

export default async function PublicMarketplace() {
  const supabase = await createClient()
  const { data: courses } = await supabase.from("courses").select("*, teacher:staff(name)").eq("status", "published").order("total_sales", { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2"><GraduationCap className="w-7 h-7 text-indigo-600" /><span className="text-xl font-bold text-gray-900">EduManage BD</span></div>
          <div className="flex gap-3"><Link href="/enroll" className="px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg font-medium">Enroll</Link><Link href="/login" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">Login</Link></div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="text-center mb-8"><h1 className="text-3xl font-bold text-gray-900">Course Marketplace</h1><p className="text-gray-500 mt-1">Learn from the best teachers</p></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(courses || []).map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
              <div className="h-40 bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center"><BookOpen className="w-12 h-12 text-white/40" /></div>
              <div className="p-5">
                <p className="font-bold text-gray-900">{c.title}</p>
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{c.description || "No description"}</p>
                <div className="flex items-center gap-2 mt-3"><Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /><span className="text-sm">{c.rating || 0}</span><span className="text-xs text-gray-400">({c.rating_count} reviews)</span></div>
                <div className="flex items-center justify-between mt-4"><div><p className="text-xs text-gray-500">by {c.teacher?.name}</p><p className="text-xs text-gray-400">{c.total_sales} enrolled</p></div><p className="text-xl font-bold text-indigo-600">{formatCurrency(c.price)}</p></div>
              </div>
            </div>
          ))}
          {(!courses || courses.length === 0) && <div className="col-span-full text-center py-16 text-gray-400">No courses available yet.</div>}
        </div>
      </div>
    </div>
  )
}
