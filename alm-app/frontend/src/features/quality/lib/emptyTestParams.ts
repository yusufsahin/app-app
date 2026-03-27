import type { TestParamsDocument } from "./testParams";
import { normalizeTestParams } from "./testParams";

export function emptyTestParamsDocument(): TestParamsDocument {
  return normalizeTestParams({ defs: [], rows: [] });
}
