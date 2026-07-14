import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { ErrorBoundary } from "./design/ErrorBoundary";
import { PromptProvider } from "./design/Prompt";
import { ToastProvider } from "./design/Toast";
import "./index.css";
import { AppProvider } from "./lib/app-context";

const queryClient = new QueryClient({
  // retry once only, so a dead backend surfaces the error state in seconds.
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 5_000, retry: 1 } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary fullScreen>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppProvider>
            <ToastProvider>
              <PromptProvider>
                <App />
              </PromptProvider>
            </ToastProvider>
          </AppProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
