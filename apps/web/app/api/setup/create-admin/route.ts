// app/api/setup/create-admin/route.ts
import { auth } from "@/lib/auth/auth";
import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@repo/db";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  // 1. Check secret token
  const authHeader = req.headers.get("authorization");
  const setupSecret = process.env.SETUP_SECRET;

  if (!setupSecret) {
    return NextResponse.json(
      { error: "Setup endpoint is disabled" },
      { status: 503 },
    );
  }

  if (authHeader !== `Bearer ${setupSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Check if admin already exists
  const existingAdmin = await db.query.users.findFirst({
    where: eq(users.role, "admin"),
  });

  if (existingAdmin) {
    return NextResponse.json(
      { error: "Admin already exists" },
      { status: 400 },
    );
  }

  // 3. Get credentials from request body
  const body = await req.json();
  const { email, name, password } = body;

  if (!email || !name || !password) {
    return NextResponse.json(
      { error: "Missing required fields: email, name, password" },
      { status: 400 },
    );
  }

  if (password.length < 12) {
    return NextResponse.json(
      { error: "Password must be at least 12 characters" },
      { status: 400 },
    );
  }

  // 4. Create admin using Better Auth's API
  try {
    await auth.api.createUser({
      body: {
        email,
        name,
        password,
        role: "admin",
        data: {
          status: "active",
          emailVerified: true,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Admin created successfully",
      email,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create admin";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
