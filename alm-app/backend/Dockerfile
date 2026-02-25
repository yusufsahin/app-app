# Build context must be repo root (alm-manifest-app) so manifest-platform-core-suite is available.
FROM python:3.12-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

FROM base AS builder
RUN pip install --no-cache-dir hatchling
# Install mpc from local manifest-platform-core-suite (no PyPI torch)
COPY manifest-platform-core-suite /tmp/mpc-suite
RUN pip install --no-cache-dir /tmp/mpc-suite
# Install alm (mpc already satisfied)
COPY alm-app/backend/pyproject.toml .
COPY alm-app/backend/src/ src/
RUN pip install --no-cache-dir .

FROM base AS runtime
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY alm-app/backend/src/ src/
COPY alm-app/backend/migrations/ migrations/
COPY alm-app/backend/alembic.ini .
COPY alm-app/backend/alm_meta/ alm_meta/
COPY alm-app/backend/entrypoint.sh .
RUN chmod +x entrypoint.sh
EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]
