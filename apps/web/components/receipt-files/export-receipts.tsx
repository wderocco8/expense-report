"use client";

import { Button } from "@/components/ui/button";
export default function ExportReceipts({ jobId }: { jobId: string }) {
  return (
    <Button
      type="button"
      onClick={() => {
        window.location.href = `/api/expense-reports/${jobId}/export`;
      }}
      variant="outline"
    >
      Download Excel
    </Button>
  );
}
