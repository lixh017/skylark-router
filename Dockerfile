# ---- Stage 1: Build frontend ----
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ---- Stage 2: Build backend (with embedded frontend) ----
FROM golang:1.22-alpine AS backend-build
WORKDIR /app/backend
ARG VERSION=dev
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ .
COPY --from=frontend-build /app/frontend/dist/ ./static/
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags "-X skylark-router/version.Version=${VERSION} -X skylark-router/version.GitCommit=${GIT_COMMIT} -X skylark-router/version.BuildTime=${BUILD_TIME}" \
    -o /app/skylark-router .

# ---- Stage 3: Runtime ----
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=backend-build /app/skylark-router .
EXPOSE 8080
ENV PORT=8080
CMD ["./skylark-router"]
