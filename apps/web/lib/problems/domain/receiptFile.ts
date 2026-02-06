import { problem } from "@/lib/problems/problem";

export const receiptFileProblems = {
  notFoundById: (id: string) =>
    problem(
      404,
      "/problems/receipt-file/not-found",
      "Receipt file not found",
      `No current receipt file exists with id ${id}`,
    ),
};
