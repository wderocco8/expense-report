import { UserApprovalList } from "@/components/admin/user-approval-list";
import { requirePageAuth } from "@/lib/auth/page";

export default async function AdminDashboard() {
  await requirePageAuth({ roles: ["admin"] });

  return (
    <div className="container mx-auto py-8 space-y-8">
      <UserApprovalList />
    </div>
  );
}
