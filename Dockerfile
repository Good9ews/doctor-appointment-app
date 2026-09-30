# Production image: deps installed from the lockfile, devDeps pruned, runs as
# the unprivileged `node` user. Needs MONGODB_URI and JWT_SECRET at runtime.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY src ./src
USER node
EXPOSE 5000
CMD ["node", "src/app.js"]
