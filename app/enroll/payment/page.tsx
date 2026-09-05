import { redirect } from "next/navigation"

export default async function PublicPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const batch = params.batchId || params.batch
  if (batch && typeof batch === "string") {
    redirect(`/enroll?batchId=${encodeURIComponent(batch)}`)
  }
  redirect("/enroll")
}

