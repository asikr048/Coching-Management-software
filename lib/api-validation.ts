import { z } from "zod"
import { NextResponse } from "next/server"

/**
 * Validate a request body against a Zod schema.
 * Returns the parsed data or a NextResponse with 400 status and validation details.
 */
export function validateBody<T>(
  schema: z.ZodType<T>,
  body: unknown
): { data: T } | { error: NextResponse } {
  const result = schema.safeParse(body)
  if (!result.success) {
    return {
      error: NextResponse.json(
        {
          error: "Validation Error (ইনপুট ত্রুটি)",
          details: result.error.flatten(),
        },
        { status: 400 }
      ),
    }
  }
  return { data: result.data }
}

/**
 * Sanitize a string to prevent XSS — strips HTML tags and trims whitespace.
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim()
}

/**
 * Validate a UUID string format.
 */
export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

/**
 * Common Zod schemas for reuse across API routes.
 */
export const schemas = {
  uuid: z.string().uuid("Invalid UUID format"),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number"),
  email: z.string().email("Invalid email address"),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Invalid month format (YYYY-MM)"),
  positiveNumber: z.number().positive("Must be a positive number"),
  nonNegativeNumber: z.number().min(0, "Must be non-negative"),
  paymentMethod: z.enum(["cash", "bkash", "nagad", "rocket", "bank", "referral", "online", "other"]),
}
