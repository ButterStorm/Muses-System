import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const OFFICIAL_SKILLS_DIR = 'lib/agents/skills/official';
const EXCLUDED_SKILLS = new Set(['remotion']);

export interface AgentSkillConfig {
  path: string;
}

export const AGENT_SKILLS: AgentSkillConfig[] = discoverOfficialSkills();

export function getAgentSkillPaths(cwd: string = process.cwd()): string[] {
  return AGENT_SKILLS.map((skill) =>
    path.isAbsolute(skill.path) ? skill.path : path.resolve(cwd, skill.path)
  );
}

function discoverOfficialSkills(cwd: string = process.cwd()): AgentSkillConfig[] {
  const officialRoot = path.resolve(cwd, OFFICIAL_SKILLS_DIR);
  if (!existsSync(officialRoot)) return [];

  return readdirSync(officialRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !EXCLUDED_SKILLS.has(name))
    .filter((name) => existsSync(path.join(officialRoot, name, 'SKILL.md')))
    .sort()
    .map((name) => ({ path: path.posix.join(OFFICIAL_SKILLS_DIR, name) }));
}
