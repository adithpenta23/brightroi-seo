// BrightROI Portal branding. The product name, links and logo paths that
// people see come from here, so a rebrand or an upstream merge only has to
// settle this file. Logo files live in src/public/brand/ and are generated
// from brand-assets/; the favicons in src/public/ keep their upstream names.
export const BRAND = {
  productName: "BrightROI Portal",
  companyName: "BrightROI",
  tagline: "Get found. Get booked.",
  supportEmail: "adith@brightroi.co",
  websiteUrl: "https://brightroi.co",
  contactUrl: "https://brightroi.co/contact",
  /** Setup guides for this deployment (this repository's docs/ folder). */
  docsUrl: "https://github.com/adithpenta23/brightroi-seo/blob/main/docs",
  /** The site audit crawler's User-Agent product token. */
  crawlerName: "BrightROI-Audit",
  logo: {
    /** The square icon, gradient on transparent. */
    icon: "/brand/icon.svg",
    /** Icon and "BrightROI" wordmark, for light backgrounds. */
    fullOnLight: "/brand/logo-on-light.png",
    /** Icon and "BrightROI" wordmark, for dark backgrounds. */
    fullOnDark: "/brand/logo-on-dark.png",
    /** Shown when a shared report's own preview image cannot render. */
    socialCard: "/brand/social-card.png",
  },
} as const;
