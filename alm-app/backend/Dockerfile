# Build context: parent of alm-manifest-app (so statelesspy and alm-manifest-app are in context).
FROM python:3.12-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

FROM base AS builder
RUN pip install --no-cache-dir hatchling
# Install statelesspy from local repo (core library)
COPY statelesspy /tmp/statelesspy-suite
RUN pip install --no-cache-dir /tmp/statelesspy-suite
# Install mpc from local manifest-platform-core-suite (no PyPI torch)
COPY alm-manifest-app/manifest-platform-core-suite /tmp/mpc-suite
RUN pip install --no-cache-dir /tmp/mpc-suite
# Install alm (statelesspy and mpc already satisfied). Drop path source for statelesspy so pip uses installed pkg.
COPY alm-manifest-app/alm-app/backend/pyproject.toml .
COPY alm-manifest-app/alm-app/backend/src/ src/
RUN sed -i '/statelesspy = { path/d' pyproject.toml && pip install --no-cache-dir .

FROM base AS runtime
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY alm-manifest-app/alm-app/backend/src/ src/
COPY alm-manifest-app/alm-app/backend/migrations/ migrations/
COPY alm-manifest-app/alm-app/backend/alembic.ini .
COPY alm-manifest-app/alm-app/backend/alm_meta/ alm_meta/
COPY alm-manifest-app/alm-app/backend/entrypoint.sh .
RUN chmod +x entrypoint.sh
EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]
