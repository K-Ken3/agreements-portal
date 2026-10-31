import { NextRequest, NextResponse } from "next/server";
import { destroySession, rejectCrossOriginMutation } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  const response = NextResponse.json({ success: true });
  await destroySession(request, response);
  return response;
}
