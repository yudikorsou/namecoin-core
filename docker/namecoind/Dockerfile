# Namecoin Core for umbrelOS
# Builds namecoind + namecoin-cli from the official, signed upstream tag
# (github.com/namecoin/namecoin-core) using Namecoin's own "depends" system,
# so the binaries are built the same way as the official release binaries.

ARG DEBIAN_VERSION=trixie-slim

########################
# Build stage
########################
FROM debian:${DEBIAN_VERSION} AS build

ARG NC_TAG=nc31.1
# Commit the nc31.1 tag points to (verified signed tag by Daniel Kraft).
ARG NC_COMMIT=462d5412ec2887155684c1b8c30abfe095395d3e

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential cmake pkg-config git ca-certificates curl \
      python3 bison byacc make patch xz-utils \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /src
RUN git clone --depth 1 --branch "${NC_TAG}" https://github.com/namecoin/namecoin-core.git . \
 && test "$(git rev-parse HEAD)" = "${NC_COMMIT}" \
 || (echo "ERROR: ${NC_TAG} does not point to expected commit ${NC_COMMIT}" >&2; exit 1)

# Dependencies (boost, libevent, sqlite) built from source, pinned by hash.
RUN make -C depends -j"$(nproc)" \
      NO_QT=1 NO_ZMQ=1 NO_USDT=1 NO_IPC=1 NO_QR=1

RUN HOST="$(ls -d depends/*-linux-gnu* | head -1)" \
 && cmake -B build --toolchain "${HOST}/toolchain.cmake" \
      -DBUILD_GUI=OFF \
      -DBUILD_TESTS=OFF \
      -DBUILD_BENCH=OFF \
      -DENABLE_IPC=OFF \
      -DENABLE_WALLET=ON \
      -DWITH_ZMQ=OFF \
      -DINSTALL_MAN=OFF \
      -DWITH_CCACHE=OFF \
 && cmake --build build -j"$(nproc)" --target namecoind namecoin-cli \
 && strip build/bin/namecoind build/bin/namecoin-cli \
 && ./build/bin/namecoind -version | head -1

########################
# Runtime stage
########################
FROM debian:${DEBIAN_VERSION}

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build /src/build/bin/namecoind /src/build/bin/namecoin-cli /usr/local/bin/
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod 0755 /usr/local/bin/entrypoint.sh

# Umbrel app data is owned by uid/gid 1000
USER 1000:1000
VOLUME ["/data"]

# 8334 = mainnet P2P, 8336 = mainnet JSON-RPC
EXPOSE 8334 8336

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
