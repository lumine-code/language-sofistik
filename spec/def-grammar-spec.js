const path = require("path");

describe("SOFiSTiK DEF grammar", () => {
  let editor;

  const setUp = async (text) => {
    editor = await lumine.workspace.open(path.join(__dirname, "fixtures", "sofistik.def"));
    if (text != null) editor.setText(text);
    await editor.whenGrammarSettled();
    await editor.getBuffer().getLanguageMode().atTransactionEnd();
    return editor.getSyntaxNodeAtBufferPosition([0, 0], (node) => node.parent == null);
  };

  const scopesAt = (text, offset = 0) => {
    const index = editor.getText().indexOf(text);
    expect(index).not.toBe(-1);
    const position = editor.getBuffer().positionForCharacterIndex(index + offset);
    return editor.scopeDescriptorForBufferPosition(position).getScopesArray();
  };

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-sofistik");
  });

  afterEach(() => editor?.destroy());

  it("selects DEF configuration by filename without claiming other DEF files", () => {
    for (const filename of ["sofistik.def", "SOFISTIK.DEF", path.join("project", "Sofistik.Def")]) {
      const grammar = lumine.grammars.selectGrammar(filename, "");
      expect(grammar.scopeName).toBe("source.sofistik.def");
      expect(grammar.type).toBe("tree-sitter");
    }
    for (const filename of ["model.def", "library.def", "sofistik.definition"]) {
      expect(lumine.grammars.selectGrammar(filename, "").scopeName).not.toBe("source.sofistik.def");
    }
  });

  it("parses environment assignments and sectioned standard mappings", async () => {
    const root = await setUp();
    expect(root.hasError).toBe(false);
    expect(root.descendantsOfType("assignment").length).toBe(6);
    expect(root.descendantsOfType("section_name").map((node) => node.text)).toEqual([
      "STANDARDS",
      "MAPPING",
    ]);
    expect(scopesAt("SOFISTIK_C")).toContain("variable.other.key.sofistik");
    expect(scopesAt("49")).toContain("string.unquoted.sofistik");
    expect(scopesAt("49")).not.toContain("constant.numeric.sofistik");
    expect(scopesAt("STANDARDS")).toContain("entity.name.section.sofistik");
    expect(scopesAt("[STANDARDS]")).toContain(
      "punctuation.definition.section.begin.bracket.square.sofistik",
    );
    expect(scopesAt("=49")).toContain("punctuation.separator.key-value.sofistik");
    expect(scopesAt("SIZE -HP 0")).toContain("string.unquoted.sofistik");
    expect(scopesAt("DIN_EN199X-200X@@0,@702")).toContain("string.unquoted.sofistik");
    expect(scopesAt("# standard mapping", 2)).toContain("string.unquoted.sofistik");
    expect(scopesAt("# standard mapping", 2)).not.toContain("comment.line.sofistik");
  });

  it("keeps inline hashes and other value punctuation literal", async () => {
    const root = await setUp(
      "# Full-line comment\r\nKEY-@@ = C:\\Program Files\\SOFiSTiK;$DATA,@@2=a=b # trailing\r\nEMPTY =\r\n",
    );
    expect(root.hasError).toBe(false);
    expect(root.descendantsOfType("assignment").length).toBe(2);
    expect(root.descendantsOfType("key").map((node) => node.text)).toEqual(["KEY-@@ ", "EMPTY "]);
    expect(root.descendantsOfType("value").map((node) => node.text)).toEqual([
      " C:\\Program Files\\SOFiSTiK;$DATA,@@2=a=b # trailing",
    ]);
    expect(root.descendantsOfType("comment").map((node) => node.text)).toEqual([
      "# Full-line comment",
    ]);
    for (const text of ["Program Files", ";$DATA", "@@2=a=b", "# trailing"]) {
      expect(scopesAt(text)).toContain("string.unquoted.sofistik");
      expect(scopesAt(text)).not.toContain("comment.line.sofistik");
    }
    expect(scopesAt("# Full-line comment", 2)).toContain("comment.line.sofistik");
    expect(scopesAt("# Full-line comment")).toContain("punctuation.definition.comment.sofistik");
  });

  it("treats a hash-prefixed line with an equals sign as a literal assignment", async () => {
    const root = await setUp("# description\n#SOFISTIK_C=49\n# Another description\n");
    expect(root.hasError).toBe(false);
    expect(root.descendantsOfType("assignment").length).toBe(1);
    expect(root.descendantsOfType("key").map((node) => node.text)).toEqual(["#SOFISTIK_C"]);
    expect(root.descendantsOfType("comment").map((node) => node.text)).toEqual([
      "# description",
      "# Another description",
    ]);
    expect(scopesAt("#SOFISTIK_C")).toContain("variable.other.key.sofistik");
    expect(scopesAt("#SOFISTIK_C")).not.toContain("comment.line.sofistik");
  });

  it("folds a section without folding the following header", async () => {
    await setUp("[STANDARDS]\nFIRST = one\nSECOND = two\n[MAPPING]\nTHIRD = three\n");
    expect(editor.isFoldableAtBufferRow(0)).toBe(true);
    editor.foldBufferRow(0);
    const ranges = editor.displayLayer.foldRangesSnapshot();
    expect(ranges.map((range) => [range.start.row, range.end.row])).toEqual([[0, 2]]);
  });

  it("uses hash comments when toggling a configuration assignment", async () => {
    await setUp("SOFISTIK_C=49\n");
    editor.toggleLineCommentsForBufferRows(0, 0);
    expect(editor.lineTextForBufferRow(0)).toBe("# SOFISTIK_C=49");
    editor.toggleLineCommentsForBufferRows(0, 0);
    expect(editor.lineTextForBufferRow(0)).toBe("SOFISTIK_C=49");
  });

  it("offers the PROG snippet only in CADINP grammars", async () => {
    const { mainModule: snippets } = await lumine.packages.activatePackage("snippets");
    await conditionPromise(
      () => snippets.provideSnippets().bundledSnippetsLoaded(),
      "package snippets to load",
      3000,
    );
    await setUp("");

    for (const scope of [
      "source.sofistik.def",
      "source.sofistik",
      "source.sofistik.include.aqua",
    ]) {
      editor.setGrammar(lumine.grammars.grammarForScopeName(scope));
      await editor.whenGrammarSettled();
      const prog = snippets.getSnippets(editor).prog;
      if (scope === "source.sofistik.def") {
        expect(prog).withContext(scope).toBeUndefined();
      } else {
        expect(prog?.prefix).withContext(scope).toBe("prog");
      }
    }
  });
});
