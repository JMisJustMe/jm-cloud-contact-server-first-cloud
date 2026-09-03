FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY JM_CLOUD_CONTACT_SERVER_v0_4_2.mjs ./
COPY public ./public
RUN mkdir -p /data && chown -R node:node /app /data
USER node
ENV NODE_ENV=production JM_CLOUD_MODE=production HOST=0.0.0.0 PORT=8791 JM_CLOUD_DATA=/data/JM_CLOUD_CONTACT_DATA_v0_4.json JM_CLOUD_PUBLIC=/app/public
EXPOSE 8791
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD wget -q -O - http://127.0.0.1:8791/ready >/dev/null || exit 1
CMD ["node","JM_CLOUD_CONTACT_SERVER_v0_4_2.mjs"]
