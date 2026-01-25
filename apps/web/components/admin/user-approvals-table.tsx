"use client";

import { DataTable } from "@/components/ui/data-table";
import { columns } from "@/components/admin/columns";
import { UserWithRole } from "better-auth/plugins";

export function UserApprovalsTable({
  data,
  onApprove,
  onDelete,
}: {
  data: UserWithRole[];
  onApprove: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return <DataTable columns={columns({ onApprove, onDelete })} data={data} />;
}
