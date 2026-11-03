# Brand assets

Source files for the BrightROI Portal branding. The app does not read this
folder directly; the branding work copies what it needs into `public/` and
generates favicons from the logo.

Put these here:

- **Logo, full version** (icon + wordmark): `logo.svg` if you have it, plus a
  PNG at least 1024px wide.
- **Logo, square icon only**: `logo-mark.svg` or a square PNG at least
  512 x 512. Favicons and app icons are generated from this.
- **Light-on-dark versions** of the above, if you have them, for the dark
  theme.
- **Brand guide**: PDF or a short text file with the colour hex codes, font
  names and any usage rules.

This repository is public. Anything committed in this folder is visible to
anyone. The logo ends up on the public app anyway, but if the brand guide
should stay private, keep it out of git.
