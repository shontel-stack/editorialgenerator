/**
 * Minimal IDML (InDesign Markup Language) exporter.
 *
 * Produces a `.idml` package — a ZIP with a specific structure — that
 * Adobe InDesign opens as an editable document. This v1 focuses on
 * text + structure fidelity (one InDesign page per issue page, headlines,
 * body copy, folios, image placeholder frames). It intentionally does NOT
 * embed remote images; image frames are created at the right size with the
 * source URL stored as the script-label so a designer can relink them.
 *
 * IDML reference: Adobe IDML Cookbook + DOMVersion 14.0 schema.
 */

import { zipSync, strToU8 } from "fflate";
import {
  formatPageNumber,
  renderFolio,
  type ArticleData,
  type CoverData,
  type IssueDoc,
  type IssuePageNode,
} from "@/lib/coverDefaults";

// --- page geometry (US Letter, points) -------------------------------------
const PAGE_W = 612; // 8.5"
const PAGE_H = 792; // 11"
const MARGIN = 54;  // 0.75"

// --- helpers ---------------------------------------------------------------
const xmlEscape = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\u2028|\u2029/g, "\n");

let idCounter = 0;
const nextSelfId = (prefix: string): string =>
  `${prefix}_${(++idCounter).toString(36)}`;

const reset = () => {
  idCounter = 0;
};

// --- text content blocks per page type -------------------------------------
interface PageText {
  heading: string;
  subhead?: string;
  byline?: string;
  body: string;
  folio: string;
  pageNumber: string;
  imageUrl?: string | null;
}

const collectPageText = (
  page: IssuePageNode,
  issue: IssueDoc,
  pageIndex: number,
): PageText => {
  const totalPages = issue.pages.length;
  const pn = formatPageNumber(issue.master, pageIndex + 1, totalPages);
  const folio = renderFolio(issue.master, issue.meta);

  switch (page.pageType) {
    case "cover": {
      const d = page.data as CoverData;
      return {
        heading: d.headline || "Untitled",
        subhead: d.dek,
        byline: d.feature || d.credit,
        body: [d.masthead, d.tagline, d.issue, d.date, d.price]
          .filter(Boolean)
          .join("\n"),
        folio: "",
        pageNumber: "",
        imageUrl: d.imageUrl,
      };
    }
    case "article": {
      const d = page.data as ArticleData;
      return {
        heading: d.headline || "Untitled",
        subhead: d.dek,
        byline: d.byline,
        body: d.body || "",
        folio,
        pageNumber: pn,
        imageUrl: d.imageUrl,
      };
    }
    case "photo": {
      const d = page.data;
      return {
        heading: d.title || "",
        subhead: d.caption,
        byline: d.credit,
        body: "",
        folio,
        pageNumber: pn,
        imageUrl: d.imageUrl,
      };
    }
    case "ad": {
      const d = page.data;
      return {
        heading: d.headline || d.brand || "",
        subhead: d.eyebrow,
        byline: d.cta,
        body: d.body || "",
        folio,
        pageNumber: pn,
        imageUrl: d.imageUrl,
      };
    }
    case "contents": {
      const d = page.data;
      return {
        heading: "Contents",
        subhead: `${d.issue} · ${d.date}`,
        byline: "",
        body:
          d.intro +
          "\n\n" +
          d.entries
            .map((e) => `${e.page}\t${e.section}\t${e.title}\t${e.byline}`)
            .join("\n"),
        folio,
        pageNumber: pn,
      };
    }
    case "back": {
      const d = page.data;
      return {
        heading: d.quote || "",
        subhead: d.attribution,
        byline: "",
        body: d.masthead || "",
        folio: "",
        pageNumber: "",
        imageUrl: d.imageUrl,
      };
    }
    default:
      return {
        heading: "",
        body: "",
        folio,
        pageNumber: pn,
      };
  }
};

// --- XML builders ----------------------------------------------------------
const MIME = "application/vnd.adobe.indesign-idml-package";

const containerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="designmap.xml" media-type="${MIME}"/>
  </rootfiles>
</container>`;

const fontsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?aid style="50" type="document" readerVersion="14.0" featureSet="513" product="14.0(148)" ?>
<idPkg:Fonts xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="14.0">
  <FontFamily Self="FontFamily_Minion" Name="Minion Pro">
    <Font Self="Font_MinionPro_Regular" FontFamily="Minion Pro" Name="Minion Pro\\tRegular" PostScriptName="MinionPro-Regular" Status="Installed" FontStyleName="Regular" FontType="OpenTypeCFF"/>
  </FontFamily>
  <FontFamily Self="FontFamily_Helvetica" Name="Helvetica">
    <Font Self="Font_Helvetica_Regular" FontFamily="Helvetica" Name="Helvetica\\tRegular" PostScriptName="Helvetica" Status="Installed" FontStyleName="Regular" FontType="OpenTypeTT"/>
  </FontFamily>
</idPkg:Fonts>`;

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?aid style="50" type="document" readerVersion="14.0" featureSet="513" product="14.0(148)" ?>
<idPkg:Styles xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="14.0">
  <RootCharacterStyleGroup Self="u1">
    <CharacterStyle Self="CharacterStyle/$ID/[No character style]" Imported="false" KeyboardShortcut="0 0" Name="$ID/[No character style]"/>
  </RootCharacterStyleGroup>
  <RootParagraphStyleGroup Self="u2">
    <ParagraphStyle Self="ParagraphStyle/$ID/[No paragraph style]" Imported="false" Name="$ID/[No paragraph style]" PointSize="11" Justification="LeftAlign"/>
    <ParagraphStyle Self="ParagraphStyle/Headline" Name="Headline" Imported="false" PointSize="36" Leading="40" FontStyle="Regular" SpaceAfter="12" Justification="LeftAlign">
      <Properties>
        <AppliedFont type="string">Minion Pro</AppliedFont>
      </Properties>
    </ParagraphStyle>
    <ParagraphStyle Self="ParagraphStyle/Dek" Name="Dek" Imported="false" PointSize="14" Leading="18" FontStyle="Italic" SpaceAfter="8" Justification="LeftAlign">
      <Properties>
        <AppliedFont type="string">Minion Pro</AppliedFont>
      </Properties>
    </ParagraphStyle>
    <ParagraphStyle Self="ParagraphStyle/Byline" Name="Byline" Imported="false" PointSize="9" Leading="12" FontStyle="Regular" SpaceAfter="18" Justification="LeftAlign">
      <Properties>
        <AppliedFont type="string">Helvetica</AppliedFont>
      </Properties>
    </ParagraphStyle>
    <ParagraphStyle Self="ParagraphStyle/Body" Name="Body" Imported="false" PointSize="10" Leading="14" FontStyle="Regular" SpaceAfter="4" Justification="LeftAlign" FirstLineIndent="12">
      <Properties>
        <AppliedFont type="string">Minion Pro</AppliedFont>
      </Properties>
    </ParagraphStyle>
    <ParagraphStyle Self="ParagraphStyle/Folio" Name="Folio" Imported="false" PointSize="8" Leading="10" FontStyle="Regular" Justification="LeftAlign">
      <Properties>
        <AppliedFont type="string">Helvetica</AppliedFont>
      </Properties>
    </ParagraphStyle>
  </RootParagraphStyleGroup>
  <RootObjectStyleGroup Self="u3">
    <ObjectStyle Self="ObjectStyle/$ID/[None]" Name="$ID/[None]"/>
  </RootObjectStyleGroup>
  <RootTableStyleGroup Self="u4">
    <TableStyle Self="TableStyle/$ID/[No table style]" Name="$ID/[No table style]"/>
  </RootTableStyleGroup>
  <RootCellStyleGroup Self="u5">
    <CellStyle Self="CellStyle/$ID/[None]" Name="$ID/[None]"/>
  </RootCellStyleGroup>
</idPkg:Styles>`;

const graphicXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?aid style="50" type="document" readerVersion="14.0" featureSet="513" product="14.0(148)" ?>
<idPkg:Graphic xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="14.0">
  <Color Self="Color/Black" Model="Process" Space="CMYK" ColorValue="0 0 0 100" Name="Black" ColorEditable="false" ColorRemovable="false" Visible="true" AlternateSpace="NoAlternateColor" AlternateColorValue=""/>
  <Color Self="Color/Paper" Model="Process" Space="CMYK" ColorValue="0 0 0 0" Name="Paper" ColorEditable="false" ColorRemovable="false" Visible="true" AlternateSpace="NoAlternateColor" AlternateColorValue=""/>
  <Swatch Self="Swatch/None" Name="None"/>
  <StrokeStyle Self="StrokeStyle/$ID/Solid" Name="$ID/Solid"/>
</idPkg:Graphic>`;

const preferencesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?aid style="50" type="document" readerVersion="14.0" featureSet="513" product="14.0(148)" ?>
<idPkg:Preferences xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="14.0">
  <DocumentPreference Self="dpref" PageHeight="${PAGE_H}" PageWidth="${PAGE_W}" PageOrientation="Portrait" PagesPerDocument="1" FacingPages="false" AllowPageShuffle="true" DocumentBleedBottomOffset="0" DocumentBleedTopOffset="0" DocumentBleedInsideOrLeftOffset="0" DocumentBleedOutsideOrRightOffset="0" SlugBottomOffset="0" SlugTopOffset="0" SlugInsideOrLeftOffset="0" SlugRightOrOutsideOffset="0" DocumentBleedUniformSize="true" DocumentSlugUniformSize="false" PreserveLayoutWhenShuffling="true" ColumnDirection="Horizontal" ColumnGuideColor="PurpleRed"/>
  <MarginPreference Self="mpref" ColumnCount="1" ColumnGutter="12" Top="${MARGIN}" Bottom="${MARGIN}" Left="${MARGIN}" Right="${MARGIN}" ColumnDirection="Horizontal" ColumnsPositions="0 ${PAGE_W - 2 * MARGIN}"/>
  <TransparencyDefaultContainerObject Self="TransparencyDefaultContainer">
    <TransparencyDefault Self="TransparencyDefault"/>
  </TransparencyDefaultContainerObject>
  <ViewPreference Self="vpref" HorizontalMeasurementUnits="Points" VerticalMeasurementUnits="Points" RulerOrigin="PageOrigin"/>
</idPkg:Preferences>`;

const masterSpreadXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?aid style="50" type="document" readerVersion="14.0" featureSet="513" product="14.0(148)" ?>
<idPkg:MasterSpread xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="14.0">
  <MasterSpread Self="uMaster" Name="A-Master" NamePrefix="A" BaseName="Master" ShowMasterItems="true" PageCount="1" OverriddenPageItemProps="">
    <Page Self="uMasterPage" Name="A" AppliedTrapPreset="TrapPreset/$ID/kDefaultTrapStyleName" OverrideList="" GeometricBounds="0 0 ${PAGE_H} ${PAGE_W}" ItemTransform="1 0 0 1 0 0">
      <Properties>
        <PageColor type="enumeration">UseMasterColor</PageColor>
      </Properties>
      <MarginPreference ColumnCount="1" ColumnGutter="12" Top="${MARGIN}" Bottom="${MARGIN}" Left="${MARGIN}" Right="${MARGIN}" ColumnDirection="Horizontal" ColumnsPositions="0 ${PAGE_W - 2 * MARGIN}"/>
    </Page>
  </MasterSpread>
</idPkg:MasterSpread>`;

interface BuiltStory {
  selfId: string;
  xml: string;
  filename: string;
}

const buildStory = (
  text: PageText,
  pageIndex: number,
): BuiltStory => {
  const selfId = `Story_p${pageIndex + 1}`;
  const lines: string[] = [];

  const para = (style: string, content: string) => {
    if (!content) return;
    // split into paragraphs by blank-line / newline
    const parts = content.split(/\n+/).filter((p) => p.trim().length > 0);
    for (const part of parts) {
      lines.push(
        `    <ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/${style}">` +
          `<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]">` +
          `<Content>${xmlEscape(part)}</Content>` +
          `</CharacterStyleRange>` +
          `<Br/>` +
          `</ParagraphStyleRange>`,
      );
    }
  };

  para("Headline", text.heading);
  para("Dek", text.subhead ?? "");
  para("Byline", text.byline ?? "");
  para("Body", text.body);

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?aid style="50" type="document" readerVersion="14.0" featureSet="513" product="14.0(148)" ?>
<idPkg:Story xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="14.0">
  <Story Self="${selfId}" AppliedTOCStyle="n" TrackChanges="false" StoryTitle="$ID/" AppliedNamedGrid="n">
${lines.join("\n")}
  </Story>
</idPkg:Story>`;

  return { selfId, xml, filename: `Stories/Story_${selfId}.xml` };
};

const folioStory = (text: PageText, pageIndex: number): BuiltStory | null => {
  if (!text.folio && !text.pageNumber) return null;
  const selfId = `Folio_p${pageIndex + 1}`;
  const content = [text.pageNumber, text.folio].filter(Boolean).join("   ");
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?aid style="50" type="document" readerVersion="14.0" featureSet="513" product="14.0(148)" ?>
<idPkg:Story xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="14.0">
  <Story Self="${selfId}" AppliedTOCStyle="n" TrackChanges="false" StoryTitle="$ID/" AppliedNamedGrid="n">
    <ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/Folio">
      <CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]">
        <Content>${xmlEscape(content)}</Content>
      </CharacterStyleRange>
      <Br/>
    </ParagraphStyleRange>
  </Story>
</idPkg:Story>`;
  return { selfId, xml, filename: `Stories/Story_${selfId}.xml` };
};

interface BuiltSpread {
  selfId: string;
  xml: string;
  filename: string;
  storyIds: string[];
}

const buildSpread = (
  page: IssuePageNode,
  text: PageText,
  pageIndex: number,
  bodyStory: BuiltStory,
  folio: BuiltStory | null,
): BuiltSpread => {
  const spreadSelf = `uSpread_${pageIndex + 1}`;
  const pageSelf = `uPage_${pageIndex + 1}`;

  const items: string[] = [];
  const usedStories: string[] = [bodyStory.selfId];

  // Main text frame: fills the live area (inside margins).
  const tfId = nextSelfId("uTF");
  const left = MARGIN;
  const top = MARGIN;
  const right = PAGE_W - MARGIN;
  const bottom = PAGE_H - MARGIN - 24; // leave room for folio
  // GeometricBounds: y1 x1 y2 x2 (top left bottom right)
  items.push(
    `      <TextFrame Self="${tfId}" ParentStory="${bodyStory.selfId}" PreviousTextFrame="n" NextTextFrame="n" ContentType="TextType" GeometricBounds="${top} ${left} ${bottom} ${right}" ItemTransform="1 0 0 1 0 0">
        <Properties>
          <PathGeometry>
            <GeometryPathType PathOpen="false">
              <PathPointArray>
                <PathPointType Anchor="${left} ${top}" LeftDirection="${left} ${top}" RightDirection="${left} ${top}"/>
                <PathPointType Anchor="${left} ${bottom}" LeftDirection="${left} ${bottom}" RightDirection="${left} ${bottom}"/>
                <PathPointType Anchor="${right} ${bottom}" LeftDirection="${right} ${bottom}" RightDirection="${right} ${bottom}"/>
                <PathPointType Anchor="${right} ${top}" LeftDirection="${right} ${top}" RightDirection="${right} ${top}"/>
              </PathPointArray>
            </GeometryPathType>
          </PathGeometry>
        </Properties>
        <TextFramePreference TextColumnCount="${page.pageType === "article" ? 2 : 1}" TextColumnGutter="14" Inset="0 0 0 0"/>
      </TextFrame>`,
  );

  // Image placeholder frame (top of page, half height) when an image is referenced.
  if (text.imageUrl) {
    const imgId = nextSelfId("uIMG");
    const imgTop = MARGIN;
    const imgBottom = MARGIN + (PAGE_H - 2 * MARGIN) * 0.45;
    items.push(
      `      <Rectangle Self="${imgId}" ContentType="GraphicType" GeometricBounds="${imgTop} ${left} ${imgBottom} ${right}" ItemTransform="1 0 0 1 0 0" Label="${xmlEscape(text.imageUrl)}">
        <Properties>
          <PathGeometry>
            <GeometryPathType PathOpen="false">
              <PathPointArray>
                <PathPointType Anchor="${left} ${imgTop}" LeftDirection="${left} ${imgTop}" RightDirection="${left} ${imgTop}"/>
                <PathPointType Anchor="${left} ${imgBottom}" LeftDirection="${left} ${imgBottom}" RightDirection="${left} ${imgBottom}"/>
                <PathPointType Anchor="${right} ${imgBottom}" LeftDirection="${right} ${imgBottom}" RightDirection="${right} ${imgBottom}"/>
                <PathPointType Anchor="${right} ${imgTop}" LeftDirection="${right} ${imgTop}" RightDirection="${right} ${imgTop}"/>
              </PathPointArray>
            </GeometryPathType>
          </PathGeometry>
          <Label>
            <KeyValuePair Key="source-url" Value="${xmlEscape(text.imageUrl)}"/>
          </Label>
        </Properties>
      </Rectangle>`,
    );
  }

  // Folio frame at the bottom.
  if (folio) {
    const folId = nextSelfId("uFOL");
    const fTop = PAGE_H - MARGIN - 18;
    const fBottom = PAGE_H - MARGIN;
    items.push(
      `      <TextFrame Self="${folId}" ParentStory="${folio.selfId}" PreviousTextFrame="n" NextTextFrame="n" ContentType="TextType" GeometricBounds="${fTop} ${left} ${fBottom} ${right}" ItemTransform="1 0 0 1 0 0">
        <Properties>
          <PathGeometry>
            <GeometryPathType PathOpen="false">
              <PathPointArray>
                <PathPointType Anchor="${left} ${fTop}" LeftDirection="${left} ${fTop}" RightDirection="${left} ${fTop}"/>
                <PathPointType Anchor="${left} ${fBottom}" LeftDirection="${left} ${fBottom}" RightDirection="${left} ${fBottom}"/>
                <PathPointType Anchor="${right} ${fBottom}" LeftDirection="${right} ${fBottom}" RightDirection="${right} ${fBottom}"/>
                <PathPointType Anchor="${right} ${fTop}" LeftDirection="${right} ${fTop}" RightDirection="${right} ${fTop}"/>
              </PathPointArray>
            </GeometryPathType>
          </PathGeometry>
        </Properties>
      </TextFrame>`,
    );
    usedStories.push(folio.selfId);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?aid style="50" type="document" readerVersion="14.0" featureSet="513" product="14.0(148)" ?>
<idPkg:Spread xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="14.0">
  <Spread Self="${spreadSelf}" PageCount="1" BindingLocation="0" AllowPageShuffle="true" ItemTransform="1 0 0 1 0 ${pageIndex * (PAGE_H + 50)}" ShowMasterItems="true" PageTransitionType="None" PageTransitionDirection="NotApplicable" PageTransitionDuration="Medium" FlattenerOverride="Default">
    <FlattenerPreference LineArtAndTextResolution="300" GradientAndMeshResolution="150" ClipComplexRegions="false" ConvertAllStrokesToOutlines="false" ConvertAllTextToOutlines="false"/>
    <Page Self="${pageSelf}" Name="${pageIndex + 1}" AppliedTrapPreset="TrapPreset/$ID/kDefaultTrapStyleName" OverrideList="" AppliedMaster="uMaster" MasterPageTransform="1 0 0 1 0 0" TabOrder="" GridStartingPoint="TopOutside" UseMasterGrid="true" GeometricBounds="0 0 ${PAGE_H} ${PAGE_W}" ItemTransform="1 0 0 1 0 0">
      <Properties>
        <Descriptor type="list">
          <ListItem type="string">$ID/</ListItem>
          <ListItem type="enumeration">Arabic</ListItem>
          <ListItem type="boolean">true</ListItem>
          <ListItem type="boolean">false</ListItem>
          <ListItem type="long">1</ListItem>
          <ListItem type="string">${pageIndex + 1}</ListItem>
          <ListItem type="boolean">false</ListItem>
          <ListItem type="boolean">false</ListItem>
          <ListItem type="boolean">true</ListItem>
          <ListItem type="boolean">false</ListItem>
        </Descriptor>
        <PageColor type="enumeration">UseMasterColor</PageColor>
      </Properties>
      <MarginPreference ColumnCount="1" ColumnGutter="12" Top="${MARGIN}" Bottom="${MARGIN}" Left="${MARGIN}" Right="${MARGIN}" ColumnDirection="Horizontal" ColumnsPositions="0 ${PAGE_W - 2 * MARGIN}"/>
    </Page>
${items.join("\n")}
  </Spread>
</idPkg:Spread>`;

  return {
    selfId: spreadSelf,
    xml,
    filename: `Spreads/Spread_${spreadSelf}.xml`,
    storyIds: usedStories,
  };
};

const designmapXml = (
  issue: IssueDoc,
  spreads: BuiltSpread[],
  stories: BuiltStory[],
): string => {
  const spreadSrcs = spreads
    .map(
      (s) =>
        `  <idPkg:Spread src="Spreads/Spread_${s.selfId}.xml" xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"/>`,
    )
    .join("\n");
  const storySrcs = stories
    .map(
      (s) =>
        `  <idPkg:Story src="Stories/Story_${s.selfId}.xml" xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"/>`,
    )
    .join("\n");

  const docTitle = `${issue.master.publication} — ${issue.meta.issue}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?aid style="50" type="document" readerVersion="14.0" featureSet="513" product="14.0(148)" ?>
<Document xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="14.0" Self="d" StoryList="${stories.map((s) => s.selfId).join(" ")}" Name="${xmlEscape(docTitle)}.indd" ZeroPoint="0 0" ActiveLayer="Layer_1" CMYKProfile="U.S. Web Coated (SWOP) v2" RGBProfile="sRGB IEC61966-2.1" SolidColorIntent="UseColorSettings" AfterBlendingIntent="UseColorSettings" DefaultImageIntent="UseColorSettings" RGBProfilePolicy="PreserveEmbeddedProfiles" CMYKProfilePolicy="PreserveEmbeddedProfiles" ProfileMismatchForRGBPolicy="None" ProfileMismatchForCMYKPolicy="None" ProfileMismatchForImportedImagesPolicy="None" MissingProfileForRGBPolicy="None" MissingProfileForCMYKPolicy="None">
  <Language Self="Language/$ID/English: USA" Name="$ID/English: USA" SingleQuotes="‘’" DoubleQuotes="“”" PrimaryLanguageName="English" SublanguageName="USA" Id="1033" HyphenationVendor="Proximity" SpellingVendor="Proximity"/>
  <Layer Self="Layer_1" Name="Layer 1" Visible="true" Locked="false" IgnoreWrap="false" ShowGuides="true" LockGuides="false" UI="true" Expendable="true" Printable="true"/>
  <idPkg:Fonts src="Resources/Fonts.xml" xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"/>
  <idPkg:Styles src="Resources/Styles.xml" xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"/>
  <idPkg:Preferences src="Resources/Preferences.xml" xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"/>
  <idPkg:Graphic src="Resources/Graphic.xml" xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"/>
  <idPkg:MasterSpread src="MasterSpreads/MasterSpread_uMaster.xml" xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"/>
${spreadSrcs}
${storySrcs}
</Document>`;
};

export function buildIdml(issue: IssueDoc): Uint8Array {
  reset();
  const spreads: BuiltSpread[] = [];
  const stories: BuiltStory[] = [];

  issue.pages.forEach((page, i) => {
    const text = collectPageText(page, issue, i);
    const body = buildStory(text, i);
    stories.push(body);
    const folio = folioStory(text, i);
    if (folio) stories.push(folio);
    spreads.push(buildSpread(page, text, i, body, folio));
  });

  const files: Record<string, Uint8Array> = {};
  // `mimetype` MUST be the first entry and stored uncompressed in a true
  // OCF zip. fflate's `zipSync` doesn't expose per-entry compression
  // ordering controls; in practice InDesign accepts deflated mimetype.
  files["mimetype"] = strToU8(MIME);
  files["META-INF/container.xml"] = strToU8(containerXml);
  files["designmap.xml"] = strToU8(designmapXml(issue, spreads, stories));
  files["Resources/Fonts.xml"] = strToU8(fontsXml);
  files["Resources/Styles.xml"] = strToU8(stylesXml);
  files["Resources/Graphic.xml"] = strToU8(graphicXml);
  files["Resources/Preferences.xml"] = strToU8(preferencesXml);
  files["MasterSpreads/MasterSpread_uMaster.xml"] = strToU8(masterSpreadXml);
  for (const s of spreads) files[s.filename] = strToU8(s.xml);
  for (const s of stories) files[s.filename] = strToU8(s.xml);

  return zipSync(files, { level: 6 });
}

export function downloadIdml(issue: IssueDoc, filename: string): void {
  const idmlBytes = buildIdml(issue);
  const base = filename.replace(/\.(idml|zip)$/i, "") || "issue";
  const idmlName = `${base}.idml`;
  // Wrap the .idml inside a single .zip for easier sharing (some chat/email
  // clients strip or mis-handle the .idml extension). InDesign users unzip
  // and open the .idml inside.
  const zipBytes = zipSync({ [idmlName]: idmlBytes }, { level: 6 });
  const blob = new Blob([new Uint8Array(zipBytes)], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${base}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- companion package: IDML + Links/ folder of fetched images -------------

/** All unique image URLs referenced by an issue (page hero images + custom image blocks). */
function collectImageUrls(issue: IssueDoc): string[] {
  const urls = new Set<string>();
  for (const page of issue.pages) {
    const anyData = page.data as { imageUrl?: string | null };
    if (anyData.imageUrl) urls.add(anyData.imageUrl);
    for (const b of page.customBlocks ?? []) {
      if (b.kind === "image" && b.imageUrl) urls.add(b.imageUrl);
    }
  }
  return Array.from(urls);
}

const SAFE_NAME_RE = /[^A-Za-z0-9._-]+/g;

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(SAFE_NAME_RE, "_").replace(/^_+|_+$/g, "");
  return cleaned || "image";
}

function extFromContentType(ct: string | null): string | null {
  if (!ct) return null;
  const base = ct.split(";")[0].trim().toLowerCase();
  switch (base) {
    case "image/jpeg":
    case "image/jpg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/gif":
      return ".gif";
    case "image/webp":
      return ".webp";
    case "image/avif":
      return ".avif";
    case "image/tiff":
      return ".tif";
    case "image/svg+xml":
      return ".svg";
    default:
      return null;
  }
}

function deriveFilename(url: string, contentType: string | null, fallbackIndex: number): string {
  try {
    const u = new URL(url, window.location.href);
    const last = u.pathname.split("/").filter(Boolean).pop() ?? "";
    const decoded = decodeURIComponent(last);
    const base = sanitizeFilename(decoded);
    const hasExt = /\.[A-Za-z0-9]{2,5}$/.test(base);
    if (base && hasExt) return base;
    const ext = extFromContentType(contentType) ?? ".img";
    const stem = base || `image-${fallbackIndex + 1}`;
    return `${stem}${ext}`;
  } catch {
    const ext = extFromContentType(contentType) ?? ".img";
    return `image-${fallbackIndex + 1}${ext}`;
  }
}

interface FetchedImage {
  url: string;
  filename: string;
  bytes: Uint8Array;
}

interface SkippedImage {
  url: string;
  reason: string;
}

async function fetchImage(url: string, index: number): Promise<FetchedImage | SkippedImage> {
  try {
    // data: URLs — decode without a network round-trip.
    if (url.startsWith("data:")) {
      const comma = url.indexOf(",");
      if (comma < 0) return { url, reason: "Malformed data URL" };
      const header = url.slice(5, comma);
      const payload = url.slice(comma + 1);
      const ct = header.split(";")[0] || null;
      const isB64 = /;base64/i.test(header);
      const binary = isB64 ? atob(payload) : decodeURIComponent(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return { url, filename: deriveFilename(url, ct, index), bytes };
    }

    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) return { url, reason: `HTTP ${res.status}` };
    const buf = await res.arrayBuffer();
    return {
      url,
      filename: deriveFilename(url, res.headers.get("content-type"), index),
      bytes: new Uint8Array(buf),
    };
  } catch (e) {
    return { url, reason: (e as Error).message || "Fetch blocked (CORS or network)" };
  }
}

/** Build a ZIP containing `<slug>.idml`, `Links/<files>`, and `relink-manifest.txt`. */
export async function buildIdmlPackage(
  issue: IssueDoc,
  slug: string,
): Promise<{ bytes: Uint8Array; fetched: number; skipped: SkippedImage[] }> {
  const idmlBytes = buildIdml(issue);
  const urls = collectImageUrls(issue);
  const results = await Promise.all(urls.map((u, i) => fetchImage(u, i)));

  const fetched: FetchedImage[] = [];
  const skipped: SkippedImage[] = [];
  const usedNames = new Set<string>();

  for (const r of results) {
    if ("bytes" in r) {
      let name = r.filename;
      if (usedNames.has(name)) {
        const dot = name.lastIndexOf(".");
        const stem = dot > 0 ? name.slice(0, dot) : name;
        const ext = dot > 0 ? name.slice(dot) : "";
        let i = 2;
        while (usedNames.has(`${stem}-${i}${ext}`)) i++;
        name = `${stem}-${i}${ext}`;
      }
      usedNames.add(name);
      fetched.push({ ...r, filename: name });
    } else {
      skipped.push(r);
    }
  }

  const manifestLines: string[] = [
    `# ${issue.master.publication} — ${issue.meta.issue}`,
    `# Place this folder next to the .idml file, then in InDesign use Links panel → Relink to Folder → select Links/.`,
    `# Frame Label on each placeholder = original source URL.`,
    "",
    "## Fetched images (frame-label URL → Links/ filename)",
    ...fetched.map((f) => `${f.url}\t->\tLinks/${f.filename}`),
  ];
  if (skipped.length) {
    manifestLines.push(
      "",
      "## Skipped (relink manually in InDesign)",
      ...skipped.map((s) => `${s.url}\t!!\t${s.reason}`),
    );
  }

  const files: Record<string, Uint8Array> = {};
  const idmlName = `${slug || "issue"}.idml`;
  files[idmlName] = idmlBytes;
  for (const f of fetched) files[`Links/${f.filename}`] = f.bytes;
  files["relink-manifest.txt"] = strToU8(manifestLines.join("\n"));
  files["relink-images.jsx"] = strToU8(buildRelinkScript());
  files["README.txt"] = strToU8(buildReadme(issue, idmlName, fetched.length, skipped));

  return { bytes: zipSync(files, { level: 6 }), fetched: fetched.length, skipped };
}

function buildReadme(
  issue: IssueDoc,
  idmlName: string,
  fetchedCount: number,
  skipped: SkippedImage[],
): string {
  const lines: string[] = [
    `${issue.master.publication} — ${issue.meta.issue}`,
    `InDesign package`,
    "=".repeat(48),
    "",
    "WHAT'S IN THIS ZIP",
    `  ${idmlName}            The editable InDesign document (IDML).`,
    `  Links/                 ${fetchedCount} image file(s) referenced by the layout.`,
    `  relink-manifest.txt    Map of original image URLs → local filenames.`,
    `  relink-images.jsx      Optional InDesign script — auto-relinks everything in one click.`,
    `  README.txt             This file.`,
    "",
    "HOW TO OPEN",
    `  1. Unzip this archive so ${idmlName} and the Links/ folder sit side by side.`,
    `  2. In InDesign: File → Open → choose ${idmlName}.`,
    `     (InDesign converts IDML into a new .indd on first save.)`,
    "",
    "RELINKING IMAGES — OPTION A (one-click, recommended)",
    `  1. Save the open document once (Cmd/Ctrl + S) into this same folder so`,
    `     InDesign knows where Links/ lives.`,
    `  2. Window → Utilities → Scripts.`,
    `  3. Drag relink-images.jsx into the "User" folder of the Scripts panel,`,
    `     then double-click it. The script reads relink-manifest.txt, relinks`,
    `     every placeholder frame to its file in Links/, and reports a summary.`,
    "",
    "RELINKING IMAGES — OPTION B (manual, no script)",
    `  1. Open the Links panel:  Window → Links  (or  Cmd/Ctrl + Shift + D).`,
    `  2. Open the panel menu (top-right ☰) → "Relink to Folder…".`,
    `  3. Select the Links/ folder from this zip and click Choose.`,
    `  4. InDesign matches every missing image by filename and relinks them all.`,
    "",
    "IF AN IMAGE IS MISSING OR SHOWS A RED/YELLOW WARNING",
    `  Some images can't be auto-bundled — usually because the source server`,
    `  blocks cross-origin downloads (CORS). Those are listed in`,
    `  relink-manifest.txt under "Skipped (relink manually in InDesign)".`,
    "",
    `  To fix each one:`,
    `    1. Open relink-manifest.txt and copy the original URL.`,
    `    2. Download the image manually (browser → Save Image As…) into the`,
    `       Links/ folder, keeping the filename from the URL when possible.`,
    `    3. In the Links panel, select the missing item, then click the`,
    `       Relink icon (chain) at the bottom and pick the file you saved.`,
    `    4. Alternatively, every placeholder frame has the original URL stored`,
    `       as its Script Label (Window → Output → Script Label) so you can`,
    `       recover the source even without the manifest.`,
    "",
  ];
  if (skipped.length) {
    lines.push(
      `SKIPPED THIS EXPORT (${skipped.length})`,
      ...skipped.map((s) => `  • ${s.url}   — ${s.reason}`),
      "",
    );
  }
  lines.push(
    "TIP",
    `  Keep this zip as the handoff artifact. Re-export from the web editor`,
    `  any time the content changes — the Links/ folder will refresh too.`,
    "",
  );
  return lines.join("\n");
}

export async function downloadIdmlPackage(
  issue: IssueDoc,
  slug: string,
): Promise<{ fetched: number; skipped: SkippedImage[] }> {
  const { bytes, fetched, skipped } = await buildIdmlPackage(issue, slug);
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug || "issue"}-indesign-package.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { fetched, skipped };
}

/**
 * InDesign ExtendScript (.jsx) that reads relink-manifest.txt sitting next to
 * the open document and relinks every placeholder frame to its bundled image
 * in Links/. Frames are matched by their Script Label (which the exporter
 * sets to the original source URL).
 */
function buildRelinkScript(): string {
  return [
    "// Auto-relink packaged images for this InDesign document.",
    "// Usage: open the .idml in this folder, then File → Scripts → Scripts panel →",
    "// double-click relink-images.jsx (or drag this file into the Scripts panel).",
    "#target indesign",
    "(function () {",
    "  if (app.documents.length === 0) {",
    "    alert('Open the .idml from this folder first, then run relink-images.jsx.');",
    "    return;",
    "  }",
    "  var doc = app.activeDocument;",
    "  if (!doc.saved && !doc.fullName) {",
    "    alert('Save the document once so InDesign knows its folder, then run again.');",
    "    return;",
    "  }",
    "  var folder = doc.fullName.parent;",
    "  var manifest = File(folder.fsName + '/relink-manifest.txt');",
    "  if (!manifest.exists) {",
    "    alert('relink-manifest.txt not found next to the document.');",
    "    return;",
    "  }",
    "  manifest.encoding = 'UTF-8';",
    "  manifest.open('r');",
    "  var text = manifest.read();",
    "  manifest.close();",
    "",
    "  var urlToRel = {};",
    "  var lines = text.split(/\\r?\\n/);",
    "  for (var i = 0; i < lines.length; i++) {",
    "    var line = lines[i];",
    "    if (!line || line.charAt(0) === '#') continue;",
    "    if (line.indexOf('->') === -1) continue;",
    "    var parts = line.split(/\\t->\\t|\\s+->\\s+/);",
    "    if (parts.length < 2) continue;",
    "    var url = parts[0].replace(/^\\s+|\\s+$/g, '');",
    "    var rel = parts[1].replace(/^\\s+|\\s+$/g, '');",
    "    if (url && rel) urlToRel[url] = rel;",
    "  }",
    "",
    "  var relinked = 0, placed = 0, failed = 0, notFound = 0;",
    "  var items = doc.allPageItems;",
    "  app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;",
    "  for (var j = 0; j < items.length; j++) {",
    "    var it = items[j];",
    "    var label;",
    "    try { label = it.label; } catch (e) { continue; }",
    "    if (!label) continue;",
    "    var rel = urlToRel[label];",
    "    if (!rel) continue;",
    "    var target = File(folder.fsName + '/' + rel);",
    "    if (!target.exists) { notFound++; continue; }",
    "    try {",
    "      if (it.graphics && it.graphics.length > 0) {",
    "        it.graphics[0].itemLink.relink(target);",
    "        it.graphics[0].itemLink.update();",
    "        relinked++;",
    "      } else if (it.hasOwnProperty('place')) {",
    "        it.place(target);",
    "        placed++;",
    "      } else { failed++; continue; }",
    "      try { it.fit(FitOptions.PROPORTIONALLY); } catch (e2) {}",
    "      try { it.fit(FitOptions.CENTER_CONTENT); } catch (e3) {}",
    "    } catch (e1) { failed++; }",
    "  }",
    "  app.scriptPreferences.userInteractionLevel = UserInteractionLevels.INTERACT_WITH_ALL;",
    "",
    "  for (var k = 0; k < doc.links.length; k++) {",
    "    try {",
    "      if (doc.links[k].status === LinkStatus.LINK_OUT_OF_DATE) doc.links[k].update();",
    "    } catch (e4) {}",
    "  }",
    "",
    "  alert(",
    "    'Relink complete.\\n' +",
    "    'Relinked: ' + relinked + '\\n' +",
    "    'Placed into empty frames: ' + placed + '\\n' +",
    "    'File missing in Links/: ' + notFound + '\\n' +",
    "    'Failed: ' + failed + '\\n\\n' +",
    "    'Anything still missing is listed in relink-manifest.txt under Skipped — relink those manually.'",
    "  );",
    "})();",
    "",
  ].join("\n");
}


