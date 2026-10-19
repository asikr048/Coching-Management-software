import { createClient } from "@supabase/supabase-js"
import { DEFAULT_BRANDING, type InstituteBranding } from "@/lib/branding"

const DB_SETTING_KEY = "institute_branding"

/**
 * Server-side branding reader for metadata, favicons and SSR fallbacks.
 * Uses the public anon key (the same data the branding studio writes) and
 * never throws: a missing/unreachable setting simply falls back to defaults.
 */
export async function getServerBranding(): Promise<InstituteBranding> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key || url.includes("placeholder")) {
    return DEFAULT_BRANDING
  }

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", DB_SETTING_KEY)
      .maybeSingle()

    if (error || !data?.value) return DEFAULT_BRANDING

    const parsed = JSON.parse(data.value)
    return { ...DEFAULT_BRANDING, ...parsed }
  } catch {
    return DEFAULT_BRANDING
  }
}
