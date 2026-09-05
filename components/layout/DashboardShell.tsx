"use client"

import { useState } from "react"
import DashboardSidebar from "./DashboardSidebar"
import DashboardHeader from "./DashboardHeader"
import { BranchProvider } from "@/components/providers/BranchContext"
import type { Staff } from "@/lib/supabase/types"

export default function DashboardShell({
  staff,
  children,
}: {
  staff: Staff
  children: React.ReactNode
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <BranchProvider>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        {/* Sidebar (Desktop Persistent + Mobile Drawer) */}
        <DashboardSidebar
          role={staff.role}
          name={staff.name}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />

        {/* Main App Layout */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <DashboardHeader
            user={staff}
            onMenuToggle={() => setMobileMenuOpen(prev => !prev)}
          />
          <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </BranchProvider>
  )
}
