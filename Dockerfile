# Stage 1: Build Next.js frontend
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build


# Stage 2: Python backend runtime
FROM python:3.12-slim AS runtime

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

# Install backend dependencies
COPY backend/pyproject.toml ./backend/
RUN cd backend && uv pip install --system fastapi "uvicorn[standard]" aiosqlite "litellm>=1.56.0" "pydantic>=2.0.0"

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend-builder /app/frontend/out ./frontend/out

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
