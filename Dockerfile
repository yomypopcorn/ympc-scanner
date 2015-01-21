FROM node:0.10.35

RUN groupadd -r yomypopcorn && useradd -r -g yomypopcorn yomypopcorn
RUN mkdir /src

COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

COPY . /src/

RUN \
  chown -R yomypopcorn:yomypopcorn /src && \
  cd /src/ && \
  npm install -g

USER yomypopcorn

WORKDIR /src

CMD [ "/entrypoint.sh" ]
