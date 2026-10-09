#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="${1:-$PROJECT_DIR/.local-https}"
bash "$PROJECT_DIR/scripts/create-local-https.sh" "$CERT_DIR"
umask 077
for service in spring cpp frontend redis-insight mssql; do
  target="$CERT_DIR/internal/$service"
  mkdir -p "$target"
  case "$service" in
    frontend) hostname=agora-frontend-dev ;;
    redis-insight) hostname=redis-insight ;;
    *) hostname="agora-$service" ;;
  esac
  if [ -f "$target/fullchain.pem" ] && [ -f "$target/privkey.pem" ] \
    && openssl x509 -checkend 2592000 -noout -in "$target/fullchain.pem" >/dev/null \
    && openssl verify -CAfile "$CERT_DIR/root-ca.pem" -verify_hostname "$hostname" "$target/fullchain.pem" >/dev/null 2>&1; then
    cp "$CERT_DIR/root-ca.pem" "$target/ca.pem"
    continue
  fi
  work="$(mktemp -d "$target/.issue.XXXXXX")"
  trap 'rm -rf "$work"' EXIT
  cat > "$work/extensions.cnf" <<EOF
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:$hostname,DNS:$service,DNS:localhost,IP:127.0.0.1,IP:::1
EOF
  openssl req -new -newkey rsa:2048 -nodes -sha256 -subj "/CN=$hostname" \
    -keyout "$work/privkey.pem" -out "$work/request.csr"
  openssl x509 -req -in "$work/request.csr" -CA "$CERT_DIR/root-ca.pem" -CAkey "$CERT_DIR/root-ca.key" \
    -set_serial "0x$(openssl rand -hex 16)" -sha256 -days 365 \
    -extfile "$work/extensions.cnf" -out "$work/cert.pem"
  openssl verify -CAfile "$CERT_DIR/root-ca.pem" -verify_hostname "$hostname" "$work/cert.pem"
  cat "$work/cert.pem" "$CERT_DIR/root-ca.pem" > "$target/fullchain.pem"
  mv "$work/privkey.pem" "$target/privkey.pem"
  if [ "$service" = mssql ]; then
    openssl rsa -in "$target/privkey.pem" -traditional -out "$target/server.key"
    mv "$target/server.key" "$target/privkey.pem"
  fi
  cp "$CERT_DIR/root-ca.pem" "$target/ca.pem"
  rm -rf "$work"
  trap - EXIT
done
echo "Internal service TLS certificates are ready: $CERT_DIR/internal"
