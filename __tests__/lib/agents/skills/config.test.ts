import { AGENT_SKILLS, getAgentSkillPaths } from '@/lib/agents/skills/config';

describe('agent skills config', () => {
  it('discovers only official built-in skills', () => {
    expect(AGENT_SKILLS).toContainEqual({ path: 'lib/agents/skills/official/jason-writing-style' });
    expect(AGENT_SKILLS).toContainEqual({ path: 'lib/agents/skills/official/hyperframes' });
    expect(AGENT_SKILLS).toContainEqual({ path: 'lib/agents/skills/official/whisper-subtitle' });
    expect(AGENT_SKILLS.some((skill) => skill.path.includes('remotion'))).toBe(false);
    expect(AGENT_SKILLS.some((skill) => skill.path.includes('.agents/skills'))).toBe(false);
    expect(AGENT_SKILLS.every((skill) => skill.path.startsWith('lib/agents/skills/official/'))).toBe(true);
  });

  it('returns absolute skill paths for the runtime resource loader', () => {
    const paths = getAgentSkillPaths('/repo');
    expect(paths).toContain('/repo/lib/agents/skills/official/jason-writing-style');
    expect(paths).toContain('/repo/lib/agents/skills/official/hyperframes');
    expect(paths.some((skillPath) => skillPath.includes('/.agents/skills/'))).toBe(false);
    expect(paths.some((skillPath) => skillPath.includes('remotion'))).toBe(false);
  });
});
