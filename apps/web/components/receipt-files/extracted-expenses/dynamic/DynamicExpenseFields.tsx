import { SchemaFieldGroup, SchemaFieldDefinition } from "@repo/db";
import { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import { ExtractedExpenseFormValues } from "@/components/receipt-files/extracted-expenses/dynamic/types";
import DynamicFieldInput from "@/components/receipt-files/extracted-expenses/dynamic//DynamicFieldInput";
import {
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";

interface DynamicExpenseFieldsProps {
  fields: SchemaFieldDefinition[];
  groups: SchemaFieldGroup[];
  control: Control<ExtractedExpenseFormValues>;
  register: UseFormRegister<ExtractedExpenseFormValues>;
  errors: FieldErrors<ExtractedExpenseFormValues>;
  isSubmitting: boolean;
}

export default function DynamicExpenseFields({
  fields,
  groups,
  control,
  register,
  errors,
  isSubmitting,
}: DynamicExpenseFieldsProps) {
  const sortedFields = [...fields].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );
  const ungroupedFields = sortedFields.filter((f) => f.groupId == null);
  const groupedFields = sortedFields.filter((f) => f.groupId);

  const inputProps = { control, register, errors, isSubmitting };

  return (
    <FieldGroup>
      <FieldSet>
        <FieldLegend variant="label">Expense Details</FieldLegend>
        <FieldDescription>
          General details regarding your expense
        </FieldDescription>

        <FieldGroup>
          {ungroupedFields.map((field) => (
            <DynamicFieldInput key={field.key} field={field} {...inputProps} />
          ))}
        </FieldGroup>
      </FieldSet>

      {groups.map((group) => {
        const members = groupedFields.filter((f) => f.groupId === group.id);
        // Structural check only — a group with zero member fields, not a
        // showWhen visibility check. That's the piece you're adding later.
        if (members.length === 0) return null;

        return (
          <div key={group.id}>
            <FieldSeparator />
            <FieldSet>
              <FieldLegend variant="label">{group.label}</FieldLegend>
              {group.description && (
                <FieldDescription>{group.description}</FieldDescription>
              )}
              <FieldGroup>
                {members.map((field) => (
                  <DynamicFieldInput
                    key={field.key}
                    field={field}
                    {...inputProps}
                  />
                ))}
              </FieldGroup>
            </FieldSet>
          </div>
        );
      })}
    </FieldGroup>
  );
}
