"""Regenerate BrightROI Portal favicons, logos and the fallback social card.

Reads the logo files in brand-assets/ and writes:
  src/public/favicon*.png, favicon.ico          browser tab icons
  src/public/apple-touch-icon.png,
  src/public/android-chrome-*.png               home-screen icons (navy tile)
  src/public/brand/icon.svg, icon-192.png       the icon, for the app and report cards
  src/public/brand/logo-on-light.png,
  src/public/brand/logo-on-dark.png             icon + wordmark
  src/public/brand/social-card.png              link preview fallback

Needs Python 3 and Pillow (pip install pillow). Run from the repository root:
  python scripts/brightroi/make_brand_images.py
"""

import os
import shutil

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ASSETS = os.path.join(ROOT, "brand-assets")
PUBLIC = os.path.join(ROOT, "src", "public")
BRAND = os.path.join(PUBLIC, "brand")
NAVY = (7, 19, 41, 255)
MIST = (169, 184, 208, 255)
GRADIENT = [(37, 99, 235), (8, 123, 255), (6, 182, 212), (139, 92, 246)]
GRADIENT_STOPS = [0, 0.4, 0.72, 1]
TAGLINE = "Get found. Get booked."


def trimmed(name):
    image = Image.open(os.path.join(ASSETS, name)).convert("RGBA")
    return image.crop(image.getchannel("A").getbbox())


def square(image, pad):
    side = int(max(image.size) * (1 + 2 * pad))
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    out.alpha_composite(image, ((side - image.width) // 2, (side - image.height) // 2))
    return out


def on_tile(icon, size):
    out = Image.new("RGBA", (size, size), NAVY)
    out.alpha_composite(icon.resize((size, size), Image.LANCZOS))
    return out


def gradient_color(t):
    i = max(k for k in range(3) if GRADIENT_STOPS[k] <= t)
    f = (t - GRADIENT_STOPS[i]) / (GRADIENT_STOPS[i + 1] - GRADIENT_STOPS[i])
    return tuple(round(GRADIENT[i][j] + (GRADIENT[i + 1][j] - GRADIENT[i][j]) * f) for j in range(3))


def social_card():
    card = Image.new("RGBA", (1200, 630), NAVY)
    logo = trimmed("BrightROI_Full_DarkBackground.png")
    width = 640
    logo = logo.resize((width, round(logo.height * width / logo.width)), Image.LANCZOS)
    card.alpha_composite(logo, ((1200 - width) // 2, 200))
    draw = ImageDraw.Draw(card)
    font = ImageFont.truetype(os.path.join(BRAND, "fonts", "inter-latin-wght-normal.woff2"), 44)
    font.set_variation_by_axes([600])
    text_width = draw.textlength(TAGLINE, font=font)
    draw.text(((1200 - text_width) / 2, 200 + logo.height + 48), TAGLINE, font=font, fill=MIST)
    for x in range(1200):
        draw.line([(x, 618), (x, 629)], fill=gradient_color(x / 1199) + (255,))
    card.convert("RGB").save(os.path.join(BRAND, "social-card.png"), optimize=True)


def main():
    os.makedirs(BRAND, exist_ok=True)
    icon = trimmed("BrightROI_Icon_Gradient.png")
    tight = square(icon, 0.02)
    roomy = square(icon, 0.16)

    for size, name in [(16, "favicon-16x16.png"), (32, "favicon-32x32.png"), (32, "favicon.png")]:
        tight.resize((size, size), Image.LANCZOS).save(os.path.join(PUBLIC, name), optimize=True)
    tight.resize((256, 256), Image.LANCZOS).save(
        os.path.join(PUBLIC, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)]
    )
    for size, name in [
        (180, "apple-touch-icon.png"),
        (192, "android-chrome-192x192.png"),
        (512, "android-chrome-512x512.png"),
    ]:
        on_tile(roomy, size).save(os.path.join(PUBLIC, name), optimize=True)

    shutil.copyfile(os.path.join(ASSETS, "BrightROI_Icon_Gradient.svg"), os.path.join(BRAND, "icon.svg"))
    tight.resize((192, 192), Image.LANCZOS).save(os.path.join(BRAND, "icon-192.png"), optimize=True)
    for source, target in [
        ("BrightROI_Full_LightBackground.png", "logo-on-light.png"),
        ("BrightROI_Full_DarkBackground.png", "logo-on-dark.png"),
    ]:
        logo = trimmed(source)
        height = 160
        logo = logo.resize((round(logo.width * height / logo.height), height), Image.LANCZOS)
        logo.save(os.path.join(BRAND, target), optimize=True)

    social_card()
    print("Brand images written to src/public and src/public/brand.")


if __name__ == "__main__":
    main()
