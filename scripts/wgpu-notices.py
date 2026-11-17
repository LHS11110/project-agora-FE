"""Retain Cargo dependency metadata and upstream license texts beside the WASM."""
import json
from pathlib import Path
import re
import shutil
import subprocess

root = Path(__file__).resolve().parent.parent
metadata = json.loads(subprocess.check_output([
    'cargo', 'metadata', '--manifest-path', str(root / 'rust/agora-wgpu-renderer/Cargo.toml'),
    '--locked', '--format-version', '1', '--filter-platform', 'wasm32-unknown-unknown',
]))
resolved = {node['id'] for node in metadata['resolve']['nodes']}
output = root / 'public/licenses/rust'
output.mkdir(parents=True, exist_ok=True)
components = []
for package in metadata['packages']:
    if package['id'] not in resolved or package['name'] == 'agora-wgpu-renderer':
        continue
    directory = Path(package['manifest_path']).parent
    folder = output / (package['name'] + '-' + package['version'])
    folder.mkdir(exist_ok=True)
    notices = []
    for source in sorted(directory.iterdir()):
        if source.is_file() and re.match(r'^(license|licence|notice|copying|copyright)([.\-_]|$)', source.name, re.I):
            shutil.copyfile(source, folder / source.name)
            notices.append(folder.name + '/' + source.name)
    # Some crates put their dual-license texts in a dedicated directory.
    extra = directory / 'LICENSES'
    if extra.is_dir():
        for source in sorted(extra.rglob('*')):
            if source.is_file():
                dest = folder / 'LICENSES' / source.relative_to(extra)
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, dest)
                notices.append(str(dest.relative_to(output)))
    supplemental = root / 'licenses/upstream/rust' / folder.name
    if not notices and supplemental.is_dir():
        for source in sorted(supplemental.iterdir()):
            if source.is_file():
                shutil.copyfile(source, folder / source.name)
                notices.append(folder.name + '/' + source.name)
    components.append({'name': package['name'], 'version': package['version'],
        'license': package['license'], 'repository': package['repository'], 'notices': notices})
(output / 'inventory.json').write_text(json.dumps({'scope': 'Cargo resolved wasm32 dependency superset',
    'components': sorted(components, key=lambda entry: entry['name'])}, indent=2) + '\n')
print('Retained Rust dependency notices:', len(components))
