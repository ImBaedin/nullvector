type ObjectType = "planet" | "system" | "sector" | "galaxy";

type ParsedSeed = {
  raw: string;
  galaxyKey: string; // e.g. "G3" or fallback
  galaxyNum?: number;
  sectorNum?: number;
  systemNum?: number;
  planetNum?: number;
  type: ObjectType;
};

type LanguageStyle = {
  id: string;
  syllablesStart: string[];
  syllablesMid: string[];
  syllablesEnd: string[];
  prefixes: string[];
  suffixes: string[];
  epithets: string[];
  galaxyNouns: string[];
  systemNouns: string[];
};

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  if (arr.length === 0) throw new Error("pick requires non-empty array");
  const idx = Math.floor(rng() * arr.length);
  const item = arr[idx];
  if (item === undefined) throw new Error("pick requires non-empty array");
  return item;
}

function chance(rng: () => number, p: number): boolean {
  return rng() < p;
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function toRoman(num: number): string {
  const n = clampInt(Math.floor(num), 1, 3999);
  const map: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];

  let x = n;
  let out = "";
  for (const [val, sym] of map) {
    while (x >= val) {
      out += sym;
      x -= val;
    }
  }
  return out;
}

function parseSeed(seed: string): ParsedSeed {
  const parts = seed.split(":").map((s) => s.trim());
  const getNum = (prefix: string): number | undefined => {
    const part = parts.find((p) => p.toUpperCase().startsWith(prefix));
    if (!part) return undefined;
    const m = part.match(/\d+/);
    return m ? Number(m[0]) : undefined;
  };

  const galaxyNum = getNum("G");
  const sectorNum = getNum("S");
  const systemNum = getNum("SYS");
  const planetNum = getNum("P");

  const upperParts = parts.map((p) => p.toUpperCase());
  const hasPlanet = upperParts.some((p) => p.startsWith("P"));
  const hasSystem = upperParts.some((p) => p.startsWith("SYS"));
  const hasSector = upperParts.some((p) => p.startsWith("S"));
  const hasGalaxy = upperParts.some((p) => p.startsWith("G"));

  const type: ObjectType = hasPlanet
    ? "planet"
    : hasSystem
      ? "system"
      : hasSector
        ? "sector"
        : "galaxy";

  const galaxyKey = galaxyNum !== undefined ? `G${galaxyNum}` : "G0";

  return {
    raw: seed,
    galaxyKey,
    galaxyNum,
    sectorNum,
    systemNum,
    planetNum,
    type: hasGalaxy ? type : "galaxy",
  };
}

const STYLES: LanguageStyle[] = [
  {
    id: "harsh",
    syllablesStart: ["kr", "x", "z", "vr", "dr", "th", "sk", "q"],
    syllablesMid: [
      "a",
      "e",
      "i",
      "o",
      "u",
      "ax",
      "or",
      "ul",
      "en",
      "ir",
      "ex",
      "ok",
    ],
    syllablesEnd: ["k", "x", "th", "rn", "z", "v", "sk", "rax", "d", "n"],
    prefixes: ["Vor", "Xan", "Kyr", "Drak", "Zer", "Thal", "Qor"],
    suffixes: ["on", "ar", "ax", "is", "um", "ix", "or", "esh"],
    epithets: ["Shattered", "Iron", "Black", "Ashen", "Riven", "Silent"],
    galaxyNouns: ["Reach", "Arm", "Veil", "Rift", "Spiral", "Expanse"],
    systemNouns: ["System", "Binary", "Cluster", "Node", "Array"],
  },
  {
    id: "soft",
    syllablesStart: ["l", "m", "n", "s", "v", "el", "al", "io", "ae"],
    syllablesMid: [
      "a",
      "e",
      "i",
      "o",
      "u",
      "li",
      "na",
      "ra",
      "se",
      "va",
      "ri",
      "lo",
    ],
    syllablesEnd: ["a", "e", "ia", "is", "on", "en", "ir", "el", "os"],
    prefixes: ["Ael", "Eli", "Sola", "Lumi", "Vela", "Nara", "Ser"],
    suffixes: ["ia", "ara", "el", "is", "ora", "une", "iel"],
    epithets: ["Radiant", "Azure", "Luminous", "Golden", "Serene", "Pearl"],
    galaxyNouns: ["Halo", "Drift", "Garden", "Sea", "Crown", "Belt"],
    systemNouns: ["System", "Concord", "Triad", "Nexus", "Hearth"],
  },
  {
    id: "latin",
    syllablesStart: ["cor", "val", "nov", "alt", "prae", "aur", "stell"],
    syllablesMid: ["a", "e", "i", "o", "u", "um", "us", "ae", "ia", "or"],
    syllablesEnd: ["us", "um", "a", "is", "or", "ix", "ens"],
    prefixes: ["Nova", "Astra", "Ordo", "Civis", "Magnus", "Vita"],
    suffixes: ["Prime", "Secundus", "Tertius", "Major", "Minor"],
    epithets: ["Outer", "Inner", "Obsidian", "Imperial", "Lost", "Eternal"],
    galaxyNouns: ["Dominion", "Arc", "March", "Spiral", "Vast"],
    systemNouns: ["System", "Complex", "Chain", "Line"],
  },
  {
    id: "catalog",
    syllablesStart: ["HD", "RX", "GL", "Ke", "TR", "XN", "PSR"],
    syllablesMid: ["-", " ", "-", " ", "-", "-", " "],
    syllablesEnd: ["A", "B", "C", "I", "II", "III", "IV", "V"],
    prefixes: ["Epsilon", "Zeta", "Delta", "Sigma", "Omicron", "Lambda"],
    suffixes: ["Station", "Field", "Array", "Outpost", "Gate"],
    epithets: ["Unnamed", "Surveyed", "Restricted", "Classified", "Frontier"],
    galaxyNouns: ["Region", "Volume", "Reach", "Expanse"],
    systemNouns: ["System", "Group", "Locus", "Set"],
  },
];

function makeCoreName(rng: () => number, style: LanguageStyle): string {
  const syllableCount = 2 + Math.floor(rng() * 2); // 2–3
  let out = "";

  // Sometimes use a fixed prefix for stronger "language" identity.
  if (chance(rng, 0.25)) {
    out += pick(rng, style.prefixes);
  } else {
    out += pick(rng, style.syllablesStart);
  }

  for (let i = 0; i < syllableCount; i++) {
    out += pick(rng, style.syllablesMid);
  }

  if (chance(rng, 0.7)) {
    out += pick(rng, style.syllablesEnd);
  } else {
    out += pick(rng, style.suffixes);
  }

  // Clean up spacing/hyphen weirdness in catalog style.
  out = out.replace(/\s+/g, " ").trim();
  out = out.replace(/-+/g, "-");

  // Title-case-ish: keep all-caps tokens like HD/RX, otherwise capitalize.
  const tokens = out.split(" ");
  const fixed = tokens.map((t) => {
    if (/^[A-Z]{2,}$/.test(t)) return t;
    if (/^[A-Z]{1,3}-/.test(t)) return t;
    return t.charAt(0).toUpperCase() + t.slice(1);
  });

  return fixed.join(" ");
}

function sectorCode(
  rng: () => number,
  sectorNum?: number,
  galaxyNum?: number,
): string {
  const letter = String.fromCharCode(65 + Math.floor(rng() * 26));
  const a = sectorNum ?? Math.floor(rng() * 30) + 1;
  const b = galaxyNum ?? Math.floor(rng() * 90) + 10;
  const left = String(a).padStart(2, "0");
  const right = String(b).padStart(2, "0");
  return `${letter}-${left}${right}`;
}

function generateByType(
  rng: () => number,
  style: LanguageStyle,
  parsed: ParsedSeed,
): string {
  const core = makeCoreName(rng, style);

  if (parsed.type === "galaxy") {
    const t = Math.floor(rng() * 4);
    const noun = pick(rng, style.galaxyNouns);
    const epithet = pick(rng, style.epithets);

    if (t === 0) return `${core} ${noun}`;
    if (t === 1) return `The ${epithet} ${noun}`;
    if (t === 2) return `${core} ${pick(rng, ["Spiral", "Drift", "Veil"])}`;
    return `${pick(rng, style.prefixes)} ${noun}`;
  }

  if (parsed.type === "sector") {
    const code = sectorCode(rng, parsed.sectorNum, parsed.galaxyNum);
    const t = Math.floor(rng() * 4);
    const epithet = pick(rng, style.epithets);

    if (t === 0) return `Sector ${code}`;
    if (t === 1) return `${core} Sector`;
    if (t === 2) return `The ${epithet} Sector ${code}`;
    return `${core} Quadrant`;
  }

  if (parsed.type === "system") {
    const t = Math.floor(rng() * 5);
    const noun = pick(rng, style.systemNouns);
    const n = parsed.systemNum ?? (Math.floor(rng() * 9) + 1);

    if (style.id === "catalog" && chance(rng, 0.6)) {
      const catalogNum = 1000 + Math.floor(rng() * 90000);
      const suffix = pick(rng, style.syllablesEnd);
      return `${pick(rng, style.syllablesStart)}-${catalogNum}${suffix}`;
    }

    if (t === 0) return `${core} ${noun}`;
    if (t === 1) return `The ${core} ${noun}`;
    if (t === 2) return `${core}-${toRoman(n)} ${noun}`;
    if (t === 3) return `${core} ${pick(rng, ["Belt", "Locus", "Circuit"])}`;
    return `${pick(rng, style.prefixes)} ${core} ${noun}`;
  }

  // planet
  const t = Math.floor(rng() * 7);
  const n = parsed.planetNum ?? (Math.floor(rng() * 12) + 1);
  const epithet = pick(rng, style.epithets);

  if (style.id === "catalog" && chance(rng, 0.55)) {
    const catalogNum = 10 + Math.floor(rng() * 9900);
    const letter = pick(rng, ["b", "c", "d", "e", "f"]);
    return `${core}-${catalogNum}${letter}`;
  }

  if (t === 0) return `${core} ${toRoman(n)}`;
  if (t === 1) return `${core}-${toRoman(n)}`;
  if (t === 2) return `${core} Prime`;
  if (t === 3) return `New ${core}`;
  if (t === 4) return `${core} ${pick(rng, ["IV", "V", "VI", "VII", "IX"])}`;
  if (t === 5) return `${core} of the ${epithet} Sky`;
  return `The ${epithet} ${core}`;
}

/**
 * Deterministic, galaxy-style-consistent sci-fi name generator.
 * Same seed => same result. All seeds sharing the same "G#" share a style.
 */
export function generateSciFiName(seed: string): string {
  const parsed = parseSeed(seed);

  // Style locked to galaxy only (so everything in G3 shares a "language").
  const styleRng = mulberry32(fnv1a32(`style:${parsed.galaxyKey}`));
  const style =
    STYLES[Math.floor(styleRng() * STYLES.length)] ?? (STYLES[0] as LanguageStyle);

  // Name details can vary by full seed.
  const nameRng = mulberry32(fnv1a32(`name:${seed}|${style.id}`));
  return generateByType(nameRng, style, parsed);
}
