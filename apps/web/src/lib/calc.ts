// Évaluateur d'expressions arithmétiques sûr (sans eval).
// Supporte + - * / , les parenthèses, les décimaux, le % (ex: 40% -> 0.4)
// et les fractions naturelles (ex: 3/8). Utilisé par la mini-calculette
// et le champ "proba estimée" du simulateur de value bet.

type Token =
  | { t: "num"; v: number }
  | { t: "op"; v: "+" | "-" | "*" | "/" }
  | { t: "lparen" }
  | { t: "rparen" };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = input;

  while (i < s.length) {
    const c = s[i];

    // Les espaces séparent les jetons mais ne fusionnent pas les nombres.
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }

    if (c >= "0" && c <= "9" || c === ".") {
      let num = "";
      while (i < s.length && (s[i] === "." || (s[i] >= "0" && s[i] <= "9"))) {
        num += s[i];
        i++;
      }
      let value = Number(num);
      if (Number.isNaN(value)) throw new Error(`Nombre invalide : « ${num} »`);
      // Suffixe pourcentage : 40% -> 0.4
      if (s[i] === "%") {
        value = value / 100;
        i++;
      }
      tokens.push({ t: "num", v: value });
      continue;
    }

    if (c === "+" || c === "-" || c === "*" || c === "/") {
      tokens.push({ t: "op", v: c });
      i++;
      continue;
    }
    if (c === "(") { tokens.push({ t: "lparen" }); i++; continue; }
    if (c === ")") { tokens.push({ t: "rparen" }); i++; continue; }

    throw new Error(`Caractère non autorisé : « ${c} »`);
  }
  return tokens;
}

// Descente récursive : expr = term (('+'|'-') term)* ; term = factor (('*'|'/') factor)*
function parse(tokens: Token[]): number {
  let pos = 0;

  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseExpr(): number {
    let value = parseTerm();
    while (peek()?.t === "op" && ((peek() as { v: string }).v === "+" || (peek() as { v: string }).v === "-")) {
      const op = (next() as { v: string }).v;
      const rhs = parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  function parseTerm(): number {
    let value = parseFactor();
    while (peek()?.t === "op" && ((peek() as { v: string }).v === "*" || (peek() as { v: string }).v === "/")) {
      const op = (next() as { v: string }).v;
      const rhs = parseFactor();
      if (op === "/") {
        if (rhs === 0) throw new Error("Division par zéro");
        value = value / rhs;
      } else {
        value = value * rhs;
      }
    }
    return value;
  }

  function parseFactor(): number {
    const tok = peek();
    if (!tok) throw new Error("Expression incomplète");

    // Signe unaire
    if (tok.t === "op" && (tok.v === "+" || tok.v === "-")) {
      next();
      const val = parseFactor();
      return tok.v === "-" ? -val : val;
    }
    if (tok.t === "lparen") {
      next();
      const val = parseExpr();
      if (peek()?.t !== "rparen") throw new Error("Parenthèse fermante manquante");
      next();
      return val;
    }
    if (tok.t === "num") {
      next();
      return tok.v;
    }
    throw new Error("Expression invalide");
  }

  const result = parseExpr();
  if (pos < tokens.length) throw new Error("Expression invalide");
  return result;
}

/** Évalue une expression arithmétique. Lève une erreur si l'expression est invalide. */
export function evaluate(input: string): number {
  const tokens = tokenize(input);
  if (tokens.length === 0) throw new Error("Expression vide");
  const result = parse(tokens);
  if (!Number.isFinite(result)) throw new Error("Résultat non fini");
  return result;
}

/** Évalue sans lever d'erreur : renvoie null si l'expression est invalide/vide. */
export function tryEvaluate(input: string): number | null {
  if (!input.trim()) return null;
  try {
    return evaluate(input);
  } catch {
    return null;
  }
}
