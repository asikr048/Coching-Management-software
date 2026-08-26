"use client"
import { useState } from "react"
import { Search, Download, Eye, Edit } from "lucide-react"
import Link from "next/link"
import { formatDate } from "@/lib/utils"
import type { Student } from "@/lib/supabase/types"

interface Batch { id: string; name: string }
interface Props { students: (Student & { enrollments?: { batch?: { name: string }; status: string }[] })[]; batches: Batch[] }

export default function StudentsClient({ students, batches }: Props) {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  const filtered = students.filter(s => {
    const matchQ = !query || s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.student_id.toLowerCase().includes(query.toLowerCase()) ||
      s.phone?.toLowerCase().includes(query.toLowerCase())
    const matchS = !statusFilter || (statusFilter === "active" ? s.is_active : !s.is_active)
    return matchQ && matchS
  })

  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, ID, phone..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Batch</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Guardian</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Enrolled</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No students found</td></tr>
              ) : (
                filtered.map(student => {
                  const activeEnrollments = student.enrollments?.filter(e => e.status === "active") || []
                  return (
                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-xs">
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-sm">{student.name}</p>
                            <p className="text-xs text-gray-500">{student.phone || student.email || ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600"><span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-xs">{student.student_id}</span></td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {activeEnrollments.length > 0 ? activeEnrollments.map(e => e.batch?.name).join(", ") : <span className="text-gray-400">Not enrolled</span>}
                      </td>
                      <td className="px-4 py-3"><p className="text-sm text-gray-700">{student.guardian_name || "-"}</p><p className="text-xs text-gray-500">{student.guardian_phone}</p></td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(student.enrollment_date)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${student.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                          {student.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/dashboard/owner/students/${student.id}`} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Eye className="w-4 h-4" /></Link>
                          <Link href={`/dashboard/owner/students/${student.id}/edit`} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><Edit className="w-4 h-4" /></Link>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 text-sm text-gray-500">Showing {filtered.length} of {students.length} students</div>
      </div>
    </div>
  )
}
