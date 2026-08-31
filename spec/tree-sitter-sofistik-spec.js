describe("SOFiSTiK Tree-sitter grammar", () => {
  let editor;
  let languageMode;

  const setUp = async (text) => {
    editor = await lumine.workspace.open();
    const buffer = editor.getBuffer();
    buffer.setText(text);
    lumine.grammars.assignLanguageMode(buffer, "source.sofistik");
    languageMode = buffer.getLanguageMode();
    await languageMode.ready;
    for (let index = 0; index < 25; index++) await Promise.resolve();
  };

  beforeEach(async () => {
    lumine.config.set("editor.useTreeSitterParsers", true);
    await lumine.packages.activatePackage("language-sofistik");
  });

  it("builds nested program, command, record, and item nodes", async () => {
    await setUp("+PROG SOFIMSHA\nNODE 1 X 0 Y 0\n  2 X 1 Y 0\nEND\n");

    expect(languageMode.tree.rootNode.hasError).toBe(false);
    const program = languageMode.tree.rootNode.descendantsOfType("program")[0];
    const header = program.childForFieldName("header");
    const command = program.descendantsOfType("command")[0];
    expect(header.childForFieldName("module").text).toBe("SOFIMSHA");
    expect(command.childForFieldName("name").text).toBe("NODE");
    expect(command.descendantsOfType("implicit_record").length).toBe(1);
    expect(command.descendantsOfType("item_name").map((node) => node.text)).toEqual([
      "X",
      "Y",
      "X",
      "Y",
    ]);
  });

  it("applies SOFiSTiK scopes and marks contextual errors", async () => {
    await setUp("@ SOFiSTiK 2026\n+PROG AQUA\nCONC NO 1\nEND\n+PROG UNKNOWN\nEND\n");

    expect(editor.scopeDescriptorForBufferPosition([0, 3]).toString()).toContain(
      "meta.version.sofistik",
    );
    expect(editor.scopeDescriptorForBufferPosition([1, 1]).toString()).toContain(
      "support.class.sofistik",
    );
    expect(editor.scopeDescriptorForBufferPosition([2, 1]).toString()).toContain(
      "keyword.control.sofistik",
    );
    expect(editor.scopeDescriptorForBufferPosition([2, 6]).toString()).toContain(
      "entity.name.function.sofistik",
    );
    expect(editor.scopeDescriptorForBufferPosition([4, 7]).toString()).toContain(
      "invalid.illegal.sofistik",
    );
  });

  it("exposes nested program and command symbols", async () => {
    await setUp("+PROG AQUA\nCONC 1 C 30\nEND\n");
    const layer = languageMode.rootLanguageLayer;
    const captures = layer.queries.tagsQuery.captures(layer.tree.rootNode);

    expect(
      captures
        .filter((capture) => capture.name.startsWith("definition."))
        .map((capture) => [capture.name, capture.node.type]),
    ).toEqual([
      ["definition.module", "program"],
      ["definition.method", "command"],
    ]);
    expect(
      captures.filter((capture) => capture.name === "name").map((capture) => capture.node.text),
    ).toEqual(["AQUA", "CONC"]);
  });

  it("folds programs and commands that span physical lines", async () => {
    await setUp("+PROG SOFIMSHA\nNODE 1 X 0\n  2 X 1\nEND\n");
    expect(editor.isFoldableAtBufferRow(0)).toBe(true);
    expect(editor.isFoldableAtBufferRow(1)).toBe(true);
  });
});
