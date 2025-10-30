ARG TARGETARCH
ARG OS="linux"
ARG VERSION="0.14.0"

FROM alpine:3 as downloader
ARG TARGETARCH
ARG OS
ARG VERSION

RUN apk add --no-cache curl tar

WORKDIR /tmp
RUN if [ "${TARGETARCH}" = "amd64" ]; then \
      ARCH="amd64"; \
    elif [ "${TARGETARCH}" = "arm64" ]; then \
      ARCH="arm64"; \
    else \
      ARCH="${TARGETARCH}"; \
    fi && \
    curl -sL https://github.com/prometheus-community/smartctl_exporter/releases/download/v${VERSION}/smartctl_exporter-${VERSION}.${OS}-${ARCH}.tar.gz | tar xz

FROM alpine:3
LABEL maintainer="Homelab"

RUN apk add --no-cache smartmontools

ARG TARGETARCH
ARG OS
ARG VERSION

COPY --from=downloader /tmp/smartctl_exporter-${VERSION}.${OS}-${TARGETARCH}/smartctl_exporter /bin/smartctl_exporter

EXPOSE 9633
USER nobody
ENTRYPOINT ["/bin/smartctl_exporter"]
