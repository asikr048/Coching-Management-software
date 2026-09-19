import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import BulkEnrollClient from "./BulkEnrollClient"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function BulkEnrollPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  let batches: any[] = []
  try {
    const { data: bData } = await admin
      .from("batches")
      .select("*, branch:branches(id, name)")
      .order("name")

    if (bData && bData.length > 0) {
      batches = bData.filter((b: any) => b.is_active !== false && b.status !== "finished")
    } else {
      const { data: fbB } = await supabase
        .from("batches")
        .select("*, branch:branches(id, name)")
        .order("name")
      if (fbB) batches = fbB.filter((b: any) => b.is_active !== false && b.status !== "finished")
    }
  } catch {
    try {
      const { data: fbB } = await supabase.from("batches").select("*").order("name")
      if (fbB) batches = fbB.filter((b: any) => b.is_active !== false && b.status !== "finished")
    } catch {}
  }

  let branches: any[] = []
  try {
    const { data: brData } = await admin.from("branches").select("id, name, address").order("name")
    if (brData) branches = brData
    else {
      const { data: fbBr } = await supabase.from("branches").select("id, name, address").order("name")
      if (fbBr) branches = fbBr
    }
  } catch {
    try {
      const { data: fbBr } = await supabase.from("branches").select("id, name, address").order("name")
      if (fbBr) branches = fbBr
    } catch {}
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/owner/students"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            title="Back to Students list"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Multi-Enroll Students by CSV</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                Bulk Enrollment
              </span>
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              সিএসভি (CSV) ফাইল থেকে একসাথে একাধিক শিক্ষার্থী ভর্তি করুন এবং আইডি কার্ড ও মানি রসিদ তৈরি করুন।
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/owner/students/new"
          className="text-xs font-medium text-slate-500 hover:text-indigo-600 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
        >
          Single Student Enrollment →
        </Link>
      </div>

      <BulkEnrollClient initialBatches={batches} branches={branches} />
    </div>
  )
}
