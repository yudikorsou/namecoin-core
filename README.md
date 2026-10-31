# Namecoin Core — Umbrel community app store

Run a fully validating [Namecoin](https://www.namecoin.org) node on umbrelOS.

The node is built from the **official, signed upstream release**
([`namecoin/namecoin-core`](https://github.com/namecoin/namecoin-core), tag `nc31.1`,
commit `462d5412ec`). Nothing in Namecoin's consensus or code is changed: the
Dockerfile clones the tag, refuses to build if it doesn't point at the expected
commit, and compiles it with Namecoin's own pinned `depends` toolchain.

## What you get

| | |
|---|---|
| **Namecoin Core 31.1** | `namecoind` + `namecoin-cli`, mainnet, `txindex=1`, wallet support compiled in |
| **Dashboard** | Sync progress, peers, mempool, disk usage, a name lookup (`d/…`, `id/…`) against your own chain, and RPC connection details |
| **Ports** | `8334` P2P · `8336` JSON-RPC (LAN only) · `8339` dashboard |

## Install on your Umbrel

1. Build the images once (see below) and make both GHCR packages **public**.
2. On your Umbrel: **App Store → ⋯ (top right) → Community App Stores** and add
   `https://github.com/yudikorsou/namecoin-core`
3. Open the *yudikorsou* store and install **Namecoin Core**.

## Building the images

The app pulls two images:

- `ghcr.io/yudikorsou/namecoin-core:31.1`
- `ghcr.io/yudikorsou/namecoin-core-ui:1.0.0`

After pushing this repo to GitHub: **Actions → Build images → Run workflow**. It
builds amd64 and arm64 on native runners (≈30–60 min for the node), then
publishes multi-arch tags. Afterwards open each package under
*github.com/yudikorsou?tab=packages → Package settings* and set visibility to
**Public**, otherwise Umbrel can't pull them.

Local build (optional):

```sh
docker build -t ghcr.io/yudikorsou/namecoin-core:31.1   docker/namecoind
docker build -t ghcr.io/yudikorsou/namecoin-core-ui:1.0.0 docker/ui
```

## Data & configuration

Everything lives in the app's data folder on the Umbrel
(`~/umbrel/app-data/yudikorsou-namecoin-core/data/namecoin/`):

- `namecoin.conf` — created on first start, yours to edit (kept on updates)
- `rpc-credentials.env` — RPC user/password generated on first start. namecoind
  only ever receives a salted `-rpcauth` hash of it.

Use the CLI from the Umbrel shell:

```sh
docker exec -it yudikorsou-namecoin-core_namecoind_1 \
  sh -c '. /data/rpc-credentials.env && namecoin-cli -datadir=/data -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD getblockchaininfo'
```

## Updating to a new Namecoin release

1. In `docker/namecoind/Dockerfile` set `NC_TAG` and `NC_COMMIT` (verify the tag
   signature on GitHub first).
2. Bump the image tag in `yudikorsou-namecoin-core/docker-compose.yml`, the
   `version`/`releaseNotes` in `umbrel-app.yml`, and the tag in the workflow's
   `manifest` job.
3. Run the workflow, then update the app from the Umbrel App Store.

## Credits

Namecoin Core © The Namecoin and Bitcoin Core developers, MIT license. Logo from
[namecoin/namecoin-graphics](https://github.com/namecoin/namecoin-graphics).
