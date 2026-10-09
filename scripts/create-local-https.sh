#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="${1:-$PROJECT_DIR/.local-https}"
umask 077
mkdir -p "$CERT_DIR"
chmod 700 "$CERT_DIR"

if [ ! -f "$CERT_DIR/root-ca.pem" ] || [ ! -f "$CERT_DIR/root-ca.key" ]; then
  if [ -e "$CERT_DIR/root-ca.pem" ] || [ -e "$CERT_DIR/root-ca.key" ]; then
    echo 'Incomplete local CA; restore its matching certificate/key before proceeding.' >&2
    exit 1
  fi
  openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 3650 \
    -subj '/CN=Agora Local Development CA' \
    -addext 'basicConstraints=critical,CA:TRUE,pathlen:0' \
    -addext 'keyUsage=critical,keyCertSign,cRLSign' \
    -keyout "$CERT_DIR/root-ca.key" -out "$CERT_DIR/root-ca.pem"
fi

if [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ] \
  && openssl x509 -checkend 2592000 -noout -in "$CERT_DIR/fullchain.pem" >/dev/null \
  && openssl verify -CAfile "$CERT_DIR/root-ca.pem" -verify_hostname agora-nginx "$CERT_DIR/fullchain.pem" >/dev/null 2>&1; then
  openssl verify -CAfile "$CERT_DIR/root-ca.pem" -verify_hostname localhost "$CERT_DIR/fullchain.pem"
  openssl verify -CAfile "$CERT_DIR/root-ca.pem" -verify_ip 127.0.0.1 "$CERT_DIR/fullchain.pem"
  echo "Local HTTPS certificates are ready: $CERT_DIR"
  exit 0
fi

ISSUE_DIR="$(mktemp -d "$CERT_DIR/.issue.XXXXXX")"
trap 'rm -rf "$ISSUE_DIR"' EXIT
cat > "$ISSUE_DIR/extensions.cnf" <<'EOF'
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:localhost,DNS:agora-nginx,DNS:nginx,IP:127.0.0.1,IP:::1
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
EOF
openssl req -new -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' \
  -keyout "$ISSUE_DIR/privkey.pem" -out "$ISSUE_DIR/request.csr"
openssl x509 -req -in "$ISSUE_DIR/request.csr" -CA "$CERT_DIR/root-ca.pem" \
  -CAkey "$CERT_DIR/root-ca.key" -set_serial "0x$(openssl rand -hex 16)" \
  -sha256 -days 365 -extfile "$ISSUE_DIR/extensions.cnf" -out "$ISSUE_DIR/localhost.pem"
cat "$ISSUE_DIR/localhost.pem" "$CERT_DIR/root-ca.pem" > "$ISSUE_DIR/fullchain.pem"
openssl verify -CAfile "$CERT_DIR/root-ca.pem" -verify_hostname localhost "$ISSUE_DIR/fullchain.pem"
openssl verify -CAfile "$CERT_DIR/root-ca.pem" -verify_ip 127.0.0.1 "$ISSUE_DIR/fullchain.pem"
mv "$ISSUE_DIR/privkey.pem" "$CERT_DIR/privkey.pem"
mv "$ISSUE_DIR/fullchain.pem" "$CERT_DIR/fullchain.pem"
chmod 600 "$CERT_DIR"/*.pem "$CERT_DIR"/*.key
echo "Local HTTPS certificates are ready: $CERT_DIR"
