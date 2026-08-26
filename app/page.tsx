import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/utils"
import { GraduationCap, BookOpen, Users, Clock, Calendar, MapPin, Star, ArrowRight, Phone, Mail, ChevronRight } from "lucide-react"
import Link from "next/link"

export default async function HomePage() {
  const supabase = await createClient()
  const { data: batches } = await supabase.from("batches").select("*, teacher:staff(name)").eq("is_active", true).order("created_at", { ascending: false })
  const { data: courses } = await supabase.from("courses").select("*, teacher:staff(name)").eq("status", "published").order("total_sales", { ascending: false }).limit(6)
  const { count: studentCount } = await supabase.from("students").select("id", { count: "exact", head: true }).eq("is_active", true)

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-lg border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center"><GraduationCap className="w-5 h-5 text-white" /></div>
            <span className="text-xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">EduManage BD</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#batches" className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Batches</a>
            <a href="#courses" className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Courses</a>
            <Link href="/parent-portal" className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Parent Portal</Link>
            <Link href="/enroll" className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Enroll</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">Sign In</Link>
            <Link href="/enroll" className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg hover:shadow-indigo-200 transition-all">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50" />
        <div className="absolute top-20 right-0 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-40" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-100 rounded-full blur-3xl opacity-40" />
        <div className="max-w-7xl mx-auto relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-100 rounded-full text-indigo-700 text-sm font-medium mb-6">
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              Admissions Open for 2026
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight">
              Excel in Your
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"> Academic Journey</span>
            </h1>
            <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto">
              Join Rajshahi's premier coaching center. Expert teachers, proven results, 
              and a supportive learning environment to help you achieve your goals.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <a href="#batches" className="px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-xl hover:shadow-indigo-200 transition-all flex items-center justify-center gap-2">
                View Batches <ArrowRight className="w-4 h-4" />
              </a>
              <Link href="/enroll" className="px-8 py-3.5 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:border-indigo-300 hover:bg-indigo-50 transition-all">
                Enroll Now
              </Link>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { label: "Active Students", value: studentCount || "500+", icon: Users },
              { label: "Expert Teachers", value: "20+", icon: GraduationCap },
              { label: "Active Batches", value: (batches || []).length || "10+", icon: BookOpen },
              { label: "Success Rate", value: "95%", icon: Star },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm hover:shadow-md transition-shadow">
                <s.icon className="w-5 h-5 text-indigo-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Batches Section */}
      <section id="batches" className="py-20 px-4 bg-gray-50/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Available Batches</h2>
            <p className="mt-3 text-gray-600 max-w-lg mx-auto">Choose the batch that fits your schedule. Click on any batch to see details and enroll.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(batches || []).map(batch => (
              <Link key={batch.id} href={`/batch/${batch.id}`} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:border-indigo-200 transition-all duration-300">
                <div className="h-44 bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 relative overflow-hidden">
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
                  <div className="absolute bottom-4 left-5">
                    <p className="text-white/80 text-xs font-medium uppercase tracking-wider">{batch.class_level || "All Levels"}</p>
                    <h3 className="text-xl font-bold text-white mt-1">{batch.name}</h3>
                  </div>
                  <div className="absolute top-4 right-4 px-3 py-1 bg-white/20 backdrop-blur rounded-full text-white text-xs font-medium">
                    {batch.current_seats}/{batch.max_seats} seats
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                    <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5 text-indigo-500" /> {batch.subject || "General"}</span>
                    <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-indigo-500" /> {batch.teacher?.name || "TBA"}</span>
                  </div>
                  {batch.schedule_days && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-2">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{batch.schedule_days}</span>
                    </div>
                  )}
                  {batch.schedule_time && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-3">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{batch.schedule_time}</span>
                    </div>
                  )}
                  {batch.description && <p className="text-sm text-gray-500 line-clamp-2 mb-3">{batch.description}</p>}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div>
                      <p className="text-2xl font-bold text-indigo-600">{formatCurrency(batch.monthly_fee)}<span className="text-sm font-normal text-gray-400">/mo</span></p>
                      {batch.admission_fee > 0 && <p className="text-xs text-gray-400">Admission: {formatCurrency(batch.admission_fee)}</p>}
                    </div>
                    <span className="flex items-center gap-1 text-sm font-medium text-indigo-600 group-hover:gap-2 transition-all">
                      Details <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
            {(!batches || batches.length === 0) && (
              <div className="col-span-full text-center py-16">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 text-lg">Batches coming soon!</p>
                <p className="text-gray-400 text-sm mt-1">Contact us for enrollment details.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Courses Section */}
      <section id="courses" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Online Courses</h2>
            <p className="mt-3 text-gray-600 max-w-lg mx-auto">Learn at your own pace with our expert-led online courses.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(courses || []).map(course => (
              <div key={course.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow">
                <div className="h-36 bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center relative">
                  <BookOpen className="w-10 h-10 text-white/30" />
                  <span className="absolute top-3 right-3 px-2 py-0.5 bg-white/20 backdrop-blur rounded-full text-white text-xs font-medium capitalize">{course.level}</span>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-gray-900">{course.title}</h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{course.description || "No description"}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-sm text-gray-600">{course.rating || 0} ({course.rating_count} reviews)</span>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                    <div>
                      <p className="text-xs text-gray-400">by {course.teacher?.name}</p>
                      <p className="text-xs text-gray-400">{course.total_sales} enrolled</p>
                    </div>
                    <p className="text-xl font-bold text-emerald-600">{formatCurrency(course.price)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {(courses || []).length > 0 && (
            <div className="text-center mt-8">
              <Link href="/marketplace" className="inline-flex items-center gap-2 px-6 py-3 border-2 border-gray-200 rounded-xl font-medium text-gray-700 hover:border-indigo-300 hover:text-indigo-600 transition-all">
                View All Courses <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
          {(!courses || courses.length === 0) && (
            <div className="text-center py-12"><p className="text-gray-400">Courses coming soon!</p></div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-12 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold">Ready to Start Learning?</h2>
            <p className="mt-4 text-white/80 text-lg max-w-lg mx-auto">Join hundreds of students already achieving their academic goals with us.</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/enroll" className="px-8 py-3.5 bg-white text-indigo-700 rounded-xl font-semibold hover:shadow-xl transition-all">
                Enroll Now - Free
              </Link>
              <Link href="/parent-portal" className="px-8 py-3.5 border-2 border-white/30 text-white rounded-xl font-semibold hover:bg-white/10 transition-all">
                Parent Portal
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center"><GraduationCap className="w-4 h-4 text-white" /></div>
              <span className="text-lg font-bold text-white">EduManage BD</span>
            </div>
            <p className="text-sm leading-relaxed">Rajshahi's premier coaching center providing quality education with expert teachers and proven results.</p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
            <div className="space-y-2 text-sm">
              <p><a href="#batches" className="hover:text-indigo-400 transition-colors">View Batches</a></p>
              <p><Link href="/enroll" className="hover:text-indigo-400 transition-colors">Enroll Now</Link></p>
              <p><Link href="/parent-portal" className="hover:text-indigo-400 transition-colors">Parent Portal</Link></p>
              <p><Link href="/marketplace" className="hover:text-indigo-400 transition-colors">Online Courses</Link></p>
            </div>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Contact</h4>
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Rajshahi, Bangladesh</p>
              <p className="flex items-center gap-2"><Phone className="w-4 h-4" /> 01XXXXXXXXX</p>
              <p className="flex items-center gap-2"><Mail className="w-4 h-4" /> info@edumanage.com</p>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-gray-800 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} EduManage BD. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
