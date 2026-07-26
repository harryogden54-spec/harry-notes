/**
 * Line-based three-way merge, used for note bodies.
 *
 * Why this exists: the sync engine is last-write-wins per row. `doMerge` already
 * refuses to let a remote row overwrite an unpushed local edit — but nothing
 * stopped the reverse. Edit a note on your phone while your laptop has an older
 * copy, then let the laptop push, and the laptop's whole row replaces the
 * phone's: the phone's text is gone with no trace. Small-field data (a due date,
 * a done flag) is fine under last-write-wins; a note body is the one place where
 * losing the other side actually costs you writing.
 *
 * The merge is deliberately line-based rather than character-based. Markdown
 * notes are line-structured (headings, bullets, checklist items, table rows), so
 * line granularity matches how they are actually edited, and it keeps the
 * one-element-per-line invariant the web editor relies on.
 *
 * Edits to different parts of a note merge silently. Edits to the *same* lines
 * produce a git-style conflict block — both versions kept, visible, nothing
 * discarded. That is the point: never silently pick a winner.
 */

/** Beyond this, the O(n*m) LCS matrices get expensive. Notes this long are
 *  pathological; fall straight to keep-both rather than stall the UI thread. */
const MAX_LINES = 1500;

export const CONFLICT_MINE_MARKER   = "<<<<<<< this device";
export const CONFLICT_SPLIT_MARKER  = "=======";
export const CONFLICT_THEIRS_MARKER = ">>>>>>> other device";

export type MergeResult = {
  text: string;
  /** True when at least one region had to be kept as a conflict block. */
  conflicted: boolean;
};

function splitLines(s: string): string[] {
  return s.length === 0 ? [] : s.split("\n");
}

function sameSeg(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * Indices of a longest common subsequence, as [aIndex, bIndex] pairs in
 * increasing order. Standard O(n*m) DP — fine at these sizes and it keeps the
 * alignment monotonic, which the region walk below depends on.
 */
function lcsMatches(a: string[], b: string[]): Array<[number, number]> {
  const n = a.length, m = b.length;
  const dp: Int32Array[] = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    const row = dp[i], next = dp[i + 1];
    for (let j = m - 1; j >= 0; j--) {
      row[j] = a[i] === b[j] ? next[j + 1] + 1 : Math.max(next[j], row[j + 1]);
    }
  }
  const out: Array<[number, number]> = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push([i, j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return out;
}

/** A replacement of `base[start..end)` with `lines`. A pure insertion has
 *  start === end. Derived from the gaps between LCS matches. */
type Hunk = { start: number; end: number; lines: string[] };

function hunksFromMatches(
  base: string[],
  other: string[],
  matches: Array<[number, number]>,
): Hunk[] {
  const hunks: Hunk[] = [];
  let pb = -1, po = -1;
  const push = (bEnd: number, oEnd: number) => {
    if (bEnd > pb + 1 || oEnd > po + 1) {
      hunks.push({ start: pb + 1, end: bEnd, lines: other.slice(po + 1, oEnd) });
    }
  };
  for (const [bi, oi] of matches) { push(bi, oi); pb = bi; po = oi; }
  push(base.length, other.length);
  return hunks;
}

function conflictBlock(mine: string[], theirs: string[]): string[] {
  return [
    CONFLICT_MINE_MARKER,
    ...mine,
    CONFLICT_SPLIT_MARKER,
    ...theirs,
    CONFLICT_THEIRS_MARKER,
  ];
}

/**
 * Merge `mine` and `theirs`, both derived from `base`.
 *
 * Algorithm: align base↔mine and base↔theirs by LCS, turn each alignment's gaps
 * into hunks over base coordinates, then walk base once. A hunk from only one
 * side applies as-is. Hunks from both sides conflict only when their base ranges
 * genuinely **overlap** — adjacent edits (mine on line 2, theirs on line 3) merge
 * cleanly, which an anchor-based split cannot do because no surviving base line
 * separates them.
 */
export function mergeThreeWay(base: string, mine: string, theirs: string): MergeResult {
  // Cheap exits, and the only cases that matter most of the time.
  if (mine === theirs) return { text: mine, conflicted: false };
  if (base === mine)   return { text: theirs, conflicted: false };
  if (base === theirs) return { text: mine, conflicted: false };

  const b = splitLines(base), a = splitLines(mine), t = splitLines(theirs);

  if (b.length > MAX_LINES || a.length > MAX_LINES || t.length > MAX_LINES) {
    return { text: conflictBlock(a, t).join("\n"), conflicted: true };
  }

  const mineHunks   = hunksFromMatches(b, a, lcsMatches(b, a));
  const theirsHunks = hunksFromMatches(b, t, lcsMatches(b, t));

  const out: string[] = [];
  let conflicted = false;
  let pos = 0, mi = 0, ti = 0;

  for (;;) {
    const mh = mineHunks[mi];
    const th = theirsHunks[ti];
    const mReady = mh !== undefined && mh.start <= pos;
    const tReady = th !== undefined && th.start <= pos;

    if (mReady && tReady) {
      // Both sides touch here. Grow one combined region over every hunk that
      // reaches into it — an edit can pull in a further hunk from the other
      // side, so keep sweeping until the range stops growing.
      let end = Math.max(mh.end, th.end);
      const mineLines: string[] = [];
      const theirLines: string[] = [];
      for (let grew = true; grew; ) {
        grew = false;
        while (mineHunks[mi] && mineHunks[mi].start <= end) {
          mineLines.push(...mineHunks[mi].lines);
          if (mineHunks[mi].end > end) { end = mineHunks[mi].end; grew = true; }
          mi++;
        }
        while (theirsHunks[ti] && theirsHunks[ti].start <= end) {
          theirLines.push(...theirsHunks[ti].lines);
          if (theirsHunks[ti].end > end) { end = theirsHunks[ti].end; grew = true; }
          ti++;
        }
      }
      if (sameSeg(mineLines, theirLines)) out.push(...mineLines);
      else { conflicted = true; out.push(...conflictBlock(mineLines, theirLines)); }
      pos = end;
    } else if (mReady) {
      out.push(...mh.lines);
      pos = Math.max(pos, mh.end);
      mi++;
    } else if (tReady) {
      out.push(...th.lines);
      pos = Math.max(pos, th.end);
      ti++;
    } else if (pos < b.length) {
      out.push(b[pos]);
      pos++;
    } else {
      break;
    }
  }

  return { text: out.join("\n"), conflicted };
}

/** Whether a body still carries unresolved conflict markers. */
export function hasConflictMarkers(text: string): boolean {
  return text.includes(CONFLICT_MINE_MARKER) && text.includes(CONFLICT_THEIRS_MARKER);
}
