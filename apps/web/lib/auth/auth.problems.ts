import { problem } from "@/lib/problems/problems";

export const AuthProblems = {
  unauthenticated: () =>
    problem(
      401,
      "auth/unauthenticated",
      "Authentication required",
      "You must be signed in to access this resource"
    ),

  unauthorized: () =>
    problem(
      403,
      "auth/unauthorized",
      "Unauthorized",
      "You do not have permission to perform this action"
    ),

  banned: () =>
    problem(
      403,
      "auth/banned",
      "Account banned",
      "Your account is currently banned"
    ),
};
