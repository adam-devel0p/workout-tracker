import { expect, test } from "vitest";
import { cn } from "@/lib/utils";

test("vitest runs and resolves the @ alias", () => {
  expect(cn("p-2", "p-4")).toBe("p-4");
});
