"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Package, BookOpen, FileText, ClipboardList, Plus, Search,
  Filter, CheckCircle2, XCircle, Users, Download, ArrowRight,
  AlertTriangle, RefreshCw, Layers, Edit2, Trash2, Check,
  Clock, Sparkles, ChevronRight, X, UserCheck, Printer
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"

export type MaterialType = "book" | "sheet" | "notes" | "worksheet" | "exam_paper" | "other"

export interface Material {
  id: string
  name: string
  type: MaterialType
  batch_id?: string | null
  subject?: string | null
  total_stock: number
  available_stock: number
  price: number
  description?: string | null
  created_at: string
}

export interface MaterialIssue {
  id: string
  material_id: string
  student_id: string
  batch_id?: string | null
  issued_by?: string | null
  issued_at: string
  return_due_date?: string | null
  returned_at?: string | null
  condition_on_return?: string | null
  notes?: string | null
  status: "issued" | "returned"
  student?: {
    id: string
    name: string
    student_id: string
    phone?: string | null
  }
  batch?: {
    id: string
    name: string
  }
}

export interface Batch {
  id: string
  name: string
  subject?: string | null
  is_active?: boolean
}

export interface Student {
  id: string
  name: string
  student_id: string
  phone?: string | null
  guardian_phone?: string | null
  is_active?: boolean
  enrollments?: Array<{ batch_id: string; status?: string; batch?: { name: string } }>
}

interface CurrentStaff {
  id: string
  name: string
  email: string
  role: string
}

interface Props {
  initialMaterials: Material[]
  initialIssues: MaterialIssue[]
  batches: Batch[]
  students: Student[]
  currentStaff: CurrentStaff
}

const typeConfigs: Record<MaterialType, { label: string; icon: any; color: string; bg: string; border: string }> = {
  book: { label: "Book", icon: BookOpen, color: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200" },
  sheet: { label: "Lecture Sheet", icon: FileText, color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  notes: { label: "Class Notes", icon: ClipboardList, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  worksheet: { label: "Worksheet", icon: Layers, color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
  exam_paper: { label: "Question Paper", icon: FileText, color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  other: { label: "Other", icon: Package, color: "text-gray-700", bg: "bg-gray-50", border: "border-gray-200" },
}

export default function MaterialsClient({
  initialMaterials = [],
  initialIssues = [],
  batches = [],
  students = [],
  currentStaff
}: Props) {
  const supabase = useMemo(() => createClient(), [])

  // Materials state (synced with localStorage backup)
  const [materials, setMaterials] = useState<Material[]>(() => {
    if (typeof window === "undefined") return initialMaterials
    try {
      const saved = localStorage.getItem("medhashiree_materials")
      if (saved) {
        const parsed: Material[] = JSON.parse(saved)
        if (parsed.length > 0 && initialMaterials.length === 0) return parsed
      }
    } catch {}
    return initialMaterials
  })

  // Material issues state
  const [issues, setIssues] = useState<MaterialIssue[]>(() => {
    if (typeof window === "undefined") return initialIssues
    try {
      const saved = localStorage.getItem("medhashiree_material_issues")
      if (saved) {
        const parsed: MaterialIssue[] = JSON.parse(saved)
        if (parsed.length > 0 && initialIssues.length === 0) return parsed
      }
    } catch {}
    return initialIssues
  })

  // Sync to localStorage
  const saveMaterials = (updated: Material[]) => {
    setMaterials(updated)
    try {
      localStorage.setItem("medhashiree_materials", JSON.stringify(updated))
    } catch {}
  }

  const saveIssues = (updated: MaterialIssue[]) => {
    setIssues(updated)
    try {
      localStorage.setItem("medhashiree_material_issues", JSON.stringify(updated))
    } catch {}
  }

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>("all")
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all")

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null)

  const [distributeModalOpen, setDistributeModalOpen] = useState(false)
  const [distributeMaterial, setDistributeMaterial] = useState<Material | null>(null)

  const [whoGotItModalOpen, setWhoGotItModalOpen] = useState(false)
  const [whoGotItMaterial, setWhoGotItMaterial] = useState<Material | null>(null)

  // ==========================================
  // ADD / EDIT MATERIAL FORM STATE
  // ==========================================
  const [formData, setFormData] = useState({
    name: "",
    type: "sheet" as MaterialType,
    subject: "",
    batch_id: "",
    total_stock: 50,
    price: 0,
    description: ""
  })

  const openAddModal = () => {
    setEditingMaterial(null)
    setFormData({
      name: "",
      type: "sheet",
      subject: "",
      batch_id: "",
      total_stock: 50,
      price: 0,
      description: ""
    })
    setAddModalOpen(true)
  }

  const openEditModal = (m: Material) => {
    setEditingMaterial(m)
    setFormData({
      name: m.name,
      type: m.type,
      subject: m.subject || "",
      batch_id: m.batch_id || "",
      total_stock: m.total_stock,
      price: m.price || 0,
      description: m.description || ""
    })
    setAddModalOpen(true)
  }

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast.error("Please enter material name")
      return
    }

    if (editingMaterial) {
      // Edit
      const diff = formData.total_stock - editingMaterial.total_stock
      const updatedAvailable = Math.max(0, editingMaterial.available_stock + diff)

      const updatedMat: Material = {
        ...editingMaterial,
        name: formData.name.trim(),
        type: formData.type,
        subject: formData.subject.trim() || null,
        batch_id: formData.batch_id || null,
        total_stock: Number(formData.total_stock),
        available_stock: updatedAvailable,
        price: Number(formData.price) || 0,
        description: formData.description.trim() || null
      }

      const next = materials.map(m => m.id === editingMaterial.id ? updatedMat : m)
      saveMaterials(next)

      try {
        await supabase.from("materials").update({
          name: updatedMat.name,
          type: updatedMat.type,
          subject: updatedMat.subject,
          batch_id: updatedMat.batch_id,
          total_stock: updatedMat.total_stock,
          available_stock: updatedMat.available_stock,
          price: updatedMat.price,
          description: updatedMat.description
        }).eq("id", editingMaterial.id)
      } catch (err) {
        console.warn("Could not update material in database:", err)
      }

      toast.success("Material updated successfully!")
    } else {
      // Create
      const newId = "mat_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 6)
      const newMat: Material = {
        id: newId,
        name: formData.name.trim(),
        type: formData.type,
        subject: formData.subject.trim() || null,
        batch_id: formData.batch_id || null,
        total_stock: Number(formData.total_stock),
        available_stock: Number(formData.total_stock),
        price: Number(formData.price) || 0,
        description: formData.description.trim() || null,
        created_at: new Date().toISOString()
      }

      const next = [newMat, ...materials]
      saveMaterials(next)

      try {
        await supabase.from("materials").insert({
          id: newMat.id.startsWith("mat_") ? undefined : newMat.id,
          name: newMat.name,
          type: newMat.type,
          subject: newMat.subject,
          batch_id: newMat.batch_id,
          total_stock: newMat.total_stock,
          available_stock: newMat.available_stock,
          price: newMat.price,
          description: newMat.description
        })
      } catch (err) {
        console.warn("Could not insert material to database:", err)
      }

      toast.success("New material added successfully!")
    }

    setAddModalOpen(false)
  }

  const handleDeleteMaterial = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? Any distribution logs will also be removed.`)) {
      return
    }

    const nextMaterials = materials.filter(m => m.id !== id)
    const nextIssues = issues.filter(i => i.material_id !== id)
    saveMaterials(nextMaterials)
    saveIssues(nextIssues)

    try {
      await supabase.from("materials").delete().eq("id", id)
    } catch (e) {
      console.warn("Could not delete from supabase:", e)
    }

    toast.success("Material deleted.")
  }

  // ==========================================
  // DISTRIBUTE MATERIAL MODAL STATE
  // ==========================================
  const [distributeMode, setDistributeMode] = useState<"batch" | "search">("batch")
  const [distributeSelectedBatch, setDistributeSelectedBatch] = useState<string>("")
  const [distributeSearchStudentQuery, setDistributeSearchStudentQuery] = useState("")
  const [distributeSelectedStudentIds, setDistributeSelectedStudentIds] = useState<Set<string>>(new Set())
  const [distributeNotes, setDistributeNotes] = useState("")

  const openDistributeModal = (m?: Material) => {
    const target = m || materials[0] || null
    setDistributeMaterial(target)
    setDistributeMode("batch")
    setDistributeSelectedBatch(target?.batch_id || batches[0]?.id || "")
    setDistributeSearchStudentQuery("")
    setDistributeSelectedStudentIds(new Set())
    setDistributeNotes("")
    setDistributeModalOpen(true)
  }

  // Eligible students in selected batch
  const batchStudents = useMemo(() => {
    if (!distributeSelectedBatch) return []
    return students.filter(s => {
      const isEnrolled = s.enrollments?.some(e => e.batch_id === distributeSelectedBatch && e.status === "active")
      return Boolean(isEnrolled)
    })
  }, [students, distributeSelectedBatch])

  // Search filtered students for search mode
  const searchStudents = useMemo(() => {
    const q = distributeSearchStudentQuery.trim().toLowerCase()
    if (!q) return students.slice(0, 30)
    return students.filter(s => 
      s.name.toLowerCase().includes(q) ||
      s.student_id.toLowerCase().includes(q) ||
      (s.phone && s.phone.includes(q))
    ).slice(0, 40)
  }, [students, distributeSearchStudentQuery])

  // Set of students who have already received this material
  const alreadyIssuedStudentIds = useMemo(() => {
    if (!distributeMaterial) return new Set<string>()
    const set = new Set<string>()
    issues
      .filter(i => i.material_id === distributeMaterial.id && i.status === "issued")
      .forEach(i => set.add(i.student_id))
    return set
  }, [distributeMaterial, issues])

  // Toggle single student in distribute modal
  const toggleDistributeStudent = (studentId: string) => {
    const next = new Set(distributeSelectedStudentIds)
    if (next.has(studentId)) next.delete(studentId)
    else next.add(studentId)
    setDistributeSelectedStudentIds(next)
  }

  // Select all eligible in current view
  const handleSelectAllEligible = () => {
    const currentList = distributeMode === "batch" ? batchStudents : searchStudents
    const eligible = currentList.filter(s => !alreadyIssuedStudentIds.has(s.id))
    
    if (distributeSelectedStudentIds.size === eligible.length && eligible.length > 0) {
      setDistributeSelectedStudentIds(new Set())
    } else {
      setDistributeSelectedStudentIds(new Set(eligible.map(s => s.id)))
    }
  }

  // Confirm and issue
  const handleConfirmDistribution = async () => {
    if (!distributeMaterial) {
      toast.error("Please select a material to distribute")
      return
    }

    const countToIssue = distributeSelectedStudentIds.size
    if (countToIssue === 0) {
      toast.error("Please select at least one student")
      return
    }

    if (countToIssue > distributeMaterial.available_stock) {
      toast.error(`Cannot distribute ${countToIssue} items. Only ${distributeMaterial.available_stock} in stock.`)
      return
    }

    const newIssues: MaterialIssue[] = []
    const nowIso = new Date().toISOString()

    distributeSelectedStudentIds.forEach(stId => {
      const studentObj = students.find(s => s.id === stId)
      const batchObj = batches.find(b => b.id === (distributeSelectedBatch || distributeMaterial.batch_id))

      newIssues.push({
        id: "issue_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 6),
        material_id: distributeMaterial.id,
        student_id: stId,
        batch_id: distributeSelectedBatch || distributeMaterial.batch_id || null,
        issued_by: currentStaff.id,
        issued_at: nowIso,
        status: "issued",
        notes: distributeNotes.trim() || null,
        student: studentObj ? { id: studentObj.id, name: studentObj.name, student_id: studentObj.student_id, phone: studentObj.phone } : undefined,
        batch: batchObj ? { id: batchObj.id, name: batchObj.name } : undefined
      })
    })

    // 1. Update issues state
    const nextIssues = [...newIssues, ...issues]
    saveIssues(nextIssues)

    // 2. Decrement stock
    const nextMaterials = materials.map(m => {
      if (m.id === distributeMaterial.id) {
        return {
          ...m,
          available_stock: Math.max(0, m.available_stock - countToIssue)
        }
      }
      return m
    })
    saveMaterials(nextMaterials)

    // 3. Supabase insert
    try {
      const rowsToInsert = newIssues.map(i => ({
        material_id: i.material_id,
        student_id: i.student_id,
        batch_id: i.batch_id,
        issued_by: currentStaff.id.startsWith("admin") ? undefined : currentStaff.id,
        issued_at: i.issued_at,
        status: "issued",
        notes: i.notes
      }))
      await supabase.from("material_issues").insert(rowsToInsert)

      await supabase.from("materials").update({
        available_stock: Math.max(0, distributeMaterial.available_stock - countToIssue)
      }).eq("id", distributeMaterial.id)
    } catch (e) {
      console.warn("Could not save issues to supabase:", e)
    }

    toast.success(`✓ Distributed ${countToIssue} copies of "${distributeMaterial.name}"!`)
    setDistributeModalOpen(false)
  }

  // ==========================================
  // "WHO GOT IT" / DISTRIBUTION CONTROLLER
  // ==========================================
  const [whoGotItTab, setWhoGotItTab] = useState<"all" | "received" | "pending">("all")
  const [whoGotItSearch, setWhoGotItSearch] = useState("")

  const openWhoGotItModal = (m: Material) => {
    setWhoGotItMaterial(m)
    setWhoGotItTab("all")
    setWhoGotItSearch("")
    setWhoGotItModalOpen(true)
  }

  // Active issues for the selected material
  const materialIssuesList = useMemo(() => {
    if (!whoGotItMaterial) return []
    return issues.filter(i => i.material_id === whoGotItMaterial.id && i.status === "issued")
  }, [whoGotItMaterial, issues])

  // Target students for this material (either from target batch or all students)
  const targetStudentsForMaterial = useMemo(() => {
    if (!whoGotItMaterial) return []
    if (whoGotItMaterial.batch_id) {
      return students.filter(s => s.enrollments?.some(e => e.batch_id === whoGotItMaterial.batch_id && e.status === "active"))
    }
    return students
  }, [whoGotItMaterial, students])

  // Quick 1-click toggle Issue from inside the "Who Got It" manager
  const handleQuickIssueStudent = async (student: Student) => {
    if (!whoGotItMaterial) return
    if (whoGotItMaterial.available_stock <= 0) {
      toast.error("Cannot issue: Out of stock!")
      return
    }

    const newIssue: MaterialIssue = {
      id: "issue_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 6),
      material_id: whoGotItMaterial.id,
      student_id: student.id,
      batch_id: whoGotItMaterial.batch_id || null,
      issued_by: currentStaff.id,
      issued_at: new Date().toISOString(),
      status: "issued",
      notes: "Quick distributed via Manager",
      student: { id: student.id, name: student.name, student_id: student.student_id, phone: student.phone }
    }

    const nextIssues = [newIssue, ...issues]
    saveIssues(nextIssues)

    const nextMaterials = materials.map(m => {
      if (m.id === whoGotItMaterial.id) {
        return { ...m, available_stock: Math.max(0, m.available_stock - 1) }
      }
      return m
    })
    saveMaterials(nextMaterials)
    setWhoGotItMaterial(prev => prev ? { ...prev, available_stock: Math.max(0, prev.available_stock - 1) } : null)

    try {
      await supabase.from("material_issues").insert({
        material_id: whoGotItMaterial.id,
        student_id: student.id,
        batch_id: whoGotItMaterial.batch_id,
        issued_by: currentStaff.id.startsWith("admin") ? undefined : currentStaff.id,
        status: "issued",
        notes: "Quick distributed"
      })
      await supabase.from("materials").update({
        available_stock: Math.max(0, whoGotItMaterial.available_stock - 1)
      }).eq("id", whoGotItMaterial.id)
    } catch {}

    toast.success(`✓ Marked ${student.name} as received.`)
  }

  // Quick 1-click revoke / return
  const handleQuickRevokeStudent = async (issueId: string, studentName: string) => {
    if (!whoGotItMaterial) return

    const nextIssues = issues.filter(i => i.id !== issueId)
    saveIssues(nextIssues)

    const nextMaterials = materials.map(m => {
      if (m.id === whoGotItMaterial.id) {
        return { ...m, available_stock: m.available_stock + 1 }
      }
      return m
    })
    saveMaterials(nextMaterials)
    setWhoGotItMaterial(prev => prev ? { ...prev, available_stock: prev.available_stock + 1 } : null)

    try {
      await supabase.from("material_issues").delete().eq("id", issueId)
      await supabase.from("materials").update({
        available_stock: whoGotItMaterial.available_stock + 1
      }).eq("id", whoGotItMaterial.id)
    } catch {}

    toast.info(`Revoked distribution for ${studentName}. 1 unit restored to stock.`)
  }

  // Export / Print Checklist
  const handleExportChecklist = () => {
    if (!whoGotItMaterial) return

    const rows = targetStudentsForMaterial.map((s, idx) => {
      const issue = materialIssuesList.find(i => i.student_id === s.id)
      const statusStr = issue ? "RECEIVED" : "NOT RECEIVED"
      const dateStr = issue ? formatDate(issue.issued_at) : "-"
      return [
        idx + 1,
        `"${s.name}"`,
        `"${s.student_id}"`,
        `"${s.phone || '-'}"`,
        `"${statusStr}"`,
        `"${dateStr}"`,
        `"_________________"`
      ].join(",")
    })

    const headers = ["#", "Student Name", "Student ID", "Phone", "Status", "Received Date", "Signature"]
    const csv = [headers.join(","), ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.setAttribute("download", `distribution_checklist_${whoGotItMaterial.name.replace(/\s+/g, "_")}.csv`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success("Distribution signature checklist downloaded!")
  }

  // Filtered materials grid
  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      // 1. Search query
      const q = searchQuery.trim().toLowerCase()
      if (q) {
        const nameMatch = m.name.toLowerCase().includes(q)
        const subMatch = (m.subject || "").toLowerCase().includes(q)
        if (!nameMatch && !subMatch) return false
      }
      // 2. Type filter
      if (selectedType !== "all" && m.type !== selectedType) return false
      // 3. Batch filter
      if (selectedBatchFilter !== "all" && m.batch_id !== selectedBatchFilter) return false
      // 4. Stock filter
      if (stockFilter === "in_stock" && m.available_stock <= 0) return false
      if (stockFilter === "low_stock" && (m.available_stock > 5 || m.available_stock <= 0)) return false
      if (stockFilter === "out_of_stock" && m.available_stock > 0) return false

      return true
    })
  }, [materials, searchQuery, selectedType, selectedBatchFilter, stockFilter])

  // Overall stats
  const totalMaterialsCount = materials.length
  const totalStockInHand = materials.reduce((acc, m) => acc + (m.available_stock || 0), 0)
  const totalDistributedCount = issues.filter(i => i.status === "issued").length
  const lowStockCount = materials.filter(m => m.available_stock <= 5 && m.available_stock > 0).length

  return (
    <div className="space-y-6">
      {/* Page Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <Package className="w-7 h-7 text-indigo-600" />
            Study Materials & Distribution
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage books, lecture sheets, notes, and track student distribution
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => openDistributeModal()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-semibold hover:bg-indigo-100 transition-colors shadow-sm"
          >
            <Users className="w-4 h-4 text-indigo-600" />
            Distribute Material
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
          >
            <Plus className="w-4 h-4" />
            + Add Material
          </button>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Total Items</span>
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">{totalMaterialsCount}</p>
          <p className="text-xs text-gray-400 mt-1">Books, sheets, and notes</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Units In Stock</span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-2">{totalStockInHand}</p>
          <p className="text-xs text-gray-400 mt-1">Available for distribution</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Distributed</span>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-600 mt-2">{totalDistributedCount}</p>
          <p className="text-xs text-gray-400 mt-1">Copies given to students</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Low Stock Alert</span>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">{lowStockCount}</p>
          <p className="text-xs text-gray-400 mt-1">&le; 5 units remaining</p>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search materials by title or subject..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
            >
              <option value="all">All Types</option>
              <option value="sheet">Lecture Sheets</option>
              <option value="book">Books</option>
              <option value="notes">Class Notes</option>
              <option value="worksheet">Practice Worksheets</option>
              <option value="exam_paper">Question Papers</option>
              <option value="other">Other Materials</option>
            </select>

            <select
              value={selectedBatchFilter}
              onChange={e => setSelectedBatchFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
            >
              <option value="all">All Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <select
              value={stockFilter}
              onChange={e => setStockFilter(e.target.value as any)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
            >
              <option value="all">All Stock Status</option>
              <option value="in_stock">In Stock (&gt;0)</option>
              <option value="low_stock">Low Stock (&le;5)</option>
              <option value="out_of_stock">Out of Stock (0)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Materials Grid */}
      {filteredMaterials.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-base font-semibold text-gray-700">No study materials found</p>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            {searchQuery || selectedType !== "all" 
              ? "Try adjusting your search query or filter settings." 
              : "Get started by adding books, lecture sheets, or worksheets for your students."}
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            + Add First Material
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMaterials.map(m => {
            const config = typeConfigs[m.type] || typeConfigs.other
            const TypeIcon = config.icon
            const batchObj = batches.find(b => b.id === m.batch_id)
            const distributedForThis = issues.filter(i => i.material_id === m.id && i.status === "issued").length
            const isOutOfStock = m.available_stock <= 0
            const isLowStock = m.available_stock <= 5 && !isOutOfStock

            const stockPct = m.total_stock > 0 
              ? Math.min(100, Math.round((m.available_stock / m.total_stock) * 100)) 
              : 0

            return (
              <div 
                key={m.id} 
                className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg} ${config.color} ${config.border}`}>
                      <TypeIcon className="w-3.5 h-3.5" />
                      {config.label}
                    </span>

                    {m.price > 0 ? (
                      <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                        {formatCurrency(m.price)}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                        Free Material
                      </span>
                    )}
                  </div>

                  {/* Title & Subject */}
                  <h3 className="font-bold text-gray-900 text-base group-hover:text-indigo-600 transition-colors">
                    {m.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span>{m.subject || "All Subjects"}</span>
                    <span>•</span>
                    <span className="truncate max-w-[150px] font-medium text-gray-700">
                      {batchObj ? batchObj.name : "All Batches"}
                    </span>
                  </div>

                  {m.description && (
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                      {m.description}
                    </p>
                  )}

                  {/* Stock Indicator */}
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-gray-500">
                        In Stock: <strong className={isOutOfStock ? "text-red-600" : isLowStock ? "text-amber-600" : "text-gray-900"}>{m.available_stock}</strong> / {m.total_stock} units
                      </span>
                      <span className="text-gray-400 font-mono">{stockPct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isOutOfStock ? "bg-red-500" : isLowStock ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${stockPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => openWhoGotItModal(m)}
                    className="flex-1 py-1.5 px-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg border border-gray-200 transition-colors text-center flex items-center justify-center gap-1"
                    title="View and manage who received this material"
                  >
                    <Users className="w-3.5 h-3.5 text-gray-500" />
                    Who Got It ({distributedForThis})
                  </button>

                  <button
                    onClick={() => openDistributeModal(m)}
                    disabled={isOutOfStock}
                    className="flex-1 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-bold rounded-lg transition-colors text-center flex items-center justify-center gap-1 shadow-sm"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    Distribute
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(m)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit material"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteMaterial(m.id, m.name)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete material"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ========================================== */}
      {/* 1. ADD / EDIT MATERIAL MODAL              */}
      {/* ========================================== */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" />
                {editingMaterial ? "Edit Material" : "Add New Study Material"}
              </h3>
              <button onClick={() => setAddModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMaterial} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Material Title / Name <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., HSC Physics Chapter 1 Lecture Sheet"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Material Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as MaterialType })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                  >
                    <option value="sheet">📄 Lecture Sheet</option>
                    <option value="book">📖 Book</option>
                    <option value="notes">📝 Class Notes</option>
                    <option value="worksheet">📋 Practice Worksheet</option>
                    <option value="exam_paper">📑 Question Paper</option>
                    <option value="other">📦 Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Subject
                  </label>
                  <input
                    value={formData.subject}
                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="e.g., Physics, Math"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Assigned Batch
                  </label>
                  <select
                    value={formData.batch_id}
                    onChange={e => setFormData({ ...formData, batch_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                  >
                    <option value="">Available for All Batches</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Total Quantity / Stock <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.total_stock}
                    onChange={e => setFormData({ ...formData, total_stock: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Price (৳) <span className="text-gray-400 font-normal">(Leave 0 if free for enrolled students)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.price}
                  onChange={e => setFormData({ ...formData, price: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Description / Topic Notes
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  placeholder="e.g., Covers Newton's laws and practice formulas..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-200"
                >
                  {editingMaterial ? "Update Material" : "Save & Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 2. DISTRIBUTE MATERIAL MODAL               */}
      {/* ========================================== */}
      {distributeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-gray-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-indigo-50/50">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  Distribute Study Material
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select a batch or search students to issue books or sheets
                </p>
              </div>
              <button onClick={() => setDistributeModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Select Material */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Select Material to Distribute <span className="text-red-500">*</span>
                </label>
                <select
                  value={distributeMaterial?.id || ""}
                  onChange={e => {
                    const found = materials.find(m => m.id === e.target.value)
                    setDistributeMaterial(found || null)
                    setDistributeSelectedStudentIds(new Set())
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                >
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.type.toUpperCase()}) • {m.available_stock} in stock
                    </option>
                  ))}
                </select>
                {distributeMaterial && (
                  <p className="text-xs text-gray-500 mt-1">
                    Available Stock: <strong className="text-indigo-600">{distributeMaterial.available_stock} units</strong>
                  </p>
                )}
              </div>

              {/* Mode Toggle */}
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setDistributeMode("batch")
                    setDistributeSelectedStudentIds(new Set())
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    distributeMode === "batch" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Distribute by Batch
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDistributeMode("search")
                    setDistributeSelectedStudentIds(new Set())
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    distributeMode === "search" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Search & Multi-Select Students
                </button>
              </div>

              {/* MODE 1: BY BATCH */}
              {distributeMode === "batch" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Select Target Batch
                    </label>
                    <select
                      value={distributeSelectedBatch}
                      onChange={e => {
                        setDistributeSelectedBatch(e.target.value)
                        setDistributeSelectedStudentIds(new Set())
                      }}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                    >
                      {batches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-semibold text-gray-500 uppercase">
                      Students Enrolled ({batchStudents.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleSelectAllEligible}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                    >
                      Select All Eligible
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-gray-50/50">
                    {batchStudents.length === 0 ? (
                      <p className="p-6 text-center text-xs text-gray-400">No students enrolled in this batch.</p>
                    ) : (
                      batchStudents.map(student => {
                        const alreadyIssued = alreadyIssuedStudentIds.has(student.id)
                        const isSelected = distributeSelectedStudentIds.has(student.id)

                        return (
                          <div
                            key={student.id}
                            onClick={() => !alreadyIssued && toggleDistributeStudent(student.id)}
                            className={`p-3 flex items-center justify-between text-xs transition-colors ${
                              alreadyIssued 
                                ? "bg-gray-100/60 opacity-60 cursor-not-allowed" 
                                : isSelected 
                                ? "bg-indigo-50/80 cursor-pointer" 
                                : "hover:bg-white cursor-pointer"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                disabled={alreadyIssued}
                                checked={isSelected || alreadyIssued}
                                onChange={() => {}}
                                className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                              />
                              <div>
                                <p className="font-semibold text-gray-900">{student.name}</p>
                                <p className="text-[11px] text-gray-500 font-mono">{student.student_id} • {student.phone || "No phone"}</p>
                              </div>
                            </div>

                            {alreadyIssued ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <Check className="w-3 h-3" /> Already Received
                              </span>
                            ) : (
                              <span className="text-[11px] text-gray-400">
                                {isSelected ? "Selected" : "Click to select"}
                              </span>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              {/* MODE 2: SEARCH STUDENTS */}
              {distributeMode === "search" && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      value={distributeSearchStudentQuery}
                      onChange={e => setDistributeSearchStudentQuery(e.target.value)}
                      placeholder="Search student by name, student ID, or phone..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-semibold text-gray-500 uppercase">
                      Matching Students ({searchStudents.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleSelectAllEligible}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                    >
                      Select All Eligible
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-gray-50/50">
                    {searchStudents.length === 0 ? (
                      <p className="p-6 text-center text-xs text-gray-400">No matching students found.</p>
                    ) : (
                      searchStudents.map(student => {
                        const alreadyIssued = alreadyIssuedStudentIds.has(student.id)
                        const isSelected = distributeSelectedStudentIds.has(student.id)

                        return (
                          <div
                            key={student.id}
                            onClick={() => !alreadyIssued && toggleDistributeStudent(student.id)}
                            className={`p-3 flex items-center justify-between text-xs transition-colors ${
                              alreadyIssued 
                                ? "bg-gray-100/60 opacity-60 cursor-not-allowed" 
                                : isSelected 
                                ? "bg-indigo-50/80 cursor-pointer" 
                                : "hover:bg-white cursor-pointer"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                disabled={alreadyIssued}
                                checked={isSelected || alreadyIssued}
                                onChange={() => {}}
                                className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                              />
                              <div>
                                <p className="font-semibold text-gray-900">{student.name}</p>
                                <p className="text-[11px] text-gray-500 font-mono">{student.student_id} • {student.phone || "No phone"}</p>
                              </div>
                            </div>

                            {alreadyIssued ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <Check className="w-3 h-3" /> Already Received
                              </span>
                            ) : (
                              <span className="text-[11px] text-gray-400">
                                {isSelected ? "Selected" : "Click to select"}
                              </span>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Optional Distribution Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Distribution Note <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  value={distributeNotes}
                  onChange={e => setDistributeNotes(e.target.value)}
                  placeholder="e.g. Distributed in class / signed at reception counter"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                />
              </div>

              {/* Stock Preview Alert */}
              {distributeMaterial && (
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-gray-500">Selected: </span>
                    <strong className="text-indigo-600 font-bold">{distributeSelectedStudentIds.size} students</strong>
                  </div>
                  <div>
                    <span className="text-gray-500">Stock After Issue: </span>
                    <strong className={`font-bold ${
                      distributeMaterial.available_stock - distributeSelectedStudentIds.size < 0
                        ? "text-red-600"
                        : "text-emerald-600"
                    }`}>
                      {distributeMaterial.available_stock - distributeSelectedStudentIds.size} units
                    </strong>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
              <span className="text-xs text-gray-500">
                {distributeSelectedStudentIds.size} students selected
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDistributeModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDistribution}
                  disabled={distributeSelectedStudentIds.size === 0 || (distributeMaterial ? distributeSelectedStudentIds.size > distributeMaterial.available_stock : true)}
                  className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:text-gray-500 rounded-lg transition-colors shadow-sm"
                >
                  Confirm & Issue ({distributeSelectedStudentIds.size})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 3. "WHO GOT IT" DISTRIBUTION CONTROLLER    */}
      {/* ========================================== */}
      {whoGotItModalOpen && whoGotItMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden border border-gray-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 text-lg">
                    {whoGotItMaterial.name}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md uppercase">
                    {whoGotItMaterial.type}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Distribution Tracker & Student Collection Manager
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportChecklist}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" /> Export / Print Checklist
                </button>
                <button onClick={() => setWhoGotItModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Distribution Summary Card */}
            <div className="px-6 py-3 bg-indigo-50/50 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4">
                <span>Total Target: <strong>{targetStudentsForMaterial.length}</strong></span>
                <span>Distributed: <strong className="text-emerald-700">{materialIssuesList.length}</strong></span>
                <span>Remaining to Issue: <strong className="text-amber-700">{Math.max(0, targetStudentsForMaterial.length - materialIssuesList.length)}</strong></span>
                <span>Available Stock: <strong className="text-indigo-700">{whoGotItMaterial.available_stock}</strong></span>
              </div>
              <div>
                <span className="font-semibold text-indigo-900">
                  {targetStudentsForMaterial.length > 0 
                    ? Math.round((materialIssuesList.length / targetStudentsForMaterial.length) * 100) 
                    : 0}% Distribution Rate
                </span>
              </div>
            </div>

            {/* Sub Filter Tabs & Search */}
            <div className="px-6 py-3 border-b border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex bg-gray-100 p-1 rounded-lg text-xs">
                <button
                  onClick={() => setWhoGotItTab("all")}
                  className={`px-3 py-1 font-semibold rounded-md transition-all ${
                    whoGotItTab === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  All ({targetStudentsForMaterial.length})
                </button>
                <button
                  onClick={() => setWhoGotItTab("received")}
                  className={`px-3 py-1 font-semibold rounded-md transition-all ${
                    whoGotItTab === "received" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Received ({materialIssuesList.length})
                </button>
                <button
                  onClick={() => setWhoGotItTab("pending")}
                  className={`px-3 py-1 font-semibold rounded-md transition-all ${
                    whoGotItTab === "pending" ? "bg-white text-amber-700 shadow-sm" : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Not Received Yet ({Math.max(0, targetStudentsForMaterial.length - materialIssuesList.length)})
                </button>
              </div>

              {/* In-Modal Search */}
              <div className="relative min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  value={whoGotItSearch}
                  onChange={e => setWhoGotItSearch(e.target.value)}
                  placeholder="Find student..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                />
              </div>
            </div>

            {/* Student Distribution Table */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
                      <th className="px-4 py-2.5">#</th>
                      <th className="px-4 py-2.5">Student</th>
                      <th className="px-4 py-2.5">ID</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Date Issued</th>
                      <th className="px-4 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {(() => {
                      const list = targetStudentsForMaterial.filter(s => {
                        const issue = materialIssuesList.find(i => i.student_id === s.id)
                        const hasReceived = Boolean(issue)

                        if (whoGotItTab === "received" && !hasReceived) return false
                        if (whoGotItTab === "pending" && hasReceived) return false

                        if (whoGotItSearch.trim()) {
                          const q = whoGotItSearch.toLowerCase()
                          const matchName = s.name.toLowerCase().includes(q)
                          const matchId = s.student_id.toLowerCase().includes(q)
                          const matchPhone = (s.phone || "").includes(q)
                          if (!matchName && !matchId && !matchPhone) return false
                        }
                        return true
                      })

                      if (list.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-gray-400">
                              No students found for this tab or filter.
                            </td>
                          </tr>
                        )
                      }

                      return list.map((student, idx) => {
                        const issue = materialIssuesList.find(i => i.student_id === student.id)
                        const hasReceived = Boolean(issue)

                        return (
                          <tr key={student.id} className="hover:bg-gray-50/70 transition-colors">
                            <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-gray-900">{student.name}</p>
                              <p className="text-[11px] text-gray-400">{student.phone || "No phone"}</p>
                            </td>
                            <td className="px-4 py-3 font-mono text-gray-600">
                              {student.student_id}
                            </td>
                            <td className="px-4 py-3">
                              {hasReceived ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Received
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                  <Clock className="w-3 h-3 text-amber-600" /> Not Received
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-500">
                              {issue ? formatDate(issue.issued_at) : "-"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {hasReceived && issue ? (
                                <button
                                  onClick={() => handleQuickRevokeStudent(issue.id, student.name)}
                                  className="text-[11px] text-red-600 hover:text-red-800 font-semibold px-2 py-1 rounded hover:bg-red-50 transition-colors"
                                >
                                  Revoke
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleQuickIssueStudent(student)}
                                  className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors shadow-sm"
                                >
                                  Mark as Issued
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
