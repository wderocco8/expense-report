// components/auth/sign-in-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignUpForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const name = formData.get("name") as string;

    const { error } = await authClient.signUp.email(
      {
        email,
        name,
        password,
        callbackURL: "/expense-report-jobs",
      },
      {
        onError: (ctx) => {
          setError(ctx.error.message);
        },
      }
    );

    setLoading(false);

    if (!error) {
      router.push("/expense-report-jobs");
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
      <div>
        <Label>Name</Label>
        <Input name="name" type="text" required />
      </div>

      <div>
        <Label>Email</Label>
        <Input name="email" type="email" required />
      </div>

      <div>
        <Label>Password</Label>
        <Input name="password" type="password" required />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button className="w-full" disabled={loading}>
        {loading ? "Signing up..." : "Sign up"}
      </Button>
    </form>
  );
}
