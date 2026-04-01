import { describe, expect, it } from "vitest";
import type { FormFieldSchema } from "../../types/formSchema";
import {
  getFieldLookup,
  mapLookupItems,
  resolveFieldOptions,
  resolveLookupLabel,
} from "./lookupResolvers";

describe("lookupResolvers", () => {
  it("merges static and dynamic options while deduping by value", () => {
    const field: FormFieldSchema = {
      key: "assignee_id",
      type: "entity_ref",
      entity_ref: "user",
      label_key: "Assignee",
      options: [
        { id: "u1", label: "Ada" },
        { id: "u2", label: "Grace" },
      ],
    };

    const options = resolveFieldOptions({
      field,
      lookupSources: {
        user: [
          { value: "u2", label: "Grace Hopper" },
          { value: "u3", label: "Linus" },
        ],
      },
    });

    expect(options).toEqual([
      { value: "u1", label: "Ada" },
      { value: "u2", label: "Grace" },
      { value: "u3", label: "Linus" },
    ]);
  });

  it("infers lookup metadata for tag lists and entity refs", () => {
    expect(
      getFieldLookup({
        key: "tag_ids",
        type: "tag_list",
        label_key: "Tags",
      }),
    ).toEqual({ kind: "tag", multi: true });

    expect(
      getFieldLookup({
        key: "cycle_id",
        type: "entity_ref",
        entity_ref: "cycle",
        label_key: "Cycle",
      }),
    ).toEqual({ kind: "cycle", multi: false });
  });

  it("prefers explicit lookup metadata over inferred defaults", () => {
    expect(
      getFieldLookup({
        key: "reviewers",
        type: "entity_ref",
        entity_ref: "user",
        label_key: "Reviewers",
        lookup: { kind: "team", multi: true },
      }),
    ).toEqual({ kind: "team", multi: true });
  });

  it("maps lookup items and resolves labels safely", () => {
    const options = mapLookupItems(
      [{ id: 1, name: "Chrome" }, { id: 2, name: "Firefox" }],
      (item) => String(item.id),
      (item) => item.name,
    );

    expect(options).toEqual([
      { value: "1", label: "Chrome" },
      { value: "2", label: "Firefox" },
    ]);
    expect(resolveLookupLabel("2", options)).toBe("Firefox");
    expect(resolveLookupLabel("", options)).toBeNull();
    expect(resolveLookupLabel("999", options)).toBeNull();
  });

  it("returns only static options when no lookup source exists", () => {
    const field: FormFieldSchema = {
      key: "priority",
      type: "choice",
      label_key: "Priority",
      options: [
        { id: "high", label: "High" },
        { id: "low", label: "Low" },
      ],
    };

    expect(resolveFieldOptions({ field, lookupSources: {} })).toEqual([
      { value: "high", label: "High" },
      { value: "low", label: "Low" },
    ]);
  });
});
