"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

interface ExportReceiptsProps {
  jobId: string;
  disabled: boolean;
}

export default function ExportReceipts({
  jobId,
  disabled,
}: ExportReceiptsProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    try {
      setLoading(true);

      const res = await fetch(`/api/expense-reports/${jobId}/export`, {
        method: "GET",
      });

      if (!res.ok) {
        throw new Error("Failed to download report");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `expense-report-${jobId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
      toast.success("Successfully downloaded excel report");
    } catch (err) {
      console.error(err);
      toast.error("Failed to download excel report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      onClick={handleDownload}
      variant="outline"
      disabled={disabled || loading}
    >
      {loading && <Spinner data-icon="inline-start" />}
      Download Excel
    </Button>
  );
}
