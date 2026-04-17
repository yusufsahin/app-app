import { describe, it, expect } from "vitest";
import { jsonParseErrorLine } from "./jsonParseErrorLine";

describe("jsonParseErrorLine", () => {
  it("returns undefined for non-SyntaxError", () => {
    expect(jsonParseErrorLine(new Error("x"))).toBeUndefined();
  });

  it("extracts line when message contains (line N …)", () => {
    const err = new SyntaxError('Expected property name or \'}\' in JSON at position 2 (line 3 column 5)');
    expect(jsonParseErrorLine(err)).toBe(3);
  });

  it("returns undefined when message has no line", () => {
    try {
      JSON.parse("");
    } catch (e) {
      expect(jsonParseErrorLine(e)).toBeUndefined();
    }
  });
});
