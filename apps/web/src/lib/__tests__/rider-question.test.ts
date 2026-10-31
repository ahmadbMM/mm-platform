import { describe, expect, it } from "vitest";
import { openQuestions, questionAnswerBody, skipIds } from "../rider-question";

// A question staff put on one rider's account (2026-11-01): what the pop-up asks, and what it may send.
describe("a rider's question", () => {
  it("asks the open questions in the database's order, minus those passed with Later", () => {
    const data = [{ id: 7, question: " What did the duck tell the cat? " }, { id: 9, question: "Second?" }];
    expect(openQuestions(data)).toEqual([{ id: 7, question: "What did the duck tell the cat?" }, { id: 9, question: "Second?" }]);
    expect(openQuestions(data, [7])).toEqual([{ id: 9, question: "Second?" }]);
  });
  it("asks nothing from a bad token's null, an error's object or a malformed row", () => {
    expect(openQuestions(null)).toEqual([]);
    expect(openQuestions({ message: "x" })).toEqual([]);
    expect(openQuestions([{ id: "7", question: "Q" }, { id: 8, question: "  " }, { id: -1, question: "Q" }, null])).toEqual([]);
  });
  it("reads the skip list as positive ids only", () => {
    expect(skipIds("7,abc,-2,9")).toEqual([7, 9]);
    expect(skipIds(null)).toEqual([]);
  });
  it("sends a trimmed answer of 1 to 1000 characters, never an empty or longer one", () => {
    expect(questionAnswerBody({ id: 7, answer: "  Quack  " })).toEqual({ id: 7, answer: "Quack" });
    expect(questionAnswerBody({ id: 7, answer: "   " })).toBeNull();
    expect(questionAnswerBody({ id: 7, answer: "a".repeat(1001) })).toBeNull();
    expect(questionAnswerBody({ id: "7", answer: "Quack" })).toBeNull();
    expect(questionAnswerBody(null)).toBeNull();
  });
});
