#!/bin/sh
# Namecoin Core entrypoint for umbrelOS
# - On first start: creates RPC credentials and a default namecoin.conf
# - On every start: derives an -rpcauth line (salted HMAC) from the
#   credentials so no plaintext password is ever passed to namecoind.
set -eu

DATA="${NAMECOIN_DATA:-/data}"
CONF="$DATA/namecoin.conf"
CRED="$DATA/rpc-credentials.env"

umask 077
mkdir -p "$DATA"

if [ ! -s "$CRED" ]; then
  echo "[entrypoint] Generating RPC credentials"
  {
    echo "RPC_USER=umbrel"
    echo "RPC_PASSWORD=$(openssl rand -hex 32)"
  } > "$CRED"
fi
# shellcheck disable=SC1090
. "$CRED"

if [ ! -s "$CONF" ]; then
  echo "[entrypoint] Writing default namecoin.conf (edit it freely, it is kept across updates)"
  cat > "$CONF" <<'EOF'
# Namecoin Core configuration (umbrelOS)
# RPC credentials are injected at startup from rpc-credentials.env

server=1
listen=1
txindex=1

# JSON-RPC: reachable from other apps on the Umbrel and from your LAN only
rpcbind=0.0.0.0
rpcport=8336
rpcallowip=127.0.0.1
rpcallowip=10.0.0.0/8
rpcallowip=172.16.0.0/12
rpcallowip=192.168.0.0/16

port=8334
dbcache=450
maxconnections=40
EOF
fi

SALT="$(openssl rand -hex 16)"
HMAC="$(printf '%s' "$RPC_PASSWORD" | openssl dgst -sha256 -hmac "$SALT" -r | cut -d' ' -f1)"

echo "[entrypoint] Starting $(namecoind -version | head -1)"
exec namecoind \
  -datadir="$DATA" \
  -conf="$CONF" \
  -rpcauth="${RPC_USER}:${SALT}\$${HMAC}" \
  -printtoconsole \
  "$@"
