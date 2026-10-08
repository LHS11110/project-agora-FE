// Runs inside the Linux Node image. The host OS and repository layout are irrelevant.
import { cp, mkdir, mkdtemp, readlink, readdir, rename, rm, stat, symlink } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';

async function publishDist(source, output) {
  if (!(await stat(join(source, 'index.html'))).isFile()) throw new Error('Build is missing index.html');
  const releases = join(output, 'releases');
  await mkdir(releases, { recursive: true });
  const release = await mkdtemp(join(releases, 'release-'));
  const current = join(output, 'current');
  let previous;
  try { previous = await readlink(current); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const previousPath = previous ? resolve(output, previous) : undefined;
  const link = join(output, `.current-${process.pid}-${Date.now()}`);
  let published = false;
  try {
    // Retain prior hashed assets so already-open pages can load their lazy chunks.
    if (previousPath?.startsWith(`${resolve(releases)}/release-`)) {
      try { await cp(join(previousPath, 'assets'), join(release, 'assets'), { recursive: true }); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    await cp(source, release, { recursive: true });
    await symlink(`releases/${basename(release)}`, link);
    await rename(link, current); // Atomically switch the served tree, preserving the old release on failure.
    published = true;
    for (const item of await readdir(releases, { withFileTypes: true })) {
      const path = join(releases, item.name);
      if (item.isDirectory() && item.name.startsWith('release-') && path !== release && path !== previousPath) {
        await rm(path, { recursive: true });
      }
    }
  } finally {
    await rm(link, { force: true });
    if (!published) await rm(release, { recursive: true, force: true });
  }
}

export async function exportDist(source, output) {
  await mkdir(output, { recursive: true });
  const lock = join(output, '.deploy-lock');
  try { await mkdir(lock); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('Frontend export is already locked; verify no exporter is running before removing .deploy-lock.');
    throw error;
  }
  try { await publishDist(source, output); }
  finally { await rm(lock, { recursive: true, force: true }); }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  await exportDist(resolve(process.argv[2] || '/app/dist'), resolve(process.argv[3] || '/output'));
  console.log('Published frontend build through an atomic release link.');
}
