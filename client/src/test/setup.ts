import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// vitest.config.ts doesn't enable `test.globals`, so @testing-library/react's own automatic
// afterEach-cleanup (which relies on detecting global test-framework hooks) doesn't kick in —
// wire it up explicitly instead, so each test starts from an empty DOM.
afterEach(() => {
  cleanup();
});
