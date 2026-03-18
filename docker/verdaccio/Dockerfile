FROM verdaccio/verdaccio:6

USER root
RUN npm install -g --registry https://mirrors.holdenitdown.net/npm/ verdaccio-aws-s3-storage
USER verdaccio
