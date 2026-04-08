#!/usr/bin/env python3
"""
Screenshot helper for idea-mvp skill.
Takes an HTML file and generates a PNG screenshot at specified viewport size.

Usage:
    python3 screenshot.py <html_file> <output_png> [width] [height]

Examples:
    python3 screenshot.py home.html home.png 390 844      # iPhone 14
    python3 screenshot.py landing.html landing.png 1440 900  # Desktop
"""

import sys
import asyncio
from pathlib import Path


async def take_screenshot(html_path: str, output_path: str, width: int, height: int):
    from playwright.async_api import async_playwright

    html_path = str(Path(html_path).resolve())
    output_path = str(Path(output_path).resolve())

    # Ensure output directory exists
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(
            viewport={"width": width, "height": height},
            device_scale_factor=2,  # Retina quality
        )
        await page.goto(f"file://{html_path}")
        # Wait for fonts and rendering to settle
        await page.wait_for_timeout(500)
        await page.screenshot(path=output_path, full_page=True)
        await browser.close()

    print(f"Screenshot saved: {output_path} ({width}x{height} @2x, full page)")


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    html_file = sys.argv[1]
    output_png = sys.argv[2]
    width = int(sys.argv[3]) if len(sys.argv) > 3 else 390
    height = int(sys.argv[4]) if len(sys.argv) > 4 else 844

    if not Path(html_file).exists():
        print(f"Error: HTML file not found: {html_file}")
        sys.exit(1)

    asyncio.run(take_screenshot(html_file, output_png, width, height))


if __name__ == "__main__":
    main()
