/**
 * The building: AUTHORED, and the source of truth.
 *
 * This file used to be generated from src/data/floorplan.svg, with the drawing
 * upstream of it and `npm run floorplan` in between. That reversed on
 * 2026-10-10. Nothing generates this now - it is edited directly, by hand or by
 * a tool, and the SVG is something this produces rather than something it reads.
 *
 * WHY IT FLIPPED. The page always rendered from this data, never from the
 * drawing, so the SVG was only ever an input. Keeping it upstream cost two
 * things that both went away with the flip:
 *
 *   a regeneration step   Edit the drawing, forget to re-run the extractor, and
 *                         the site silently shows the old building. Nothing
 *                         checked for it.
 *   a list of hazards     CLAUDE.md carried nine entries warning that the next
 *                         export from the design tool would silently destroy
 *                         them - because the SVG was both the source of truth
 *                         AND a tool's output. There is no such list now. A
 *                         change here is a change, full stop.
 *
 * It also suits where the editing is going: a web UI or an agent can write a
 * data file, and cannot meaningfully write a hand-drawn SVG.
 *
 * EVERYTHING NAMED IS A ZONE, as of 2026-10-11. A room is an unnamed container:
 * a walled shape that groups zones and carries the fill behind them. Every
 * space with a name - the Kitchen, the Compressor Room, a hallway nobody names
 * - is a zone, coded `<room>.<n>`. A room that used to carry one name now holds
 * one zone of the same shape, `.1`; a room that already held a zone gained a
 * second for what was left of it (U5.2 Woodshop 2 is the room minus the Wood
 * CNC corner). Zones never overlap. The old container names - Garage, Upper
 * Commons, Fab Lab, Lower Commons, TBD - are gone with the level that held
 * them: a room holding two disciplines was never either of them, and a name on
 * it said something about neither.
 *
 * WHAT IS NOT HERE. `outline` and `viewBox` are DERIVED - see
 * lib/floorplan-frame.ts. A value that can be worked out from the walls must
 * never be a row somebody keeps in step by hand.
 *
 * REDRAWING THE BUILDING is still possible and is now a deliberate one-off:
 * scripts/read-floorplan.mjs reads an SVG and prints this file's authored half.
 * It OVERWRITES what is here, so it is for starting again rather than for
 * routine edits. scripts/export-floorplan.mjs goes the other way.
 *
 * The three wall layers are the drawing's own, and so are their weights: the
 * outside of the building, the partitions inside it, and the stairs, which are
 * drawn lightest because they are a thing you walk on rather than a thing you
 * cannot walk through. Doorways are pen-ups in the path data - the absence IS
 * the door, which is also how the building works.
 */
import { outline, extents, frames, type Pt } from '../lib/floorplan-frame.ts';

export type { Pt };
export type Floor = 'upstairs' | 'downstairs';
export type Layer = 'exterior' | 'interior' | 'stairs';

/** Stroke weights, in the drawing's own units, exactly as it sets them. */
export const STROKE: Record<Layer, number> = {
  exterior: 6,
  interior: 3,
  stairs: 1.5,
};

/**
 * A room: a walled shape, and nothing else. It has no name, no label and no
 * hover; it exists to group the zones inside it and to carry the access fill
 * behind them. Kept as its own row rather than folded into the zones so that
 * more zones can be nested in it later.
 *
 * The fill is the author's own colour-coding from the drawing - a map-colouring,
 * so adjacent rooms differ and nothing can be read off the colour itself. The
 * page never paints it; the exporter writes it so the SVG opens legibly in a
 * design tool.
 */
export type Room = {
  id: string;
  fill: string | null;
  points: Pt[];
};

/**
 * A zone: a named area inside a room. "Laser Cutting" within U15, "Wood CNC"
 * within U5, or the whole of U2 as U2.1 Compressor Room. No wall divides a zone
 * from its siblings, and that is exactly what makes it a zone rather than a
 * room.
 *
 * `name` is null for the ten hallways, staircases and the landing. They have no
 * label, no hover and no tooltip, and `lines` is empty.
 *
 * THE LABEL IS AUTHORED, ALL OF IT. `at` is the CENTRE of the label block - not
 * the first baseline, which is what it was until 2026-10-11 - and `lines` are
 * the breaks that fit this zone's own width at this `size`. Sixteen anchors
 * were placed by hand in the design handoff; the rest are the centre of a
 * rectangular zone, or the drawing's own anchor where the shape is not one.
 * The lines were wrapped once, by the handoff's rule (greedy by character
 * count, never leaving a last line of one or two characters), and written
 * down. Recomputing either at render would be guessing at a decision somebody
 * made with the plan in front of them.
 *
 * `size` is the label's own: 9.2 for a bold label, 7 for a quiet one, and two
 * closets smaller still because that is all the room they have. Which style a
 * zone takes is a rendering rule - see lib/map-plan.ts - but the size has to
 * sit beside the lines that were wrapped at it.
 *
 * `rotate` turns the whole label about `at`. One zone uses it: U3.1 Jewelry is
 * a tall slot a third of the width of its room, so its name runs up the wall
 * at -90 rather than shrinking to fit across it.
 */
export type Zone = {
  id: string;
  name: string | null;
  room: string;
  lines: string[];
  at: Pt;
  size: number;
  rotate?: number;
  points: Pt[];
};

/**
 * A way in, named from OUTSIDE the building.
 *
 * Not a room and not a zone: no shape, no studio, nothing in the review list.
 * It is a name with a position, which is all it has in common with a zone
 * label - and the reason it lives here rather than in map.astro, since the
 * position of everything on this plan is stated in one place.
 *
 * Both sit outside the walls, which is the whole point. "Member Entrance" is
 * below the upstairs south wall, beside the arrow through the doorway that is
 * the pen-up between x=333.5 and x=360.9 - hence `anchor: 'start'`, so the
 * words hang off the arrow's tail rather than straddling it. "Main Entrance" is
 * inside the recessed porch downstairs - the triangular notch bitten out of
 * the east wall. That notch is outside the floorplate, which is checkable
 * rather than a figure of speech: isPointInFill on the plate is false there.
 *
 * THE ARROW RUNS FROM OUTSIDE TO IN, tail first, head inside the building, and
 * it must pass through the doorway rather than near it. Both were checked with
 * isPointInStroke rather than placed by eye: there is exactly ONE door at each
 * entrance, and at the porch it is the LOWER diagonal face - the upper one is
 * solid wall for its whole length.
 *
 *   member   straight north through the gap at x=333.5-360.9, y=340
 *   main     north-west across the lower diagonal, along x+y=1275, which is
 *            perpendicular to that face and crosses it at (820.5, 454.5) - the
 *            doorway's own midpoint
 *
 * The member label sits BELOW the upstairs frame (y=357.4 against a viewBox
 * that ends at 353.9). That is deliberate: it is centred in the band between
 * the wall's outer face and the plate's edge, and the plan's svg is
 * `overflow: visible` to let it.
 */
export type Entrance = {
  id: string;
  lines: string[];
  at: Pt;
  size: number;
  /** Left off for `middle`. */
  anchor?: 'start';
  /** [tail, head] - tail outside the building, head inside it. */
  arrow: readonly [Pt, Pt];
};

/** What each floor states about itself. Everything else is worked out. */
export type FloorRows = {
  /** The drawing stacks the floors; this is the second one's own shift. */
  offsetY: number;
  d: Record<Layer, string>;
  rooms: Room[];
  zones: Zone[];
  entrances: Entrance[];
};

export type FloorPlan = FloorRows & {
  /** The floorplate, with the doorways closed up, for the fill underneath. */
  outline: Pt[];
  /** Both floors share a width and a height, so they render at one scale. */
  viewBox: string;
};

export const FLOORS: Floor[] = ['upstairs', 'downstairs'];

export const BUILDING: Record<Floor, FloorRows> = {
  upstairs: {
    offsetY: 0,
    d: {
      exterior: "M333.5 340 H285 M187 340 H181 V29.6 H854.7 V340 H360.9",
      interior: "M181 190.3 H239 M290 29.6 V198.3 M290 216.7 V340 M290 244.9 H320.3 V315.6 M320.3 334 V340 M290 96.5 H319.8 M338.2 96.5 H394.2 M394.2 29.6 V205 H336 M375.6 252.2 H394.2 V312.9 M320.3 301 H326 M344.4 301 H394.2 M394.2 312.9 H759.3 M442.2 181.8 H627.7 M442.2 169 V186 M394.2 177 H411.5 M411.5 168 V185.3 M548.1 29.6 V132.3 M548.1 150.7 V212.3 M548.1 230.7 V269.3 M548.1 287.7 V312.9 M548.1 83.5 H579.8 M598.2 83.5 H627.7 M627.7 29.6 V87.5 M627.7 109.3 V242 M548.1 113.3 H627.7 M548.1 242 H627.7 M627.7 155 H677.15 M627.7 198.3 H677.15 M674 155 V158.6 M674 177 V198.3 M695.55 155 H749.45 M742.3 155 V207 M695.55 198.3 H742.3 M698.7 155 V158.6 M698.7 177 V198.3 M742.3 225.4 V233.4 H762.7 M759.3 233.4 V312.9 M767.85 155 H854.7 M791.6 180.2 V199.55 M791.6 217.95 V233.4 M791.6 180.2 H829.5 V233.4 M781.1 233.4 H854.7",
      stairs: "M290 245 H320.3 V314 H290 Z M290 251.3 H320.3 M290 257.6 H320.3 M290 263.9 H320.3 M290 270.2 H320.3 M290 276.5 H320.3 M290 282.8 H320.3 M290 289.1 H320.3 M290 295.4 H320.3 M290 301.7 H320.3 M290 308 H320.3 M791.6 155 H829.5 V180.2 H791.6 Z M797.9 155 V180.2 M804.2 155 V180.2 M810.5 155 V180.2 M816.8 155 V180.2 M823.1 155 V180.2 M829.5 180.2 H854.7 V233.4 H829.5 Z M829.5 186.5 H854.7 M829.5 192.8 H854.7 M829.5 199.1 H854.7 M829.5 205.4 H854.7 M829.5 211.7 H854.7 M829.5 218 H854.7 M829.5 224.3 H854.7 M829.5 230.6 H854.7",
    },
    rooms: [
      { id: "U1", fill: "#a9c4b0",
        points: [[181, 29.6], [290, 29.6], [290, 340], [181, 340]] },
      { id: "U2", fill: "#a9c4b0",
        points: [[290, 29.6], [394.2, 29.6], [394.2, 96.5], [290, 96.5]] },
      { id: "U3", fill: "#c3bad8",
        points: [[290, 96.5], [394.2, 96.5], [394.2, 205], [290, 205]] },
      { id: "U4", fill: "#d9c6a5",
        points: [[290, 205], [394.2, 205], [394.2, 301], [320.3, 301], [320.3, 244.9], [290, 244.9]] },
      { id: "U5", fill: "#d9c6a5",
        points: [[394.2, 29.6], [548.1, 29.6], [548.1, 181.8], [442.2, 181.8], [442.2, 177], [394.2, 177]] },
      { id: "U6", fill: "#a9c4b0",
        points: [[394.2, 177], [442.2, 177], [442.2, 181.8], [548.1, 181.8], [548.1, 312.9], [394.2, 312.9]] },
      { id: "U7", fill: "#a9c4b0",
        points: [[548.1, 29.6], [627.7, 29.6], [627.7, 83.5], [548.1, 83.5]] },
      { id: "U8", fill: "#c3bad8",
        points: [[548.1, 113.3], [627.7, 113.3], [627.7, 181.8], [548.1, 181.8]] },
      { id: "U9", fill: "#d9c6a5",
        points: [[548.1, 181.8], [627.7, 181.8], [627.7, 242], [548.1, 242]] },
      { id: "U15", fill: "#c3bad8",
        points: [[627.7, 198.3], [742.3, 198.3], [742.3, 233.4], [759.3, 233.4], [759.3, 312.9], [548.1, 312.9], [548.1, 242], [627.7, 242]] },
      { id: "U10", fill: "#d9c6a5",
        points: [[627.7, 29.6], [854.7, 29.6], [854.7, 155], [627.7, 155]] },
      { id: "U11", fill: "#a9c4b0",
        points: [[627.7, 155], [674, 155], [674, 198.3], [627.7, 198.3]] },
      { id: "U12", fill: "#a9c4b0",
        points: [[698.7, 155], [742.3, 155], [742.3, 198.3], [698.7, 198.3]] },
      { id: "U14", fill: "#d9c6a5",
        points: [[791.6, 180.2], [829.5, 180.2], [829.5, 233.4], [791.6, 233.4]] },
      { id: "U16", fill: "#a9c4b0",
        points: [[759.3, 233.4], [854.7, 233.4], [854.7, 340], [759.3, 340]] },
      { id: "U18", fill: "#d2cdbf",
        points: [[290, 244.9], [320.3, 244.9], [320.3, 340], [290, 340]] },
      { id: "U19", fill: "#e6e2d6",
        points: [[320.3, 301], [394.2, 301], [394.2, 340], [320.3, 340]] },
      { id: "U20", fill: "#e6e2d6",
        points: [[394.2, 312.9], [759.3, 312.9], [759.3, 340], [394.2, 340]] },
      { id: "U21", fill: "#e6e2d6",
        points: [[548.1, 83.5], [627.7, 83.5], [627.7, 113.3], [548.1, 113.3]] },
      { id: "U13", fill: "#e6e2d6",
        points: [[674, 155], [698.7, 155], [698.7, 198.3], [674, 198.3]] },
      { id: "U22", fill: "#e6e2d6",
        points: [[742.3, 155], [791.6, 155], [791.6, 233.4], [742.3, 233.4]] },
      { id: "U23", fill: "#d2cdbf",
        points: [[791.6, 155], [854.7, 155], [854.7, 233.4], [829.5, 233.4], [829.5, 180.2], [791.6, 180.2]] },
    ],
    zones: [
      { id: "U1.1", name: "Metal Shop 1", room: "U1",
        lines: ["Metal Shop 1"], at: [235.5, 110], size: 9.2,
        points: [[181, 29.6], [290, 29.6], [290, 190.3], [181, 190.3]] },
      { id: "U1.2", name: "Big Wood CNC", room: "U1",
        lines: ["Big","Wood","CNC"], at: [206, 300], size: 9.2,
        points: [[181, 252.5], [231, 252.5], [231, 340], [181, 340]] },
      { id: "U4.1", name: "Staff Desk", room: "U4",
        lines: ["Staff Desk"], at: [370.6, 276], size: 7,
        points: [[347, 251], [394.2, 251], [394.2, 301], [347, 301]] },
      { id: "U5.1", name: "Wood CNC", room: "U5",
        lines: ["Wood","CNC"], at: [417.2, 52.5], size: 9.2,
        points: [[394.2, 29.6], [440.1, 29.6], [440.1, 75.5], [394.2, 75.5]] },
      { id: "U10.1", name: "Electronics", room: "U10",
        lines: ["Electronics"], at: [700.85, 92.3], size: 9.2,
        points: [[627.7, 29.6], [774, 29.6], [774, 155], [627.7, 155]] },
      { id: "U10.2", name: "Printmaking", room: "U10",
        lines: ["Printmaking"], at: [814.35, 92.3], size: 9.2,
        points: [[774, 29.6], [854.7, 29.6], [854.7, 155], [774, 155]] },
      { id: "U15.1", name: "3D Printing", room: "U15",
        lines: ["3D Printing"], at: [587.9, 277.5], size: 9.2,
        points: [[548.1, 242], [627.7, 242], [627.7, 312.9], [548.1, 312.9]] },
      { id: "U15.2", name: "Laser Cutting", room: "U15",
        lines: ["Laser Cutting"], at: [690, 257], size: 9.2,
        points: [[627.7, 198.3], [742.3, 198.3], [742.3, 233.4], [759.3, 233.4], [759.3, 312.9], [627.7, 312.9]] },
      { id: "U3.1", name: "Jewelry", room: "U3",
        lines: ["Jewelry"], at: [307.4, 150.8], size: 9.2, rotate: -90,
        points: [[290, 96.5], [324.7, 96.5], [324.7, 205], [290, 205]] },
      { id: "U3.2", name: "Metal Shop 2", room: "U3",
        lines: ["Metal","Shop 2"], at: [359.45, 150.75], size: 9.2,
        points: [[324.7, 96.5], [394.2, 96.5], [394.2, 205], [324.7, 205]] },
      { id: "U2.1", name: "Compressor Room", room: "U2",
        lines: ["Compressor Room"], at: [342.1, 63.05], size: 7,
        points: [[290, 29.6], [394.2, 29.6], [394.2, 96.5], [290, 96.5]] },
      { id: "U4.2", name: null, room: "U4",
        lines: [], at: [357, 229], size: 11,
        points: [[290, 205], [394.2, 205], [394.2, 251], [347, 251], [347, 301], [320.3, 301], [320.3, 244.9], [290, 244.9]] },
      { id: "U5.2", name: "Woodshop 2", room: "U5",
        lines: ["Woodshop 2"], at: [471.7, 109], size: 9.2,
        points: [[440.1, 29.6], [548.1, 29.6], [548.1, 181.8], [442.2, 181.8], [442.2, 177], [394.2, 177], [394.2, 75.5], [440.1, 75.5]] },
      { id: "U6.1", name: "Woodshop 1", room: "U6",
        lines: ["Woodshop 1"], at: [470.6, 250.6], size: 9.2,
        points: [[394.2, 177], [442.2, 177], [442.2, 181.8], [548.1, 181.8], [548.1, 312.9], [394.2, 312.9]] },
      { id: "U7.1", name: "Screen Printing Darkroom", room: "U7",
        lines: ["Screen","Printing","Darkroom"], at: [587.9, 56.55], size: 9.2,
        points: [[548.1, 29.6], [627.7, 29.6], [627.7, 83.5], [548.1, 83.5]] },
      { id: "U8.1", name: "Sanding Room", room: "U8",
        lines: ["Sanding Room"], at: [587.9, 147.55], size: 9.2,
        points: [[548.1, 113.3], [627.7, 113.3], [627.7, 181.8], [548.1, 181.8]] },
      { id: "U9.1", name: "Fume Room", room: "U9",
        lines: ["Fume Room"], at: [587.9, 211.9], size: 9.2,
        points: [[548.1, 181.8], [627.7, 181.8], [627.7, 242], [548.1, 242]] },
      { id: "U11.1", name: "Restroom", room: "U11",
        lines: ["Restroom"], at: [650.85, 176.65], size: 7,
        points: [[627.7, 155], [674, 155], [674, 198.3], [627.7, 198.3]] },
      { id: "U12.1", name: "Restroom", room: "U12",
        lines: ["Restroom"], at: [720.5, 176.65], size: 7,
        points: [[698.7, 155], [742.3, 155], [742.3, 198.3], [698.7, 198.3]] },
      { id: "U14.1", name: "Closet", room: "U14",
        lines: ["Closet"], at: [810.55, 206.8], size: 7,
        points: [[791.6, 180.2], [829.5, 180.2], [829.5, 233.4], [791.6, 233.4]] },
      { id: "U16.1", name: "Computer Lab", room: "U16",
        lines: ["Computer Lab"], at: [807, 286.7], size: 9.2,
        points: [[759.3, 233.4], [854.7, 233.4], [854.7, 340], [759.3, 340]] },
      { id: "U18.1", name: null, room: "U18",
        lines: [], at: [305, 332.6], size: 7.2,
        points: [[290, 244.9], [320.3, 244.9], [320.3, 340], [290, 340]] },
      { id: "U19.1", name: "Member Check-In", room: "U19",
        lines: ["Member","Check-In"], at: [357.2, 320.5], size: 9.2,
        points: [[320.3, 301], [394.2, 301], [394.2, 340], [320.3, 340]] },
      { id: "U20.1", name: null, room: "U20",
        lines: [], at: [576.8, 330.5], size: 11,
        points: [[394.2, 312.9], [759.3, 312.9], [759.3, 340], [394.2, 340]] },
      { id: "U21.1", name: null, room: "U21",
        lines: [], at: [587.9, 102.4], size: 11,
        points: [[548.1, 83.5], [627.7, 83.5], [627.7, 113.3], [548.1, 113.3]] },
      { id: "U13.1", name: null, room: "U13",
        lines: [], at: [686.4, 178.5], size: 4,
        points: [[674, 155], [698.7, 155], [698.7, 198.3], [674, 198.3]] },
      { id: "U22.1", name: null, room: "U22",
        lines: [], at: [767, 198.2], size: 11,
        points: [[742.3, 155], [791.6, 155], [791.6, 233.4], [742.3, 233.4]] },
      { id: "U23.1", name: null, room: "U23",
        lines: [], at: [810.5, 169.9], size: 6.5,
        points: [[791.6, 155], [854.7, 155], [854.7, 233.4], [829.5, 233.4], [829.5, 180.2], [791.6, 180.2]] },
    ],
    entrances: [
      { id: "member", lines: ["Member Entrance"], at: [355, 357.4], size: 6.8, anchor: "start", arrow: [[347.2, 358], [347.2, 335]] },
    ],
  },
  downstairs: {
    offsetY: 50,
    d: {
      exterior: "M290 379 H854.4 V384.4 L802.4 436.4 L810.7 444.7 M830.1 464.1 L854.4 488.4 V693.2 H290 V379",
      interior: "M547.3 379 V562.4 H563.55 M497.1 406.6 V493.6 M497.1 521.2 V550.2 H547.3 M581.95 562.4 H670.2 M598.2 379 V562.4 M598.2 455.7 H670.2 M598.2 500.9 H670.2 M670.2 379 V418.3 M670.2 436.7 V479.8 M670.2 498.2 V539.3 M670.2 557.7 V562.4 M290 561.8 H329.5 M290 636.6 H316.8 M316.8 586.2 H329.5 M395.1 586.2 H409.15 M427.55 586.2 H474 M492.4 586.2 H503.95 M497.7 586.2 V605 H528.6 V586.2 M522.35 586.2 H626.65 M645.05 586.2 H717.7 M736.1 586.2 H741.7 M741.7 598 H758 M776.4 598 H782 V586.2 H854.4 M316.8 586.2 V666.9 M316.8 685.3 V693.2 M395.1 586.2 V693.2 M468.7 586.2 V693.2 M559.2 586.2 V666.9 M559.2 685.3 V693.2 M468.7 659 H651.8 M651.8 586.2 V666.9 M651.8 685.3 V693.2 M741.7 586.2 V666.9 M741.7 685.3 V693.2 M802.4 436.4 L743 495.8 V525.3 H711.4 M817.3 379 L820.5 384.5 M829.7 400.4 L832.9 405.9 M854.4 488.4 L810.8 532 M791.6 541 V532 H827.6 M791.6 559.4 V562.5 M791.6 562.5 H829 M829 513.8 V562.5",
      stairs: "M290 586.2 H316.8 V636.6 H290 Z M290 592.5 H316.8 M290 598.8 H316.8 M290 605.1 H316.8 M290 611.4 H316.8 M290 617.7 H316.8 M290 624 H316.8 M290 630.3 H316.8 M316.8 561.8 H329.5 V586.2 H316.8 Z M323.15 561.8 V586.2 M829 518 H854.4 V562.5 H829 Z M829 524.3 H854.4 M829 530.6 H854.4 M829 536.9 H854.4 M829 543.2 H854.4 M829 549.5 H854.4 M829 555.8 H854.4 M798 562.5 H829 V586.2 H798 Z M804.3 562.5 V586.2 M810.6 562.5 V586.2 M816.9 562.5 V586.2 M823.2 562.5 V586.2",
    },
    rooms: [
      { id: "D1", fill: "#d9c6a5",
        points: [[290, 379], [547.3, 379], [547.3, 586.2], [395.1, 586.2], [395.1, 693.2], [316.8, 693.2], [316.8, 586.2], [329.5, 586.2], [329.5, 562.4], [290, 562.4]] },
      { id: "D2", fill: "#a9c4b0",
        points: [[547.3, 379], [598.2, 379], [598.2, 562.4], [547.3, 562.4]] },
      { id: "D3", fill: "#d9c6a5",
        points: [[598.2, 379], [670.2, 379], [670.2, 455.7], [598.2, 455.7]] },
      { id: "D4", fill: "#c3bad8",
        points: [[598.2, 455.7], [670.2, 455.7], [670.2, 500.9], [598.2, 500.9]] },
      { id: "D5", fill: "#d9c6a5",
        points: [[598.2, 500.9], [670.2, 500.9], [670.2, 562.4], [598.2, 562.4]] },
      { id: "D6", fill: "#a9c4b0",
        points: [[670.2, 379], [817.3, 379], [832.9, 405.9], [802.4, 436.4], [743, 495.8], [670.2, 495.8]] },
      { id: "D7", fill: "#d9c6a5",
        points: [[802.4, 436.4], [854.4, 488.4], [810.8, 532], [791.6, 532], [791.6, 586.2], [782, 586.2], [782, 598], [741.7, 598], [741.7, 586.2], [670.2, 586.2], [670.2, 495.8], [743, 495.8]] },
      { id: "D20", fill: "#d9c6a5",
        points: [[817.3, 379], [854.4, 379], [854.4, 384.4], [832.9, 405.9]] },
      { id: "D8", fill: "#c3bad8",
        points: [[791.6, 532], [829, 532], [829, 562.5], [791.6, 562.5]] },
      { id: "D9", fill: "#c3bad8",
        points: [[290, 636.6], [316.8, 636.6], [316.8, 693.2], [290, 693.2]] },
      { id: "D10", fill: "#d9c6a5",
        points: [[395.1, 586.2], [468.7, 586.2], [468.7, 693.2], [395.1, 693.2]] },
      { id: "D11", fill: "#a9c4b0",
        points: [[468.7, 586.2], [497.7, 586.2], [497.7, 605], [528.6, 605], [528.6, 586.2], [559.2, 586.2], [559.2, 659], [468.7, 659]] },
      { id: "D19", fill: "#d9c6a5",
        points: [[497.7, 586.2], [528.6, 586.2], [528.6, 605], [497.7, 605]] },
      { id: "D12", fill: "#c3bad8",
        points: [[468.7, 659], [559.2, 659], [559.2, 693.2], [468.7, 693.2]] },
      { id: "D13", fill: "#d9c6a5",
        points: [[559.2, 586.2], [651.8, 586.2], [651.8, 659], [559.2, 659]] },
      { id: "D14", fill: "#a9c4b0",
        points: [[559.2, 659], [651.8, 659], [651.8, 693.2], [559.2, 693.2]] },
      { id: "D15", fill: "#c3bad8",
        points: [[651.8, 586.2], [741.7, 586.2], [741.7, 693.2], [651.8, 693.2]] },
      { id: "D16", fill: "#e2b7a6",
        points: [[741.7, 598], [782, 598], [782, 586.2], [854.4, 586.2], [854.4, 693.2], [741.7, 693.2]] },
      { id: "D18", fill: "#d2cdbf",
        points: [[290, 561.8], [329.5, 561.8], [329.5, 586.2], [316.8, 586.2], [316.8, 636.6], [290, 636.6]] },
      { id: "D22", fill: "#e6e2d6",
        points: [[547.3, 562.4], [670.2, 562.4], [670.2, 586.2], [547.3, 586.2]] },
      { id: "D23", fill: "#d2cdbf",
        points: [[810.8, 532], [854.4, 488.4], [854.4, 586.2], [791.6, 586.2], [791.6, 562.5], [829, 562.5], [829, 532]] },
    ],
    zones: [
      { id: "D1.1", name: "Member Studios", room: "D1",
        lines: ["Member","Studios"], at: [522.2, 443], size: 9.2,
        points: [[497.1, 379], [547.3, 379], [547.3, 507.4], [497.1, 507.4]] },
      { id: "D1.3", name: "Storage", room: "D1",
        lines: ["Storage"], at: [522.2, 528.8], size: 7,
        points: [[497.1, 507.4], [547.3, 507.4], [547.3, 550.2], [497.1, 550.2]] },
      { id: "D1.2", name: "Leather", room: "D1",
        lines: ["Leather"], at: [355.9, 639.7], size: 9.2,
        points: [[316.8, 586.2], [395.1, 586.2], [395.1, 693.2], [316.8, 693.2]] },
      { id: "D1.4", name: "Event Space", room: "D1",
        lines: ["Event Space"], at: [428.05, 470.4], size: 9.2,
        points: [[359, 379], [497.1, 379], [497.1, 561.8], [359, 561.8]] },
      { id: "D1.5", name: "Mini Makerspace", room: "D1",
        lines: ["Mini","Makerspace"], at: [324.5, 470.4], size: 9.2,
        points: [[290, 379], [359, 379], [359, 561.8], [290, 561.8]] },
      { id: "D2.1", name: "Utility Room", room: "D2",
        lines: ["Utility Room"], at: [572.75, 470.7], size: 7,
        points: [[547.3, 379], [598.2, 379], [598.2, 562.4], [547.3, 562.4]] },
      { id: "D3.1", name: "A/V", room: "D3",
        lines: ["A/V"], at: [634.2, 417.35], size: 9.2,
        points: [[598.2, 379], [670.2, 379], [670.2, 455.7], [598.2, 455.7]] },
      { id: "D4.1", name: "Kitchen", room: "D4",
        lines: ["Kitchen"], at: [634.2, 478.3], size: 9.2,
        points: [[598.2, 455.7], [670.2, 455.7], [670.2, 500.9], [598.2, 500.9]] },
      { id: "D5.1", name: "Office", room: "D5",
        lines: ["Office"], at: [634.2, 531.65], size: 7,
        points: [[598.2, 500.9], [670.2, 500.9], [670.2, 562.4], [598.2, 562.4]] },
      { id: "D6.1", name: "Lounge", room: "D6",
        lines: ["Lounge"], at: [716, 437], size: 9.2,
        points: [[670.2, 379], [817.3, 379], [832.9, 405.9], [802.4, 436.4], [743, 495.8], [670.2, 495.8]] },
      { id: "D7.1", name: "Lobby", room: "D7",
        lines: ["Lobby"], at: [760, 548], size: 9.2,
        points: [[802.4, 436.4], [854.4, 488.4], [810.8, 532], [791.6, 532], [791.6, 586.2], [782, 586.2], [782, 598], [741.7, 598], [741.7, 586.2], [670.2, 586.2], [670.2, 495.8], [743, 495.8]] },
      { id: "D20.1", name: "Closet", room: "D20",
        lines: ["Closet"], at: [834.5, 389], size: 5.8,
        points: [[817.3, 379], [854.4, 379], [854.4, 384.4], [832.9, 405.9]] },
      { id: "D8.1", name: "Closet", room: "D8",
        lines: ["Closet"], at: [810.3, 547.25], size: 7,
        points: [[791.6, 532], [829, 532], [829, 562.5], [791.6, 562.5]] },
      { id: "D9.1", name: "Closet", room: "D9",
        lines: ["Closet"], at: [303.4, 665], size: 6.2,
        points: [[290, 636.6], [316.8, 636.6], [316.8, 693.2], [290, 693.2]] },
      { id: "D10.1", name: "Sewing", room: "D10",
        lines: ["Sewing"], at: [431.9, 639.7], size: 9.2,
        points: [[395.1, 586.2], [468.7, 586.2], [468.7, 693.2], [395.1, 693.2]] },
      { id: "D11.1", name: "Men's Restroom", room: "D11",
        lines: ["Men's Restroom"], at: [514, 628], size: 7,
        points: [[468.7, 586.2], [497.7, 586.2], [497.7, 605], [528.6, 605], [528.6, 586.2], [559.2, 586.2], [559.2, 659], [468.7, 659]] },
      { id: "D19.1", name: "Closet", room: "D19",
        lines: ["Closet"], at: [513.15, 595.6], size: 7,
        points: [[497.7, 586.2], [528.6, 586.2], [528.6, 605], [497.7, 605]] },
      { id: "D12.1", name: "Kiln Room", room: "D12",
        lines: ["Kiln Room"], at: [513.95, 676.1], size: 9.2,
        points: [[468.7, 659], [559.2, 659], [559.2, 693.2], [468.7, 693.2]] },
      { id: "D13.1", name: "Women's Restroom", room: "D13",
        lines: ["Women's Restroom"], at: [605.5, 628], size: 7,
        points: [[559.2, 586.2], [651.8, 586.2], [651.8, 659], [559.2, 659]] },
      { id: "D14.1", name: "Ceramics Storage", room: "D14",
        lines: ["Ceramics","Storage"], at: [605.5, 676.1], size: 9.2,
        points: [[559.2, 659], [651.8, 659], [651.8, 693.2], [559.2, 693.2]] },
      { id: "D15.1", name: "Ceramics 1", room: "D15",
        lines: ["Ceramics 1"], at: [696.75, 639.7], size: 9.2,
        points: [[651.8, 586.2], [741.7, 586.2], [741.7, 693.2], [651.8, 693.2]] },
      { id: "D16.1", name: "Ceramics 2", room: "D16",
        lines: ["Ceramics 2"], at: [799.5, 645.7], size: 9.2,
        points: [[741.7, 598], [782, 598], [782, 586.2], [854.4, 586.2], [854.4, 693.2], [741.7, 693.2]] },
      { id: "D18.1", name: null, room: "D18",
        lines: [], at: [303, 577.6], size: 10,
        points: [[290, 561.8], [329.5, 561.8], [329.5, 586.2], [316.8, 586.2], [316.8, 636.6], [290, 636.6]] },
      { id: "D22.1", name: null, room: "D22",
        lines: [], at: [608.7, 578.3], size: 11,
        points: [[547.3, 562.4], [670.2, 562.4], [670.2, 586.2], [547.3, 586.2]] },
      { id: "D23.1", name: null, room: "D23",
        lines: [], at: [841.5, 507.5], size: 7,
        points: [[810.8, 532], [854.4, 488.4], [854.4, 586.2], [791.6, 586.2], [791.6, 562.5], [829, 562.5], [829, 532]] },
    ],
    entrances: [
      { id: "main", lines: ["Main","Entrance"], at: [841, 432.6], size: 6.8, arrow: [[831.2, 443.8], [817, 458]] },
    ],
  },
};

// --- derived ---------------------------------------------------------------
//
// Computed at module load rather than written down, so the floorplate and the
// frame cannot drift from the walls they come from.

const views = frames(
  FLOORS.map((f) => extents([BUILDING[f].d.exterior, BUILDING[f].d.interior, BUILDING[f].d.stairs], BUILDING[f].offsetY)),
);

export const FLOORPLAN: Record<Floor, FloorPlan> = Object.fromEntries(
  FLOORS.map((f, i) => [f, { ...BUILDING[f], outline: outline(BUILDING[f].d.exterior), viewBox: views[i] }]),
) as Record<Floor, FloorPlan>;
