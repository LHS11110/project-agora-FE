import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default;
const srcDir = fileURLToPath(new URL('../src/', import.meta.url));
const FORM_TAGS = new Set(['input', 'textarea', 'select']);
const STATIC_SINGLETON_IDS = new Set([
  'canvas-entry-password',
]);

function walkSourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSourceFiles(full, out);
    else if (/\.(jsx?|tsx?)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

test('all JSX form controls declare an id or name attribute without unguarded static duplicate ids', () => {
  const missing = [];
  const staticIds = [];

  for (const file of walkSourceFiles(srcDir).sort()) {
    const code = fs.readFileSync(file, 'utf8');
    const ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
    const rel = path.relative(srcDir, file);
    traverse(ast, {
      JSXOpeningElement(p) {
        const nameNode = p.node.name;
        if (nameNode.type !== 'JSXIdentifier' || !FORM_TAGS.has(nameNode.name)) return;
        const attrs = p.node.attributes.filter((a) => a.type === 'JSXAttribute');
        const idAttr = attrs.find((a) => a.name.name === 'id');
        const nameAttr = attrs.find((a) => a.name.name === 'name');
        if (!idAttr && !nameAttr) {
          missing.push(`${rel}:${p.node.loc.start.line} <${nameNode.name}>`);
        }
        if (idAttr?.value?.type === 'StringLiteral' && !STATIC_SINGLETON_IDS.has(idAttr.value.value)) {
          staticIds.push(`${rel}:${p.node.loc.start.line} id="${idAttr.value.value}"`);
        }
      },
    });
  }

  assert.deepEqual(missing, [], `Form fields missing id or name:\n${missing.join('\n')}`);
  assert.deepEqual(staticIds, [], `Unexpected static form control id (use useId() for component instances):\n${staticIds.join('\n')}`);
});

test('dynamically created form elements and Monaco editor inputs assign id or name', () => {
  const offenders = [];
  for (const file of walkSourceFiles(srcDir).sort()) {
    const code = fs.readFileSync(file, 'utf8');
    const rel = path.relative(srcDir, file);
    const matches = [...code.matchAll(/createElement\(\s*['"](input|textarea|select)['"]\s*\)/g)];
    if (!matches.length) continue;
    // Every module dynamically creating a form element must set .name or .id on it.
    if (!/\.(name|id)\s*=|setAttribute\(\s*['"](name|id)['"]/.test(code)) {
      offenders.push(rel);
    }
  }
  assert.deepEqual(offenders, [], `Dynamic createElement form controls missing id/name: ${offenders.join(', ')}`);

  const monacoSource = fs.readFileSync(path.join(srcDir, 'canvas/CanvasCodeEditor.jsx'), 'utf8');
  assert.match(monacoSource, /textarea\.inputarea[\s\S]*\.(id|name)\s*=/);
});
