import { deepMergeLocale } from "../../deepMerge";
import { qualityEn } from "../en/quality";
import { qualityTrPatches } from "./qualityPatches";

export const qualityTr = deepMergeLocale(qualityEn, qualityTrPatches) as typeof qualityEn;
