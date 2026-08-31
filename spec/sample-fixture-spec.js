const fs = require("fs");
const path = require("path");

const FIXTURE = path.join(__dirname, "fixtures", "sample.dat");

describe("SOFiSTiK sample fixtures", () => {
  beforeEach(async () => {
    await lumine.packages.activatePackage("language-sofistik");
  });

  it("parses sample.dat with Tree-sitter", async () => {
    lumine.config.set("editor.useTreeSitterParsers", true);
    const editor = await lumine.workspace.open(FIXTURE);
    const languageMode = editor.getBuffer().getLanguageMode();
    await languageMode.ready;
    await languageMode.atTransactionEnd();

    expect(editor.getGrammar().scopeName).toBe("source.sofistik");
    expect(editor.getGrammar().constructor.name).toBe("TreeSitterGrammar");
    expect(languageMode.tree.rootNode.hasError).toBe(false);
    expect(languageMode.tree.rootNode.descendantsOfType("program").length).toBe(6);
    expect(languageMode.tree.rootNode.descendantsOfType("command").length).toBeGreaterThan(15);
  });

  it("tokenizes sample.dat with the TextMate fallback", async () => {
    lumine.config.set("editor.useTreeSitterParsers", false);
    try {
      const editor = await lumine.workspace.open(FIXTURE);
      expect(editor.getGrammar().scopeName).toBe("source.sofistik");
      expect(editor.getGrammar().constructor.name).not.toBe("TreeSitterGrammar");

      const scopes = new Set();
      for (const tokens of editor.getGrammar().tokenizeLines(fs.readFileSync(FIXTURE, "utf8"))) {
        for (const token of tokens) {
          for (const name of token.scopes) scopes.add(name);
        }
      }
      scopes.delete("source.sofistik");
      expect(scopes.size).toBeGreaterThan(0);
    } finally {
      lumine.config.set("editor.useTreeSitterParsers", true);
    }
  });
});
