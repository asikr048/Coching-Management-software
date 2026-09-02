import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { formatCurrency } from "@/lib/utils"
import { GraduationCap, BookOpen, Users, Clock, Calendar, MapPin, ArrowLeft, CheckCircle } from "lucide-react"
import Link from "next/link"
import PublicNavbar from "@/components/layout/PublicNavbar"
import EnrollButton from "./EnrollButton"

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: batch } = await supabase.from("batches").select("*, teacher:staff(name, subject)").eq("id", id).single()
  if (!batch) notFound()

  const seatsLeft = batch.max_seats - (batch.current_seats || 0)
  const isFull = seatsLeft <= 0

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicNavbar />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to all batches
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero Card */}
            <div className="bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 rounded-2xl p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <p className="text-white/70 text-sm uppercase tracking-wider font-medium">{batch.class_level || "All Levels"} • {batch.subject || "General"}</p>
              <h1 className="text-3xl md:text-4xl font-bold mt-2">{batch.name}</h1>
              <div className="flex flex-wrap gap-4 mt-4 text-sm text-white/80">
                {batch.teacher && <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> {batch.teacher.name}</span>}
                {batch.schedule_days && <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {batch.schedule_days}</span>}
                {batch.schedule_time && <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {batch.schedule_time}</span>}
              </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-3">About This Batch</h2>
              <p className="text-gray-600 leading-relaxed">
                {batch.description || `Join our ${batch.name} batch for comprehensive ${batch.subject || "academic"} coaching. Led by experienced teacher ${batch.teacher?.name || "our expert faculty"}, this batch provides structured learning with regular assessments and personalized attention. Classes are held ${batch.schedule_days || "on scheduled days"} ${batch.schedule_time ? "at " + batch.schedule_time : ""}.`}
              </p>
            </div>

            {/* What You Get */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">What You Get</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  "Expert teacher instruction",
                  "Regular exams & assessments",
                  "Study materials provided",
                  "Progress tracking",
                  "Parent SMS updates",
                  "Certificate on completion",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar - Enrollment Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 sticky top-24 shadow-sm">
              <div className="text-center mb-6">
                <p className="text-3xl font-bold text-indigo-600">{formatCurrency(batch.monthly_fee)}</p>
                <p className="text-sm text-gray-400">per month</p>
                {batch.admission_fee > 0 && (
                  <p className="text-sm text-gray-500 mt-1">+ {formatCurrency(batch.admission_fee)} admission fee (one-time)</p>
                )}
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-sm py-2 border-b border-gray-50">
                  <span className="text-gray-500">Subject</span>
                  <span className="font-medium text-gray-800">{batch.subject || "General"}</span>
                </div>
                <div className="flex items-center justify-between text-sm py-2 border-b border-gray-50">
                  <span className="text-gray-500">Teacher</span>
                  <span className="font-medium text-gray-800">{batch.teacher?.name || "TBA"}</span>
                </div>
                <div className="flex items-center justify-between text-sm py-2 border-b border-gray-50">
                  <span className="text-gray-500">Class Level</span>
                  <span className="font-medium text-gray-800">{batch.class_level || "All"}</span>
                </div>
                {batch.schedule_days && (
                  <div className="flex items-center justify-between text-sm py-2 border-b border-gray-50">
                    <span className="text-gray-500">Schedule</span>
                    <span className="font-medium text-gray-800">{batch.schedule_days}</span>
                  </div>
                )}
                {batch.schedule_time && (
                  <div className="flex items-center justify-between text-sm py-2 border-b border-gray-50">
                    <span className="text-gray-500">Time</span>
                    <span className="font-medium text-gray-800">{batch.schedule_time}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm py-2">
                  <span className="text-gray-500">Seats Available</span>
                  <span className={`font-bold ${seatsLeft <= 5 ? "text-red-600" : "text-emerald-600"}`}>{seatsLeft} / {batch.max_seats}</span>
                </div>
              </div>

              {/* Seats progress bar */}
              <div className="mb-6">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${seatsLeft <= 5 ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${((batch.current_seats || 0) / batch.max_seats) * 100}%` }} />
                </div>
                {seatsLeft <= 5 && seatsLeft > 0 && <p className="text-xs text-red-500 mt-1 font-medium">Only {seatsLeft} seats left! Enroll now.</p>}
              </div>

              {/* Enroll Button — checks auth + enrollment status */}
              <EnrollButton batchId={batch.id} isFull={isFull} />


              <p className="text-xs text-gray-400 text-center mt-3">No registration fee • Cancel anytime</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}