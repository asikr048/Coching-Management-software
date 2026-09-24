"use client"

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  InstituteBranding,
  ThemePalette,
  DEFAULT_BRANDING,
  getActiveBranding,
  saveActiveBranding,
  getThemeConfig,
  BRANDING_UPDATE_EVENT,
} from "@/lib/branding"

interface BrandingContextType {
  branding: InstituteBranding
  theme: ThemePalette
  updateBranding: (updated: Partial<InstituteBranding>) => Promise<boolean>
  resetToDefaults: () => Promise<boolean>
  refreshBranding: () => Promise<void>
  isLoaded: boolean
}

const BrandingContext = createContext<BrandingContextType>({
  branding: DEFAULT_BRANDING,
  theme: getThemeConfig(DEFAULT_BRANDING.themeColor),
  updateBranding: async () => false,
  resetToDefaults: async () => false,
  refreshBranding: async () => {},
  isLoaded: false,
})

const DB_SETTING_KEY = "institute_branding"

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<InstituteBranding>(() => getActiveBranding())
  const [isLoaded, setIsLoaded] = useState(false)
  const supabase = createClient()

  const theme = useMemo(() => getThemeConfig(branding.themeColor), [branding.themeColor])

  // Sync with DB and listen to events
  useEffect(() => {
    let isMounted = true

    // 1. Initial Load from LocalStorage
    const local = getActiveBranding()
    setBranding(local)

    // 2. Fetch from Supabase site_settings if available
    async function fetchFromDb() {
      try {
        const { data, error } = await supabase
          .from("site_settings")
          .select("value")
          .eq("key", DB_SETTING_KEY)
          .maybeSingle()

        if (!error && data?.value) {
          try {
            const parsed = JSON.parse(data.value)
            const merged = { ...DEFAULT_BRANDING, ...parsed }
            if (isMounted) {
              setBranding(merged)
              saveActiveBranding(merged)
            }
          } catch (e) {
            console.warn("Could not parse DB branding:", e)
          }
        }
      } catch (e) {
        console.warn("Could not query site_settings for branding:", e)
      } finally {
        if (isMounted) setIsLoaded(true)
      }
    }

    fetchFromDb()

    // 3. Listen to local custom event (same window tabs/components)
    const handleBrandingUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<InstituteBranding>
      if (customEvent.detail) {
        setBranding(customEvent.detail)
      } else {
        setBranding(getActiveBranding())
      }
    }

    // 4. Listen to storage event (cross-tab sync)
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === "institute_branding_config") {
        setBranding(getActiveBranding())
      }
    }

    window.addEventListener(BRANDING_UPDATE_EVENT, handleBrandingUpdate)
    window.addEventListener("storage", handleStorageEvent)

    return () => {
      isMounted = false
      window.removeEventListener(BRANDING_UPDATE_EVENT, handleBrandingUpdate)
      window.removeEventListener("storage", handleStorageEvent)
    }
  }, [])

  // Apply CSS color variables dynamically for instant application
  useEffect(() => {
    if (typeof document !== "undefined") {
      const root = document.documentElement
      root.style.setProperty("--brand-primary", theme.primaryHex)
      root.style.setProperty("--brand-secondary", theme.secondaryHex)
      root.style.setProperty("--brand-bg-light", theme.bgLightHex)
      root.style.setProperty("--brand-border", theme.borderHex)
    }
  }, [theme])

  // Apply Favicon (mini URL logo) and Page Title dynamically for browser tab
  useEffect(() => {
    if (typeof document !== "undefined") {
      const iconUrl = branding.faviconUrl || branding.logoUrl
      if (iconUrl) {
        // Update all icon links
        const existingLinks = document.querySelectorAll("link[rel*='icon']")
        if (existingLinks.length > 0) {
          existingLinks.forEach((link) => {
            ;(link as HTMLLinkElement).href = iconUrl
          })
        } else {
          const newLink = document.createElement("link")
          newLink.rel = "icon"
          newLink.href = iconUrl
          document.head.appendChild(newLink)
        }
      }

      // Update document title if present and not already customized by route
      if (branding.name && !document.title.includes(branding.name)) {
        const base = branding.name + (branding.tagline ? ` | ${branding.tagline}` : "")
        document.title = base
      }
    }
  }, [branding.faviconUrl, branding.logoUrl, branding.name, branding.tagline])

  const refreshBranding = async () => {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", DB_SETTING_KEY)
        .maybeSingle()

      if (!error && data?.value) {
        const parsed = JSON.parse(data.value)
        const merged = { ...DEFAULT_BRANDING, ...parsed }
        setBranding(merged)
        saveActiveBranding(merged)
      }
    } catch (e) {
      console.warn("Error refreshing branding:", e)
    }
  }

  const updateBranding = async (updated: Partial<InstituteBranding>): Promise<boolean> => {
    const next: InstituteBranding = {
      ...branding,
      ...updated,
    }

    // 1. Immediately persist locally and broadcast to UI
    setBranding(next)
    saveActiveBranding(next)

    // 2. Persist to Supabase site_settings table asynchronously
    try {
      const jsonStr = JSON.stringify(next)
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key: DB_SETTING_KEY, value: jsonStr }, { onConflict: "key" })

      if (error) {
        console.warn("Could not save branding to Supabase site_settings:", error.message)
      }
      return true
    } catch (e) {
      console.warn("Exception saving branding to site_settings:", e)
      return true // local save succeeded
    }
  }

  const resetToDefaults = async (): Promise<boolean> => {
    return updateBranding(DEFAULT_BRANDING)
  }

  return (
    <BrandingContext.Provider
      value={{
        branding,
        theme,
        updateBranding,
        resetToDefaults,
        refreshBranding,
        isLoaded,
      }}
    >
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding() {
  const context = useContext(BrandingContext)
  if (!context) {
    throw new Error("useBranding must be used within a BrandingProvider")
  }
  return context
}
