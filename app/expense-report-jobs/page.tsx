"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExpenseReportCreateSchema } from "@/server/validators/expenseReport.zod";
import { z } from "zod";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

export default function CreateExpenseReportJob() {
  type FormValues = z.infer<typeof ExpenseReportCreateSchema>;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(ExpenseReportCreateSchema),
    defaultValues: {
      title: "",
    },
  });

  async function onSubmit(values: FormValues) {
    const res = await fetch("/api/expense-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      // optional: toast / error boundary
      return;
    }

    reset();
    // router.push(`/expense-reports/${job.id}`);
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
