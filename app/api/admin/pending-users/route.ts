import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api";
import { auth } from "@/lib/auth/auth";
import { respondProblem } from "@/lib/http/respond";
import { headers } from "next/headers";

export async function GET() {
  const authResult = await requireApiAuth({ role: "admin" });
  if (!authResult.ok) {
    return respondProblem(authResult.problem);
  }

  const { users } = await auth.api.listUsers({
    query: {
      filterField: "banned",
      filterOperator: "eq",
      filterValue: true,
    },
    headers: await headers(),
  });

  return NextResponse.json({ users });
}
