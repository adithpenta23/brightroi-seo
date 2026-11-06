import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PlugZap } from "lucide-react";
import { PageHeader } from "@/client/components/PageHeader";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/client/components/ui/alert";
import { dataforseoHelpLinkOptions } from "@/client/navigation/items";
import { getSeoApiKeyStatus } from "@/serverFunctions/config";
import { DATAFORSEO_NOT_CONNECTED_MESSAGE } from "@/shared/dataforseo-connection";

// BrightROI: each DataForSEO-powered section says the key is missing in one
// place, in place of the app-wide pop-up and banner (see AppShell.tsx).

/** False once the server says DATAFORSEO_API_KEY is empty; null while unknown. */
export function useDataforseoConnected(): boolean | null {
  // Same key as the app shell's check, so one request serves both.
  const query = useQuery({
    queryKey: ["seoApiKeyStatus"],
    queryFn: () => getSeoApiKeyStatus(),
  });
  return query.data?.configured ?? null;
}

function DataforseoNotice() {
  return (
    <Alert variant="warning">
      <PlugZap />
      <AlertTitle>{DATAFORSEO_NOT_CONNECTED_MESSAGE}</AlertTitle>
      <AlertDescription>
        <Link
          {...dataforseoHelpLinkOptions}
          className="font-medium underline underline-offset-4"
        >
          How to add the key
        </Link>
      </AlertDescription>
    </Alert>
  );
}

/** The notice, only while DataForSEO isn't connected. */
export function MissingDataforseoNotice() {
  return useDataforseoConnected() === false ? <DataforseoNotice /> : null;
}

/**
 * While DataForSEO isn't connected, shows the notice instead of `children`, so
 * a search that could only fail is never offered. `keepContent` shows it above
 * them instead, for pages that also list data already saved (rank history,
 * local grids). `title` gives a replaced full page its heading back.
 */
export function DataforseoGate({
  children,
  keepContent = false,
  title,
}: {
  children: ReactNode;
  keepContent?: boolean;
  title?: string;
}) {
  const connected = useDataforseoConnected();
  if (connected !== false) return children;
  if (keepContent) {
    return (
      <>
        <DataforseoNotice />
        {children}
      </>
    );
  }
  return (
    <div className="px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        {title ? <PageHeader title={title} /> : null}
        <DataforseoNotice />
      </div>
    </div>
  );
}
