const fs = require("fs");
const path = require("path");

const REGRESSION_FIXTURE = fs.readFileSync(
  path.join(__dirname, "fixtures", "tree-sitter-regressions.dat"),
  "utf8",
);

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

  const scopeFor = (needle, offset = 0) => {
    const index = editor.getText().indexOf(needle);
    expect(index).not.toBe(-1);
    const position = editor.getBuffer().positionForCharacterIndex(index + offset);
    return editor.scopeDescriptorForBufferPosition(position).toString();
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

  it("applies SOFiSTiK scopes without decorating parser recovery nodes", async () => {
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
    expect(editor.scopeDescriptorForBufferPosition([4, 7]).toString()).not.toContain(
      "invalid.illegal.sofistik",
    );
  });

  it("highlights TEMPLATE commands and END records", async () => {
    await setUp("+PROG TEMPLATE\nHEAD variables\nEND\n");

    expect(editor.scopeDescriptorForBufferPosition([1, 1]).toString()).toContain(
      "keyword.control.sofistik",
    );
    expect(editor.scopeDescriptorForBufferPosition([2, 1]).toString()).toContain(
      "keyword.control.sofistik",
    );
  });

  it("parses representative files without changing scope around preprocessor definitions", async () => {
    await setUp(REGRESSION_FIXTURE);

    const root = languageMode.tree.rootNode;
    expect(root.hasError).toBe(false);
    expect(root.descendantsOfType("program").length).toBe(3);
    expect(root.descendantsOfType("commented_program_header").length).toBe(2);
    expect(root.toString()).not.toContain("preprocessor_define_block");
    expect(
      root.descendantsOfType("ignored_text").some((node) => node.text.includes("11 Belki")),
    ).toBe(true);
    expect(root.descendantsOfType("sequence_generator").map((node) => node.text)).toEqual([
      "(80 89 1)",
    ]);
    expect(root.descendantsOfType("hash_variable").map((node) => node.text)).toContain("#q_bk");
    expect(root.descendantsOfType("unit").map((node) => node.text)).toContain("[N/m]");

    const commandNames = root
      .descendantsOfType("command_name")
      .map((node) => node.text.toUpperCase());
    expect(commandNames).toContain("HEAD");
    expect(commandNames).toContain("SUPP");
  });

  it("applies stable scopes to the representative regression cases", async () => {
    await setUp(REGRESSION_FIXTURE);

    expect(scopeFor("$prog sofiload", 1)).toContain("support.class.sofistik");
    expect(scopeFor("$prog maxima", 7)).toContain("support.class.sofistik");
    expect(scopeFor("head variables", 1)).toContain("keyword.control.sofistik");
    expect(scopeFor("end\n\n+prog sofiload", 1)).toContain("keyword.control.sofistik");
    expect(scopeFor("#q_bk", 1)).toContain("variable.other.sofistik");
    expect(scopeFor("[N/m]", 1)).toContain("constant.other.sofistik");
    expect(scopeFor("(80 89 1)", 1)).toContain("constant.numeric.sofistik");
    expect(scopeFor("supp $(no)", 1)).toContain("keyword.control.sofistik");
    expect(scopeFor("11 Belki", 1)).not.toContain("invalid.illegal.sofistik");
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
