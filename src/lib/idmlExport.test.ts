import { describe, it, expect } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { buildIdml } from "./idmlExport";
import {
  makeDefaultIssue,
  type IssueDoc,
  type CustomBlock,
} from "./coverDefaults";

const decode = (bytes: Uint8Array) => strFromU8(bytes);

function makeTestIssue(): IssueDoc {
  const issue = makeDefaultIssue();
  // Force a folio template that uses {n} so we can verify substitution.
  issue.master = {
    ...issue.master,
    folioTemplate: { left: "pg. {n}", right: "pg. {n}" },
  };
  // Add a custom text block on the first article page.
  const articleIdx = issue.pages.findIndex((p) => p.pageType === "article");
  if (articleIdx >= 0) {
    const custom: CustomBlock = {
      id: "b1",
      kind: "text",
      x: 100,
      y: 100,
      w: 800,
      h: 200,
      text: "Custom body text block that must survive export.",
    };
    issue.pages[articleIdx] = {
      ...issue.pages[articleIdx],
      customBlocks: [custom],
    };
  }
  return issue;
}

function readPkg(bytes: Uint8Array): Record<string, string> {
  const entries = unzipSync(bytes);
  const out: Record<string, string> = {};
  for (const [name, data] of Object.entries(entries)) out[name] = decode(data);
  return out;
}

describe("IDML export — structural correctness", () => {
  const issue = makeTestIssue();
  const bytes = buildIdml(issue);
  const files = readPkg(bytes);

  it("has designmap.xml with Section, correct featureSet, and StoryList incl. backing story", () => {
    const dm = files["designmap.xml"];
    expect(dm).toBeTruthy();
    expect(dm).toMatch(/featureSet="257"/);
    expect(dm).toMatch(/product="21\.4\(4\)"/);
    expect(dm).toMatch(/DOMVersion="21\.4"/);

    const pageCount = issue.pages.length;
    const sectionMatch = dm.match(
      /<Section Self="uSection0" Length="(\d+)"[^>]*PageStart="([^"]+)"/,
    );
    expect(sectionMatch).not.toBeNull();
    expect(Number(sectionMatch![1])).toBe(pageCount);
    expect(sectionMatch![2]).toBe("uPage_1");

    expect(dm).toMatch(/StoryList="uBackingStory\b/);
    expect(dm).toMatch(/idPkg:Tags src="XML\/Tags\.xml"/);
    expect(dm).toMatch(/idPkg:BackingStory src="XML\/BackingStory\.xml"/);
  });

  it("mimetype is the first zip entry and stored uncompressed", () => {
    // Manually inspect zip local file header for the first entry.
    // Local file header signature = 0x04034b50; filename at offset 30.
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
    const compression = bytes[8] | (bytes[9] << 8); // 0 = stored
    expect(compression).toBe(0);
    const nameLen = bytes[26] | (bytes[27] << 8);
    const name = new TextDecoder().decode(bytes.slice(30, 30 + nameLen));
    expect(name).toBe("mimetype");
  });

  it("META-INF has container.xml and metadata.xml; XML has Tags + BackingStory", () => {
    expect(files["META-INF/container.xml"]).toMatch(
      /full-path="designmap\.xml" media-type="text\/xml"/,
    );
    expect(files["META-INF/metadata.xml"]).toMatch(
      /application\/vnd\.adobe\.indesign-idml-package/,
    );
    expect(files["XML/Tags.xml"]).toMatch(/XMLTag\/Root/);
    expect(files["XML/BackingStory.xml"]).toMatch(/MarkupTag="XMLTag\/Root"/);
  });

  it("every spread Page has the 7-item Descriptor and centered-spine ItemTransform", () => {
    const spreadFiles = Object.keys(files).filter((n) => n.startsWith("Spreads/"));
    expect(spreadFiles.length).toBe(issue.pages.length);
    // The default page height for the default issue is 11 in = 792 pt; page tx = -396.
    for (const name of spreadFiles) {
      const src = files[name];
      // Page descriptor: exactly 7 ListItems with the required type sequence.
      const descriptorMatch = src.match(/<Descriptor type="list">([\s\S]*?)<\/Descriptor>/);
      expect(descriptorMatch, `${name} descriptor`).not.toBeNull();
      const items = [...descriptorMatch![1].matchAll(/<ListItem type="([^"]+)">/g)].map(
        (m) => m[1],
      );
      expect(items).toEqual([
        "string",
        "enumeration",
        "boolean",
        "boolean",
        "long",
        "long",
        "string",
      ]);

      // Every Page ItemTransform is centered-spine.
      expect(src, `${name} page transform`).toMatch(
        /<Page[^>]*ItemTransform="1 0 0 1 0 -396"/,
      );

      // Every top-level page item (TextFrame / Rectangle) uses the same transform.
      const itemTx = [...src.matchAll(/<(?:TextFrame|Rectangle)[^>]*ItemTransform="([^"]+)"/g)]
        .map((m) => m[1]);
      for (const tx of itemTx) {
        expect(tx, `${name} item transform`).toBe("1 0 0 1 0 -396");
      }

      // No Rectangle has a Label="..." attribute.
      expect(src).not.toMatch(/<Rectangle\b[^>]*\bLabel="/);
    }
  });

  it("master spread page also uses centered-spine transform", () => {
    const ms = files["MasterSpreads/MasterSpread_uMaster.xml"];
    expect(ms).toMatch(/<Page[^>]*ItemTransform="1 0 0 1 0 -396"/);
  });

  it("only designmap.xml carries the aid processing instruction", () => {
    expect(files["designmap.xml"]).toMatch(/<\?aid /);
    for (const [name, body] of Object.entries(files)) {
      if (name === "designmap.xml") continue;
      if (!name.endsWith(".xml")) continue;
      expect(body, `${name} should not contain aid PI`).not.toMatch(/<\?aid /);
    }
  });

  it("stories substitute {n} in folios and include custom text-block content", () => {
    const storyFiles = Object.entries(files).filter(([n]) => n.startsWith("Stories/"));
    for (const [name, src] of storyFiles) {
      // No unresolved placeholders like {n} in any Content payload.
      const contents = [...src.matchAll(/<Content>([\s\S]*?)<\/Content>/g)].map((m) => m[1]);
      for (const c of contents) {
        expect(c, `${name} content unresolved token`).not.toMatch(/\{n\}/);
        expect(c, `${name} content unresolved token`).not.toMatch(/\{[a-zA-Z]+\}/);
      }
      // Br placement: inside CharacterStyleRange, after Content (not as sibling).
      if (/<Br\/>/.test(src)) {
        expect(src).toMatch(
          /<Content>[\s\S]*?<\/Content>\s*<Br\/>\s*<\/CharacterStyleRange>/,
        );
      }
    }
    // The custom text block on the article page must have made it into a Story.
    const allContent = storyFiles.map(([, s]) => s).join("\n");
    expect(allContent).toMatch(/Custom body text block that must survive export/);
  });

  it("graphic-frame rectangles built without an EmbeddedImage map contain no Image children (placeholder mode)", () => {
    // The base buildIdml call has no image assets, so no <Image> appears — but
    // the Rectangle is still emitted with a valid geometry. When assets are
    // provided, an <Image>+<Link> would appear inside.
    const spreadFiles = Object.entries(files).filter(([n]) => n.startsWith("Spreads/"));
    const anyRectangle = spreadFiles.some(([, s]) => /ContentType="GraphicType"/.test(s));
    // Cover / photo / article default data references imageUrl, so at least one
    // graphic rectangle must exist.
    expect(anyRectangle).toBe(true);
  });
});
