import type { JdParseResult } from "@/lib/llm/types";

export interface MatchCandidate {
  id: string;
  title: string;
  organization?: string;
  role?: string;
  rawText: string;
  skills: unknown;
  tags: unknown;
}

export interface MatchResult {
  experience: MatchCandidate;
  matchScore: number;
  matchedSkills: string[];
  matchedKeywords: string[];
  matchReason: string;
  recommended: boolean;
}

type JdLike =
  | JdParseResult
  | {
      parsedSkills?: unknown;
      parsedKeywords?: unknown;
      parsedRequirements?: unknown;
      skills?: unknown;
      keywords?: unknown;
      requirements?: unknown;
    };

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9一-鿿+#.]+/i)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function includesTerm(haystackText: string, haystackTokens: Set<string>, term: string) {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return false;
  return normalized.includes(" ")
    ? haystackText.includes(normalized)
    : haystackTokens.has(normalized);
}

function jdSkills(jd: JdLike) {
  return stringArray("skills" in jd ? jd.skills : []).concat(stringArray("parsedSkills" in jd ? jd.parsedSkills : []));
}

function jdKeywords(jd: JdLike) {
  return stringArray("keywords" in jd ? jd.keywords : []).concat(
    stringArray("parsedKeywords" in jd ? jd.parsedKeywords : []),
  );
}

export function scoreExperiences(jd: JdLike, experiences: MatchCandidate[]): MatchResult[];
export function scoreExperiences(experiences: MatchCandidate[], jd: JdLike): MatchResult[];
export function scoreExperiences(first: JdLike | MatchCandidate[], second: JdLike | MatchCandidate[]): MatchResult[] {
  const experiences = Array.isArray(first) ? first : (second as MatchCandidate[]);
  const jd = Array.isArray(first) ? (second as JdLike) : first;
  const skills = unique(jdSkills(jd));
  const keywords = unique(jdKeywords(jd));

  return experiences
    .map((experience, index) => {
      const skillValues = stringArray(experience.skills);
      const tagValues = stringArray(experience.tags);
      const haystackText = [experience.title, experience.organization, experience.role, experience.rawText, ...skillValues, ...tagValues]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const haystackTokens = new Set(tokenize(haystackText));
      const matchedSkills = skills.filter((skill) => includesTerm(haystackText, haystackTokens, skill));
      const matchedKeywords = keywords.filter(
        (keyword) =>
          !matchedSkills.some((skill) => skill.toLowerCase() === keyword.toLowerCase()) &&
          includesTerm(haystackText, haystackTokens, keyword),
      );
      const matchScore = matchedSkills.length * 2 + matchedKeywords.length;
      const reasonParts = [
        matchedSkills.length ? `Matched skills: ${matchedSkills.join(", ")}` : "",
        matchedKeywords.length ? `Matched keywords: ${matchedKeywords.join(", ")}` : "",
      ].filter(Boolean);

      return {
        experience,
        matchScore,
        matchedSkills,
        matchedKeywords,
        matchReason: reasonParts.join("; ") || "No direct JD skill or keyword overlap.",
        recommended: matchScore > 0,
        index,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore || a.index - b.index)
    .map(({ index: _index, ...result }) => result);
}
