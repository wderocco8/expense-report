import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import DateFieldInput from "@/components/receipt-files/extracted-expenses/dynamic/DateFieldInput";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { buildExtractedExpenseSchema, time } from "@repo/shared";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { ExtractedExpense, ReceiptFile, SchemaVersion } from "@repo/db";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import ReceiptPreviewDialog from "@/components/receipt-files/extracted-expenses/receipt-preview-dialog";
import ExtractedExpenseSkeleton from "@/components/receipt-files/extracted-expenses/extracted-expense-skeleton";
import UnsavedChangesDialog from "@/components/receipt-files/extracted-expenses/unsaved-changes-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import DynamicExpenseFields from "./dynamic/DynamicExpenseFields";
import { ExtractedExpenseFormValues } from "./dynamic/types";

function formatMoney(value: string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return "";
  return n.toFixed(2);
}

type ReceiptImage = { url: string };

type ExtractedExpenseSheetProps = {
  receipt: ReceiptFile | null | undefined;
  schemaVersionId: string | undefined;
  open: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
};

async function fetchSchemaVersion(
  id: string | undefined,
): Promise<SchemaVersion> {
  const res = await fetch(`/api/schema-versions/${id}`);

  if (!res.ok) {
    throw new Error("Failed to fetch schema-version");
  }
  return res.json();
}

export function ExtractedExpenseSheet({
  receipt,
  schemaVersionId,
  open,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: ExtractedExpenseSheetProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [unsavedChangesOpen, setUnsavedChangesOpen] = useState(false);
  const [pendingNav, setPendingNav] = useState<null | "prev" | "next">(null);
  const [pendingClose, setPendingClose] = useState(false);

  const fetcher = async (url: string) => {
    const res = await fetch(url);

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      const error = new Error(errorBody.error || "Request failed");
      throw error;
    }

    return res.json();
  };

  const { data: schemaVersion } = useQuery<SchemaVersion>({
    queryKey: ["schema-version", schemaVersionId],
    queryFn: () => fetchSchemaVersion(schemaVersionId),
    enabled: schemaVersionId != undefined,
    staleTime: 10 * time.Second,
    // TODO: configure gcTime and stale time?
  });

  console.log("schema version", schemaVersionId, schemaVersion);

  const {
    data: expense,
    isLoading,
    mutate,
    error,
  } = useSWR<ExtractedExpense>(
    () =>
      open && receipt?.id
        ? `/api/receipts/${receipt.id}/extracted-expense`
        : null,
    fetcher,
  );

  console.log("expense", expense);

  const { data: image, isLoading: isLoadingImage } = useSWR<ReceiptImage>(
    receipt?.id ? `/api/receipts/${receipt.id}/image` : null,
    fetcher,
  );

  const formSchema = useMemo(
    () => buildExtractedExpenseSchema(schemaVersion?.fields ?? []),
    [schemaVersion],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    control,
  } = useForm<ExtractedExpenseFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: expense
      ? {
          amount: expense.amount,
          date: expense.date ?? null,
          extractedFields: expense.extractedFields,
        }
      : undefined,
  });

  const inputProps = { control, register, errors, isSubmitting };

  useEffect(() => {
    if (expense) {
      reset({
        amount: expense.amount,
        date: expense.date ?? null,
        extractedFields: expense.extractedFields,
      });
    }
  }, [expense, reset]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  async function onSubmit(values: ExtractedExpenseFormValues) {
    if (!expense?.id) return;

    const res = await fetch(`/api/extracted-expenses/${expense.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      toast.error("Encountered error updating expense");
      return;
    }

    toast.success("Expense has been updated");
    mutate({ ...expense, ...values }, false); // optimistic update
    reset({ ...expense, ...values }); // reset form state to current values
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          if (isDirty) {
            setPendingClose(true);
            setUnsavedChangesOpen(true);
          } else {
            onClose();
          }
        }
      }}
    >
      <SheetContent
        className="flex flex-col"
        side="right"
        showCloseButton={false}
      >
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col flex-1 min-h-0"
        >
          <SheetHeader>
            <div className="flex justify-between items-center mt-6">
              <SheetTitle>Extracted Expense</SheetTitle>

              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (isDirty) {
                      setPendingNav("prev");
                      setUnsavedChangesOpen(true);
                    } else {
                      onPrev();
                    }
                  }}
                  disabled={!hasPrev}
                >
                  Prev
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (isDirty) {
                      setPendingNav("next");
                      setUnsavedChangesOpen(true);
                    } else {
                      onNext();
                    }
                  }}
                  disabled={!hasNext}
                >
                  Next
                </Button>
              </div>
            </div>
            <SheetDescription>
              AI-extracted expense details from this receipt.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 px-4 pb-4 overflow-y-auto">
            <div className="mb-4">
              <div
                className="relative w-full h-72 overflow-hidden rounded-lg border cursor-pointer group"
                onClick={() => image?.url && setPreviewOpen(true)}
              >
                {isLoadingImage ? (
                  <Skeleton className="absolute inset-0" />
                ) : image?.url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt={receipt?.originalFilename ?? "Receipt"}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/50" />
                    {receipt?.originalFilename && (
                      <div className="absolute inset-0 flex items-center justify-center px-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <p className="text-white text-lg font-medium text-center break-all drop-shadow-md">
                          {receipt.originalFilename}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    No image available
                  </div>
                )}
              </div>
            </div>
            {isLoading ? (
              <ExtractedExpenseSkeleton />
            ) : !expense ? (
              <div className="text-sm text-muted-foreground">
                No extracted expense found for this receipt.
              </div>
            ) : !(schemaVersion?.fields || schemaVersion?.groups) ? (
              <div className="text-sm text-muted-foreground">
                No schema version found for this receipt.
              </div>
            ) : (
              <FieldGroup>
                {/* amount/date are system fields, not part of schemaVersion.fields
                    (Decision 4) — rendered directly here rather than through
                    DynamicExpenseFields, which only knows about custom fields. */}
                <FieldGroup>
                  <Field data-invalid={!!errors.amount}>
                    <FieldLabel htmlFor="amount">
                      Amount <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="amount"
                      disabled={isSubmitting}
                      inputMode="decimal"
                      aria-invalid={!!errors.amount}
                      {...register("amount", {
                        onBlur: (e) => {
                          e.target.value = formatMoney(e.target.value);
                        },
                      })}
                    />
                    <FieldError
                      errors={errors.amount ? [errors.amount] : undefined}
                    />
                  </Field>

                  <Field data-invalid={!!errors.date}>
                    <FieldLabel htmlFor="date">
                      Date <span className="text-destructive">*</span>
                    </FieldLabel>
                    <DateFieldInput
                      name="date"
                      control={control}
                      disabled={isSubmitting}
                    />
                    <FieldError
                      errors={errors.date ? [errors.date] : undefined}
                    />
                  </Field>
                </FieldGroup>

                <DynamicExpenseFields
                  fields={schemaVersion.fields}
                  groups={schemaVersion.groups}
                  {...inputProps}
                />
              </FieldGroup>
            )}
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => reset()} // resets to the last fetched expense
              disabled={!isDirty} // only active if there are changes
            >
              Reset
            </Button>
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting && <Spinner />}
              Update
            </Button>
            <SheetClose asChild>
              <Button variant="outline">Cancel</Button>
            </SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
      <UnsavedChangesDialog
        open={unsavedChangesOpen}
        onOpenChange={setUnsavedChangesOpen}
        onSubmit={() => {
          setUnsavedChangesOpen(false);

          if (pendingNav === "prev") onPrev();
          else if (pendingNav === "next") onNext();
          else if (pendingClose) onClose();

          setPendingNav(null);
          setPendingClose(false);
          reset(expense);
        }}
        onCancel={() => {
          setUnsavedChangesOpen(false);
          setPendingNav(null);
          setPendingClose(false);
        }}
      />
      <ReceiptPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        imageUrl={image?.url ?? null}
        imageAlt={receipt?.originalFilename ?? null}
      />
    </Sheet>
  );
}
