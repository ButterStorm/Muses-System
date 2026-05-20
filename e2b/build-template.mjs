import { existsSync, readFileSync } from 'node:fs';
import { Template, defaultBuildLogger } from 'e2b';
import { template } from './template.mjs';

loadEnvFile('.env.local');
loadEnvFile('.env');

const templateName = process.env.E2B_SANDBOX_TEMPLATE || 'muses-node22';

await Template.build(template, templateName, {
  cpuCount: 2,
  memoryMB: 4096,
  onBuildLogs: defaultBuildLogger(),
});

console.log(`Built E2B template: ${templateName}`);

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
