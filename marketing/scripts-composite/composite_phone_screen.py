#!/usr/bin/env python3
"""
Composite a real app screenshot onto the black phone screen area in a
generated ad creative.

Workflow:
  1. Load the creative (black rectangle where the phone screen is).
  2. Auto-detect the 4 corners of the phone's *screen* (not its body) by
     thresholding near-pure-black pixels, eroding the mask to strip the
     bezel, and taking the rotated-rectangle extremes of the largest
     remaining component.
  3. Center-crop the source screenshot so its aspect matches the detected
     quad — no UI stretching.
  4. Perspective-warp with LANCZOS (supersampled) onto the quad.
  5. Build a feathered alpha mask so the composite edge blends into the
     surrounding titanium bezel from the original photo.
  6. Alpha-blend the warped screenshot onto the creative; then re-blend
     with the original's "screen" glass so rim highlights and reflections
     carry through onto the composited display.

Usage:
  python composite_phone_screen.py <creative.png> <screenshot.png> <output.png>
  python composite_phone_screen.py --batch config.json [--debug-dir dir]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage


# ----- Corner detection -------------------------------------------------------

def inset_quad(corners: np.ndarray, inset_px: float) -> np.ndarray:
    """Shrink a quadrilateral toward its centroid by inset_px pixels."""
    if inset_px == 0:
        return corners
    centroid = corners.mean(axis=0)
    out = np.empty_like(corners)
    for i, pt in enumerate(corners):
        direction = centroid - pt
        length = float(np.linalg.norm(direction))
        if length < 1e-6:
            out[i] = pt
            continue
        out[i] = pt + (direction / length) * inset_px
    return out


def detect_phone_screen_corners(
    creative: Image.Image,
    darkness_threshold: int = 10,
    min_area_ratio: float = 0.01,
    erode_px: int = 6,
) -> np.ndarray:
    """Find the 4 corners of the phone's black *screen* rectangle.

    Strategy:
      1. Threshold to near-pure-black pixels (darkness_threshold).
      2. Binary-erode by erode_px — this strips away thin dark bezel edges
         and shadows so the remaining region is the screen interior only.
      3. Pick the component whose bounding box is largest AND near the
         image center AND has a phone-screen aspect ratio (tall rectangle).
      4. Dilate back by erode_px to restore the original screen extent.
      5. Compute the 4 corners via (x+y, x-y) extremes.
    """
    gray = np.asarray(creative.convert("L"), dtype=np.uint8)
    h, w = gray.shape
    mask = gray < darkness_threshold

    # Erosion strips the bezel: the phone body often has a thin dark edge
    # from its metallic frame that leaks into the mask. A ~6px erosion
    # removes that and keeps only the true uniform-black screen interior.
    if erode_px > 0:
        eroded = ndimage.binary_erosion(mask, iterations=erode_px)
    else:
        eroded = mask

    labels, n = ndimage.label(eroded)
    if n == 0:
        raise RuntimeError(
            "No dark pixels found after erosion — adjust darkness_threshold "
            "or lower erode_px."
        )

    label_ids = np.arange(1, n + 1)
    areas = ndimage.sum(eroded, labels, index=label_ids).astype(np.int64)
    bboxes = ndimage.find_objects(labels)
    centers = ndimage.center_of_mass(eroded, labels, index=label_ids)

    cy, cx = h / 2.0, w / 2.0
    min_area = int((h * w) * min_area_ratio)
    diag = (h ** 2 + w ** 2) ** 0.5

    best_label = -1
    best_score = -1.0
    for i, label_id in enumerate(label_ids):
        area = int(areas[i])
        if area < min_area:
            continue
        comp_cy, comp_cx = centers[i]
        d_norm = (((comp_cy - cy) ** 2 + (comp_cx - cx) ** 2) ** 0.5) / diag
        y_slice, x_slice = bboxes[i]
        bbox_h = y_slice.stop - y_slice.start
        bbox_w = x_slice.stop - x_slice.start
        aspect = bbox_h / max(bbox_w, 1)
        # iPhone 15 Pro screen aspect is ~19.5:9 = 2.17; allow 1.6–2.6 after
        # tilt compensation.
        aspect_score = 1.0 if 1.6 < aspect < 2.6 else 0.3
        score = area * aspect_score * (1.0 - d_norm)
        if score > best_score:
            best_score = score
            best_label = int(label_id)

    if best_label < 0:
        raise RuntimeError("Could not find a phone-shaped dark region.")

    # Dilate the winning component back by the same amount so we recover
    # the true screen extent (the erosion was only for noise removal).
    winner_mask = labels == best_label
    if erode_px > 0:
        winner_mask = ndimage.binary_dilation(winner_mask, iterations=erode_px)

    ys, xs = np.where(winner_mask)
    pts = np.stack([xs.astype(np.float64), ys.astype(np.float64)], axis=1)
    return _min_rotated_rect(pts)


def _min_rotated_rect(pts: np.ndarray) -> np.ndarray:
    """Compute the minimum-area rotated bounding rectangle of a set of 2D
    points using the rotating-calipers approach on the convex hull.

    This gives the true 4 corners of a tilted rectangle (including its
    full extent), unlike the (x+y, x-y) extrema trick which understates
    the long axis for rotated rounded rectangles.

    Returns corners as (4, 2) in TL, TR, BR, BL order (clockwise starting
    from the corner with smallest (x + y)).
    """
    from scipy.spatial import ConvexHull

    hull = ConvexHull(pts)
    hull_pts = pts[hull.vertices]
    n = len(hull_pts)

    best_area = float("inf")
    best_rect: np.ndarray | None = None

    for i in range(n):
        p1 = hull_pts[i]
        p2 = hull_pts[(i + 1) % n]
        edge = p2 - p1
        edge_len = float(np.linalg.norm(edge))
        if edge_len < 1e-9:
            continue
        u = edge / edge_len  # along edge
        v = np.array([-u[1], u[0]], dtype=np.float64)  # perpendicular

        # Project all hull points onto (u, v).
        rel = hull_pts - p1
        proj_u = rel @ u
        proj_v = rel @ v
        u_min, u_max = float(proj_u.min()), float(proj_u.max())
        v_min, v_max = float(proj_v.min()), float(proj_v.max())
        area = (u_max - u_min) * (v_max - v_min)
        if area >= best_area:
            continue
        best_area = area
        # Build rectangle corners in (u, v) space, then rotate back.
        corners_uv = np.array(
            [
                [u_min, v_min],
                [u_max, v_min],
                [u_max, v_max],
                [u_min, v_max],
            ],
            dtype=np.float64,
        )
        # Transform each (u, v) back to world: p = p1 + u*u_hat + v*v_hat
        world = p1 + corners_uv[:, 0:1] * u + corners_uv[:, 1:2] * v
        best_rect = world

    if best_rect is None:
        raise RuntimeError("Minimum bounding rectangle computation failed.")

    # Order corners as TL, TR, BR, BL clockwise starting from the corner
    # with smallest (x + y) — the "visual top-left" of the quad.
    sum_xy = best_rect[:, 0] + best_rect[:, 1]
    start = int(np.argmin(sum_xy))
    ordered = np.roll(best_rect, -start, axis=0)
    # Check winding: if points go counter-clockwise, reverse.
    def cross(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    if cross(ordered[0], ordered[1], ordered[2]) < 0:
        # Counter-clockwise; reverse to clockwise.
        ordered = np.array([ordered[0], ordered[3], ordered[2], ordered[1]])
    return ordered


# ----- Aspect handling -------------------------------------------------------

# iPhone 15 Pro screen aspect (height / width) ≈ 19.5:9 = 2.167
IPHONE_SCREEN_ASPECT = 19.5 / 9.0


def quad_aspect(corners: np.ndarray) -> float:
    """Estimate the (height / width) aspect ratio of a tilted quadrilateral
    by averaging the lengths of its left/right and top/bottom edges."""
    tl, tr, br, bl = corners
    top = np.linalg.norm(tr - tl)
    bottom = np.linalg.norm(br - bl)
    left = np.linalg.norm(bl - tl)
    right = np.linalg.norm(br - tr)
    width = (top + bottom) / 2.0
    height = (left + right) / 2.0
    return float(height / max(width, 1e-6))


def constrain_quad_to_aspect(
    corners: np.ndarray, target_aspect: float
) -> np.ndarray:
    """Rebuild a 4-corner quad preserving the center, rotation, and width
    of the detected quad but forcing its (height / width) aspect to
    target_aspect. The rotation is computed from the phone's *body axis*
    (midpoint of top edge to midpoint of bottom edge), which is the
    correct "long axis" of a tilted phone — using the top edge alone
    gives a wrong angle when the phone has significant lean.
    """
    tl, tr, br, bl = corners
    center = corners.mean(axis=0)

    # Phone body axis runs from the midpoint of the top edge to the
    # midpoint of the bottom edge. This is the long axis of the screen.
    top_mid = (tl + tr) / 2.0
    bot_mid = (bl + br) / 2.0
    body_vec = bot_mid - top_mid
    body_len = float(np.linalg.norm(body_vec))
    if body_len < 1e-6:
        return corners
    # "Down" unit vector (along the body, from top toward bottom).
    down = body_vec / body_len
    # "Right" unit vector perpendicular to body, pointing to the right of
    # the phone. In screen coords (y increases downward), rotating `down`
    # 90° clockwise visually is (down.y, -down.x).
    right = np.array([down[1], -down[0]], dtype=np.float64)

    # Width: average of top and bottom edge lengths (the short-axis extent).
    top_len = float(np.linalg.norm(tr - tl))
    bottom_len = float(np.linalg.norm(br - bl))
    width = (top_len + bottom_len) / 2.0
    # Enforced height along the body axis from target aspect.
    height = width * target_aspect
    half_w, half_h = width / 2.0, height / 2.0

    # Build corners in body-axis frame: body_top = center - down*half_h,
    # body_bot = center + down*half_h, offset by ±right*half_w.
    body_top_center = center - down * half_h
    body_bot_center = center + down * half_h
    new_tl = body_top_center - right * half_w
    new_tr = body_top_center + right * half_w
    new_br = body_bot_center + right * half_w
    new_bl = body_bot_center - right * half_w
    return np.array([new_tl, new_tr, new_br, new_bl], dtype=np.float64)


# ----- Perspective warp -------------------------------------------------------

def _perspective_coefficients(
    src_corners: np.ndarray, dst_corners: np.ndarray
) -> tuple[float, ...]:
    """Solve PIL's 8-coefficient perspective transform (dst -> src mapping)."""
    matrix = []
    for (dx, dy), (sx, sy) in zip(dst_corners, src_corners):
        matrix.append([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy])
        matrix.append([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy])
    A = np.array(matrix, dtype=np.float64)
    B = np.array(src_corners, dtype=np.float64).reshape(8)
    return tuple(np.linalg.solve(A, B))


def warp_screenshot_onto_corners(
    screenshot: Image.Image,
    dst_corners: np.ndarray,
    canvas_size: tuple[int, int],
    supersample: int = 2,
) -> Image.Image:
    """Warp the screenshot so its 4 corners map to dst_corners.

    Uses LANCZOS supersampling: render at NxN the final resolution with
    BICUBIC, then downsample with LANCZOS. This is measurably crisper
    than a single BICUBIC pass on the destination size.
    """
    sw, sh = screenshot.size
    src_corners = np.array(
        [[0, 0], [sw - 1, 0], [sw - 1, sh - 1], [0, sh - 1]], dtype=np.float64
    )

    if supersample <= 1:
        coeffs = _perspective_coefficients(src_corners, dst_corners)
        return screenshot.convert("RGBA").transform(
            canvas_size,
            Image.Transform.PERSPECTIVE,
            coeffs,
            resample=Image.Resampling.BICUBIC,
        )

    # Supersampled path: render on a 2x canvas, then LANCZOS down.
    big_canvas = (canvas_size[0] * supersample, canvas_size[1] * supersample)
    big_dst = dst_corners * supersample
    coeffs = _perspective_coefficients(src_corners, big_dst)
    big = screenshot.convert("RGBA").transform(
        big_canvas,
        Image.Transform.PERSPECTIVE,
        coeffs,
        resample=Image.Resampling.BICUBIC,
    )
    return big.resize(canvas_size, Image.Resampling.LANCZOS)


# ----- Compositing ------------------------------------------------------------

def build_screen_mask(
    corners: np.ndarray,
    size: tuple[int, int],
    feather_px: float = 2.5,
) -> Image.Image:
    """White-inside polygon mask with a Gaussian feather at the edges so
    the composite blends into the bezel instead of hard-cutting."""
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    pts = [(float(x), float(y)) for x, y in corners]
    draw.polygon(pts, fill=255)
    if feather_px > 0:
        mask = mask.filter(ImageFilter.GaussianBlur(radius=feather_px))
    return mask


def blend_rim_highlights(
    result: Image.Image,
    original_creative: Image.Image,
    mask: Image.Image,
    strength: float = 0.35,
) -> Image.Image:
    """Blend the original creative's pixels back on top of the composite
    inside the screen region using 'lighten' compositing — this picks up
    any rim light, reflection, or glass sheen that the black screen had
    and carries it onto the composited screenshot, killing the pasted-on
    look."""
    if strength <= 0:
        return result
    # Extract the original's screen region (it was mostly black, but the
    # edges carried rim-light spill from the titanium frame).
    orig_rgba = original_creative.convert("RGBA")
    result_rgba = result.convert("RGBA")

    # Lighten blend: max(original, result) per channel — any pixel in the
    # original that was brighter than pure black (i.e. the rim) shows
    # through.
    orig_np = np.asarray(orig_rgba, dtype=np.uint8)
    result_np = np.asarray(result_rgba, dtype=np.uint8)
    lighten = np.maximum(orig_np, result_np)

    # Mix lighten back into result by `strength`, limited to the screen
    # mask area (outside the mask the result already equals the original).
    mask_np = np.asarray(mask, dtype=np.float32) / 255.0
    blend_weight = (mask_np * strength)[..., None]  # (H, W, 1)
    blended = result_np.astype(np.float32) * (1 - blend_weight) + lighten.astype(
        np.float32
    ) * blend_weight
    return Image.fromarray(blended.clip(0, 255).astype(np.uint8), mode="RGBA")


def composite(
    creative_path: Path,
    screenshot_path: Path,
    output_path: Path,
    debug_path: Path | None = None,
    inset: float = 0.0,
    darkness_threshold: int = 10,
    min_area_ratio: float = 0.01,
    erode_px: int = 6,
    feather_px: float = 2.5,
    rim_light_strength: float = 0.35,
    supersample: int = 2,
    manual_corners: list[list[float]] | None = None,
) -> None:
    creative = Image.open(creative_path).convert("RGBA")
    screenshot_full = Image.open(screenshot_path).convert("RGBA")

    if manual_corners is not None:
        corners = np.array(manual_corners, dtype=np.float64)
        if corners.shape != (4, 2):
            raise ValueError("manual_corners must be a 4x2 array (TL, TR, BR, BL)")
    else:
        corners = detect_phone_screen_corners(
            creative,
            darkness_threshold=darkness_threshold,
            min_area_ratio=min_area_ratio,
            erode_px=erode_px,
        )
    if inset != 0.0:
        corners = inset_quad(corners, inset)

    # Trust detection completely. Gemini-generated phones have variable
    # aspect (1.8–2.6 in our set) and forcing iPhone's 2.17 either
    # overshoots or undershoots the real screen bounds. The slight
    # vertical stretch from fitting a 1.925-aspect screenshot into a
    # detected quad is the lesser evil compared to visible black gaps
    # at the screen edges.
    detected_aspect = quad_aspect(corners)
    print(f"  aspect: detected={detected_aspect:.3f} (using as-is)")
    screenshot = screenshot_full

    warped = warp_screenshot_onto_corners(
        screenshot, corners, creative.size, supersample=supersample
    )
    mask = build_screen_mask(corners, creative.size, feather_px=feather_px)

    result = creative.copy()
    result.paste(warped, (0, 0), mask)
    result = blend_rim_highlights(result, creative, mask, strength=rim_light_strength)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.convert("RGB").save(output_path, "PNG", optimize=True)
    print(f"  -> {output_path}")

    if debug_path is not None:
        debug = creative.copy()
        d = ImageDraw.Draw(debug)
        pts = [(float(x), float(y)) for x, y in corners]
        d.polygon(pts, outline=(255, 0, 255, 255), width=6)
        for i, (x, y) in enumerate(pts):
            d.ellipse((x - 12, y - 12, x + 12, y + 12), outline=(255, 255, 0), width=4)
            d.text((x + 16, y + 16), ["TL", "TR", "BR", "BL"][i], fill=(255, 255, 0))
        debug.convert("RGB").save(debug_path, "PNG")
        print(f"  debug: {debug_path}")


# ----- CLI --------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.strip())
    parser.add_argument("creative", nargs="?", help="Path to the creative PNG")
    parser.add_argument("screenshot", nargs="?", help="Path to the app screenshot PNG")
    parser.add_argument("output", nargs="?", help="Path to write the composited PNG")
    parser.add_argument("--batch", help="Path to a JSON config file (list of jobs)")
    parser.add_argument("--debug", help="Optional path to write a debug overlay PNG")
    parser.add_argument("--inset", type=float, default=0.0)
    parser.add_argument("--erode", type=int, default=6)
    parser.add_argument("--feather", type=float, default=2.5)
    parser.add_argument("--rim-strength", type=float, default=0.35)
    parser.add_argument("--no-supersample", action="store_true")
    args = parser.parse_args()

    supersample = 1 if args.no_supersample else 2

    if args.batch:
        config = json.loads(Path(args.batch).read_text())
        failures = []
        for i, job in enumerate(config, 1):
            print(f"[{i}/{len(config)}] {Path(job['creative']).name}")
            try:
                composite(
                    Path(job["creative"]),
                    Path(job["screenshot"]),
                    Path(job["output"]),
                    debug_path=Path(job["debug"]) if job.get("debug") else None,
                    inset=float(job.get("inset", args.inset)),
                    darkness_threshold=int(job.get("darkness_threshold", 10)),
                    min_area_ratio=float(job.get("min_area_ratio", 0.01)),
                    erode_px=int(job.get("erode", args.erode)),
                    feather_px=float(job.get("feather", args.feather)),
                    rim_light_strength=float(
                        job.get("rim_strength", args.rim_strength)
                    ),
                    supersample=supersample,
                    manual_corners=job.get("corners"),
                )
            except Exception as e:  # noqa: BLE001
                print(f"  ! FAILED: {e}")
                failures.append(job["creative"])
        if failures:
            print(f"\n{len(failures)} failed:")
            for f in failures:
                print(f"  - {f}")
            return 1
        return 0

    if not (args.creative and args.screenshot and args.output):
        parser.error("Provide creative, screenshot, and output — or use --batch.")
    print(f"[1/1] {Path(args.creative).name}")
    composite(
        Path(args.creative),
        Path(args.screenshot),
        Path(args.output),
        debug_path=Path(args.debug) if args.debug else None,
        inset=args.inset,
        erode_px=args.erode,
        feather_px=args.feather,
        rim_light_strength=args.rim_strength,
        supersample=supersample,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
