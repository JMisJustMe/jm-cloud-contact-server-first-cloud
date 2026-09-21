FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY gateway-cading-v0.2 ./gateway-cading-v0.2
RUN node --check gateway-cading-v0.2/JM_SOVEREIGN_AGENT_GATEWAY_CADING_JS_CARRIER_v0_2.mjs \
 && node --check gateway-cading-v0.2/JM_SOVEREIGN_AGENT_GATEWAY_API_CARRIER_v0_2.mjs \
 && echo "2a1a6e82f615599c9c79f8c5d21a0978cfbf977f566957de1f8324e276ac7479  gateway-cading-v0.2/JM_SOVEREIGN_AGENT_GATEWAY_v0_2.cading" | sha256sum -c - \
 && echo "f3330a26238be993dc0ad0a0dc8cf3c9a2c703fe6e577a52be3eb4482c228b7b  gateway-cading-v0.2/JM_SOVEREIGN_AGENT_GATEWAY_CADING_JS_CARRIER_v0_2.mjs" | sha256sum -c -
RUN mkdir -p /data && chown -R node:node /app /data
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8791 JM_GATEWAY_DATA=/data/JM_SOVEREIGN_AGENT_GATEWAY_STORE_v0_2.json JM_GATEWAY_ACP_ENABLED=true
EXPOSE 8791
HEALTHCHECK --interval=30s --timeout=5s --start-period=8s --retries=3 CMD wget -q -O - http://127.0.0.1:${PORT}/ready >/dev/null || exit 1
CMD ["node","gateway-cading-v0.2/JM_SOVEREIGN_AGENT_GATEWAY_API_CARRIER_v0_2.mjs"]
