import { describe, it, expect } from 'vitest';
import { buildVelocityParams, buildBurndownParams } from '../orgApi';

describe('orgApi parameter builders', () => {
    describe('buildVelocityParams', () => {
        it('should return default params for empty options', () => {
            const params = buildVelocityParams();
            expect(params.get('effort_field')).toBe('story_points');
            expect(params.getAll('cycle_node_id')).toEqual([]);
        });

        it('should include cycleNodeIds', () => {
            const params = buildVelocityParams({ cycleNodeIds: ['c1', 'c2'] });
            expect(params.getAll('cycle_node_id')).toEqual(['c1', 'c2']);
        });

        it('should include releaseCycleNodeId and lastN', () => {
            const params = buildVelocityParams({ releaseCycleNodeId: 'r1', lastN: 5 });
            expect(params.get('release_cycle_node_id')).toBe('r1');
            expect(params.get('last_n')).toBe('5');
        });

        it('should use custom effort_field', () => {
            const params = buildVelocityParams({ effortField: 'hours' });
            expect(params.get('effort_field')).toBe('hours');
        });
    });

    describe('buildBurndownParams', () => {
        it('should return default params for empty options', () => {
            const params = buildBurndownParams();
            expect(params.get('effort_field')).toBe('story_points');
        });

        it('should include cycleNodeIds and lastN', () => {
            const params = buildBurndownParams({ cycleNodeIds: ['c1'], lastN: 10 });
            expect(params.getAll('cycle_node_id')).toEqual(['c1']);
            expect(params.get('last_n')).toBe('10');
        });
    });
});
