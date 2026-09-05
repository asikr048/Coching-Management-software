"use client"

import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Branch, Role } from "@/lib/supabase/types"

interface BranchContextType {
  selectedBranchId: string // "all" or specific branch id
  setSelectedBranchId: (id: string) => void
  branches: Branch[]
  currentBranch: Branch | null
  permittedBranchIds: string[]
  isAllBranchesPermitted: boolean
  userRole: Role | null
  loading: boolean
  refreshBranches: () => Promise<void>
}

const BranchContext = createContext<BranchContextType>({
  selectedBranchId: "all",
  setSelectedBranchId: () => {},
  branches: [],
  currentBranch: null,
  permittedBranchIds: [],
  isAllBranchesPermitted: true,
  userRole: null,
  loading: true,
  refreshBranches: async () => {},
})

export function BranchProvider({
  children,
  initialBranches = [],
}: {
  children: ReactNode
  initialBranches?: Branch[]
}) {
  const [branches, setBranches] = useState<Branch[]>(initialBranches)
  const [selectedBranchId, setSelectedBranchIdState] = useState<string>("all")
  const [permittedBranchIds, setPermittedBranchIds] = useState<string[]>([])
  const [isAllBranchesPermitted, setIsAllBranchesPermitted] = useState<boolean>(true)
  const [userRole, setUserRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const refreshBranches = async () => {
    try {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .order("name", { ascending: true })

      if (!error && data) {
        setBranches(data)
      }
    } catch (e) {
      console.warn("Could not fetch branches:", e)
    }
  }

  // Load user role, branch permissions, and initial branch selection
  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: staffRow } = await supabase
            .from("staff")
            .select("id, role, branch_id, branch_ids")
            .eq("auth_user_id", user.id)
            .maybeSingle()

          if (staffRow) {
            setUserRole(staffRow.role as Role)

            if (staffRow.role === "owner") {
              setIsAllBranchesPermitted(true)
              setPermittedBranchIds([])
            } else {
              const bList: string[] = []
              if (staffRow.branch_id) bList.push(staffRow.branch_id)
              if (Array.isArray(staffRow.branch_ids)) {
                staffRow.branch_ids.forEach((b: string) => {
                  if (!bList.includes(b)) bList.push(b)
                })
              }

              // Super manager with no specific branch restriction can manage all
              if (staffRow.role === "super_manager" && bList.length === 0) {
                setIsAllBranchesPermitted(true)
                setPermittedBranchIds([])
              } else {
                setIsAllBranchesPermitted(false)
                setPermittedBranchIds(bList)

                // If user only has access to specific branches and current selection is "all", default to first branch
                if (bList.length === 1) {
                  setSelectedBranchIdState(bList[0])
                }
              }
            }
          }
        }

        // Fetch fresh branch list if none provided
        if (initialBranches.length === 0) {
          await refreshBranches()
        }

        // Restore saved branch from localStorage if permitted
        if (typeof window !== "undefined") {
          const saved = localStorage.getItem("medhashiree_admin_branch_id")
          if (saved) {
            setSelectedBranchIdState(saved)
          }
        }
      } catch (e) {
        console.warn("Branch initialization error:", e)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [])

  const setSelectedBranchId = (id: string) => {
    setSelectedBranchIdState(id)
    if (typeof window !== "undefined") {
      localStorage.setItem("medhashiree_admin_branch_id", id)
    }
  }

  // Available branches filtered by permissions
  const availableBranches = useMemo(() => {
    if (isAllBranchesPermitted) return branches
    return branches.filter(b => permittedBranchIds.includes(b.id))
  }, [branches, isAllBranchesPermitted, permittedBranchIds])

  const currentBranch = useMemo(() => {
    if (selectedBranchId === "all") return null
    return branches.find(b => b.id === selectedBranchId) || null
  }, [branches, selectedBranchId])

  return (
    <BranchContext.Provider
      value={{
        selectedBranchId,
        setSelectedBranchId,
        branches: availableBranches,
        currentBranch,
        permittedBranchIds,
        isAllBranchesPermitted,
        userRole,
        loading,
        refreshBranches,
      }}
    >
      {children}
    </BranchContext.Provider>
  )
}

export function useBranch() {
  return useContext(BranchContext)
}
