FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV MATO_PAPER_ALLOW_DEV=0
ENV PAPER_STATE_PATH=/data/paper.json
ENV PORT=8080
COPY src ./src
COPY public ./public
EXPOSE 8080
CMD ["node", "src/server.mjs"]
