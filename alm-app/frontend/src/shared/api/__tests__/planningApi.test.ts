import { describe, it, expect } from 'vitest';
import { 
    cadenceDisplayLabel, 
    cadenceDisplayLabelWithType, 
    getReleaseNameForCycle 
} from '../planningApi';

describe('planningApi display labels', () => {
    it('cadenceDisplayLabel should format name and path', () => {
        expect(cadenceDisplayLabel({ name: 'Cycle 1' })).toBe('Cycle 1');
        expect(cadenceDisplayLabel({ name: 'Cycle 1', path: '2024/Cycle 1' })).toBe('Cycle 1 (2024/Cycle 1)');
    });

    it('cadenceDisplayLabelWithType should include type badge', () => {
        expect(cadenceDisplayLabelWithType({ name: 'R1', type: 'release' })).toBe('R1 · Release');
        expect(cadenceDisplayLabelWithType({ name: 'C1', type: 'cycle' })).toBe('C1 · Cycle');
        expect(cadenceDisplayLabelWithType({ name: 'C1' })).toBe('C1 · Cycle'); // default
    });
});

describe('getReleaseNameForCycle', () => {
    const tree = [
        { id: 'r1', parent_id: null, path: 'Release 1', type: 'release' as const },
        { id: 'r2', parent_id: null, path: 'Release 2', type: 'release' as const },
        { id: 'c1', parent_id: 'r1', path: 'Release 1/Cycle 1', type: 'cycle' as const },
        { id: 'c2', parent_id: 'c1', path: 'Release 1/Cycle 1/Sub', type: 'cycle' as const },
    ];

    it('should return null for invalid or missing id', () => {
        expect(getReleaseNameForCycle(null, tree)).toBeNull();
        expect(getReleaseNameForCycle('unknown', tree)).toBeNull();
    });

    it('should return the path for a release node', () => {
        expect(getReleaseNameForCycle('r1', tree)).toBe('Release 1');
    });

    it('should return parent release path for a cycle', () => {
        expect(getReleaseNameForCycle('c1', tree)).toBe('Release 1');
    });

    it('should return grandparent release path for a nested cycle', () => {
        expect(getReleaseNameForCycle('c2', tree)).toBe('Release 1');
    });
});
