"use client";

import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { UserWithRole } from "better-auth/plugins";

export function UserApprovalList() {
  const [users, setUsers] = useState<UserWithRole[]>([]);

  async function loadUsers() {
    const { data } = await authClient.admin.listUsers({
      query: {
        filterField: "banned",
        filterValue: true,
        filterOperator: "eq",
      },
    });
    setUsers(data?.users || []);
  }

  useEffect(() => {
    (async () => {
      await loadUsers();
    })();
  }, []);

  async function approveUser(userId: string) {
    await authClient.admin.unbanUser({ userId });
    loadUsers();
  }

  async function rejectUser(userId: string) {
    await authClient.admin.removeUser({ userId });
    loadUsers();
  }

  return (
    <div className="space-y-4">
      {users.map((user) => (
        <div
          key={user.id}
          className="flex items-center justify-between p-4 border rounded"
        >
          <div>
            <p className="font-medium">{user.name}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
            {user.banReason && (
              <p className="text-xs text-orange-600">
                Reason: {user.banReason}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => approveUser(user.id)}>Approve</Button>
            <Button variant="destructive" onClick={() => rejectUser(user.id)}>
              Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
