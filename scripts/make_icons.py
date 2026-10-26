#!/usr/bin/env python3
"""Renders the extension icons (orange rounded square + white upvote triangle).

No dependencies: rasterises with 4x4 supersampling and writes PNGs with zlib.
Usage: python3 scripts/make_icons.py
"""
import os
import struct
import zlib

ACCENT = (255, 102, 0)
OUT = os.path.join(os.path.dirname(__file__), "..", "icons")


def inside_rounded_rect(x, y, x0, y0, x1, y1, r):
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def inside_triangle(x, y, a, b, c):
    def sign(p, q, r):
        return (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1])

    d1, d2, d3 = sign((x, y), a, b), sign((x, y), b, c), sign((x, y), c, a)
    neg = d1 < 0 or d2 < 0 or d3 < 0
    pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (neg and pos)


def render(size):
    ss = 4
    # Geometry in a 24-unit space, matching the SVG logo used in the UI.
    tri = ((12, 6.5), (17.5, 15), (6.5, 15))
    rows = []
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            bg = fg = 0
            for sy in range(ss):
                for sx in range(ss):
                    x = (px + (sx + 0.5) / ss) * 24 / size
                    y = (py + (sy + 0.5) / ss) * 24 / size
                    if inside_rounded_rect(x, y, 1, 1, 23, 23, 6):
                        bg += 1
                        if inside_triangle(x, y, *tri):
                            fg += 1
            n = ss * ss
            alpha = bg / n
            if bg:
                t = fg / bg
                rgb = [round(ACCENT[i] * (1 - t) + 255 * t) for i in range(3)]
            else:
                rgb = [0, 0, 0]
            row += bytes(rgb + [round(alpha * 255)])
        rows.append(bytes(row))
    return b"".join(rows)


def png(size, raw):
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for size in (16, 32, 48, 128):
        with open(os.path.join(OUT, f"icon-{size}.png"), "wb") as f:
            f.write(png(size, render(size)))
        print(f"icons/icon-{size}.png")
