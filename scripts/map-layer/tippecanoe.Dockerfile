# tippecanoe (https://github.com/felt/tippecanoe), which builds the cave
# layer's vector tiles (build-tiles.js). Built once, locally:
#   docker build -t opencaves-tippecanoe -f scripts/map-layer/tippecanoe.Dockerfile scripts/map-layer
FROM debian:bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends build-essential git ca-certificates libsqlite3-dev zlib1g-dev \
 && git clone --depth 1 https://github.com/felt/tippecanoe.git /src \
 && make -C /src -j"$(nproc)" && make -C /src install

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends libsqlite3-0 zlib1g libstdc++6 && rm -rf /var/lib/apt/lists/*
COPY --from=build /usr/local/bin/tippecanoe* /usr/local/bin/tile-join /usr/local/bin/
WORKDIR /data
