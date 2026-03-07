import { expect } from "chai";
import { describe, it } from "mocha";
import type { CSNode, ParentRef } from "../src/cstree";
import { createNode, TestTag, type TestDataMap } from "./helpers";

enum OtherTag {
  Foo = "foo",
}

describe("cstree types", () => {
  it("CSNode is structurally valid", () => {
    const node: CSNode<TestTag, TestDataMap> = {
      tag: TestTag.A,
      id: 0,
      data: "hello",
      firstChild: null,
      nextSibling: null,
      parentRef: null,
    };
    expect(node.tag).to.equal(TestTag.A);
    expect(node.parentRef).to.be.null;
  });

  it("ParentRef firstChild variant is structurally valid", () => {
    const parent: CSNode<TestTag, TestDataMap> = {
      tag: TestTag.Root,
      id: 0,
      data: "r",
      firstChild: null,
      nextSibling: null,
      parentRef: null,
    };
    const ref: ParentRef<TestTag, TestDataMap> = { tag: "firstChild", parent };
    expect(ref.tag).to.equal("firstChild");
    expect(ref.parent).to.equal(parent);
  });

  it("ParentRef sibling variant is structurally valid", () => {
    const prev: CSNode<TestTag, TestDataMap> = {
      tag: TestTag.A,
      id: 0,
      data: "x",
      firstChild: null,
      nextSibling: null,
      parentRef: null,
    };
    const ref: ParentRef<TestTag, TestDataMap> = { tag: "sibling", prev };
    expect(ref.tag).to.equal("sibling");
    expect(ref.prev).to.equal(prev);
  });

  it("rejects a string that is not a member of the tag enum", () => {
    // @ts-expect-error: "not_a_tag" is not assignable to TestTag
    createNode("not_a_tag", 0, "data");

    // @ts-expect-error: OtherTag is not assignable to TestTag
    const _node: CSNode<OtherTag, { [OtherTag.Foo]: string }> = createNode(OtherTag.Foo, 0, "data");
    void _node;
  });
});
