const path = require("path");

describe("language-sofistik", () => {
  beforeEach(async () => {
    await lumine.packages.activatePackage("language-sofistik");
  });

  it("selects Tree-sitter for input files", () => {
    for (const extension of ["dat", "gra", "grb", "results"]) {
      const grammar = lumine.grammars.selectGrammar(`model.${extension}`, "");
      expect(grammar.scopeName).toBe("source.sofistik");
      expect(grammar.type).toBe("tree-sitter");
    }
  });

  it("uses the central log grammar for output files", async () => {
    await lumine.packages.activatePackage("language-log");
    for (const extension of ["erg", "lst", "prt", "urs"]) {
      const grammar = lumine.grammars.selectGrammar(`report.${extension}`, "");
      expect(grammar.scopeName).toBe("text.sofistik-output");
      expect(grammar.type).toBe("tree-sitter");
    }
  });

  it("parses the main fixture without errors", async () => {
    const editor = await lumine.workspace.open(path.join(__dirname, "fixtures", "sample.dat"));
    const languageMode = editor.getBuffer().getLanguageMode();
    await languageMode.ready;

    expect(languageMode.tree.rootNode.hasError).toBe(false);
    expect(languageMode.tree.rootNode.descendantsOfType("program").length).toBe(6);
  });

  it("uses a dollar sign for line comments", async () => {
    const editor = await lumine.workspace.open("model.dat");
    editor.setText("+PROG AQUA");
    editor.toggleLineCommentsForBufferRows(0, 0);
    expect(editor.lineTextForBufferRow(0)).toBe("$ +PROG AQUA");
  });

  it("renders record terminators with the syntax keyword color", () => {
    const terminator = document.createElement("span");
    terminator.className = "syntax--sofistik syntax--punctuation syntax--terminator syntax--record";
    const keywordColor = document.createElement("span");
    keywordColor.style.color = "var(--syntax-color-keyword)";
    document.body.append(terminator, keywordColor);

    try {
      expect(getComputedStyle(terminator).color).toBe(getComputedStyle(keywordColor).color);
    } finally {
      terminator.remove();
      keywordColor.remove();
    }
  });
});
