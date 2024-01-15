FROM node:21-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

FROM node:21-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY . .

RUN apk --no-cache add curl

RUN npx tailwindcss -i ./public/input.css -o ./public/output.css

EXPOSE 3333

ENV PORT 3333

ENV NODE_ENV production

CMD ["npm", "start"]