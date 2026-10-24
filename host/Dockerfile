FROM node:22-alpine
WORKDIR /app
COPY package.json /app/package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY . /app/
RUN node --check JM_CLOUD_CONTACT_SERVER_v0_5_1_HOSTED_DESCENDANT.mjs \
 && node --check host/init-custody.mjs \
 && node --check host/local-rd-service.mjs \
 && node --test bridge/revolving-door-v0_1_2_challenge/test/*.test.mjs
RUN mkdir -p /data /rdstate && chown -R node:node /app /data /rdstate
USER node
EXPOSE 8791
CMD ["node", "JM_CLOUD_CONTACT_SERVER_v0_5_1_HOSTED_DESCENDANT.mjs"]
