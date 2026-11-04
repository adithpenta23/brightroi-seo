import { ImageResponse } from "takumi-js/response";
import { domainField } from "@/types/schemas/domain";
import logo from "../../../public/brand/logo-on-light.png?inline";
import { BRAND } from "@/shared/brand";

/** One template for all reports. Assets stay local; titles never go to an image service. */
export async function renderReportSocialImage(
  title: string,
  projectDomain?: string | null,
  projectName?: string,
): Promise<Response> {
  // Projects normally store a bare domain. Also handle older full URLs, and
  // omit missing/invalid websites rather than failing an otherwise valid card.
  const domain = domainField.safeParse(projectDomain);
  const response = new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        padding: 64,
        backgroundColor: "#f8fafc",
        color: "#0b1220",
      }}
    >
      <img src={logo} width={219} height={64} alt={BRAND.companyName} />
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
          paddingTop: 24,
        }}
      >
        {projectName ? (
          <div
            style={{
              fontSize: 32,
              fontWeight: 600,
              color: "#2563eb",
              marginBottom: 16,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {projectName}
          </div>
        ) : null}
        <div
          style={{
            fontSize: title.length > 85 ? 54 : title.length > 48 ? 64 : 80,
            fontWeight: 700,
            letterSpacing: -2,
            lineHeight: 1.12,
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </div>
      </div>
      {domain.success && (
        <div
          style={{
            position: "absolute",
            right: 64,
            bottom: 28,
            maxWidth: "80%",
            fontSize: 24,
            fontWeight: 400,
            color: "#475569",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {domain.data}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 12,
          backgroundColor: "#2563eb",
        }}
      />
    </div>,
    {
      width: 1200,
      height: 630,
      format: "png",
      // No title-dependent network calls for emoji assets.
      emoji: "from-font",
      headers: {
        // Like the share page, the image contains report content. Always check
        // access again rather than letting a revoked title live in our CDN.
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
  // Catch rendering failures before a 200 response has already been sent.
  await response.ready;
  return response;
}
