FROM node:0.10.35

RUN groupadd -r yomypopcorn && useradd -r -g yomypopcorn yomypopcorn
