"""Insert missing ``member`` system role on existing tenants (YAML parity with new signups).

Revision ID: 058
Revises: 057
Create Date: 2026-04-19

New tenants already receive ``member`` from ``default_roles.yaml``. Older databases
may lack this row; ``POST /admin/users`` defaults ``role_slug`` to ``member``.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "058"
down_revision = "057"
branch_labels = None
depends_on = None

_BACKFILL_MARKER = "Backfilled by migration 058."

_MEMBER_PRIVILEGE_CODES = (
    "project:read",
    "artifact:read",
    "artifact:update",
    "artifact:comment",
    "artifact:transition",
    "task:create",
    "task:read",
    "task:update",
    "task:delete",
    "task:assign",
    "workflow:read",
    "manifest:read",
)


def upgrade() -> None:
    conn = op.get_bind()
    description = (
        "Standard collaborative tenant member (default for admin-created users). "
        + _BACKFILL_MARKER
    )

    conn.execute(
        sa.text(
            """
            WITH missing AS (
              SELECT t.id AS tenant_id
              FROM tenants t
              WHERE t.deleted_at IS NULL
                AND NOT EXISTS (
                  SELECT 1
                  FROM roles r
                  WHERE r.tenant_id = t.id
                    AND r.slug = 'member'
                )
            ),
            inserted_roles AS (
              INSERT INTO roles (
                id,
                tenant_id,
                name,
                slug,
                description,
                is_system,
                hierarchy_level,
                created_at,
                updated_at
              )
              SELECT
                gen_random_uuid(),
                m.tenant_id,
                'Member',
                'member',
                :role_description,
                TRUE,
                15,
                NOW(),
                NOW()
              FROM missing m
              RETURNING id, tenant_id
            )
            INSERT INTO role_privileges (role_id, privilege_id)
            SELECT ir.id, rp.privilege_id
            FROM inserted_roles ir
            INNER JOIN roles dev
              ON dev.tenant_id = ir.tenant_id
             AND dev.slug = 'developer'
             AND dev.deleted_at IS NULL
            INNER JOIN role_privileges rp ON rp.role_id = dev.id
            """
        ),
        {"role_description": description},
    )

    codes_in = ", ".join(f"'{code}'" for code in _MEMBER_PRIVILEGE_CODES)
    conn.execute(
        sa.text(
            f"""
            INSERT INTO role_privileges (role_id, privilege_id)
            SELECT r.id, p.id
            FROM roles r
            INNER JOIN privileges p ON p.code IN ({codes_in})
            WHERE r.slug = 'member'
              AND r.deleted_at IS NULL
              AND r.description LIKE :marker
              AND NOT EXISTS (
                SELECT 1 FROM role_privileges rp WHERE rp.role_id = r.id
              )
            """
        ),
        {"marker": f"%{_BACKFILL_MARKER}%"},
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            DELETE FROM roles
            WHERE slug = 'member'
              AND description LIKE :marker
            """
        ),
        {"marker": f"%{_BACKFILL_MARKER}%"},
    )
