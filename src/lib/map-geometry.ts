/**
 * The geometry /map needs beyond the building itself: one frame for both
 * floors, and each floor's zone boundaries drawn once.
 *
 * Data-free on purpose, like lib/day-status.ts - it takes walls and polygons
 * as arguments and imports nothing from data/, so plain Node can test it
 * without resolving the extensionless imports the data modules use.
 */
import { points, extents, type Pt } from './floorplan-frame.ts';

export type Layer = 'exterior' | 'interior' | 'stairs';
export type Walls = { d: Record<Layer, string> };

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Where each floor's exterior starts, so both can be registered on one top
 * edge. The drawing stacks the floors with `offsetY`; the viewer shows one at
 * a time in a shared frame, and the walls line up when switching only if the
 * floors are aligned on something. The north wall is the something: the two
 * buildings share it, and their east walls already agree in x.
 *
 *   ALIGN[f] = top(base) - top(f)
 *
 * For this building that is 0 upstairs and -349.4 downstairs.
 */
export function alignOf<F extends string>(building: Record<F, Walls>, base: F): Record<F, number> {
  const top = (f: F) => Math.min(...points(building[f].d.exterior).map((p) => p.y));
  const out = {} as Record<F, number>;
  for (const f of Object.keys(building) as F[]) out[f] = r2(top(base) - top(f));
  return out;
}

/**
 * One viewBox for every floor: the union of their aligned wall boxes, padded
 * 12 left and right, 3 on top (so the top wall's outer edge meets the top of
 * the side rail) and 12 below.
 */
export function sharedFrame<F extends string>(building: Record<F, Walls>, align: Record<F, number>): string {
  const boxes = (Object.keys(building) as F[]).map((f) =>
    extents([building[f].d.exterior, building[f].d.interior, building[f].d.stairs], align[f]),
  );
  const x0 = Math.min(...boxes.map((b) => b.x0)) - 12;
  const x1 = Math.max(...boxes.map((b) => b.x1)) + 12;
  const y0 = Math.min(...boxes.map((b) => b.y0)) - 3;
  const y1 = Math.max(...boxes.map((b) => b.y1)) + 12;
  return `${r2(x0)} ${r2(y0)} ${r2(x1 - x0)} ${r2(y1 - y0)}`;
}

/**
 * Every zone edge, drawn once.
 *
 * Zones used to stroke their own outlines, and where two zones share an edge
 * the two dashed strokes sat on top of each other out of phase - a solid-ish
 * line with a stutter in it. So the edges are collected across all the named
 * zones on a floor, grouped by the LINE they lie on, merged where they
 * overlap, and emitted as one path.
 *
 * A line's key is its unit direction (sign made canonical, so an edge drawn
 * right-to-left matches one drawn left-to-right) and its perpendicular offset
 * from the origin, rounded to 0.1. Along that line each edge is an interval;
 * intervals within 0.5 of each other merge - so a shared edge is drawn once,
 * and two zones' collinear top edges become one longer segment, which is the
 * same ink with one fewer dash restart. A 1-unit gap stays two segments.
 */
export function zoneEdges(polygons: readonly (readonly Pt[])[]): string {
  const lines = new Map<string, { dx: number; dy: number; c: number; iv: [number, number][] }>();
  for (const poly of polygons) {
    poly.forEach((p, i) => {
      const q = poly[(i + 1) % poly.length];
      let dx = q[0] - p[0];
      let dy = q[1] - p[1];
      const len = Math.hypot(dx, dy);
      if (len < 0.01) return;
      dx /= len;
      dy /= len;
      if (dx < -1e-6 || (Math.abs(dx) < 1e-6 && dy < 0)) {
        dx = -dx;
        dy = -dy;
      }
      // `+ 0` folds a -0 into 0, or two keys would print "-0.0" and "0.0".
      const c = -dy * p[0] + dx * p[1] + 0;
      const t0 = dx * p[0] + dy * p[1];
      const t1 = dx * q[0] + dy * q[1];
      const key = `${dx.toFixed(3)},${dy.toFixed(3)},${c.toFixed(1)}`;
      if (!lines.has(key)) lines.set(key, { dx, dy, c, iv: [] });
      lines.get(key)!.iv.push([Math.min(t0, t1), Math.max(t0, t1)]);
    });
  }
  const out: string[] = [];
  for (const { dx, dy, c, iv } of lines.values()) {
    iv.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const v of iv) {
      const last = merged[merged.length - 1];
      if (last && v[0] <= last[1] + 0.5) last[1] = Math.max(last[1], v[1]);
      else merged.push([v[0], v[1]]);
    }
    for (const [a, b] of merged) {
      out.push(`M${r2(dx * a - dy * c)} ${r2(dy * a + dx * c)} L${r2(dx * b - dy * c)} ${r2(dy * b + dx * c)}`);
    }
  }
  return out.join(' ');
}
