"use client";

import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth/auth-client";
import { UserWithRole } from "better-auth/plugins";
import { toast } from "sonner";
import { UserApprovalsTable } from "@/components/admin/user-approvals-table";
import { PendingUsersResponse } from "@/types/admin";

export function UserApprovalList() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  async function loadUsers() {
    const res = await fetch("/api/admin/pending-users");
    if (!res.ok) {
      toast.error("Failed to load users");
      throw new Error("Failed to load users");
    }

    const data: PendingUsersResponse = await res.json();
    setUsers(data.users);
  }

  useEffect(() => {
    (async () => {
      await loadUsers();
    })();
  }, []);

  async function approveUser(userId: string) {
    setLoading(userId);
    try {
      await authClient.admin.unbanUser({ userId });

      // ✅ Send approval email via your API route
      await fetch("/api/send-approval-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      toast.success("User approved and notified");
      await loadUsers();
    } catch (error) {
      console.error("Error approving user", error);
      toast.error("Failed to approve user");
    } finally {
      setLoading(null);
    }
  }

  async function rejectUser(userId: string) {
    setLoading(userId);
    try {
      await authClient.admin.removeUser({ userId });
      toast.success("User rejected");
      await loadUsers();
    } catch (error) {
      console.error("Error rejecting user", error);
      toast.error("Failed to reject user");
    } finally {
      setLoading(null);
    }
  }

  return (
    <UserApprovalsTable
      data={users}
      onApprove={approveUser}
      onDelete={rejectUser}
    />
  );
}
