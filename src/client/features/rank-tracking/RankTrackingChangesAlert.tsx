import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/client/components/ui/alert";

export function RankTrackingChangesAlert() {
  return (
    <Alert variant="info">
      <Info />
      <AlertDescription className="text-foreground">
        <p>
          <span className="font-medium">
            Rank tracking now retries some results.
          </span>{" "}
          Since September, Google has been serving incomplete results to all
          rank trackers.
        </p>
      </AlertDescription>
    </Alert>
  );
}
