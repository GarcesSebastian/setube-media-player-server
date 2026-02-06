FROM node:20-alpine

RUN apk add --no-cache ffmpeg yt-dlp python3

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

EXPOSE 4000
CMD ["npm", "start"]