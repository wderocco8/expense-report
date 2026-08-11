import { problem } from "@/lib/problems/problem";

export const schemaVersionProblems = {
  notFoundById: (id: string) =>
    problem(
      404,
      "/problems/schema-version/not-found",
      "Schema version not found",
      `No schema version exists with id ${id}`,
    ),
};
