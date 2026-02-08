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
import {
  MAX_FILES_PER_UPLOAD,
  ReceiptUploadInput,
  ReceiptUploadSchema,
} from "@repo/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { useRouter } from "next/navigation";

interface ScanUploadReceiptsProps {
  jobId: string;
  onSuccess: () => void;
}

export function ScanUploadReceipts({
  jobId,
  onSuccess,
}: ScanUploadReceiptsProps) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setError,
    setValue,
  } = useForm<ReceiptUploadInput>({
    resolver: zodResolver(ReceiptUploadSchema),
    defaultValues: {
      jobId,
      files: [],
    },
  });

  const files = watch("files");
  const fileError = errors.files;

  const onSubmit = async (values: ReceiptUploadInput) => {
    const formData = new FormData();
    formData.append("jobId", values.jobId);
    values.files.forEach((f) => formData.append("files", f));

    const res = await fetch("/api/receipts", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      // TODO: handle error
      return;
    }

    reset();
    // TODO: add local state for optimistic UI
    router.refresh();
    onSuccess();
  };

  return (
    <form
      id="scan-upload-form"
      onSubmit={handleSubmit(onSubmit)}
      className="h-full flex flex-col"
    >
      <input type="hidden" {...register("jobId")} />

      <FieldGroup className="h-full">
        <Field className="h-full" data-invalid={!!fileError}>
          <FieldLabel>Receipts</FieldLabel>

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
            className="flex h-full w-full flex-col gap-4"
          >
            <FileUploadDropzone className="flex-1">
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center justify-center rounded-full border p-2.5">
                  <Upload className="size-6 text-muted-foreground" />
                </div>
                <p className="font-medium text-sm">Drag & drop files here</p>
                <p className="text-muted-foreground text-xs">
                  Or click to browse (max 2 files)
                </p>
              </div>
              <FileUploadTrigger asChild>
                <Button variant="outline" size="sm" className="mt-2 w-fit">
                  Browse files
                </Button>
              </FileUploadTrigger>
            </FileUploadDropzone>

            <FileUploadList>
              {files.map((file, i) => (
                <FileUploadItem key={i} value={file}>
                  <FileUploadItemPreview />
                  <FileUploadItemMetadata />
                  <FileUploadItemDelete asChild>
                    <Button variant="ghost" size="icon">
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
