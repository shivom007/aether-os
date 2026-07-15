import { fail } from "@/lib/api"

export async function POST() {
  return fail("Session refresh is handled by NextAuth.", 410)
}
