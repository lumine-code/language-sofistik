describe("sofistik conservative indentation", () => {
  let editor;
  beforeEach(async () => {
    jasmine.useRealClock();
    await lumine.packages.activatePackage("language-sofistik");
    editor = await lumine.workspace.open("indentation.dat");
    editor.update({ autoIndent: true, tabLength: 2, softTabs: true });
  });
  afterEach(() => editor.destroy());
  async function newline(source) {
    editor.setText(source);
    await editor.whenGrammarSettled();
    editor.setCursorBufferPosition([0, Infinity]);
    await editor.insertNewline();
    return editor.lineTextForBufferRow(1);
  }
  it("does not guess indentation from an unfinished construct", async () => {
    expect(await newline("LOOP#i 2")).toBe("");
  });
  it("inherits manual indentation when continuing a line", async () => {
    expect(await newline("  LET#value #i")).toBe("  ");
  });
  it("ignores structural-looking punctuation in comments", async () => {
    expect(await newline("$ LOOP#i ( {")).toBe("");
  });
});
