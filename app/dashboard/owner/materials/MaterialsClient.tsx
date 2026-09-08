"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Package, BookOpen, FileText, ClipboardList, Plus, Search,
  Filter, CheckCircle2, XCircle, Users, Download, ArrowRight,
  AlertTriangle, RefreshCw, Layers, Edit2, Trash2, Check,
  Clock, Sparkles, ChevronRight, X, UserCheck, Printer, Landmark, Building2
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { useBranch } from "@/components/providers/BranchContext"
import type { Branch } from "@/lib/supabase/types"

export type MaterialType = "book" | "sheet" | "notes" | "worksheet" | "exam_paper" | "other"

export interface Material {
  id: string
  name: string
  type: MaterialType
  branch_id?: string | null
  batch_id?: string | null
  batch_ids?: string[] | null
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
  branch_id?: string | null
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
  branches?: Branch[]
  students: Student[]
  currentStaff: CurrentStaff
}

const typeConfigs: Record<MaterialType, { label: string; icon: any; color: string; bg: string; border: string }> = {
  book: { label: "Book", icon: BookOpen, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  sheet: { label: "Lecture Sheet", icon: FileText, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  notes: { label: "Class Notes", icon: ClipboardList, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  worksheet: { label: "Worksheet", icon: Layers, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30" },
  exam_paper: { label: "Question Paper", icon: FileText, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  other: { label: "Other", icon: Package, color: "text-slate-400", bg: "bg-slate-800", border: "border-slate-700" },
}

export default function MaterialsClient({
  initialMaterials = [],
  initialIssues = [],
  batches = [],
  branches = [],
  students = [],
  currentStaff
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const { selectedBranchId, currentBranch } = useBranch()

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

  // Auto-sync legacy localStorage materials with backend database so valid UUIDs are assigned
  useEffect(() => {
    async function syncLegacyMaterials() {
      const dbIds = new Set(initialMaterials.map(m => m.id))
      const unsyncedMats = materials.filter(m => !dbIds.has(m.id) || String(m.id).startsWith("mat_"))
      if (unsyncedMats.length === 0) return

      for (const lm of unsyncedMats) {
        try {
          const res = await fetch("/api/materials/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(lm)
          })
          if (res.ok) {
            const data = await res.json()
            if (data.material) {
              setMaterials(prev => {
                const updated = prev.map(m => m.id === lm.id ? data.material : m)
                try { localStorage.setItem("medhashiree_materials", JSON.stringify(updated)) } catch {}
                return updated
              })
            }
          }
        } catch (syncErr) {
          console.warn("Syncing legacy material note:", syncErr)
        }
      }

      // Also sync any local distribution issues
      const legacyIssues = issues.filter(i => i.id && String(i.id).startsWith("issue_"))
      for (const li of legacyIssues) {
        try {
          await fetch("/api/materials/distribute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              material_id: li.material_id,
              student_ids: [li.student_id],
              batch_id: li.batch_id,
              issued_by: li.issued_by,
              notes: li.notes,
            })
          })
        } catch {}
      }
    }

    syncLegacyMaterials()
  }, [])

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
  // ADD / EDIT MATERIAL FORM STATE (MULTI-BATCH)
  // ==========================================
  const [formData, setFormData] = useState({
    name: "",
    type: "sheet" as MaterialType,
    subject: "",
    branch_id: (selectedBranchId !== "all" ? selectedBranchId : "") as string,
    batch_ids: [] as string[],
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
      branch_id: selectedBranchId !== "all" ? selectedBranchId : (branches[0]?.id || ""),
      batch_ids: [],
      total_stock: 50,
      price: 0,
      description: ""
    })
    setAddModalOpen(true)
  }

  const openEditModal = (m: Material) => {
    setEditingMaterial(m)
    const initialBatchIds = m.batch_ids && m.batch_ids.length > 0 
      ? m.batch_ids 
      : (m.batch_id ? [m.batch_id] : [])

    setFormData({
      name: m.name,
      type: m.type,
      subject: m.subject || "",
      branch_id: m.branch_id || (selectedBranchId !== "all" ? selectedBranchId : (branches[0]?.id || "")),
      batch_ids: initialBatchIds,
      total_stock: m.total_stock,
      price: m.price || 0,
      description: m.description || ""
    })
    setAddModalOpen(true)
  }

  const toggleFormBatch = (batchId: string) => {
    const exists = formData.batch_ids.includes(batchId)
    if (exists) {
      setFormData(f => ({ ...f, batch_ids: f.batch_ids.filter(id => id !== batchId) }))
    } else {
      setFormData(f => ({ ...f, batch_ids: [...f.batch_ids, batchId] }))
    }
  }

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast.error("Please enter material name")
      return
    }

    const primaryBatchId = formData.batch_ids.length > 0 ? formData.batch_ids[0] : null
    const finalBranchId = formData.branch_id || (selectedBranchId !== "all" ? selectedBranchId : null)

    if (editingMaterial) {
      // Edit
      const diff = formData.total_stock - editingMaterial.total_stock
      const updatedAvailable = Math.max(0, editingMaterial.available_stock + diff)

      const updatedMat: Material = {
        ...editingMaterial,
        name: formData.name.trim(),
        type: formData.type,
        subject: formData.subject.trim() || null,
        branch_id: finalBranchId,
        batch_id: primaryBatchId,
        batch_ids: formData.batch_ids,
        total_stock: Number(formData.total_stock),
        available_stock: updatedAvailable,
        price: Number(formData.price) || 0,
        description: formData.description.trim() || null
      }

      // Optimistic local update
      const next = materials.map(m => m.id === editingMaterial.id ? updatedMat : m)
      saveMaterials(next)

      try {
        const res = await fetch("/api/materials/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingMaterial.id,
            name: formData.name.trim(),
            type: formData.type,
            subject: formData.subject.trim() || null,
            branch_id: finalBranchId,
            batch_id: primaryBatchId,
            batch_ids: formData.batch_ids,
            total_stock: Number(formData.total_stock),
            available_stock: updatedAvailable,
            price: Number(formData.price) || 0,
            description: formData.description.trim() || null
          })
        })
        const data = await res.json()
        if (data?.material) {
          saveMaterials(materials.map(m => m.id === editingMaterial.id ? data.material : m))
          toast.success("Material updated successfully!")
        } else {
          toast.error(data?.error || "Failed to update material")
          return
        }
      } catch (err: any) {
        console.warn("Could not update material via API:", err)
        toast.error(err?.message || "Could not update material")
        return
      }
    } else {
      // Create with server-generated database UUID
      try {
        const res = await fetch("/api/materials/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name.trim(),
            type: formData.type,
            subject: formData.subject.trim() || null,
            branch_id: finalBranchId,
            batch_id: primaryBatchId,
            batch_ids: formData.batch_ids,
            total_stock: Number(formData.total_stock),
            available_stock: Number(formData.total_stock),
            price: Number(formData.price) || 0,
            description: formData.description.trim() || null
          })
        })
        const data = await res.json()
        if (data?.material) {
          saveMaterials([data.material, ...materials])
          toast.success("New material added to batch successfully!")
        } else {
          toast.error(data?.error || "Failed to save material to database")
          return
        }
      } catch (err: any) {
        console.warn("Could not insert material via API:", err)
        toast.error(err?.message || "Could not create material")
        return
      }
    }

    setAddModalOpen(false)
  }

  const handleDeleteMaterial = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? Any distribution logs will also be removed from student profiles.`)) {
      return
    }

    const nextMaterials = materials.filter(m => m.id !== id)
    const nextIssues = issues.filter(i => i.material_id !== id)
    saveMaterials(nextMaterials)
    saveIssues(nextIssues)

    try {
      const res = await fetch("/api/materials/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name })
      })
      const data = await res.json()
      if (data?.success) {
        toast.success(`"${name}" deleted from batch and student profiles.`)
      } else {
        toast.error(data?.error || "Could not delete material from database")
      }
    } catch (e: any) {
      console.warn("Could not delete via API:", e)
      try {
        await supabase.from("materials").delete().eq("id", id)
      } catch {}
      toast.success(`"${name}" deleted.`)
    }
  }

  // ==========================================
  // DISTRIBUTE MATERIAL MODAL STATE (MULTI-BATCH)
  // ==========================================
  const [distributeMode, setDistributeMode] = useState<"batch" | "search">("batch")
  const [distributeSelectedBatchIds, setDistributeSelectedBatchIds] = useState<string[]>([])
  const [distributeSearchStudentQuery, setDistributeSearchStudentQuery] = useState("")
  const [distributeSelectedStudentIds, setDistributeSelectedStudentIds] = useState<Set<string>>(new Set())
  const [distributeNotes, setDistributeNotes] = useState("")

  const openDistributeModal = (m?: Material) => {
    const target = m || materials[0] || null
    setDistributeMaterial(target)
    setDistributeMode("batch")

    // Default to material's assigned batches, or first batch
    const initialBatches = target?.batch_ids && target.batch_ids.length > 0
      ? target.batch_ids
      : (target?.batch_id ? [target.batch_id] : (batches[0] ? [batches[0].id] : []))

    setDistributeSelectedBatchIds(initialBatches)
    setDistributeSearchStudentQuery("")
    setDistributeSelectedStudentIds(new Set())
    setDistributeNotes("")
    setDistributeModalOpen(true)
  }

  const distributeAvailableBatches = useMemo(() => {
    const targetBranch = distributeMaterial?.branch_id || (selectedBranchId !== "all" ? selectedBranchId : null)
    if (!targetBranch) return batches
    return batches.filter(b => !b.branch_id || b.branch_id === targetBranch)
  }, [batches, distributeMaterial, selectedBranchId])

  const toggleDistributeBatch = (batchId: string) => {
    if (distributeSelectedBatchIds.includes(batchId)) {
      setDistributeSelectedBatchIds(distributeSelectedBatchIds.filter(id => id !== batchId))
    } else {
      setDistributeSelectedBatchIds([...distributeSelectedBatchIds, batchId])
    }
  }

  // Eligible students across ALL selected batches
  const batchStudents = useMemo(() => {
    if (distributeSelectedBatchIds.length === 0) return []
    const setIds = new Set<string>()
    const list: Student[] = []

    students.forEach(s => {
      const isEnrolledInAny = s.enrollments?.some(
        e => distributeSelectedBatchIds.includes(e.batch_id) && e.status === "active"
      )
      if (isEnrolledInAny && !setIds.has(s.id)) {
        setIds.add(s.id)
        list.push(s)
      }
    })
    return list
  }, [students, distributeSelectedBatchIds])

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
      // Find matching batch among selected batches
      const enrolledBatchId = studentObj?.enrollments?.find(
        e => distributeSelectedBatchIds.includes(e.batch_id)
      )?.batch_id || distributeSelectedBatchIds[0] || distributeMaterial.batch_id

      const batchObj = batches.find(b => b.id === enrolledBatchId)

      newIssues.push({
        id: "issue_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 6),
        material_id: distributeMaterial.id,
        student_id: stId,
        batch_id: enrolledBatchId || null,
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

    // 3. Backend API insert
    try {
      const res = await fetch("/api/materials/distribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          material_id: distributeMaterial.id,
          material_name: distributeMaterial.name,
          student_ids: Array.from(distributeSelectedStudentIds),
          batch_id: distributeSelectedBatchIds[0] || distributeMaterial.batch_id,
          issued_by: currentStaff.id,
          notes: distributeNotes.trim() || undefined
        })
      })
      const data = await res.json()
      if (data?.success) {
        if (data.issues && data.issues.length > 0) {
          const insertedMap = new Map(data.issues.map((iss: any) => [iss.student_id, iss]))
          const resolvedIssues = newIssues.map(i => {
            const dbIss: any = insertedMap.get(i.student_id)
            return dbIss ? { ...i, id: dbIss.id, issued_at: dbIss.issued_at } : i
          })
          saveIssues([...resolvedIssues, ...issues])
        }
      } else {
        toast.error(data?.error || "Failed to record distribution")
      }
    } catch (e) {
      console.warn("Could not save issues via API, falling back:", e)
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
      } catch {}
    }

    toast.success(`✓ Distributed ${countToIssue} copies of "${distributeMaterial.name}" across selected batches!`)
    setDistributeModalOpen(false)
  }

  // ==========================================
  // "WHO GOT IT" / DISTRIBUTION CONTROLLER
  // ==========================================
  const [whoGotItTab, setWhoGotItTab] = useState<"all" | "received" | "pending">("all")
  const [whoGotItSearch, setWhoGotItSearch] = useState("")
  const [whoGotItBatchFilter, setWhoGotItBatchFilter] = useState<string>("all")

  const openWhoGotItModal = (m: Material) => {
    setWhoGotItMaterial(m)
    setWhoGotItTab("all")
    setWhoGotItSearch("")
    setWhoGotItBatchFilter("all")
    setWhoGotItModalOpen(true)
  }

  // Active issues for the selected material
  const materialIssuesList = useMemo(() => {
    if (!whoGotItMaterial) return []
    return issues.filter(i => i.material_id === whoGotItMaterial.id && i.status === "issued")
  }, [whoGotItMaterial, issues])

  // Target students for this material (across all assigned batches or all students)
  const targetStudentsForMaterial = useMemo(() => {
    if (!whoGotItMaterial) return []
    const assignedBatches = whoGotItMaterial.batch_ids && whoGotItMaterial.batch_ids.length > 0
      ? whoGotItMaterial.batch_ids
      : (whoGotItMaterial.batch_id ? [whoGotItMaterial.batch_id] : [])

    if (assignedBatches.length > 0) {
      return students.filter(s => s.enrollments?.some(e => assignedBatches.includes(e.batch_id) && e.status === "active"))
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

    const assignedBatches = whoGotItMaterial.batch_ids && whoGotItMaterial.batch_ids.length > 0
      ? whoGotItMaterial.batch_ids
      : (whoGotItMaterial.batch_id ? [whoGotItMaterial.batch_id] : [])

    const enrolledBatch = student.enrollments?.find(e => assignedBatches.includes(e.batch_id))?.batch_id || assignedBatches[0] || null

    const newIssue: MaterialIssue = {
      id: "issue_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 6),
      material_id: whoGotItMaterial.id,
      student_id: student.id,
      batch_id: enrolledBatch,
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
      const res = await fetch("/api/materials/distribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          material_id: whoGotItMaterial.id,
          material_name: whoGotItMaterial.name,
          student_ids: [student.id],
          batch_id: enrolledBatch,
          issued_by: currentStaff.id,
          notes: "Quick distributed via Manager"
        })
      })
      const data = await res.json()
      if (data?.success && data?.issues && data.issues.length > 0) {
        const dbIss = data.issues[0]
        const resolvedIssue = { ...newIssue, id: dbIss.id, issued_at: dbIss.issued_at }
        saveIssues([resolvedIssue, ...issues])
      }
    } catch {
      try {
        await supabase.from("material_issues").insert({
          material_id: whoGotItMaterial.id,
          student_id: student.id,
          batch_id: enrolledBatch,
          issued_by: currentStaff.id.startsWith("admin") ? undefined : currentStaff.id,
          status: "issued",
          notes: "Quick distributed"
        })
      } catch {}
    }

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
      await fetch("/api/materials/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issue_id: issueId,
          material_id: whoGotItMaterial.id
        })
      })
    } catch {
      try {
        await supabase.from("material_issues").delete().eq("id", issueId)
      } catch {}
    }

    toast.info(`Revoked distribution for ${studentName}. 1 unit restored to stock.`)
  }

  // Export / Print Checklist
  const handleExportChecklist = () => {
    if (!whoGotItMaterial) return

    const rows = targetStudentsForMaterial.map((s, idx) => {
      const issue = materialIssuesList.find(i => i.student_id === s.id)
      const statusStr = issue ? "RECEIVED" : "NOT RECEIVED"
      const dateStr = issue ? formatDate(issue.issued_at) : "-"
      const batchName = s.enrollments?.map(e => e.batch?.name).filter(Boolean).join("; ") || "General"

      return [
        idx + 1,
        `"${s.name}"`,
        `"${s.student_id}"`,
        `"${s.phone || '-'}"`,
        `"${batchName}"`,
        `"${statusStr}"`,
        `"${dateStr}"`,
        `"_________________"`
      ].join(",")
    })

    const headers = ["#", "Student Name", "Student ID", "Phone", "Batch", "Status", "Received Date", "Signature"]
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
      // 0. Branch filter
      if (selectedBranchId !== "all") {
        if (m.branch_id && m.branch_id !== selectedBranchId) return false
      }
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
      if (selectedBatchFilter !== "all") {
        const hasBatch = (m.batch_ids && m.batch_ids.includes(selectedBatchFilter)) || m.batch_id === selectedBatchFilter
        if (!hasBatch) return false
      }
      // 4. Stock filter
      if (stockFilter === "in_stock" && m.available_stock <= 0) return false
      if (stockFilter === "low_stock" && (m.available_stock > 5 || m.available_stock <= 0)) return false
      if (stockFilter === "out_of_stock" && m.available_stock > 0) return false

      return true
    })
  }, [materials, selectedBranchId, searchQuery, selectedType, selectedBatchFilter, stockFilter])

  // Batches available for the add/edit modal (filtered by material's branch)
  const modalAvailableBatches = useMemo(() => {
    const bId = formData.branch_id || (selectedBranchId !== "all" ? selectedBranchId : null)
    if (!bId) return batches
    return batches.filter(b => !b.branch_id || b.branch_id === bId)
  }, [batches, formData.branch_id, selectedBranchId])

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
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <Package className="w-7 h-7 text-amber-400" />
            Study Materials & Distribution
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Manage books, lecture sheets, notes, and track student distribution across batches
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => openDistributeModal()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-slate-200 border border-slate-700 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Users className="w-4 h-4 text-amber-400" />
            Distribute Material
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black rounded-xl text-sm shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            + Add Material
          </button>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Total Items</span>
            <div className="p-2 bg-slate-950 rounded-xl border border-slate-200 text-amber-400">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{totalMaterialsCount}</p>
          <p className="text-xs text-slate-500 mt-1">Books, sheets, and notes</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Units In Stock</span>
            <div className="p-2 bg-slate-950 rounded-xl border border-slate-200 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">{totalStockInHand}</p>
          <p className="text-xs text-slate-500 mt-1">Available for distribution</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Distributed</span>
            <div className="p-2 bg-slate-950 rounded-xl border border-slate-200 text-blue-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-600 mt-2">{totalDistributedCount}</p>
          <p className="text-xs text-slate-500 mt-1">Copies given to students</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Low Stock Alert</span>
            <div className="p-2 bg-slate-950 rounded-xl border border-slate-200 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-600 mt-2">{lowStockCount}</p>
          <p className="text-xs text-slate-500 mt-1">&le; 5 units remaining</p>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search materials by title or subject..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-amber-400 text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-amber-400 text-slate-900"
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
              className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-amber-400 text-slate-900"
            >
              <option value="all">All Batches</option>
              {batches
                .filter(b => selectedBranchId === "all" || !b.branch_id || b.branch_id === selectedBranchId)
                .map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
            </select>

            <select
              value={stockFilter}
              onChange={e => setStockFilter(e.target.value as any)}
              className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-amber-400 text-slate-900"
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
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-12 text-center">
          <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-base font-bold text-slate-300">No study materials found</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || selectedType !== "all" 
              ? "Try adjusting your search query or filter settings." 
              : "Get started by adding books, lecture sheets, or worksheets for your students."}
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 text-xs font-black rounded-xl shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            + Add First Material
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMaterials.map(m => {
            const config = typeConfigs[m.type] || typeConfigs.other
            const TypeIcon = config.icon

            // Get assigned batches for display
            const assignedBatchIds = m.batch_ids && m.batch_ids.length > 0 
              ? m.batch_ids 
              : (m.batch_id ? [m.batch_id] : [])

            const assignedBatches = batches.filter(b => assignedBatchIds.includes(b.id))
            const distributedForThis = issues.filter(i => i.material_id === m.id && i.status === "issued").length
            const isOutOfStock = m.available_stock <= 0
            const isLowStock = m.available_stock <= 5 && !isOutOfStock

            const stockPct = m.total_stock > 0 
              ? Math.min(100, Math.round((m.available_stock / m.total_stock) * 100)) 
              : 0

            return (
              <div 
                key={m.id} 
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg} ${config.color} ${config.border}`}>
                        <TypeIcon className="w-3.5 h-3.5" />
                        {config.label}
                      </span>
                      {m.branch_id && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          <Building2 className="w-3 h-3 text-slate-500" />
                          {branches.find(b => b.id === m.branch_id)?.name || "Branch"}
                        </span>
                      )}
                    </div>

                    {m.price > 0 ? (
                      <span className="text-xs font-bold text-slate-300 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-md font-mono">
                        {formatCurrency(m.price)}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                        Free Material
                      </span>
                    )}
                  </div>

                  {/* Title & Subject */}
                  <h3 className="font-bold text-slate-900 text-base group-hover:text-amber-500 transition-colors">
                    {m.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    {m.subject || "General Subject"}
                  </p>

                  {/* Assigned Batches List */}
                  <div className="mt-2 flex flex-wrap gap-1 items-center">
                    {assignedBatches.length === 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        All Batches
                      </span>
                    ) : (
                      assignedBatches.map(b => (
                        <span key={b.id} className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-700 border border-amber-500/20">
                          {b.name}
                        </span>
                      ))
                    )}
                  </div>

                  {m.description && (
                    <p className="text-xs text-slate-500 mt-2.5 line-clamp-2">
                      {m.description}
                    </p>
                  )}

                  {/* Stock Indicator */}
                  <div className="mt-4 pt-3 border-t border-slate-200">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-600">
                        In Stock: <strong className={isOutOfStock ? "text-rose-600" : isLowStock ? "text-amber-600" : "text-slate-900"}>{m.available_stock}</strong> / {m.total_stock} units
                      </span>
                      <span className="text-slate-500 font-mono">{stockPct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 border border-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isOutOfStock ? "bg-rose-500" : isLowStock ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${stockPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-5 pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                  <button
                    onClick={() => openWhoGotItModal(m)}
                    className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors text-center flex items-center justify-center gap-1 cursor-pointer"
                    title="View and manage who received this material"
                  >
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    Who Got It ({distributedForThis})
                  </button>

                  <button
                    onClick={() => openDistributeModal(m)}
                    disabled={isOutOfStock}
                    className="flex-1 py-1.5 px-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 disabled:opacity-40 text-xs font-black rounded-lg transition-colors text-center flex items-center justify-center gap-1 shadow-md shadow-amber-500/20 cursor-pointer"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    Distribute
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(m)}
                      className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Edit material"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteMaterial(m.id, m.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
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
      {/* 1. ADD / EDIT MATERIAL MODAL (MULTI-BATCH) */}
      {/* ========================================== */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-700 text-white">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="font-black text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                {editingMaterial ? "Edit Material" : "Add New Study Material"}
              </h3>
              <button onClick={() => setAddModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMaterial} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Material Title / Name <span className="text-rose-400">*</span>
                </label>
                <input
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., HSC Physics Chapter 1 Lecture Sheet"
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-xl focus:outline-none focus:border-amber-400 text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Material Type <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as MaterialType })}
                    className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-xl focus:outline-none focus:border-amber-400 text-slate-100"
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
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Subject
                  </label>
                  <input
                    value={formData.subject}
                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="e.g., Physics, Math"
                    className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-xl focus:outline-none focus:border-amber-400 text-slate-100 placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* Branch Selector */}
              {branches.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Target Branch
                  </label>
                  <select
                    value={formData.branch_id}
                    onChange={e => setFormData({ ...formData, branch_id: e.target.value, batch_ids: [] })}
                    className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-xl focus:outline-none focus:border-amber-400 text-slate-100"
                  >
                    <option value="">All Branches</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* MULTI-BATCH SELECTOR */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Assigned Batches <span className="text-amber-400 font-bold">(Multi-Select Supported)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (formData.batch_ids.length === modalAvailableBatches.length) {
                        setFormData({ ...formData, batch_ids: [] })
                      } else {
                        setFormData({ ...formData, batch_ids: modalAvailableBatches.map(b => b.id) })
                      }
                    }}
                    className="text-[11px] font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
                  >
                    {formData.batch_ids.length === modalAvailableBatches.length ? "Deselect All" : "Select All Batches"}
                  </button>
                </div>

                <div className="border border-slate-700 rounded-xl p-2.5 bg-slate-950 max-h-44 overflow-y-auto space-y-1.5">
                  {/* Option: All Batches */}
                  <div
                    onClick={() => setFormData({ ...formData, batch_ids: [] })}
                    className={`p-2 rounded-lg text-xs font-medium flex items-center justify-between cursor-pointer transition-colors ${
                      formData.batch_ids.length === 0 
                        ? "bg-amber-500 text-slate-950 shadow-sm font-bold" 
                        : "bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700"
                    }`}
                  >
                    <span>✨ Available for All Batches (Open to Everyone)</span>
                    {formData.batch_ids.length === 0 && <Check className="w-4 h-4 text-slate-950" />}
                  </div>

                  {/* Individual Batches */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                    {modalAvailableBatches.map(b => {
                      const isSelected = formData.batch_ids.includes(b.id)
                      return (
                        <div
                          key={b.id}
                          onClick={() => toggleFormBatch(b.id)}
                          className={`p-2 rounded-lg text-xs font-medium flex items-center justify-between cursor-pointer border transition-all ${
                            isSelected 
                              ? "bg-amber-500/15 border-amber-500/40 text-amber-300 font-bold shadow-sm" 
                              : "bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-3.5 h-3.5 text-amber-500 rounded cursor-pointer pointer-events-none bg-slate-950 border-slate-700"
                            />
                            <span className="truncate">{b.name}</span>
                          </div>
                          {b.subject && (
                            <span className="text-[10px] text-slate-500 shrink-0 ml-1">{b.subject}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 px-0.5">
                  <span>
                    {formData.batch_ids.length === 0 ? (
                      <strong className="text-amber-400">All Batches Selected</strong>
                    ) : (
                      <span><strong className="text-white">{formData.batch_ids.length}</strong> batches selected</span>
                    )}
                  </span>
                  {formData.batch_ids.length > 0 && (
                    <button 
                      type="button" 
                      onClick={() => setFormData({ ...formData, batch_ids: [] })}
                      className="text-slate-500 hover:text-rose-400 cursor-pointer"
                    >
                      Reset to All Batches
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Total Stock <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.total_stock}
                    onChange={e => setFormData({ ...formData, total_stock: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-xl focus:outline-none focus:border-amber-400 text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Price (৳) <span className="text-slate-500 font-normal">(0 = Free)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-xl focus:outline-none focus:border-amber-400 text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description / Topic Notes
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  placeholder="e.g., Covers chapter formulas, exercises, and past questions..."
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-xl focus:outline-none focus:border-amber-400 text-slate-100 placeholder:text-slate-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-300 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-black text-slate-950 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 rounded-xl shadow-md shadow-amber-500/20 cursor-pointer transition-all"
                >
                  {editingMaterial ? "Update Material" : "Save & Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 2. DISTRIBUTE MATERIAL MODAL (MULTI-BATCH) */}
      {/* ========================================== */}
      {distributeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh] text-white">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-950">
              <div>
                <h3 className="font-black text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-400" />
                  Distribute Study Material
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select single or multiple batches, or search individual students
                </p>
              </div>
              <button onClick={() => setDistributeModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Select Material */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Select Material to Distribute <span className="text-rose-400">*</span>
                </label>
                <select
                  value={distributeMaterial?.id || ""}
                  onChange={e => {
                    const found = materials.find(m => m.id === e.target.value)
                    setDistributeMaterial(found || null)
                    setDistributeSelectedStudentIds(new Set())
                    if (found?.batch_ids && found.batch_ids.length > 0) {
                      setDistributeSelectedBatchIds(found.batch_ids)
                    }
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-xl focus:outline-none focus:border-amber-400 text-slate-100"
                >
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.type.toUpperCase()}) • {m.available_stock} in stock
                    </option>
                  ))}
                </select>
                {distributeMaterial && (
                  <p className="text-xs text-slate-400 mt-1">
                    Available Stock: <strong className="text-amber-400">{distributeMaterial.available_stock} units</strong>
                  </p>
                )}
              </div>

              {/* Mode Toggle */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setDistributeMode("batch")
                    setDistributeSelectedStudentIds(new Set())
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    distributeMode === "batch" ? "bg-amber-500 text-slate-950 shadow-sm font-black" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Distribute by Batch (Multi-Batch)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDistributeMode("search")
                    setDistributeSelectedStudentIds(new Set())
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    distributeMode === "search" ? "bg-amber-500 text-slate-950 shadow-sm font-black" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Search & Multi-Select Students
                </button>
              </div>

              {/* MODE 1: MULTI-BATCH DISTRIBUTION */}
              {distributeMode === "batch" && (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-300">
                        Select Batches to Distribute To:
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (distributeSelectedBatchIds.length === distributeAvailableBatches.length) {
                            setDistributeSelectedBatchIds([])
                          } else {
                            setDistributeSelectedBatchIds(distributeAvailableBatches.map(b => b.id))
                          }
                        }}
                        className="text-[11px] text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
                      >
                        {distributeSelectedBatchIds.length === distributeAvailableBatches.length ? "Deselect All" : "Select All Batches"}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950 border border-slate-800 rounded-xl max-h-28 overflow-y-auto">
                      {distributeAvailableBatches.map(b => {
                        const isSelected = distributeSelectedBatchIds.includes(b.id)
                        return (
                          <button
                            type="button"
                            key={b.id}
                            onClick={() => toggleDistributeBatch(b.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                              isSelected 
                                ? "bg-amber-500 text-slate-950 border-amber-500 shadow-sm font-bold" 
                                : "bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-3 h-3 rounded pointer-events-none"
                            />
                            <span>{b.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Students in Selected Batches ({batchStudents.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleSelectAllEligible}
                      className="text-xs text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
                    >
                      Select All Eligible
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-xl divide-y divide-slate-800/80 bg-slate-950">
                    {batchStudents.length === 0 ? (
                      <p className="p-6 text-center text-xs text-slate-500">
                        {distributeSelectedBatchIds.length === 0 
                          ? "Please select at least one batch above." 
                          : "No active students enrolled in the selected batches."}
                      </p>
                    ) : (
                      batchStudents.map(student => {
                        const alreadyIssued = alreadyIssuedStudentIds.has(student.id)
                        const isSelected = distributeSelectedStudentIds.has(student.id)
                        const studentBatchNames = student.enrollments?.map(e => e.batch?.name).filter(Boolean).join(", ")

                        return (
                          <div
                            key={student.id}
                            onClick={() => !alreadyIssued && toggleDistributeStudent(student.id)}
                            className={`p-3 flex items-center justify-between text-xs transition-colors ${
                              alreadyIssued 
                                ? "bg-slate-900/50 opacity-50 cursor-not-allowed" 
                                : isSelected 
                                ? "bg-amber-500/15 cursor-pointer" 
                                : "hover:bg-slate-900 cursor-pointer"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                disabled={alreadyIssued}
                                checked={isSelected || alreadyIssued}
                                onChange={() => {}}
                                className="w-4 h-4 text-amber-500 rounded cursor-pointer bg-slate-950 border-slate-700"
                              />
                              <div>
                                <p className="font-bold text-slate-100">{student.name}</p>
                                <p className="text-[11px] text-slate-400 font-mono">
                                  {student.student_id} • {studentBatchNames || "Enrolled"}
                                </p>
                              </div>
                            </div>

                            {alreadyIssued ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">
                                <Check className="w-3 h-3" /> Already Received
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-500">
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
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={distributeSearchStudentQuery}
                      onChange={e => setDistributeSearchStudentQuery(e.target.value)}
                      placeholder="Search student by name, student ID, or phone..."
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-xl focus:outline-none focus:border-amber-400 text-slate-100 placeholder:text-slate-500"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Matching Students ({searchStudents.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleSelectAllEligible}
                      className="text-xs text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
                    >
                      Select All Eligible
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-xl divide-y divide-slate-800/80 bg-slate-950">
                    {searchStudents.length === 0 ? (
                      <p className="p-6 text-center text-xs text-slate-500">No matching students found.</p>
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
                                ? "bg-slate-900/50 opacity-50 cursor-not-allowed" 
                                : isSelected 
                                ? "bg-amber-500/15 cursor-pointer" 
                                : "hover:bg-slate-900 cursor-pointer"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                disabled={alreadyIssued}
                                checked={isSelected || alreadyIssued}
                                onChange={() => {}}
                                className="w-4 h-4 text-amber-500 rounded cursor-pointer bg-slate-950 border-slate-700"
                              />
                              <div>
                                <p className="font-bold text-slate-100">{student.name}</p>
                                <p className="text-[11px] text-slate-400 font-mono">{student.student_id} • {student.phone || "No phone"}</p>
                              </div>
                            </div>

                            {alreadyIssued ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">
                                <Check className="w-3 h-3" /> Already Received
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-500">
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Distribution Note <span className="text-slate-500 font-normal">(optional)</span>
                </label>
                <input
                  value={distributeNotes}
                  onChange={e => setDistributeNotes(e.target.value)}
                  placeholder="e.g. Handed over in class / collection verified"
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-xl focus:outline-none focus:border-amber-400 text-slate-100 placeholder:text-slate-500"
                />
              </div>

              {/* Stock Preview Alert */}
              {distributeMaterial && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400">Selected: </span>
                    <strong className="text-amber-400 font-bold">{distributeSelectedStudentIds.size} students</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Stock After Issue: </span>
                    <strong className={`font-bold ${
                      distributeMaterial.available_stock - distributeSelectedStudentIds.size < 0
                        ? "text-rose-400"
                        : "text-emerald-400"
                    }`}>
                      {distributeMaterial.available_stock - distributeSelectedStudentIds.size} units
                    </strong>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-950">
              <span className="text-xs text-slate-400">
                {distributeSelectedStudentIds.size} students selected
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDistributeModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-300 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDistribution}
                  disabled={distributeSelectedStudentIds.size === 0 || (distributeMaterial ? distributeSelectedStudentIds.size > distributeMaterial.available_stock : true)}
                  className="px-5 py-2 text-sm font-black text-slate-950 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 disabled:opacity-40 rounded-xl transition-all shadow-md shadow-amber-500/20 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh] text-white">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-white text-lg">
                    {whoGotItMaterial.name}
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-md uppercase">
                    {whoGotItMaterial.type}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Distribution Tracker & Student Collection Manager
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportChecklist}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" /> Export Checklist
                </button>
                <button onClick={() => setWhoGotItModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Distribution Summary Card */}
            <div className="px-6 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
              <div className="flex items-center gap-4">
                <span>Total Target: <strong className="text-white">{targetStudentsForMaterial.length}</strong></span>
                <span>Distributed: <strong className="text-emerald-400">{materialIssuesList.length}</strong></span>
                <span>Remaining: <strong className="text-amber-400">{Math.max(0, targetStudentsForMaterial.length - materialIssuesList.length)}</strong></span>
                <span>Available Stock: <strong className="text-blue-400">{whoGotItMaterial.available_stock}</strong></span>
              </div>
              <div>
                <span className="font-bold text-amber-400">
                  {targetStudentsForMaterial.length > 0 
                    ? Math.round((materialIssuesList.length / targetStudentsForMaterial.length) * 100) 
                    : 0}% Distribution Rate
                </span>
              </div>
            </div>

            {/* Sub Filter Tabs, Batch Selector & Search */}
            <div className="px-6 py-3 border-b border-slate-800 bg-slate-900 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setWhoGotItTab("all")}
                    className={`px-3 py-1 font-bold rounded-lg transition-all cursor-pointer ${
                      whoGotItTab === "all" ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    All ({targetStudentsForMaterial.length})
                  </button>
                  <button
                    onClick={() => setWhoGotItTab("received")}
                    className={`px-3 py-1 font-bold rounded-lg transition-all cursor-pointer ${
                      whoGotItTab === "received" ? "bg-slate-800 text-emerald-400 shadow-sm" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Received ({materialIssuesList.length})
                  </button>
                  <button
                    onClick={() => setWhoGotItTab("pending")}
                    className={`px-3 py-1 font-bold rounded-lg transition-all cursor-pointer ${
                      whoGotItTab === "pending" ? "bg-slate-800 text-amber-400 shadow-sm" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Not Received Yet ({Math.max(0, targetStudentsForMaterial.length - materialIssuesList.length)})
                  </button>
                </div>

                {/* Optional Batch filter within Who Got It */}
                <select
                  value={whoGotItBatchFilter}
                  onChange={e => setWhoGotItBatchFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-slate-700 rounded-xl text-white bg-slate-950 focus:outline-none focus:border-amber-400"
                >
                  <option value="all">All Assigned Batches</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* In-Modal Search */}
              <div className="relative min-w-[180px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  value={whoGotItSearch}
                  onChange={e => setWhoGotItSearch(e.target.value)}
                  placeholder="Find student..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-xl focus:outline-none focus:border-amber-400 text-slate-100 placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Student Distribution Table */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="border border-slate-800 rounded-xl overflow-hidden shadow-xl bg-slate-900">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <th className="px-4 py-2.5">#</th>
                      <th className="px-4 py-2.5">Student</th>
                      <th className="px-4 py-2.5">Batch</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Date Issued</th>
                      <th className="px-4 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-xs">
                    {(() => {
                      const list = targetStudentsForMaterial.filter(s => {
                        const issue = materialIssuesList.find(i => i.student_id === s.id)
                        const hasReceived = Boolean(issue)

                        if (whoGotItTab === "received" && !hasReceived) return false
                        if (whoGotItTab === "pending" && hasReceived) return false

                        if (whoGotItBatchFilter !== "all") {
                          const inBatch = s.enrollments?.some(e => e.batch_id === whoGotItBatchFilter)
                          if (!inBatch) return false
                        }

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
                            <td colSpan={6} className="py-8 text-center text-slate-500">
                              No students found for this tab or filter.
                            </td>
                          </tr>
                        )
                      }

                      return list.map((student, idx) => {
                        const issue = materialIssuesList.find(i => i.student_id === student.id)
                        const hasReceived = Boolean(issue)
                        const batchNames = student.enrollments?.map(e => e.batch?.name).filter(Boolean).join(", ")

                        return (
                          <tr key={student.id} className="hover:bg-slate-800/60 transition-colors">
                            <td className="px-4 py-3 text-slate-500 font-mono">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-100">{student.name}</p>
                              <p className="text-[11px] text-slate-400 font-mono">{student.student_id} • {student.phone || "No phone"}</p>
                            </td>
                            <td className="px-4 py-3 text-slate-300">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                                {batchNames || "General"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {hasReceived ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                  <CheckCircle2 className="w-3 h-3" /> Received
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
                                  <Clock className="w-3 h-3" /> Not Received
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-400 font-mono">
                              {issue ? formatDate(issue.issued_at) : "-"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {hasReceived && issue ? (
                                <button
                                  onClick={() => handleQuickRevokeStudent(issue.id, student.name)}
                                  className="text-[11px] text-rose-400 hover:text-rose-300 font-bold px-2.5 py-1 rounded-lg hover:bg-rose-950/30 transition-colors cursor-pointer"
                                >
                                  Revoke
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleQuickIssueStudent(student)}
                                  className="text-[11px] font-black text-slate-950 bg-amber-500 hover:bg-amber-400 px-2.5 py-1 rounded-lg transition-colors shadow-sm cursor-pointer"
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
