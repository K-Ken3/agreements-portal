import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch {
    console.error("Health check could not reach the database.");
    return NextResponse.json(
      { status: "unavailable", database: "unavailable" },
      { status: 503 }
    );
  }
}
