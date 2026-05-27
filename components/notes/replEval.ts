/**
 * Safe REPL evaluator for notes.
 * Lines starting with "> " are evaluated — numeric expressions + named primitives.
 * No eval(), no imports, no dynamic code execution.
 */

export type REPLContext = {
  tasksOverdue: number;
  tasksToday:   number;
  tasksOpen:    number;
  notesCount:   number;
  tasksDueIn:   (days: number) => number;
};

/** Format a number for display — remove unnecessary decimals. */
function fmt(n: number): string {
  if (!isFinite(n)) return "error";
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

/** Substitute named primitives with their numeric values before arithmetic. */
function substituteNames(expr: string, ctx: REPLContext): string {
  return expr
    .replace(/\btasks\.overdue\b/g,  String(ctx.tasksOverdue))
    .replace(/\btasks\.today\b/g,    String(ctx.tasksToday))
    .replace(/\btasks\.open\b/g,     String(ctx.tasksOpen))
    .replace(/\bnotes\.count\b/g,    String(ctx.notesCount))
    .replace(/\btasks\.dueIn\((\d+)\)/g, (_, n) => String(ctx.tasksDueIn(parseInt(n, 10))))
    // aliases
    .replace(/\bcount\b/g, "1"); // unsupported filter — default 1 to avoid NaN
}

/** Recursive descent parser for arithmetic: +, -, *, /, %, unary -, parentheses, decimals. */
function parseArith(input: string): number {
  const s = input.replace(/\s/g, "");
  let pos = 0;

  function peek() { return s[pos] ?? ""; }
  function consume() { return s[pos++] ?? ""; }

  function parseExpr(): number {
    let v = parseTerm();
    while ("+-".includes(peek())) {
      const op = consume();
      const r = parseTerm();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }

  function parseTerm(): number {
    let v = parseUnary();
    while ("*/%".includes(peek())) {
      const op = consume();
      const r = parseUnary();
      if (op === "*") v *= r;
      else if (op === "/") v = r !== 0 ? v / r : Infinity;
      else v = r !== 0 ? v % r : NaN;
    }
    return v;
  }

  function parseUnary(): number {
    if (peek() === "-") { consume(); return -parsePrimary(); }
    return parsePrimary();
  }

  function parsePrimary(): number {
    if (peek() === "(") {
      consume(); // (
      const v = parseExpr();
      if (peek() === ")") consume(); // )
      return v;
    }
    // Number
    let digits = "";
    while (/[\d.]/.test(peek())) digits += consume();
    if (!digits) { pos++; return NaN; } // skip unexpected char
    return parseFloat(digits);
  }

  try {
    const result = parseExpr();
    return isNaN(result) ? NaN : result;
  } catch {
    return NaN;
  }
}

/**
 * Evaluate a REPL expression (the part after "> ").
 * Returns the result string, or undefined if evaluation produces nothing useful.
 */
export function evalREPL(rawExpr: string, ctx: REPLContext): string | undefined {
  try {
    const substituted = substituteNames(rawExpr.trim(), ctx);
    if (!substituted.trim()) return undefined;
    const n = parseArith(substituted);
    if (!isFinite(n) && isNaN(n)) return undefined;
    return fmt(n);
  } catch {
    return undefined;
  }
}
