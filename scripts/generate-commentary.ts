// Generates AI season recaps and per-game blurbs via the Claude API, one
// structured-output call per season (6 calls total for 2020-2025), and caches
// the result to src/data/generated/commentary.json for the static site to
// ship pre-written. This is a separate, explicit, paid step — NOT part of
// `npm run build:data` — because it costs real money and needs API access.
//
// Run with: npx tsx scripts/generate-commentary.ts [--year=2024] [--force]
//
// Idempotent: writes progress after every season, and skips a year that
// already has an entry in commentary.json unless --force is passed, so a
// crash or interruption doesn't waste the calls already made.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { Season, Matchup, WeeklyTopPerformer, Commentary } from "../src/types.ts";
import { computeMatchupRecords } from "../src/lib/derive.ts";

const GENERATED_DIR = join(import.meta.dirname, "..", "src", "data", "generated");
const OUT_FILE = join(GENERATED_DIR, "commentary.json");
const MODEL = "claude-opus-4-8";

const args = process.argv.slice(2);
const force = args.includes("--force");
const yearArg = args.find((a) => a.startsWith("--year="));
const onlyYear = yearArg ? Number(yearArg.split("=")[1]) : null;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

const seasons = readJson<Season[]>(join(GENERATED_DIR, "seasons.json"));
const matchups = readJson<Matchup[]>(join(GENERATED_DIR, "matchups.json"));
const topPerformers = readJson<WeeklyTopPerformer[]>(join(GENERATED_DIR, "topPerformers.json"));

const existing: Commentary = existsSync(OUT_FILE) ? readJson<Commentary>(OUT_FILE) : {};

const client = new Anthropic();

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    seasonRecap: { type: "string" },
    games: {
      type: "array",
      items: {
        type: "object",
        properties: {
          matchupId: { type: "string" },
          recap: { type: "string" },
        },
        required: ["matchupId", "recap"],
        additionalProperties: false,
      },
    },
  },
  required: ["seasonRecap", "games"],
  additionalProperties: false,
} as const;

function buildPrompt(season: Season, yearMatchups: Matchup[]): string {
  const champion = season.standings.find((s) => s.rank === 1);
  const runnerUp = season.standings.find((s) => s.rank === 2);

  const standingsLines = season.standings
    .map(
      (s) =>
        `#${s.rank} ${s.managerName} (${s.teamName}) — ${s.wins}-${s.losses}${s.draws ? `-${s.draws}` : ""}, ${s.pointsFor.toFixed(1)} PF, ${s.pointsAgainst.toFixed(1)} PA${s.madePlayoffs ? ", made playoffs" : ""}`
    )
    .join("\n");

  const records = computeMatchupRecords(yearMatchups);
  const yearTopPerformers = topPerformers.filter((t) => t.year === season.year);
  const bestIndividual =
    yearTopPerformers.length > 0 ? yearTopPerformers.reduce((a, b) => (b.pts > a.pts ? b : a)) : null;

  const notableLines = [
    ...records.map((r) => `${r.label}: ${r.value} (${r.detail})`),
    bestIndividual
      ? `Best individual week: ${bestIndividual.playerName} (${bestIndividual.pos}, ${bestIndividual.nflTeam}) — ${bestIndividual.pts.toFixed(1)} pts for ${bestIndividual.managerName}, Week ${bestIndividual.week}`
      : null,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  const gameLines = yearMatchups
    .map(
      (m) =>
        `matchupId=${m.matchupId} | Week ${m.week}: ${m.team1.managerName} (${m.team1.teamName}) ${m.team1.points.toFixed(1)} vs ${m.team2.managerName} (${m.team2.teamName}) ${m.team2.points.toFixed(1)} — winner: ${
          m.winnerUserId === m.team1.userId ? m.team1.managerName : m.winnerUserId === m.team2.userId ? m.team2.managerName : "tie"
        }`
    )
    .join("\n");

  return `You are writing content for a fantasy football league's history website, covering the ${season.year} season (${season.teamCount} teams).

FINAL STANDINGS:
${standingsLines}

SEASON NOTABLES:
${notableLines}

Champion: ${champion ? `${champion.managerName} (${champion.teamName})` : "unknown"}
Runner-up: ${runnerUp ? `${runnerUp.managerName} (${runnerUp.teamName})` : "unknown"}

REGULAR SEASON GAMES (one entry per line, "matchupId=..." is the ID you must echo back exactly):
${gameLines}

Write two things, and return ONLY the structured JSON described by the schema — no other commentary:

1. "seasonRecap": a 4-6 sentence recap of the ${season.year} season's overall story — the standings race, the championship outcome, and at least one of the season notables above. Sports-column tone: factual, a little color and personality, no purple prose, no invented facts or stats beyond what's given above.

2. "games": exactly one entry per matchupId listed above (same set, matchupId copied verbatim), each with a 2-3 sentence recap of that specific game — reference the score, the margin, and the managers by name. Vary your phrasing across games so they don't all read the same. Do not invent player names, stats, or events not present in the data given here.`;
}

async function generateForSeason(season: Season): Promise<Commentary[string]> {
  const yearMatchups = matchups.filter((m) => m.year === season.year && !m.isPlayoff);
  const prompt = buildPrompt(season, yearMatchups);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    output_config: { format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(`No text block in response for ${season.year}`);
  }
  const parsed = JSON.parse(textBlock.text) as { seasonRecap: string; games: { matchupId: string; recap: string }[] };

  const expectedIds = new Set(yearMatchups.map((m) => m.matchupId));
  const returnedIds = new Set(parsed.games.map((g) => g.matchupId));
  const missing = [...expectedIds].filter((id) => !returnedIds.has(id));
  if (missing.length > 0) {
    console.warn(`  Warning: ${season.year} is missing recaps for ${missing.length} game(s): ${missing.join(", ")}`);
  }

  const games: Record<string, string> = {};
  for (const g of parsed.games) games[g.matchupId] = g.recap;

  return { seasonRecap: parsed.seasonRecap, games };
}

async function main() {
  const targets = seasons.filter((s) => (onlyYear ? s.year === onlyYear : true));

  for (const season of targets) {
    if (!force && existing[String(season.year)]) {
      console.log(`Skipping ${season.year} (already generated; use --force to regenerate)`);
      continue;
    }
    console.log(`Generating commentary for ${season.year}...`);
    const result = await generateForSeason(season);
    existing[String(season.year)] = result;
    writeFileSync(OUT_FILE, JSON.stringify(existing, null, 2));
    console.log(`  Wrote ${season.year}: season recap + ${Object.keys(result.games).length} game recaps`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
