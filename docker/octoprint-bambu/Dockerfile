ARG OCTOPRINT_VERSION=latest
ARG BAMBU_PLUGIN_REPO=https://github.com/jneilliii/OctoPrint-BambuPrinter
ARG BAMBU_PLUGIN_BRANCH=master

FROM octoprint/octoprint:${OCTOPRINT_VERSION}

ARG BAMBU_PLUGIN_REPO
ARG BAMBU_PLUGIN_BRANCH

RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN pip install \
    "paho-mqtt<2" \
    "pybambu>=1.0.1" \
    python-dateutil

RUN pip install "${BAMBU_PLUGIN_REPO}/archive/${BAMBU_PLUGIN_BRANCH}.zip"

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5000/ || exit 1