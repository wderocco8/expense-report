import { UserApprovalList } from "@/components/admin/user-approval-list";

export default function AdminDashboard() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <UserApprovalList />
    </div>
  );
}
