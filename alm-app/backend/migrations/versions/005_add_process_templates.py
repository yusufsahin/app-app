"""Add process_templates and process_template_versions tables.

Revision ID: 005
Revises: 004
Create Date: 2026-02-23

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "process_templates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("slug", sa.String(50), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("is_builtin", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_unique_constraint("uq_process_template_slug", "process_templates", ["slug"])
    op.create_index("ix_process_templates_slug", "process_templates", ["slug"])

    op.create_table(
        "process_template_versions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "template_id",
            sa.Uuid(),
            nullable=False,
        ),
        sa.Column("version", sa.String(20), nullable=False),
        sa.Column("manifest_bundle", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(
            ["template_id"],
            ["process_templates.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("template_id", "version", name="uq_process_template_version"),
    )
    op.create_index(
        "ix_process_template_versions_template_id",
        "process_template_versions",
        ["template_id"],
    )

    op.create_foreign_key(
        "fk_projects_process_template_version_id",
        "projects",
        "process_template_versions",
        ["process_template_version_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_projects_process_template_version_id",
        "projects",
        type_="foreignkey",
    )
    op.drop_table("process_template_versions")
    op.drop_table("process_templates")
