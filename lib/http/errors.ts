import { NextResponse } from "next/server";

export function authErrorResponse(auth: {
  ok: false;
  status: number;
  reason: string;
}) {
  return NextResponse.json({ error: auth.reason }, { status: auth.status });
}
