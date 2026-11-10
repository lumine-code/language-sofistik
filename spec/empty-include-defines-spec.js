const path = require("path");

const CASES = [
  ["aqa.include", "aqua", "CONC NO 1 FC 30", "CONC"],
  ["dsn.include", "decreator", "DSLN NO 1 NCS 1", "DSLN"],
  ["lfd.include", "sofiload", "LC NO 1 FACT 1", "LC"],
  ["msh.include", "sofimshc", "SPT NO 1 X 0 Y 0", "SPT"],
  ["tnd.include", "tendon", "PTUV TYPE RE X 0 U 0", "PTUV"],
];

describe("SOFiSTiK inherited inline DEFINE grammar", () => {
  let editor;

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-sofistik");
  });

  afterEach(() => editor?.destroy());

  const rootNode = () => editor.getSyntaxNodeAtBufferPosition([0, 0], (node) => !node.parent);
  const scopesAt = (needle) =>
    editor
      .scopeDescriptorForBufferPosition(
        editor.getBuffer().positionForCharacterIndex(editor.getText().indexOf(needle)),
      )
      .getScopesArray();

  for (const [filename, module, record, command] of CASES) {
    it(`retains empty inline values and following ${module} records through edits and undo`, async () => {
      editor = await lumine.workspace.open(path.join(__dirname, "fixtures", filename));
      expect(editor.getGrammar().scopeName).toBe(`source.sofistik.include.${module}`);
      for (const newline of ["\n", "\r\n"]) {
        for (const ending of ["", newline]) {
          editor.setText(
            ["#define empty =", "#define second =", record, "#define eof ="].join(newline) + ending,
          );
          expect(await editor.whenGrammarSettled()).toBe(true);
          const root = rootNode();
          expect(root.hasError).toBe(false);
          const definitions = root.descendantsOfType("preprocessor_define_statement");
          expect(definitions.map((node) => node.childForFieldName("name").text)).toEqual([
            "empty",
            "second",
            "eof",
          ]);
          expect(definitions.map((node) => node.childForFieldName("value").text.trim())).toEqual([
            "=",
            "=",
            "=",
          ]);
          for (const node of definitions) {
            expect(node.childForFieldName("value").startPosition.row).toBe(node.startPosition.row);
            expect(node.childForFieldName("value").endPosition.row).toBe(node.startPosition.row);
          }
          expect(root.descendantsOfType("preprocessor_define_header")).toEqual([]);
          expect(root.descendantsOfType("command_name").map((node) => node.text)).toEqual([
            command,
          ]);
          expect(scopesAt(command)).toContain("keyword.control.sofistik");
        }
      }

      const prefix = "#define empty =";
      editor.setText(`${prefix} 'initial'\n${record}\n`);
      expect(await editor.whenGrammarSettled()).toBe(true);
      editor.getBuffer().clearUndoStack();
      editor.setTextInBufferRange(
        [
          [0, prefix.length],
          [0, Infinity],
        ],
        "",
      );
      expect(await editor.whenGrammarSettled()).toBe(true);
      expect(rootNode().hasError).toBe(false);
      expect(
        rootNode().descendantsOfType("preprocessor_define_statement")[0].childForFieldName("value")
          .text,
      ).toBe("=");
      expect(scopesAt(command)).toContain("keyword.control.sofistik");
      editor.undo();
      expect(await editor.whenGrammarSettled()).toBe(true);
      expect(editor.getText()).toBe(`${prefix} 'initial'\n${record}\n`);
      expect(rootNode().hasError).toBe(false);
      expect(scopesAt(command)).toContain("keyword.control.sofistik");
    });
  }
});
