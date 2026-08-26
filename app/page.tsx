import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/utils"
import { GraduationCap, BookOpen, Users, Clock, Calendar, MapPin, Star, ArrowRight, Phone, Mail, ChevronRight, Play, CheckCircle, Sparkles, TrendingUp, Shield } from "lucide-react"
import Link from "next/link"

export default async function HomePage() {
  const supabase = await createClient()
  let batches: any[] = []
  let courses: any[] = []
  let studentCount: number | null = 0
  try {
    const { data: b } = await supabase.from("batches").select("*, teacher:staff(name)").eq("is_active", true).order("created_at", { ascending: false })
    batches = b || []
  } catch {}
  try {
    const { data: c } = await supabase.from("courses").select("*, teacher:staff(name)").eq("status", "published").order("total_sales", { ascending: false }).limit(6)
    courses = c || []
  } catch {}
  try {
    const { count } = await supabase.from("students").select("id", { count: "exact", head: true }).eq("is_active", true)
    studentCount = count
  } catch {}

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="fixed top-0 w-full bg-white/70 backdrop-blur-xl border-b border-gray-100/80 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">EduManage<span className="text-indigo-600">BD</span></span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            <a href="#batches" className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all">Batches</a>
            <a href="#courses" className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all">Courses</a>
            <Link href="/parent-portal" className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all">Parent Portal</Link>
            <a href="#contact" className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all">Contact</a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">Sign In</Link>
            <Link href="/enroll" className="px-5 py-2.5 text-sm font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-800 shadow-sm hover:shadow-md transition-all">
              Enroll Now
            </Link>
          </div>
        </div>
      </nav>

      {/* ====== ASYMMETRIC HERO ====== */}
      <section className="pt-24 lg:pt-16 min-h-screen flex items-center relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40" />
        <div className="absolute top-0 right-0 w-[60%] h-full bg-gradient-to-l from-indigo-600/[0.03] to-transparent" />
        
        {/* Decorative Elements */}
        <div className="absolute top-32 left-[10%] w-72 h-72 bg-indigo-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-[5%] w-96 h-96 bg-violet-200/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 w-[800px] h-[800px] border border-indigo-100/50 rounded-full -translate-x-1/2 -translate-y-1/2 opacity-40" />
        <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] border border-indigo-100/30 rounded-full -translate-x-1/2 -translate-y-1/2 opacity-30" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left Content — 5 columns */}
            <div className="lg:col-span-5 space-y-8 pt-12 lg:pt-0">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Admissions Open 2026</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-gray-900 leading-[1.1] tracking-tight">
                Where Students
                <span className="block mt-1 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
                  Become Achievers
                </span>
              </h1>
              
              <p className="text-lg text-gray-500 leading-relaxed max-w-md">
                Rajshahi&apos;s most trusted coaching center. Structured batches, expert faculty, and a track record that speaks for itself.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/enroll" className="group px-7 py-3.5 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 shadow-lg shadow-gray-900/10 hover:shadow-xl hover:shadow-gray-900/20 transition-all flex items-center justify-center gap-2">
                  Start Learning
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <a href="#batches" className="px-7 py-3.5 bg-white text-gray-700 border border-gray-200 rounded-xl font-semibold hover:border-gray-300 hover:shadow-sm transition-all flex items-center justify-center gap-2">
                  <Play className="w-4 h-4 text-indigo-600" /> Browse Batches
                </a>
              </div>

              {/* Social Proof */}
              <div className="flex items-center gap-4 pt-2">
                <div className="flex -space-x-2">
                  {[0,1,2,3].map(i => (
                    <div key={i} className={`w-8 h-8 rounded-full border-2 border-white ${
                      ["bg-indigo-400","bg-violet-400","bg-pink-400","bg-amber-400"][i]
                    } flex items-center justify-center text-white text-xs font-bold`}>
                      {["A","R","S","M"][i]}
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{studentCount || "500"}+ Students</p>
                  <p className="text-xs text-gray-500">currently enrolled</p>
                </div>
              </div>
            </div>

            {/* Right — Asymmetric Card Stack — 7 columns */}
            <div className="lg:col-span-7 relative min-h-[480px] lg:min-h-[560px]">
              {/* Main Feature Card — offset to the right */}
              <div className="absolute top-8 right-0 lg:right-[-20px] w-[85%] lg:w-[80%] bg-white rounded-3xl border border-gray-100 shadow-2xl shadow-gray-200/60 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 p-6 pb-8">
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-3 py-1 bg-white/20 rounded-full text-white text-xs font-medium backdrop-blur">Live Dashboard Preview</span>
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-white/30" />
                      <div className="w-3 h-3 rounded-full bg-white/30" />
                      <div className="w-3 h-3 rounded-full bg-white/30" />
                    </div>
                  </div>
                  <p className="text-white/70 text-sm">Total Revenue This Month</p>
                  <p className="text-3xl font-bold text-white mt-1">৳ 2,45,000</p>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between py-2.5 px-3 bg-emerald-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center"><TrendingUp className="w-4 h-4 text-emerald-600" /></div>
                      <div><p className="text-sm font-medium text-gray-800">Attendance Rate</p><p className="text-xs text-gray-500">This week</p></div>
                    </div>
                    <span className="text-lg font-bold text-emerald-600">94%</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 px-3 bg-indigo-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center"><Users className="w-4 h-4 text-indigo-600" /></div>
                      <div><p className="text-sm font-medium text-gray-800">New Enrollments</p><p className="text-xs text-gray-500">Last 30 days</p></div>
                    </div>
                    <span className="text-lg font-bold text-indigo-600">+48</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 px-3 bg-violet-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center"><Star className="w-4 h-4 text-violet-600" /></div>
                      <div><p className="text-sm font-medium text-gray-800">Exam Pass Rate</p><p className="text-xs text-gray-500">GPA 4.0+</p></div>
                    </div>
                    <span className="text-lg font-bold text-violet-600">87%</span>
                  </div>
                </div>
              </div>

              {/* Floating Card — Bottom Left (overlapping) */}
              <div className="absolute bottom-4 left-0 lg:left-[-10px] z-10 bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/50 p-4 w-[220px]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-200">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Trusted</p>
                    <p className="text-xs text-gray-500">Since 2018</p>
                  </div>
                </div>
                <div className="flex gap-0.5">
                  {[0,1,2,3,4].map(i => <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />)}
                </div>
                <p className="text-xs text-gray-500 mt-1">4.9/5 from 200+ reviews</p>
              </div>

              {/* Floating Badge — Top Left */}
              <div className="absolute top-0 left-4 lg:left-0 z-10 bg-white rounded-2xl border border-gray-100 shadow-lg shadow-gray-200/40 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-sm font-semibold text-gray-800">{(batches || []).length || "10+"} Active Batches</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Strip */}
      <section className="py-16 px-4 border-y border-gray-100 bg-gray-50/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: Users, title: "Batch Management", desc: "Organized schedule & seats" },
              { icon: Shield, title: "Biometric Entry", desc: "Automated attendance" },
              { icon: TrendingUp, title: "Result Tracking", desc: "Grades, ranks & analytics" },
              { icon: BookOpen, title: "Course Sales", desc: "Online marketplace" },
            ].map((f, i) => (
              <div key={i} className="text-center group">
                <div className="w-12 h-12 bg-white border border-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm group-hover:shadow-md group-hover:border-indigo-200 transition-all">
                  <f.icon className="w-5 h-5 text-indigo-600" />
                </div>
                <p className="font-semibold text-gray-900 text-sm">{f.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Batches Section */}
      <section id="batches" className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
            <div>
              <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wide mb-2">Choose Your Batch</p>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Available Batches</h2>
              <p className="mt-2 text-gray-500 max-w-lg">Select a batch that fits your schedule. Each batch has limited seats to ensure quality education.</p>
            </div>
            <Link href="/enroll" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors whitespace-nowrap">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(batches || []).map(batch => {
              const seatsLeft = batch.max_seats - (batch.current_seats || 0)
              return (
                <Link key={batch.id} href={`/batch/${batch.id}`} className="group relative bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-100/50 transition-all duration-300">
                  {/* Color Bar */}
                  <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">{batch.name}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">{batch.subject || "General"} • {batch.class_level || "All Levels"}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${seatsLeft <= 5 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
                        {seatsLeft} left
                      </span>
                    </div>

                    <div className="space-y-2.5 mb-5">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span>{batch.teacher?.name || "Expert Teacher"}</span>
                      </div>
                      {batch.schedule_days && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>{batch.schedule_days}</span>
                        </div>
                      )}
                      {batch.schedule_time && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span>{batch.schedule_time}</span>
                        </div>
                      )}
                    </div>

                    {/* Seat Progress */}
                    <div className="mb-4">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${seatsLeft <= 5 ? "bg-red-500" : "bg-indigo-500"}`} style={{ width: `${((batch.current_seats || 0) / batch.max_seats) * 100}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div>
                        <span className="text-2xl font-bold text-gray-900">{formatCurrency(batch.monthly_fee)}</span>
                        <span className="text-sm text-gray-400">/mo</span>
                      </div>
                      <span className="flex items-center gap-1 text-sm font-semibold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        Enroll <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
            {(!batches || batches.length === 0) && (
              <div className="col-span-full bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium text-lg">Batches coming soon!</p>
                <p className="text-gray-400 text-sm mt-1">Contact us to learn about upcoming batches.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Courses Section */}
      <section id="courses" className="py-24 px-4 bg-gray-50/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wide mb-2">Learn Online</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Online Courses</h2>
            <p className="mt-2 text-gray-500 max-w-lg mx-auto">Learn at your own pace with courses crafted by our best teachers.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(courses || []).map(course => (
              <div key={course.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow group">
                <div className="h-40 bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)]" />
                  <BookOpen className="w-10 h-10 text-white/20" />
                  <span className="absolute top-3 right-3 px-2.5 py-1 bg-black/20 backdrop-blur rounded-lg text-white text-xs font-medium capitalize">{course.level}</span>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">{course.title}</h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{course.description || "Comprehensive course material"}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex gap-0.5">{[0,1,2,3,4].map(i => <Star key={i} className={`w-3 h-3 ${i < Math.round(course.rating || 0) ? "text-amber-400 fill-amber-400" : "text-gray-200"}`} />)}</div>
                    <span className="text-xs text-gray-500">({course.rating_count})</span>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400">{course.teacher?.name} • {course.total_sales} enrolled</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(course.price)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {(courses || []).length > 0 && (
            <div className="text-center mt-10">
              <Link href="/marketplace" className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl font-semibold text-gray-700 hover:border-gray-300 hover:shadow-sm transition-all">
                View All Courses <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
          {(!courses || courses.length === 0) && (
            <div className="text-center py-12"><p className="text-gray-400">Courses coming soon!</p></div>
          )}
        </div>
      </section>

      {/* Why Us */}
      <section className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wide mb-2">Why Choose Us</p>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">Everything you need to<br />succeed academically</h2>
              <div className="mt-8 space-y-5">
                {[
                  { title: "Structured Batch System", desc: "Choose from multiple batch schedules — morning, afternoon, or evening. Each batch is limited to 30 students." },
                  { title: "Expert Faculty", desc: "Our teachers are subject matter experts with years of coaching experience and proven track records." },
                  { title: "Smart Tracking", desc: "Biometric attendance, digital payments, exam results, and parent SMS notifications — all automated." },
                  { title: "Affordable Fees", desc: "Quality education at competitive pricing with flexible payment options and referral discounts." },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center mt-0.5">
                      <CheckCircle className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{item.title}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-3xl p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                <div className="relative space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
                      <GraduationCap className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <p className="text-4xl font-bold">95%</p>
                      <p className="text-white/70 text-sm">Pass Rate</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/10 rounded-2xl p-4 text-center backdrop-blur">
                      <p className="text-2xl font-bold">{studentCount || "500"}+</p>
                      <p className="text-white/70 text-xs mt-1">Students Enrolled</p>
                    </div>
                    <div className="bg-white/10 rounded-2xl p-4 text-center backdrop-blur">
                      <p className="text-2xl font-bold">20+</p>
                      <p className="text-white/70 text-xs mt-1">Expert Teachers</p>
                    </div>
                    <div className="bg-white/10 rounded-2xl p-4 text-center backdrop-blur">
                      <p className="text-2xl font-bold">{(batches || []).length || "10"}+</p>
                      <p className="text-white/70 text-xs mt-1">Active Batches</p>
                    </div>
                    <div className="bg-white/10 rounded-2xl p-4 text-center backdrop-blur">
                      <p className="text-2xl font-bold">7+</p>
                      <p className="text-white/70 text-xs mt-1">Years Teaching</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto relative">
          <div className="bg-gray-900 rounded-[2rem] p-12 md:p-16 text-center text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 to-purple-600/20" />
            <div className="absolute top-0 right-[20%] w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-[20%] w-48 h-48 bg-purple-500/10 rounded-full blur-3xl" />
            <div className="relative">
              <h2 className="text-3xl md:text-5xl font-bold leading-tight">Ready to Start Your<br />Academic Journey?</h2>
              <p className="mt-4 text-white/50 text-lg max-w-xl mx-auto">Join hundreds of students who trust EduManage BD for their coaching needs.</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/enroll" className="px-8 py-4 bg-white text-gray-900 rounded-xl font-semibold hover:bg-gray-100 shadow-xl transition-all">
                  Enroll Now — It&apos;s Free
                </Link>
                <Link href="/parent-portal" className="px-8 py-4 border border-white/20 text-white rounded-xl font-semibold hover:bg-white/10 transition-all">
                  Parent Portal
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-gray-950 text-gray-400 pt-16 pb-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-12 border-b border-gray-800">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-lg flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-bold text-white">EduManage<span className="text-indigo-400">BD</span></span>
              </div>
              <p className="text-sm leading-relaxed max-w-sm">Rajshahi&apos;s premier coaching center. Quality education, expert teachers, and a proven track record of student success.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wide">Quick Links</h4>
              <div className="space-y-2.5 text-sm">
                <p><a href="#batches" className="hover:text-white transition-colors">View Batches</a></p>
                <p><Link href="/enroll" className="hover:text-white transition-colors">Enroll Now</Link></p>
                <p><Link href="/parent-portal" className="hover:text-white transition-colors">Parent Portal</Link></p>
                <p><Link href="/marketplace" className="hover:text-white transition-colors">Online Courses</Link></p>
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wide">Contact</h4>
              <div className="space-y-2.5 text-sm">
                <p className="flex items-center gap-2"><MapPin className="w-4 h-4 flex-shrink-0" /> Rajshahi, Bangladesh</p>
                <p className="flex items-center gap-2"><Phone className="w-4 h-4 flex-shrink-0" /> 01XXXXXXXXX</p>
                <p className="flex items-center gap-2"><Mail className="w-4 h-4 flex-shrink-0" /> info@edumanage.com</p>
              </div>
            </div>
          </div>
          <div className="pt-8 text-center text-xs text-gray-600">
            <p>&copy; {new Date().getFullYear()} EduManage BD. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
