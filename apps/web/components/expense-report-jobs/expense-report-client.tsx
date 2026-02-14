"use client";

import { ExpenseReportWithFiles } from "@/server/types/expense-report-jobs";
import { useQuery } from "@tanstack/react-query";
import { ReceiptFilesSection } from "../receipt-files/receipt-files-section";

interface ExpenseReportClientProps {
  initialJob: ExpenseReportWithFiles;
}

export function ExpenseReportClient({ initialJob }: ExpenseReportClientProps) {
  const { data } = useQuery<ExpenseReportWithFiles>({
    queryKey: ["expense-report", initialJob.id],
    queryFn: () =>
      fetch(`/api/expense-reports/${initialJob.id}`).then((r) => r.json()),
    initialData: initialJob,
    refetchInterval: (data) => {
      // const hasProcessing = data.receiptFiles.some(
      //   (r) => r.status === "processing",
      // );
      // return hasProcessing ? 3000 : false;
      return 5000;
    },
  });

  const numProcessed = data.receiptFiles.filter(
    (r) => r.status === "complete" || r.status === "failed",
  ).length;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>{data.title}</div>

      <div>
        Progress: {numProcessed} / {data.receiptFiles.length} receipts processed
      </div>

      <ReceiptFilesSection jobId={data.id} receiptFiles={data.receiptFiles} />
    </div>
  );
}
