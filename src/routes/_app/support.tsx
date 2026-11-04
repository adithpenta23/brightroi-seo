import { createFileRoute } from "@tanstack/react-router";
import { CopyButton } from "@/client/components/CopyButton";
import { PageHeader } from "@/client/components/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { SUPPORT_EMAIL } from "@/client/lib/support";
import { BRAND } from "@/shared/brand";

export const Route = createFileRoute("/_app/support")({
  component: SupportPage,
});

function SupportPage() {
  return (
    <div className="h-full overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            Help & Support
          </p>
          <PageHeader
            title={`Questions about ${BRAND.productName}?`}
            description={`Ask the ${BRAND.companyName} team about problems, access or ideas for the portal.`}
          />
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Email</h2>
              </CardTitle>
              <CardDescription>
                Send ideas, problems, questions, or feedback directly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CopyButton
                value={SUPPORT_EMAIL}
                label={SUPPORT_EMAIL}
                successMessage="Email copied to clipboard"
                size="sm"
              />
            </CardContent>
          </Card>

          <SupportLinkCard
            href={BRAND.contactUrl}
            title={BRAND.companyName}
            description={BRAND.tagline}
            cta={`Contact ${BRAND.companyName}`}
          />
        </div>
      </div>
    </div>
  );
}

function SupportLinkCard({
  href,
  title,
  description,
  cta,
}: {
  href: string;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="group block">
      <Card className="transition-colors group-hover:border-foreground/20">
        <CardHeader>
          <CardTitle>
            <h2>{title}</h2>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="font-medium">
          {cta} <span aria-hidden="true">&rarr;</span>
        </CardContent>
      </Card>
    </a>
  );
}
