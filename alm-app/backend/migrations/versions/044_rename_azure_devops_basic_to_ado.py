"""Rename built-in process template slug azure_devops_basic -> ado.

Revision ID: 044
Revises: 043
Create Date: 2026-04-02
"""

from alembic import op

revision = "044"
down_revision = "043"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE process_template_versions v
        SET manifest_bundle = jsonb_set(
            v.manifest_bundle, '{name}', '"ado"'::jsonb, true
        )
        FROM process_templates t
        WHERE v.template_id = t.id AND t.slug = 'azure_devops_basic'
        """
    )
    op.execute(
        """
        UPDATE process_templates
        SET slug = 'ado',
            name = 'ADO',
            description = 'Minimal Azure Boards–style Epic and Issue; tasks are tracked separately in ALM'
        WHERE slug = 'azure_devops_basic'
        """
    )
    op.execute(
        """
        UPDATE tenants
        SET settings = jsonb_set(
            COALESCE(settings::jsonb, '{}'::jsonb),
            '{default_process_template_slug}',
            '"ado"'::jsonb,
            true
        )
        WHERE settings IS NOT NULL
          AND settings->>'default_process_template_slug' = 'azure_devops_basic'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE process_template_versions v
        SET manifest_bundle = jsonb_set(
            v.manifest_bundle, '{name}', '"azure_devops_basic"'::jsonb, true
        )
        FROM process_templates t
        WHERE v.template_id = t.id AND t.slug = 'ado'
        """
    )
    op.execute(
        """
        UPDATE process_templates
        SET slug = 'azure_devops_basic',
            name = 'Azure DevOps Basic',
            description = 'Epic, Issue — aligned with Azure DevOps Basic (Task is separate entity)'
        WHERE slug = 'ado' AND is_builtin = true
        """
    )
    op.execute(
        """
        UPDATE tenants
        SET settings = jsonb_set(
            COALESCE(settings::jsonb, '{}'::jsonb),
            '{default_process_template_slug}',
            '"azure_devops_basic"'::jsonb,
            true
        )
        WHERE settings IS NOT NULL
          AND settings->>'default_process_template_slug' = 'ado'
        """
    )
