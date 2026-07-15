import { fail } from "@/lib/api"

export async function POST() {
  return fail("Email/password sign-in is handled by NextAuth Credentials.", 410)
}
