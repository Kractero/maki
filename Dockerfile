FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install
RUN npx tailwindcss -i ./public/input.css -o ./public/output.css

FROM node:18-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY . .

EXPOSE 3333

ENV PORT 3333

ENV NODE_ENV production

CMD ["npm", "start"]