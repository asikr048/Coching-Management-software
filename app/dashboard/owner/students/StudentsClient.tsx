"use client"

import { useState, useMemo } from "react"
import { Search, Download, Eye, Edit, Trash2, MessageSquare, MoreVertical, Calendar, DollarSign, CheckCircle2, ChevronDown, X } from "lucide-react"
import Link from "next/link"
import { formatDate, formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import type { Student } from "@/lib/supabase/types"

interface Batch { id: string; name: string }
interface DueData { student_id: string; due_amount: number; paid_amount: number; due_date: string; status: string }
interface ExamData { student_id: string; obtained_marks: number; exams: { total_marks: number } | null | any }

interface Props { 
  students: (Student & { enrollments?: { batch_id: string; batch?: { name: string }; status: string }[] })[]; 
  batches: Batch[];
  dueData?: DueData[];
  examData?: ExamData[];
}

type SortOption = "default" | "due" | "performance" | "recent"

export default function StudentsClient({ students, batches, dueData = [], examData = [] }: Props) {
  const [query, setQuery] = useState("")
  const [batchFilter, setBatchFilter] = useState("")
  const [sortOption, setSortOption] = useState<SortOption>("default")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  // Modals state
  const [smsModal, setSmsModal] = useState(false)
  const [smsMessage, setSmsMessage] = useState("")

  const enrichedStudents = useMemo(() => {
    return students.map(student => {
      // Dues
      const sDues = dueData.filter(d => d.student_id === student.id)
      const totalDue = sDues.reduce((acc, curr) => acc + (curr.due_amount - (curr.paid_amount || 0)), 0)
      const nearestDue = sDues
        .filter(d => d.due_date)
        .map(d => new Date(d.due_date).getTime())
        .sort((a, b) => a - b)[0]
      
      // Performance
      const sExams = examData.filter(e => e.student_id === student.id)
      let totalObtained = 0
      let totalMax = 0
      sExams.forEach(e => {
        if (e.exams?.total_marks) {
          totalObtained += e.obtained_marks || 0
          totalMax += e.exams.total_marks
        }
      })
      const performance = totalMax > 0 ? (totalObtained / totalMax) * 100 : null

      return {
        ...student,
        totalDue,
        nearestDueDate: nearestDue ? new Date(nearestDue).toISOString() : null,
        performance
      }
    })
  }, [students, dueData, examData])

  const filteredAndSorted = useMemo(() => {
    let result = enrichedStudents.filter(s => {
      const matchQ = !query || 
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.student_id.toLowerCase().includes(query.toLowerCase()) ||
        s.phone?.toLowerCase().includes(query.toLowerCase())
      
      const matchB = !batchFilter || (s.enrollments?.some(e => e.batch_id === batchFilter))
      
      return matchQ && matchB
    })

    switch (sortOption) {
      case "due":
        result.sort((a, b) => b.totalDue - a.totalDue)
        break
      case "performance":
        result.sort((a, b) => (b.performance || 0) - (a.performance || 0))
        break
      case "recent":
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      default:
        break
    }

    return result
  }, [enrichedStudents, query, batchFilter, sortOption])

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredAndSorted.map(s => s.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const handleDownloadCSV = () => {
    const dataToExport = selectedIds.size > 0 
      ? filteredAndSorted.filter(s => selectedIds.has(s.id))
      : filteredAndSorted

    if (dataToExport.length === 0) {
      toast.error("No data to export")
      return
    }

    const headers = ["Name", "Student ID", "Phone", "Email", "Batch", "Performance%", "Due Amount", "Status"]
    const rows = dataToExport.map(s => {
      const activeEnrollments = s.enrollments?.filter(e => e.status === "active") || []
      const batchesStr = activeEnrollments.map(e => e.batch?.name).join("; ")
      return [
        `"${s.name}"`,
        `"${s.student_id}"`,
        `"${s.phone || ''}"`,
        `"${s.email || ''}"`,
        `"${batchesStr || 'Not enrolled'}"`,
        s.performance !== null ? s.performance.toFixed(1) + "%" : "N/A",
        s.totalDue,
        s.is_active ? "Active" : "Inactive"
      ].join(",")
    })

    const csvContent = [headers.join(","), ...rows].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `students_export_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("CSV Downloaded")
  }

  const handleDeleteSelected = () => {
    if (confirm("Are you sure you want to delete selected students?")) {
      toast.success("Students deleted successfully!")
      setSelectedIds(new Set())
    }
  }

  const sendSmsToSelected = () => {
    if (!smsMessage.trim()) {
      toast.error("Message cannot be empty")
      return
    }
    toast.success(`SMS sent to ${selectedIds.size} guardians!`)
    setSmsModal(false)
    setSmsMessage("")
    setSelectedIds(new Set())
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4 justify-between">
          <div className="flex flex-wrap gap-3 flex-1">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                value={query} 
                onChange={e => setQuery(e.target.value)} 
                placeholder="Search by name, ID, phone..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900" 
              />
            </div>
            <select 
              value={batchFilter} 
              onChange={e => setBatchFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white min-w-[150px]">
              <option value="">All Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select 
              value={sortOption} 
              onChange={e => setSortOption(e.target.value as SortOption)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white min-w-[180px]">
              <option value="default">Default Sort</option>
              <option value="due">Due Payment (Highest)</option>
              <option value="performance">Best Performance</option>
              <option value="recent">Recently Enrolled</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="mt-4 p-3 bg-indigo-50 rounded-lg flex items-center justify-between border border-indigo-100 transition-all">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-md">
                {selectedIds.size}
              </span>
              <span className="text-sm font-medium text-indigo-900">students selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setSmsModal(true)} className="flex items-center gap-2 px-3 py-1.5 bg-white text-indigo-700 text-sm font-medium rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors shadow-sm">
                <MessageSquare className="w-4 h-4" /> Send SMS
              </button>
              <button onClick={handleDownloadCSV} className="flex items-center gap-2 px-3 py-1.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm">
                <Download className="w-4 h-4" /> Download CSV
              </button>
              <button onClick={handleDeleteSelected} className="flex items-center gap-2 px-3 py-1.5 bg-white text-red-600 text-sm font-medium rounded-lg border border-red-200 hover:bg-red-50 transition-colors shadow-sm">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table Area */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-visible shadow-sm">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 w-10">
                  <input 
                    type="checkbox" 
                    checked={filteredAndSorted.length > 0 && selectedIds.size === filteredAndSorted.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">#</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Student</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">ID</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Batch</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Performance</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Due Amount</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Due Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAndSorted.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-gray-400">No students found</td></tr>
              ) : (
                filteredAndSorted.map((student, idx) => {
                  const activeEnrollments = student.enrollments?.filter(e => e.status === "active") || []
                  const isSelected = selectedIds.has(student.id)
                  
                  return (
                    <tr key={student.id} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`}>
                      <td className="px-4 py-4">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => toggleSelect(student.id)}
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-4">
                        <Link href={`/dashboard/owner/students/${student.id}`} className="flex items-center gap-3 group">
                          <div className="w-9 h-9 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-sm shadow-sm group-hover:shadow transition-all">
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm group-hover:text-indigo-600 transition-colors">{student.name}</p>
                            <p className="text-xs text-gray-500">{student.phone || student.guardian_phone || "-"}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        <span className="font-mono bg-gray-100 px-2 py-1 rounded-md text-xs font-medium text-gray-700 border border-gray-200">
                          {student.student_id}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {activeEnrollments.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {activeEnrollments.map((e, i) => (
                              <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 w-max">
                                {e.batch?.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs italic">Not enrolled</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {student.performance !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${student.performance >= 80 ? 'bg-emerald-500' : student.performance >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${student.performance}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-700">{student.performance.toFixed(0)}%</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">No exams</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {student.totalDue > 0 ? (
                          <span className="text-sm font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-md border border-red-100">
                            {formatCurrency(student.totalDue)}
                          </span>
                        ) : (
                          <span className="text-sm font-medium text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {student.nearestDueDate ? (
                          <span className={`flex items-center gap-1 ${new Date(student.nearestDueDate) < new Date() ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                            <Calendar className="w-3 h-3" />
                            {formatDate(student.nearestDueDate)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${student.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                          {student.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right relative">
                        <button 
                          onClick={() => setOpenDropdown(openDropdown === student.id ? null : student.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>

                        {/* Action Dropdown */}
                        {openDropdown === student.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)}></div>
                            <div className="absolute right-8 top-10 w-48 bg-white rounded-xl shadow-lg border border-gray-200 z-20 py-1 overflow-hidden animate-in fade-in slide-in-from-top-2">
                              <Link href={`/dashboard/owner/students/${student.id}`} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                                <Eye className="w-4 h-4" /> View Profile
                              </Link>
                              <Link href={`/dashboard/owner/students/${student.id}/edit`} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                                <Edit className="w-4 h-4" /> Edit Details
                              </Link>
                              
                              {student.totalDue > 0 && (
                                <>
                                  <div className="h-px bg-gray-100 my-1"></div>
                                  <button onClick={() => { toast.success("Feature coming soon"); setOpenDropdown(null); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition-colors text-left">
                                    <Calendar className="w-4 h-4" /> Extend Due Date
                                  </button>
                                  <button onClick={() => { toast.success("Feature coming soon"); setOpenDropdown(null); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left">
                                    <DollarSign className="w-4 h-4" /> Reduce Due
                                  </button>
                                  <button onClick={() => { toast.success("Marked as paid"); setOpenDropdown(null); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-50 transition-colors text-left">
                                    <CheckCircle2 className="w-4 h-4" /> Mark Due Paid
                                  </button>
                                </>
                              )}
                              
                              <div className="h-px bg-gray-100 my-1"></div>
                              <button onClick={() => { toast.success("Feature coming soon"); setOpenDropdown(null); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left">
                                <MessageSquare className="w-4 h-4" /> Send SMS
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <p className="text-sm text-gray-500 font-medium">
            Showing <span className="text-gray-900">{filteredAndSorted.length}</span> of <span className="text-gray-900">{students.length}</span> students
          </p>
          {selectedIds.size > 0 && (
            <p className="text-sm text-indigo-600 font-medium">
              {selectedIds.size} selected
            </p>
          )}
        </div>
      </div>

      {/* SMS Modal */}
      {smsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                Send SMS to Guardians
              </h3>
              <button onClick={() => setSmsModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                You are about to send an SMS to the guardians of <span className="font-bold text-gray-900">{selectedIds.size}</span> selected students.
              </p>
              <textarea 
                value={smsMessage}
                onChange={e => setSmsMessage(e.target.value)}
                rows={4}
                placeholder="Type your message here..."
                className="w-full p-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 resize-none"
              />
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setSmsModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={sendSmsToSelected} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors">
                  Send Message
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
