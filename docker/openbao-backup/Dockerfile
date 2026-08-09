FROM docker.io/library/alpine:3.22@sha256:4bcff63911fcb4448bd4fdacec207030997caf25e9bea4045fa6c8c44de311d1

ARG APK_MIRROR=https://mirrors.holdenitdown.net/apk

RUN printf '%s\n' \
      "${APK_MIRROR}/alpine/v3.22/main" \
      "${APK_MIRROR}/alpine/v3.22/community" \
      > /etc/apk/repositories \
    && apk add --no-cache \
      age=1.2.1-r10 \
      aws-cli=2.27.25-r0 \
      bash=5.2.37-r0 \
      ca-certificates=20260611-r0 \
      coreutils=9.7-r1 \
      curl=8.14.1-r3 \
      jq=1.8.1-r0 \
      openbao=2.4.3-r2

COPY --chmod=0555 backup.sh /usr/local/bin/openbao-backup
COPY --chmod=0555 retention.sh /usr/local/bin/openbao-retention

ENV HOME=/nonexistent
USER 65532:65532
WORKDIR /
CMD ["openbao-backup"]
