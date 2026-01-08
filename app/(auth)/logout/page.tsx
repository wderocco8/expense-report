"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutPage() {
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);

  const signOut = async () => {
    const { error } = await authClient.signOut();
    if (!error) {
      router.push("/login");
    } else {
      setError(error.message ?? null);
    }
  };

  console.log("signout error", error);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Button onClick={signOut}>Sign Out</Button>
    </div>
  );
}
