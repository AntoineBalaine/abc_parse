import { expect } from "chai";
import { createCSNode, TAGS } from "../src/csTree/types";

describe("TAGS and CSNode type safety", () => {
  it("createCSNode accepts TAGS values", () => {
    const node = createCSNode(TAGS.Note, 0, { type: "empty" });
    expect(node.tag).to.equal("Note");
    expect(node.parentRef).to.equal(null);
  });

  it("createCSNode accepts TAGS values", () => {
    const node = createCSNode(TAGS.Note, 1, { type: "empty" });
    expect(node.tag).to.equal("Note");
  });

  it("rejects a string that is not a member of TAGS", () => {
    // @ts-expect-error: "not_a_tag" is not assignable to TAGS
    createCSNode("not_a_tag", 0, { type: "empty" });
  });

  it("CSNode has parentRef field", () => {
    const node = createCSNode(TAGS.Rest, 0, { type: "empty" });
    expect(node).to.have.property("parentRef");
    expect(node.parentRef).to.equal(null);
  });
});
