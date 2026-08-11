import { problem } from "@/lib/problems/problem";

export const schemaProblems = {
  notFoundById: (id: string) =>
    problem(
      404,
      "/problems/schema/not-found",
      "Schema not found",
      `No schema exists with id ${id}`,
    ),
};
