#!/usr/bin/env python3
"""
Capture HTML slides as PNG screenshots using Playwright.

Usage:
    python3 capture_slides.py <carousel-directory> [--width 1080] [--height 1080]

Finds all slide-*.html files in the given directory, opens each in a headless
browser at the specified dimensions, and saves a matching .png file.
"""

import sys
import os
import glob
import argparse


def main():
    parser = argparse.ArgumentParser(description="Capture HTML slides as PNG screenshots")
    parser.add_argument("directory", help="Path to the carousel directory containing slide-*.html files")
    parser.add_argument("--width", type=int, default=1080, help="Viewport width (default: 1080)")
    parser.add_argument("--height", type=int, default=1080, help="Viewport height (default: 1080)")
    args = parser.parse_args()

    directory = os.path.abspath(args.directory)
    if not os.path.isdir(directory):
        print(f"Error: {directory} is not a directory")
        sys.exit(1)

    # Find all slide HTML files, sorted
    slides = sorted(glob.glob(os.path.join(directory, "slide-*.html")))
    if not slides:
        print(f"No slide-*.html files found in {directory}")
        sys.exit(1)

    print(f"Found {len(slides)} slides in {directory}")

    # Import playwright
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Playwright not installed. Installing...")
        os.system("pip3 install playwright --break-system-packages")
        os.system("python3 -m playwright install chromium")
        from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        for slide_path in slides:
            page = browser.new_page(viewport={"width": args.width, "height": args.height})
            file_url = f"file://{slide_path}"
            page.goto(file_url, wait_until="networkidle")
            page.wait_for_timeout(1000)  # Wait for fonts to load

            out_path = slide_path.replace(".html", ".png")
            page.screenshot(
                path=out_path,
                clip={"x": 0, "y": 0, "width": args.width, "height": args.height},
            )
            print(f"  ✓ {os.path.basename(out_path)}")
            page.close()

        browser.close()

    print(f"\nDone! {len(slides)} screenshots saved to {directory}")


if __name__ == "__main__":
    main()
