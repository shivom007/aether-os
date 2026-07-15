import { NextResponse } from "next/server"

export async function GET() {
  const GO_API_BASE = process.env.GO_API_URL || "http://localhost:8080/api/v1"
  try {
    const res = await fetch(`${GO_API_BASE}/health`)
    if (!res.ok) throw new Error("Go backend offline")
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ status: "error", message: "Backend offline" }, { status: 503 })
  }
}
