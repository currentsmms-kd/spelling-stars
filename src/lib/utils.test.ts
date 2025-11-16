/**
 * Tests for spelling normalization and hint generation utilities
 * Critical for fair game scoring and user experience
 */

import { describe, it, expect } from "vitest";
import { normalizeSpellingAnswer, getHintText } from "./utils";

describe("normalizeSpellingAnswer", () => {
  describe("Default behavior (case insensitive, preserve punctuation)", () => {
    it("should trim leading and trailing whitespace", () => {
      expect(normalizeSpellingAnswer("  apple  ")).toBe("apple");
      expect(normalizeSpellingAnswer("\napple\n")).toBe("apple");
      expect(normalizeSpellingAnswer("\tapple\t")).toBe("apple");
    });

    it("should normalize internal whitespace to single spaces", () => {
      expect(normalizeSpellingAnswer("hello  world")).toBe("hello world");
      expect(normalizeSpellingAnswer("hello   world")).toBe("hello world");
      expect(normalizeSpellingAnswer("hello\tworld")).toBe("hello world");
    });

    it("should convert to lowercase by default", () => {
      expect(normalizeSpellingAnswer("APPLE")).toBe("apple");
      expect(normalizeSpellingAnswer("Apple")).toBe("apple");
      expect(normalizeSpellingAnswer("aPpLe")).toBe("apple");
    });

    it("should remove sentence punctuation", () => {
      expect(normalizeSpellingAnswer("Hello!")).toBe("hello");
      expect(normalizeSpellingAnswer("Hello.")).toBe("hello");
      expect(normalizeSpellingAnswer("Hello,")).toBe("hello");
      expect(normalizeSpellingAnswer("Hello?")).toBe("hello");
      expect(normalizeSpellingAnswer("Hello;")).toBe("hello");
      expect(normalizeSpellingAnswer("Hello:")).toBe("hello");
      expect(normalizeSpellingAnswer('"Hello"')).toBe("hello");
    });

    it("should preserve hyphens in compound words", () => {
      expect(normalizeSpellingAnswer("ice-cream")).toBe("ice-cream");
      expect(normalizeSpellingAnswer("mother-in-law")).toBe("mother-in-law");
      expect(normalizeSpellingAnswer("T-shirt")).toBe("t-shirt");
      expect(normalizeSpellingAnswer("twenty-one")).toBe("twenty-one");
    });

    it("should preserve apostrophes in contractions and possessives", () => {
      expect(normalizeSpellingAnswer("don't")).toBe("don't");
      expect(normalizeSpellingAnswer("it's")).toBe("it's");
      expect(normalizeSpellingAnswer("cat's")).toBe("cat's");
      expect(normalizeSpellingAnswer("children's")).toBe("children's");
    });

    it("should handle mixed punctuation correctly", () => {
      expect(normalizeSpellingAnswer("Ice-Cream!")).toBe("ice-cream");
      expect(normalizeSpellingAnswer("Don't worry!")).toBe("don't worry");
      expect(normalizeSpellingAnswer("Hello, World!")).toBe("hello world");
    });
  });

  describe("With enforceCaseSensitivity: true", () => {
    it("should preserve original case", () => {
      expect(
        normalizeSpellingAnswer("Apple", { enforceCaseSensitivity: true }),
      ).toBe("Apple");
      expect(
        normalizeSpellingAnswer("APPLE", { enforceCaseSensitivity: true }),
      ).toBe("APPLE");
      expect(
        normalizeSpellingAnswer("aPpLe", { enforceCaseSensitivity: true }),
      ).toBe("aPpLe");
    });

    it("should still remove sentence punctuation", () => {
      expect(
        normalizeSpellingAnswer("Hello!", { enforceCaseSensitivity: true }),
      ).toBe("Hello");
      expect(
        normalizeSpellingAnswer("World.", { enforceCaseSensitivity: true }),
      ).toBe("World");
    });

    it("should preserve hyphens and apostrophes", () => {
      expect(
        normalizeSpellingAnswer("T-Shirt", { enforceCaseSensitivity: true }),
      ).toBe("T-Shirt");
      expect(
        normalizeSpellingAnswer("Don't", { enforceCaseSensitivity: true }),
      ).toBe("Don't");
    });
  });

  describe("With ignorePunctuation: true", () => {
    it("should remove all punctuation including hyphens", () => {
      expect(
        normalizeSpellingAnswer("ice-cream", { ignorePunctuation: true }),
      ).toBe("ice cream");
      expect(
        normalizeSpellingAnswer("mother-in-law", { ignorePunctuation: true }),
      ).toBe("mother in law");
      expect(
        normalizeSpellingAnswer("T-shirt", { ignorePunctuation: true }),
      ).toBe("t shirt");
    });

    it("should remove all punctuation including apostrophes", () => {
      expect(
        normalizeSpellingAnswer("don't", { ignorePunctuation: true }),
      ).toBe("dont");
      expect(normalizeSpellingAnswer("it's", { ignorePunctuation: true })).toBe(
        "its",
      );
      expect(
        normalizeSpellingAnswer("cat's", { ignorePunctuation: true }),
      ).toBe("cats");
    });

    it("should still convert to lowercase by default", () => {
      expect(
        normalizeSpellingAnswer("DON'T", { ignorePunctuation: true }),
      ).toBe("dont");
      expect(
        normalizeSpellingAnswer("Ice-Cream", { ignorePunctuation: true }),
      ).toBe("ice cream");
    });
  });

  describe("Combined options", () => {
    it("should handle both enforceCaseSensitivity and ignorePunctuation", () => {
      const result = normalizeSpellingAnswer("Can't Stop!", {
        enforceCaseSensitivity: true,
        ignorePunctuation: false,
      });
      expect(result).toBe("Can't Stop");
    });

    it("should handle case preservation with punctuation removal", () => {
      const result = normalizeSpellingAnswer("Well-Known", {
        enforceCaseSensitivity: false,
        ignorePunctuation: true,
      });
      expect(result).toBe("well known");
    });

    it("should handle all options together", () => {
      const result = normalizeSpellingAnswer("Ice-Cream!!!", {
        enforceCaseSensitivity: true,
        ignorePunctuation: true,
      });
      expect(result).toBe("Ice Cream");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty string", () => {
      expect(normalizeSpellingAnswer("")).toBe("");
    });

    it("should handle string with only whitespace", () => {
      expect(normalizeSpellingAnswer("   ")).toBe("");
    });

    it("should handle string with only punctuation", () => {
      expect(normalizeSpellingAnswer("!!!")).toBe("");
      expect(normalizeSpellingAnswer("...")).toBe("");
    });

    it("should handle Unicode characters", () => {
      expect(normalizeSpellingAnswer("café")).toBe("café");
      expect(normalizeSpellingAnswer("naïve")).toBe("naïve");
    });

    it("should handle numbers", () => {
      expect(normalizeSpellingAnswer("21")).toBe("21");
      expect(normalizeSpellingAnswer("twenty-one")).toBe("twenty-one");
    });

    it("should handle very long strings", () => {
      const longWord = "a".repeat(1000);
      expect(normalizeSpellingAnswer(longWord)).toBe(longWord);
    });

    it("should handle multiple consecutive punctuation marks", () => {
      expect(normalizeSpellingAnswer("Hello!!!")).toBe("hello");
      expect(normalizeSpellingAnswer("What???")).toBe("what");
    });

    it("should handle mixed case with special characters", () => {
      expect(normalizeSpellingAnswer("TeSt-WoRd!")).toBe("test-word");
    });
  });

  describe("Real-world spelling examples", () => {
    it("should normalize common words correctly", () => {
      expect(normalizeSpellingAnswer("Beautiful!")).toBe("beautiful");
      expect(normalizeSpellingAnswer("ELEPHANT")).toBe("elephant");
      expect(normalizeSpellingAnswer("  giraffe  ")).toBe("giraffe");
    });

    it("should handle compound words", () => {
      expect(normalizeSpellingAnswer("ice-cream")).toBe("ice-cream");
      expect(normalizeSpellingAnswer("well-known")).toBe("well-known");
      expect(normalizeSpellingAnswer("old-fashioned")).toBe("old-fashioned");
    });

    it("should handle contractions", () => {
      expect(normalizeSpellingAnswer("can't")).toBe("can't");
      expect(normalizeSpellingAnswer("shouldn't")).toBe("shouldn't");
      expect(normalizeSpellingAnswer("we're")).toBe("we're");
    });

    it("should handle possessives", () => {
      expect(normalizeSpellingAnswer("dog's")).toBe("dog's");
      expect(normalizeSpellingAnswer("James's")).toBe("james's");
      expect(normalizeSpellingAnswer("children's")).toBe("children's");
    });
  });
});

describe("getHintText", () => {
  describe("With ignorePunctuation: false (preserve punctuation)", () => {
    it("should return first letter for simple words", () => {
      expect(getHintText("apple", false)).toBe("A");
      expect(getHintText("cat", false)).toBe("C");
      expect(getHintText("zebra", false)).toBe("Z");
    });

    it("should return first segment for hyphenated compound words", () => {
      expect(getHintText("ice-cream", false)).toBe("Ice");
      expect(getHintText("mother-in-law", false)).toBe("Mother");
      expect(getHintText("well-known", false)).toBe("Well");
    });

    it("should return first segment for words with apostrophes", () => {
      expect(getHintText("don't", false)).toBe("Don");
      expect(getHintText("it's", false)).toBe("It");
      expect(getHintText("can't", false)).toBe("Can");
    });

    it("should return first segment for multi-word phrases", () => {
      expect(getHintText("ice cream", false)).toBe("Ice");
      expect(getHintText("New York", false)).toBe("New");
    });

    it("should handle single-character first segments", () => {
      expect(getHintText("T-shirt", false)).toBe("T");
      expect(getHintText("A-team", false)).toBe("A");
    });

    it("should use title case for multi-character segments", () => {
      expect(getHintText("hello-world", false)).toBe("Hello");
      expect(getHintText("MOTHER-IN-LAW", false)).toBe("Mother");
    });

    it("should trim whitespace before processing", () => {
      expect(getHintText("  hello  ", false)).toBe("H");
      expect(getHintText("  ice-cream  ", false)).toBe("Ice");
    });
  });

  describe("With ignorePunctuation: true (remove punctuation)", () => {
    it("should return first letter for all words", () => {
      expect(getHintText("apple", true)).toBe("A");
      expect(getHintText("cat", true)).toBe("C");
    });

    it("should return first letter after removing hyphens", () => {
      expect(getHintText("ice-cream", true)).toBe("I");
      expect(getHintText("mother-in-law", true)).toBe("M");
      expect(getHintText("T-shirt", true)).toBe("T");
    });

    it("should return first letter after removing apostrophes", () => {
      expect(getHintText("don't", true)).toBe("D");
      expect(getHintText("it's", true)).toBe("I");
      expect(getHintText("can't", true)).toBe("C");
    });

    it("should return first letter after removing spaces", () => {
      expect(getHintText("ice cream", true)).toBe("I");
      expect(getHintText("New York", true)).toBe("N");
    });

    it("should uppercase single character", () => {
      expect(getHintText("a", true)).toBe("A");
      expect(getHintText("z", true)).toBe("Z");
    });
  });

  describe("Edge cases", () => {
    it("should return empty string for empty input", () => {
      expect(getHintText("", false)).toBe("");
      expect(getHintText("", true)).toBe("");
    });

    it("should handle whitespace-only strings", () => {
      expect(getHintText("   ", false)).toBe("");
      expect(getHintText("   ", true)).toBe("");
    });

    it("should handle strings starting with punctuation (ignorePunctuation: false)", () => {
      expect(getHintText("--hello", false)).toBe("");
      expect(getHintText("'hello", false)).toBe("");
    });

    it("should handle strings with only punctuation (ignorePunctuation: true)", () => {
      expect(getHintText("---", true)).toBe("");
      expect(getHintText("'''", true)).toBe("");
    });

    it("should handle mixed case input", () => {
      expect(getHintText("APPLE", false)).toBe("A");
      expect(getHintText("aPpLe", false)).toBe("A");
      expect(getHintText("HeLLo-WoRLd", false)).toBe("Hello");
    });

    it("should handle Unicode characters", () => {
      expect(getHintText("über", false)).toBe("Ü");
      expect(getHintText("café", false)).toBe("C");
    });

    it("should handle very long words", () => {
      const longWord = "extraordinary";
      expect(getHintText(longWord, false)).toBe("E");
    });

    it("should handle very long compound words", () => {
      expect(getHintText("super-duper-mega-ultra-word", false)).toBe("Super");
    });
  });

  describe("Real-world spelling examples", () => {
    it("should generate appropriate hints for simple words", () => {
      expect(getHintText("beautiful", false)).toBe("B");
      expect(getHintText("elephant", false)).toBe("E");
      expect(getHintText("giraffe", false)).toBe("G");
    });

    it("should generate appropriate hints for compound words", () => {
      expect(getHintText("ice-cream", false)).toBe("Ice");
      expect(getHintText("well-known", false)).toBe("Well");
      expect(getHintText("twenty-one", false)).toBe("Twenty");
    });

    it("should generate appropriate hints for contractions", () => {
      expect(getHintText("don't", false)).toBe("Don");
      expect(getHintText("shouldn't", false)).toBe("Shouldn");
      expect(getHintText("we're", false)).toBe("We");
    });

    it("should match normalization behavior for consistency", () => {
      // When ignorePunctuation is false, hints should reflect preserved structure
      const word1 = "ice-cream";
      const normalized1 = normalizeSpellingAnswer(word1);
      const hint1 = getHintText(word1, false);
      expect(normalized1).toBe("ice-cream");
      expect(hint1).toBe("Ice"); // First segment

      // When ignorePunctuation is true, hints should reflect simplified structure
      const word2 = "ice-cream";
      const normalized2 = normalizeSpellingAnswer(word2, {
        ignorePunctuation: true,
      });
      const hint2 = getHintText(word2, true);
      expect(normalized2).toBe("ice cream");
      expect(hint2).toBe("I"); // First letter only
    });
  });

  describe("Consistency with normalizeSpellingAnswer", () => {
    it("should align with punctuation handling in normalization", () => {
      const testCases = [
        { word: "ice-cream", ignorePunctuation: false },
        { word: "ice-cream", ignorePunctuation: true },
        { word: "don't", ignorePunctuation: false },
        { word: "don't", ignorePunctuation: true },
        { word: "mother-in-law", ignorePunctuation: false },
        { word: "mother-in-law", ignorePunctuation: true },
      ];

      testCases.forEach(({ word, ignorePunctuation }) => {
        const normalized = normalizeSpellingAnswer(word, { ignorePunctuation });
        const hint = getHintText(word, ignorePunctuation);

        if (ignorePunctuation) {
          // Hint should be first letter of normalized word
          expect(hint.toLowerCase()).toBe(normalized[0] || "");
        } else {
          // Hint should be first segment or first letter
          const firstChar = normalized[0]?.toLowerCase() || "";
          expect(hint.toLowerCase().startsWith(firstChar)).toBe(true);
        }
      });
    });
  });
});

describe("Integration: normalization and hint generation", () => {
  it("should work together for game scenarios", () => {
    // Scenario 1: Simple word, case insensitive
    const userAnswer1 = "APPLE";
    const correctAnswer1 = "apple";
    const normalized1 = normalizeSpellingAnswer(userAnswer1);
    expect(normalized1).toBe(correctAnswer1);

    // Scenario 2: Compound word with punctuation preserved
    const userAnswer2 = "Ice-Cream!";
    const correctAnswer2 = "ice-cream";
    const normalized2 = normalizeSpellingAnswer(userAnswer2);
    expect(normalized2).toBe(correctAnswer2);
    const hint2 = getHintText(correctAnswer2, false);
    expect(hint2).toBe("Ice");

    // Scenario 3: Contraction with punctuation removed
    const userAnswer3 = "dont";
    const correctAnswer3 = "don't";
    const normalized3a = normalizeSpellingAnswer(userAnswer3, {
      ignorePunctuation: true,
    });
    const normalized3b = normalizeSpellingAnswer(correctAnswer3, {
      ignorePunctuation: true,
    });
    expect(normalized3a).toBe(normalized3b);

    // Scenario 4: Extra whitespace
    const userAnswer4 = "  hello  world  ";
    const correctAnswer4 = "hello world";
    const normalized4 = normalizeSpellingAnswer(userAnswer4);
    expect(normalized4).toBe(correctAnswer4);
  });

  it("should handle educational settings with different rules", () => {
    const word = "mother-in-law's";

    // Younger learners: Ignore all punctuation
    const youngSettings = {
      enforceCaseSensitivity: false,
      ignorePunctuation: true,
    };
    const normalizedYoung = normalizeSpellingAnswer(word, youngSettings);
    const hintYoung = getHintText(word, true);
    expect(normalizedYoung).toBe("mother in laws");
    expect(hintYoung).toBe("M");

    // Older learners: Preserve punctuation, enforce case
    const olderSettings = {
      enforceCaseSensitivity: true,
      ignorePunctuation: false,
    };
    const normalizedOlder = normalizeSpellingAnswer(word, olderSettings);
    const hintOlder = getHintText(word, false);
    expect(normalizedOlder).toBe("mother-in-law's");
    expect(hintOlder).toBe("Mother");
  });
});
