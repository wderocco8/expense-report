"use client";

import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadList,
  FileUploadTrigger,
} from "@/components/ui/file-upload";
import { Progress } from "@/components/ui/progress";
import {
  MAX_FILES_PER_UPLOAD,
  ReceiptUploadInput,
  ReceiptUploadSchema,
} from "@repo/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { PresignBody } from "@/app/api/receipts/presign/schema";
import { ConfirmBody } from "@/app/api/receipts/schema";

interface ScanUploadReceiptsProps {
  jobId: string;
  onSuccess: () => void;
  onSubmittingChange: (v: boolean) => void;
}

export function ScanUploadReceipts({
  jobId,
  onSuccess,
  onSubmittingChange,
}: ScanUploadReceiptsProps) {
  const router = useRouter();
  const [uploadedCount, setUploadedCount] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    control,
    setError,
    setValue,
  } = useForm<ReceiptUploadInput>({
    resolver: zodResolver(ReceiptUploadSchema),
    defaultValues: { jobId, files: [] },
  });

  const files = useWatch({ control, name: "files" });
  const fileError = errors.files;

  const onSubmit = async (values: ReceiptUploadInput) => {
    setUploadedCount(0);

    // Assign a client-generated UUID to each file — used as the receiptId on the backend
    const fileEntries = values.files.map((file) => ({
      id: crypto.randomUUID(),
      file,
    }));

    // Step 1: Request presigned PUT URLs from the backend
    const presignBody: PresignBody = {
      jobId: values.jobId,
      files: fileEntries.map(({ id, file }) => ({
        id,
        name: file.name,
        type: file.type,
      })),
    };

    const presignRes = await fetch("/api/receipts/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(presignBody),
    });

    if (!presignRes.ok) {
      toast.error("Failed to prepare upload. Please try again.");
      return;
    }

    const { uploads } = (await presignRes.json()) as {
      uploads: { receiptId: string; presignedUrl: string }[];
    };

    const uploadsByReceiptId = new Map(uploads.map((u) => [u.receiptId, u]));

    // Step 2: Upload each file directly to S3 in parallel, matched by receiptId
    const succeededIds: string[] = [];
    const failedIds: string[] = [];
    await Promise.all(
      fileEntries.map(async ({ id, file }, i) => {
        try {
          const upload = uploadsByReceiptId.get(id);
          if (!upload) {
            failedIds.push(id);
            return;
          }

          // TODO: remove - simulate failure for even-indexed receipts
          if (i % 2 == 0) throw new Error("simulate failure");

          const res = await fetch(upload.presignedUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
          });

          if (res.ok) {
            succeededIds.push(id);
          } else {
            failedIds.push(id);
          }
        } catch (err) {
          console.error(`S3 upload failed for receipt ${id}:`, err);
          failedIds.push(id);
        } finally {
          setUploadedCount((c) => c + 1);
        }
      }),
    );

    if (failedIds.length > 0) {
      const failedNames = fileEntries
        .filter(({ id }) => failedIds.includes(id))
        .map(({ file }) => file.name)
        .join(", ");
      toast.error(
        `${failedIds.length} ${failedIds.length === 1 ? "file" : "files"} failed to upload: ${failedNames}`,
      );
    }

    // Step 3: Confirm — enqueues successes and immediately marks failures as failed
    const confirmBody: ConfirmBody = {
      successReceiptIds: succeededIds,
      failedReceiptIds: failedIds,
    };

    const confirmRes = await fetch("/api/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(confirmBody),
    });

    if (!confirmRes.ok) {
      toast.error("Upload failed. Please try again.");
      return;
    }

    reset();
    router.refresh();
    onSuccess();
  };

  useEffect(() => {
    onSubmittingChange(isSubmitting);
  }, [isSubmitting, onSubmittingChange]);

  // Warn browser on refresh/tab-close while uploading
  useEffect(() => {
    if (!isSubmitting) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isSubmitting]);

  return (
    <form
      id="scan-upload-form"
      onSubmit={handleSubmit(onSubmit)}
      className="h-full flex flex-col"
    >
      <input type="hidden" {...register("jobId")} />

      <FieldGroup className="h-full">
        <Field className="h-full" data-invalid={!!fileError}>
          <FileUpload
            value={files}
            onValueChange={(v) =>
              setValue("files", v, { shouldValidate: true })
            }
            accept="image/*"
            maxFiles={MAX_FILES_PER_UPLOAD}
            onFileReject={(_, message) => {
              setError("files", { message });
            }}
            multiple
            className="flex h-full w-full flex-col gap-4 min-h-0"
          >
            <FileUploadDropzone className="flex-1 min-h-80">
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center justify-center rounded-full border p-2.5">
                  <Upload className="size-6 text-muted-foreground" />
                </div>
                <p className="font-medium text-sm">Drag & drop files here</p>
                <p className="text-muted-foreground text-xs">
                  Or click to browse (max {MAX_FILES_PER_UPLOAD} files)
                </p>
              </div>
              <FileUploadTrigger asChild>
                <Button variant="outline" size="sm" className="mt-2 w-fit">
                  Browse files
                </Button>
              </FileUploadTrigger>
            </FileUploadDropzone>

            {isSubmitting ? (
              <div className="space-y-1">
                <Progress
                  value={
                    files.length > 0 ? (uploadedCount / files.length) * 100 : 0
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Uploading {uploadedCount} / {files.length}...
                </p>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                {files.length} / {MAX_FILES_PER_UPLOAD} attached
              </div>
            )}

            <FileUploadList className="overflow-y-auto">
              {files.map((file, i) => (
                <FileUploadItem key={i} value={file}>
                  <FileUploadItemPreview />
                  <FileUploadItemMetadata />
                  <FileUploadItemDelete asChild>
                    <Button variant="ghost" size="icon" disabled={isSubmitting}>
                      <X />
                    </Button>
                  </FileUploadItemDelete>
                </FileUploadItem>
              ))}
            </FileUploadList>
          </FileUpload>

          <FieldError errors={fileError ? [fileError] : undefined} />
        </Field>
      </FieldGroup>
    </form>
  );
}
