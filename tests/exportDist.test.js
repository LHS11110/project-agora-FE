import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, copyFile, readFile, readlink, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportDist } from '../build/exportDist.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

test('publishes complete releases, keeps old chunks, preserves current on failure, releases lock', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agora-export-'));
  const source = join(root, 'dist'), output = join(root, 'output');
  try {
    await mkdir(join(source, 'assets'), { recursive: true });
    await writeFile(join(source, 'index.html'), 'version1');
    await writeFile(join(source, 'assets', 'old-hash.js'), 'old');
    await exportDist(source, output);
    assert.equal(await readFile(join(output, 'current', 'index.html'), 'utf8'), 'version1');
    await rm(join(source, 'assets', 'old-hash.js'));
    await writeFile(join(source, 'index.html'), 'version2');
    await writeFile(join(source, 'assets', 'new-hash.js'), 'new');
    await exportDist(source, output);
    assert.equal(await readFile(join(output, 'current', 'index.html'), 'utf8'), 'version2');
    assert.equal(await readFile(join(output, 'current', 'assets', 'old-hash.js'), 'utf8'), 'old');
    const active = await readlink(join(output, 'current'));
    await rm(join(source, 'index.html'));
    await assert.rejects(exportDist(source, output));
    assert.equal(await readlink(join(output, 'current')), active);
    await writeFile(join(source, 'index.html'), 'version3');
    await exportDist(source, output);
    assert.equal((await readdir(join(output, 'releases'))).length, 2);
    assert.equal(await readFile(join(output, 'current', 'assets', 'old-hash.js'), 'utf8'), 'old');
    await mkdir(join(output, '.deploy-lock'));
    await assert.rejects(exportDist(source, output), /locked/);
    assert.equal(await readFile(join(output, 'current', 'index.html'), 'utf8'), 'version3');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('CLI export works when the repository path contains spaces', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agora path with spaces '));
  try {
    const script=join(root,'exportDist.mjs'), source=join(root,'dist'), output=join(root,'output');
    await copyFile(new URL('../build/exportDist.js',import.meta.url),script);
    await mkdir(source);
    await writeFile(join(source,'index.html'),'path-space-build');
    await promisify(execFile)(process.execPath,[script,source,output]);
    assert.equal(await readFile(join(output,'current','index.html'),'utf8'),'path-space-build');
  } finally { await rm(root,{recursive:true,force:true}); }
});
