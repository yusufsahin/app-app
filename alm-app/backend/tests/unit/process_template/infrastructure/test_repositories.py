import uuid
from unittest.mock import AsyncMock, MagicMock, Mock

import pytest

from alm.process_template.infrastructure.repositories import SqlAlchemyProcessTemplateRepository


@pytest.mark.asyncio
async def test_find_version_by_template_slug():
    # Arrange
    session = AsyncMock()
    repo = SqlAlchemyProcessTemplateRepository(session)
    
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = MagicMock(
        id=uuid.uuid4(),
        template_id=uuid.uuid4(),
        version="v1",
        manifest_bundle={}
    )
    session.execute.return_value = mock_result
    
    # Act
    result = await repo.find_version_by_template_slug("basic")
    
    # Assert
    assert result is not None
    assert result.version == "v1"
    session.execute.assert_called()


@pytest.mark.asyncio
async def test_add_version():
    # Arrange: add() is synchronous on AsyncSession; plain AsyncMock would treat it as async.
    session = AsyncMock()
    session.add = Mock()
    repo = SqlAlchemyProcessTemplateRepository(session)
    
    version = MagicMock(
        id=uuid.uuid4(),
        template_id=uuid.uuid4(),
        version="v2",
        manifest_bundle={}
    )
    
    # Act
    result = await repo.add_version(version)
    
    # Assert
    assert result == version
    session.add.assert_called()
    session.flush.assert_called()
