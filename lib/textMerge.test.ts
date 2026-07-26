/**
 * Tests for the three-way note-body merge. Run with:
 *
 *     npm run test:merge
 *
 * There is no test runner in this project, and adding one for a single module
 * wasn't worth it — but a merge algorithm silently returning the wrong text is
 * exactly the class of bug that loses your writing, so it does not ship untested.
 * These are plain assertions plus a fuzz pass over the one invariant that really
 * matters: no line either side introduced may be silently dropped.
 */
import { mergeThreeWay, hasConflictMarkers } from "./textMerge";

let pass = 0;
const failures: string[] = [];

function check(name: string, got: unknown, want: unknown) {
  if (got === want) { pass++; return; }
  failures.push(`${name}\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`);
}

// ─── Clean merges ─────────────────────────────────────────────────────────────

{
  const base   = "# Beam design\nspan = 6m\nload = 12kN\nnotes here";
  const mine   = "# Beam design\nspan = 8m\nload = 12kN\nnotes here";
  const theirs = "# Beam design\nspan = 6m\nload = 12kN\nnotes here\ncheck deflection";
  const r = mergeThreeWay(base, mine, theirs);
  check("edits on different lines merge", r.text, "# Beam design\nspan = 8m\nload = 12kN\nnotes here\ncheck deflection");
  check("…without conflicting", r.conflicted, false);
}

{
  // Adjacent (not overlapping) edits. An anchor-based split conflicts here
  // because no surviving base line separates them; hunk-based does not.
  const r = mergeThreeWay("h\na\nb\nt", "h\naX\nb\nt", "h\na\nbY\nt");
  check("adjacent single-line edits merge", r.text, "h\naX\nbY\nt");
  check("…without conflicting", r.conflicted, false);
}

{
  const base   = "- [ ] a\n- [ ] b\n- [ ] c";
  const r = mergeThreeWay(base, "- [x] a\n- [ ] b\n- [ ] c", base + "\n- [ ] d");
  check("checklist tick + append", r.text, "- [x] a\n- [ ] b\n- [ ] c\n- [ ] d");
  check("…without conflicting", r.conflicted, false);
}

{
  const base   = "intro\n\n## Section\nold body\n\nfooter";
  const mine   = "intro\n\n## Section\nnew body 1\nnew body 2\n\nfooter";
  const theirs = "intro\n\n## Section\nold body\n\nfooter\n\n## Extra\nmore";
  const r = mergeThreeWay(base, mine, theirs);
  check("block rewrite + append: no conflict", r.conflicted, false);
  check("block rewrite survives", r.text.includes("new body 2"), true);
  check("append survives", r.text.includes("## Extra"), true);
}

{
  const base = "one\ntwo";
  check("only mine changed", mergeThreeWay(base, "one\ntwo\nthree", base).text, "one\ntwo\nthree");
  check("only theirs changed", mergeThreeWay(base, base, "zero\none\ntwo").text, "zero\none\ntwo");
  check("neither changed", mergeThreeWay(base, base, base).text, base);
  check("identical edits both sides", mergeThreeWay("x\ny", "x\nY!", "x\nY!").text, "x\nY!");
  check("deletion applies", mergeThreeWay("keep\ndrop\nkeep2", "keep\nkeep2", "keep\ndrop\nkeep2").text, "keep\nkeep2");
}

// ─── Conflicts: both versions kept, never a silent winner ─────────────────────

{
  const r = mergeThreeWay("a\nvalue = 1\nz", "a\nvalue = 2\nz", "a\nvalue = 3\nz");
  check("same line, divergent: conflicts", r.conflicted, true);
  check("…keeps mine", r.text.includes("value = 2"), true);
  check("…keeps theirs", r.text.includes("value = 3"), true);
  check("…keeps surrounding lines", r.text.startsWith("a\n") && r.text.endsWith("\nz"), true);
  check("…is detectable", hasConflictMarkers(r.text), true);
}

{
  const r = mergeThreeWay("", "mine text", "their text");
  check("empty base conflicts", r.conflicted, true);
  check("…keeps mine", r.text.includes("mine text"), true);
  check("…keeps theirs", r.text.includes("their text"), true);
}

// ─── Fuzz: the no-silent-data-loss invariant ──────────────────────────────────

{
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];

  const mutate = (lines: string[]): string[] => {
    const out = lines.slice();
    const ops = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < ops; k++) {
      const op = out.length === 0 ? "ins" : pick(["ins", "del", "edit"]);
      if (op === "ins")      out.splice(Math.floor(rnd() * (out.length + 1)), 0, "new" + Math.floor(rnd() * 1000));
      else if (op === "del") out.splice(Math.floor(rnd() * out.length), 1);
      else { const i = Math.floor(rnd() * out.length); out[i] += "-mod" + Math.floor(rnd() * 100); }
    }
    return out;
  };

  let dropped = 0, crashed = 0, conflicts = 0;
  const RUNS = 4000;
  for (let n = 0; n < RUNS; n++) {
    const base = Array.from({ length: Math.floor(rnd() * 10) }, (_, i) => "L" + i);
    const mine = mutate(base);
    const theirs = mutate(base);
    let text: string, conflicted: boolean;
    try {
      const r = mergeThreeWay(base.join("\n"), mine.join("\n"), theirs.join("\n"));
      text = r.text; conflicted = r.conflicted;
    } catch { crashed++; continue; }
    if (conflicted) conflicts++;

    const outSet = new Set(text.length === 0 ? [] : text.split("\n"));
    const baseSet = new Set(base);
    const introduced = [...new Set([...mine, ...theirs])].filter(l => !baseSet.has(l));
    if (introduced.some(l => !outSet.has(l))) dropped++;
  }
  check("fuzz: no crashes", crashed, 0);
  check("fuzz: no line silently dropped", dropped, 0);
  // Sanity: the corpus must actually exercise both outcomes, or the invariant
  // above is trivially satisfied by always conflicting.
  check("fuzz: some cases merged cleanly", conflicts < RUNS && conflicts > 0, true);
}

// ─── Report ───────────────────────────────────────────────────────────────────

if (failures.length === 0) {
  console.log(`textMerge: ${pass} checks passed`);
} else {
  console.error(`textMerge: ${pass} passed, ${failures.length} FAILED\n`);
  for (const f of failures) console.error("  " + f + "\n");
  process.exit(1);
}
