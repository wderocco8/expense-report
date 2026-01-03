import { UserApprovalList } from "@/components/admin/user-approval-list";

export default function AdminDashboard() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <UserApprovalList />
    </div>
  );
}
