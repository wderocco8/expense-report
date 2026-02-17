"use client";

import { ReceiptFilesSection } from "@/components/receipt-files/receipt-files-section";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpenseReportJob } from "@repo/db";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export default function ExpenseReportPage() {
  const params = useParams<{ jobId: string }>();
  const { jobId } = params;

  const { data } = useQuery<ExpenseReportJob>({
    queryKey: ["expense-report", jobId],
    queryFn: () => fetch(`/api/expense-reports/${jobId}`).then((r) => r.json()),
  });

  // const numProcessed = data.receiptFiles.filter(
  //   (r) => r.status === "complete" || r.status === "failed",
  // ).length;

  return (
    <div className="container mx-auto py-8 space-y-8">
      {data ? (
        <div>{data.title}</div>
      ) : (
        <Skeleton className="h-5 w-25 rounded-full" />
      )}

      {/* <div>
        Progress: {numProcessed} / {data.receiptFiles.length} receipts processed
      </div> */}

      <ReceiptFilesSection jobId={jobId} />
    </div>
  );
}
