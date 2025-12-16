import { ReceiptFilesSection } from "@/components/receipt-files/receipt-files-section";
import { getExpenseReportWithFiles } from "@/server/services/expenseReports.service";

export default async function ExpenseReportPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const job = await getExpenseReportWithFiles(jobId);
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>{job.title}</div>
      <div>
        Progress: {job.processedFiles} / {job.totalFiles} receipts processed
      </div>
      <ReceiptFilesSection receiptFiles={job.receiptFiles} />
    </div>
  );
}
