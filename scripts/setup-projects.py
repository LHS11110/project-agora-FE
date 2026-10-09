#!/usr/bin/env python3
"""Configure FE, BE and DB for TLS; certificates must be supplied manually."""
from __future__ import annotations

import argparse
import importlib.util
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backend-dir', type=Path, default=ROOT.parent / 'project-agora-BE')
    parser.add_argument('--db-dir', type=Path, default=ROOT.parent / 'project-agora-DB')
    parser.add_argument('--tls-dir', type=Path, required=True, help='Directory of manually supplied certificates; see docs/TLS_SETUP.md.')
    parser.add_argument('--public-origin', default='https://localhost:8443')
    args = parser.parse_args()
    backend = args.backend_dir.expanduser().resolve()
    tls = args.tls_dir.expanduser().resolve()
    spec = importlib.util.spec_from_file_location('agora_backend_setup', backend / 'scripts/setup-docker.py')
    setup = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(setup)
    setup.prepare(args.db_dir, tls, args.public_origin)
    sync = setup.module_at('agora_frontend_env', backend / 'scripts/sync-docker-env.py')
    db = setup.module_at('agora_frontend_config', args.db_dir.expanduser().resolve() / 'ops/configure-db.py')
    env = ROOT / '.env'
    if env.is_symlink():
        raise ValueError('Refusing a symlinked frontend .env.')
    if not env.exists():
        sync.atomic_write_owner_only(env, (ROOT / '.env.example').read_text())
    values = sync.read_env(env)
    allowed_hosts = [host.strip() for host in values.get('VITE_ALLOWED_HOSTS', '').split(',') if host.strip()]
    allowed_hosts.append(urlsplit(args.public_origin).hostname)
    db.update_env_file(env, {
        'VITE_API_PROXY_TARGET': args.public_origin.rstrip('/'),
        'VITE_DOCKER_API_PROXY_TARGET': 'https://agora-nginx',
        'VITE_API_BASE_URL': '', 'VITE_WS_BASE_URL': args.public_origin.rstrip('/'),
        'SERVICE_TLS_CERT': str(tls / 'internal/frontend/fullchain.pem'),
        'SERVICE_TLS_KEY': str(tls / 'internal/frontend/privkey.pem'),
        'SERVICE_TLS_CA': str(tls / 'root-ca.pem'),
        'VITE_ALLOWED_HOSTS': ','.join(dict.fromkeys(allowed_hosts)),
    })
    print('FE, BE and DB configured for TLS. No certificates generated and no services started.')
    print('Continue with the startup commands in docs/TLS_SETUP.md.')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as error:
        print(f'Error: {error}', file=sys.stderr)
        sys.exit(1)
