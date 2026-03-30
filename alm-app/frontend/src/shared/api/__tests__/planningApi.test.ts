import { describe, it, expect } from 'vitest';
import { 
    incrementDisplayLabel, 
    incrementDisplayLabelWithType, 
    getReleaseNameForCycle 
} from '../planningApi';

describe('planningApi display labels', () => {
    it('incrementDisplayLabel should format name and path', () => {
        expect(incrementDisplayLabel({ name: 'Sprint 1' })).toBe('Sprint 1');
        expect(incrementDisplayLabel({ name: 'Sprint 1', path: '2024/Sprint 1' })).toBe('Sprint 1 (2024/Sprint 1)');
    });

    it('incrementDisplayLabelWithType should include type badge', () => {
        expect(incrementDisplayLabelWithType({ name: 'R1', type: 'release' })).toBe('R1 · Release');
        expect(incrementDisplayLabelWithType({ name: 'S1', type: 'iteration' })).toBe('S1 · Iteration');
        expect(incrementDisplayLabelWithType({ name: 'S1' })).toBe('S1 · Iteration'); // default
    });
});

describe('getReleaseNameForCycle', () => {
    const tree = [
        { id: 'r1', parent_id: null, path: 'Release 1', type: 'release' as const },
        { id: 'r2', parent_id: null, path: 'Release 2', type: 'release' as const },
        { id: 'i1', parent_id: 'r1', path: 'Release 1/Iter 1', type: 'iteration' as const },
        { id: 'i2', parent_id: 'i1', path: 'Release 1/Iter 1/Sub', type: 'iteration' as const },
    ];

    it('should return null for invalid or missing id', () => {
        expect(getReleaseNameForCycle(null, tree)).toBeNull();
        expect(getReleaseNameForCycle('unknown', tree)).toBeNull();
    });

    it('should return the path for a release node', () => {
        expect(getReleaseNameForCycle('r1', tree)).toBe('Release 1');
    });

    it('should return parent release path for an iteration', () => {
        expect(getReleaseNameForCycle('i1', tree)).toBe('Release 1');
    });

    it('should return grandparent release path for a nested iteration', () => {
        expect(getReleaseNameForCycle('i2', tree)).toBe('Release 1');
    });
});
