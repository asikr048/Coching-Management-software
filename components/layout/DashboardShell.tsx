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
      <div className="flex h-screen bg-[#f8fafc] text-slate-900 overflow-hidden selection:bg-amber-500 selection:text-white">
        {/* Sidebar (Desktop Persistent + Mobile Drawer) */}
        <DashboardSidebar
          role={staff.role}
          name={staff.name}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />

        {/* Main App Layout with Executive Institutional Canvas */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f8fafc]">
          <DashboardHeader
            user={staff}
            onMenuToggle={() => setMobileMenuOpen(prev => !prev)}
          />
          <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 min-w-0 bg-[#f8fafc]">
            {children}
          </main>
        </div>
      </div>
    </BranchProvider>
  )
}
