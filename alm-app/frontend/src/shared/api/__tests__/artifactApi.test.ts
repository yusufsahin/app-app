import { describe, it, expect } from 'vitest';
import { buildArtifactListParams } from '../artifactApi';

describe('buildArtifactListParams', () => {
    it('should return empty object for empty options', () => {
        const params = buildArtifactListParams({});
        expect(params).toEqual({});
    });

    it('should include state and type filters', () => {
        const params = buildArtifactListParams({ stateFilter: 'open', typeFilter: 'defect' });
        expect(params).toEqual({ state: 'open', type: 'defect' });
    });

    it('should include sorting options', () => {
        const params = buildArtifactListParams({ sortBy: 'title', sortOrder: 'desc' });
        expect(params).toEqual({ sort_by: 'title', sort_order: 'desc' });
    });

    it('should trim and include search query', () => {
        const params = buildArtifactListParams({ searchQuery: '  test-query  ' });
        expect(params).toEqual({ q: 'test-query' });
    });

    it('should include pagination options', () => {
        const params = buildArtifactListParams({ limit: 10, offset: 20 });
        expect(params).toEqual({ limit: 10, offset: 20 });
    });

    it('should include tree and includeSystemRoots flags', () => {
        const params = buildArtifactListParams({ tree: 'quality', includeSystemRoots: true });
        expect(params).toEqual({ tree: 'quality', include_system_roots: true });
    });

    it('should prioritize releaseCycleNodeId over cycleNodeId', () => {
        const params = buildArtifactListParams({ cycleNodeId: 'c1', releaseCycleNodeId: 'r1' });
        expect(params).toEqual({ release_cycle_node_id: 'r1' });
        
        const params2 = buildArtifactListParams({ cycleNodeId: 'c1' });
        expect(params2).toEqual({ cycle_node_id: 'c1' });
    });

    it('should include areaNodeId and parentId', () => {
        const params = buildArtifactListParams({ areaNodeId: 'area1', parentId: 'parent1' });
        expect(params).toEqual({ area_node_id: 'area1', parent_id: 'parent1' });
    });

    it('should handle search query with whitespace', () => {
        const params = buildArtifactListParams({ searchQuery: '  some search  ' });
        expect(params).toEqual({ q: 'some search' });
    });

    it('should handle multiple filters together', () => {
        const params = buildArtifactListParams({
            stateFilter: 'open',
            typeFilter: 'defect',
            sortBy: 'created_at',
            sortOrder: 'asc'
        });
        expect(params).toEqual({
            state: 'open',
            type: 'defect',
            sort_by: 'created_at',
            sort_order: 'asc'
        });
    });

    it('should include includeDeleted flag', () => {
        const params = buildArtifactListParams({ includeDeleted: true });
        expect(params).toEqual({ include_deleted: true });
    });

    it('should include tagId and trim it', () => {
        const params = buildArtifactListParams({ tagId: '  tag-123  ' });
        expect(params).toEqual({ tag_id: 'tag-123' });
    });

    it('should trim tree and parentId', () => {
        const params = buildArtifactListParams({ tree: '  quality  ', parentId: '  p-1  ' });
        expect(params).toEqual({ tree: 'quality', parent_id: 'p-1' });
        });

    it('should include trimmed teamId', () => {
        const params = buildArtifactListParams({ teamId: '  team-1  ' });
        expect(params).toEqual({ team_id: 'team-1' });
    });
});
