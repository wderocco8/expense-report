// scripts/seed-admin.ts
import { auth } from "@/lib/auth";
import { APIError } from "better-auth";

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || "admin@localhost";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const name = process.env.ADMIN_NAME || "Local Admin";

  try {
    // ✅ Use Better Auth's built-in createUser API
    const newUser = await auth.api.createUser({
      body: {
        email,
        name,
        password,
        role: "admin", // Set admin role directly
        data: {
          emailVerified: true, // Skip email verification for admin
        },
      },
    });

    console.log("✅ Admin user created successfully!");
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
  } catch (error) {
    // User might already exist
    if (error instanceof APIError) {
      console.log(error.message, error.status);
      if (error.message.includes("email") || error.message.includes("exists")) {
        console.log("✅ Admin user already exists");
      }
    } else {
      throw error;
    }
  }
}

seedAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error seeding admin:", err);
    process.exit(1);
  });
