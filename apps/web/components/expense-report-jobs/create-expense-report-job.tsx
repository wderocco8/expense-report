"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExpenseReportCreateSchema } from "@repo/shared";
import { z } from "zod";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function CreateExpenseReportJob() {
  const router = useRouter();

  type FormValues = z.infer<typeof ExpenseReportCreateSchema>;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(ExpenseReportCreateSchema),
  });

  async function onSubmit(values: FormValues) {
    const res = await fetch("/api/expense-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      // optional: toast / error boundary
      toast.error("Failed to create job");
      return;
    }

    toast.success("Successfully created job");
    reset();
    // TODO: add local state for optimistic UI
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-sm">
      <FieldGroup>
        <Field data-invalid={!!errors.title}>
          <FieldLabel htmlFor="title">Expense report title</FieldLabel>

          <Input
            id="title"
            placeholder="Trip to NYC"
            aria-invalid={!!errors.title}
            {...register("title")}
          />

          <FieldDescription>
            Optional. If omitted, we&apos;ll generate a title for you.
          </FieldDescription>

          <FieldError errors={errors.title ? [errors.title] : undefined} />
        </Field>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create report"}
        </Button>
      </FieldGroup>
    </form>
  );
}
