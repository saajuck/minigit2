import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./design-system/tokens.css";
import "./index.css";

// Git-backed reads never fail transiently the way a flaky public API might — a failed request
// means a bad ref/path, and retrying it with the default 3-attempt backoff just delays the error
// toast for no benefit. staleTime is left at the default (0) globally; individual queries for
// immutable data (a commit's diff, patch, blame — content that can never change once a hash
// exists) opt into a long staleTime themselves, right next to their queryFn.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
