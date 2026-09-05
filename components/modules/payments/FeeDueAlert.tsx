"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AlertCircle, ChevronRight } from "lucide-react"
import Link from "next/link"
import { formatCurrency, formatDate } from "@/lib/utils"

interface DueItem {
  id: string
  student: { name: string; student_id: string; guardian_phone: string }
  batch: { name: string }
  due_amount: number
  paid_amount: number
  due_date: string
  due_month: string
}

export default function FeeDueAlert() {
  const [dues, setDues] = useState<DueItem[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from("fee_dues")
      .select("id, due_amount, paid_amount, due_date, due_month, student:students(name, student_id, guardian_phone), batch:batches(name)")
      .in("status", ["pending", "partial"])
      .lte("due_date", new Date().toISOString().split("T")[0])
      .order("due_date", { ascending: true })
      .limit(5)
      .then(({ data }) => setDues((data as unknown as DueItem[]) || []))
  }, [supabase])

  if (dues.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-red-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="w-5 h-5 text-red-500" />
        <h3 className="font-semibold text-gray-800">Overdue Fees</h3>
        <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{dues.length} overdue</span>
      </div>
      <div className="space-y-2">
        {dues.map(due => (
          <div key={due.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-800 text-sm">{due.student?.name}</p>
              <p className="text-xs text-gray-500">{due.batch?.name} • Due: {formatDate(due.due_date)}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-red-600 text-sm">{formatCurrency((due.due_amount || 0) - (due.paid_amount || 0))}</p>
              <p className="text-xs text-gray-400">outstanding</p>
            </div>
          </div>
        ))}
      </div>
      <Link href="/dashboard/owner/fee-dues" className="mt-3 flex items-center gap-1 text-sm text-red-600 hover:text-red-700 font-medium">
        View all overdue fees <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
