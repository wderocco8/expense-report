"use client";

import { ReceiptFilesSection } from "@/components/receipt-files/receipt-files-section";
import { ExpenseReportJob } from "@repo/db";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export default function ExpenseReportPage() {
  const params = useParams<{ jobId: string }>();
  const { jobId } = params;

  const { data } = useQuery<ExpenseReportJob>({
    queryKey: ["expense-report", jobId],
    queryFn: () => fetch(`/api/expense-reports/${jobId}`).then((r) => r.json()),
    // refetchInterval: (query) => {
    //   const job = query.state.data;
    //   if (!job) return 30000;

    //   const incompleteStatus = job?.receiptFiles.some(
    //     (r) => r.status === "pending" || r.status === "processing",
    //   );
    //   return incompleteStatus ? 3000 : 30000;
    // },
  });

  if (!data) {
    // TODO: replace with skeleton perhaps....
    return <div>Loading data...</div>;
  }

  // const numProcessed = data.receiptFiles.filter(
  //   (r) => r.status === "complete" || r.status === "failed",
  // ).length;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>{data.title}</div>

      {/* <div>
        Progress: {numProcessed} / {data.receiptFiles.length} receipts processed
      </div> */}

      <ReceiptFilesSection jobId={jobId} />
    </div>
  );
}
