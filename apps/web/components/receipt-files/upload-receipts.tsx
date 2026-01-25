"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { useRouter } from "next/navigation";
import {
  ReceiptUploadInput,
  ReceiptUploadSchema,
} from "@repo/shared";

export default function UploadReceipts({ jobId }: { jobId: string }) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ReceiptUploadInput>({
    resolver: zodResolver(ReceiptUploadSchema),
    defaultValues: {
      jobId,
    },
  });

  const onSubmit = async (values: ReceiptUploadInput) => {
    const formData = new FormData();
    formData.append("jobId", values.jobId);

    Array.from(values.files).forEach((file) => formData.append("files", file));

    const res = await fetch("/api/receipts", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      // handle error
      return;
    }

    reset();
    // TODO: add local state for optimistic UI
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-sm space-y-3">
      <FieldGroup>
        <Input type="hidden" {...register("jobId")} />

        <FieldLabel htmlFor="files">Receipts</FieldLabel>

        <Input
          id="files"
          type="file"
          multiple
          accept="image/*"
          {...register("files")}
        />

        <FieldDescription>
          Upload relevant receipts for this expense report.
        </FieldDescription>

        <FieldError errors={[errors.files]} />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Uploading…" : "Submit"}
        </Button>
      </FieldGroup>
    </form>
  );
}
