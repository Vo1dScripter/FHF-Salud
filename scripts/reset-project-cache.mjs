import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd());
const stateDir = path.join(projectRoot, '.template-state');
const stateFile = path.join(stateDir, 'project-root.json');
const nextStateFile = path.join(projectRoot, '.next', 'required-server-files.json');
const runtimeEntries = [
  '.next',
  '.swc',
  '.turbo',
  'build',
  'coverage',
  'out',
  'tsconfig.tsbuildinfo',
];
const forceReset = process.argv.includes('--force');

async function readJson(filePath) {
  try {
    const contents = await readFile(filePath, 'utf8');
    return JSON.parse(contents);
  } catch {
    return null;
  }
}

async function findRecordedRoot() {
  const state = await readJson(stateFile);

  if (typeof state?.projectRoot === 'string' && state.projectRoot.length > 0) {
    return path.resolve(state.projectRoot);
  }

  const nextState = await readJson(nextStateFile);
  const nextRoot =
    nextState?.appDir ?? nextState?.config?.outputFileTracingRoot ?? null;

  if (typeof nextRoot === 'string' && nextRoot.length > 0) {
    return path.resolve(nextRoot);
  }

  return null;
}

async function clearRuntimeCache() {
  await Promise.all(
    runtimeEntries.map((entry) =>
      rm(path.join(projectRoot, entry), {
        force: true,
        recursive: true,
      }),
    ),
  );
}

const recordedRoot = await findRecordedRoot();
const shouldReset =
  forceReset || (recordedRoot !== null && recordedRoot !== projectRoot);

if (shouldReset) {
  await clearRuntimeCache();

  if (recordedRoot && recordedRoot !== projectRoot) {
    process.stdout.write(
      `Removed stale Next/SWC cache copied from ${recordedRoot} to ${projectRoot}.\n`,
    );
  }
}

await mkdir(stateDir, { recursive: true });
await writeFile(stateFile, JSON.stringify({ projectRoot }, null, 2) + '\n');
