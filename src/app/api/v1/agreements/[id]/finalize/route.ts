import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, rejectCrossOriginMutation } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return NextResponse.json(
    { error: "Agreements can only be finalised after both parties sign. Use the signing invitation workflow." },
    { status: 409 }
  );
}
