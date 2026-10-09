const path = require("path");

const INCLUDE_CASES = [
  ["aqa.include", "aqua", "CONC NO 1 FC 30", "CONC", "FC"],
  ["msh.include", "sofimshc", "SPT NO 1 X 0 Y 0", "SPT", "X"],
  ["lfd.include", "sofiload", "LC NO 1 FACT 1", "LC", "FACT"],
  ["dsn.include", "decreator", "DSLN NO 1 NCS 1", "DSLN", "NCS"],
  ["spt.include", "tendon", "PTUV TYPE RE X 0 U 0", "PTUV", "U"],
  ["tnd.include", "tendon", "PTUV TYPE RE X 0 U 0", "PTUV", "U"],
];

describe("SOFiPLUS include grammars", () => {
  const setUp = async (filename, text) => {
    const editor = await lumine.workspace.open(path.join(__dirname, "fixtures", filename));
    editor.setText(text);
    const languageMode = editor.getBuffer().getLanguageMode();
    await languageMode.ready;
    await languageMode.atTransactionEnd();
    return editor;
  };

  const scopesAt = (editor, text, offset = 0) => {
    const index = editor.getText().indexOf(text);
    expect(index).not.toBe(-1);
    const position = editor.getBuffer().positionForCharacterIndex(index + offset);
    return editor.scopeDescriptorForBufferPosition(position).getScopesArray();
  };

  const rootNode = (editor) =>
    editor.getSyntaxNodeAtBufferPosition([0, 0], (node) => node.parent == null);

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-sofistik");
  });

  for (const [filename, module, record, command, item] of INCLUDE_CASES) {
    it(`highlights ${filename} in ${module.toUpperCase()} without a program header`, async () => {
      for (const name of [filename, filename.toUpperCase()]) {
        const text = `$ include fragment\n${record}\n`;
        const editor = await setUp(name, text);
        expect(editor.getGrammar().scopeName).toBe(`source.sofistik.include.${module}`);
        expect(editor.getText()).toBe(text);

        const root = rootNode(editor);
        expect(root.hasError).toBe(false);
        expect(root.descendantsOfType("program").length).toBe(0);
        expect(root.descendantsOfType("command_name").map((node) => node.text)).toEqual([command]);
        const commandNode = root.descendantsOfType("command_name")[0];
        expect(commandNode.startPosition.row).toBe(1);
        expect(commandNode.startPosition.column).toBe(0);
        expect(scopesAt(editor, command)).toContain("keyword.control.sofistik");
        expect(scopesAt(editor, ` ${item} `, 1)).toContain("entity.name.function.sofistik");
        expect(scopesAt(editor, "$ include")).toContain("comment.line.sofistik");
        editor.destroy();
      }
    });
  }

  it("keeps records from another module unhighlighted", async () => {
    const editor = await setUp("aqa.include", "CONC NO 1\nSPTP TYPE P X 0\n");
    expect(scopesAt(editor, "CONC")).toContain("keyword.control.sofistik");
    expect(scopesAt(editor, "SPTP")).not.toContain("keyword.control.sofistik");
    expect(scopesAt(editor, " X ", 1)).not.toContain("entity.name.function.sofistik");
    expect(rootNode(editor).hasError).toBe(false);
  });

  it("honors an explicit module header over the filename context", async () => {
    const editor = await setUp(
      "aqa.include",
      "CONC NO 1\n$PROG SOFIMSHC\nSPT NO 2 X 0\nCONC NO 3\n",
    );
    expect(scopesAt(editor, "CONC NO 1")).toContain("keyword.control.sofistik");
    expect(scopesAt(editor, "SPT NO 2")).toContain("keyword.control.sofistik");
    expect(scopesAt(editor, "CONC NO 3")).not.toContain("keyword.control.sofistik");
    expect(rootNode(editor).hasError).toBe(false);
  });

  it("preserves module context after END and through incremental edits", async () => {
    const editor = await setUp("aqa.include", "END\nCONC NO 1\nEND\nSTEE NO 2\n");
    expect(scopesAt(editor, "CONC")).toContain("keyword.control.sofistik");
    expect(scopesAt(editor, "STEE")).toContain("keyword.control.sofistik");

    editor.getBuffer().setTextInRange(
      [
        [1, 0],
        [1, 4],
      ],
      "STEE",
    );
    await editor.getBuffer().getLanguageMode().atTransactionEnd();
    expect(
      rootNode(editor)
        .descendantsOfType("command_name")
        .map((node) => node.text),
    ).toEqual(["STEE", "STEE"]);
    expect(rootNode(editor).hasError).toBe(false);

    editor.setText("");
    await editor.getBuffer().getLanguageMode().atTransactionEnd();
    editor.setText("CONC NO 5\n");
    await editor.getBuffer().getLanguageMode().atTransactionEnd();
    expect(scopesAt(editor, "CONC")).toContain("keyword.control.sofistik");
  });

  it("updates module context when the include filename changes", async () => {
    const editor = await setUp("aqa.include", "CONC NO 1\nSPT NO 2 X 0\n");
    expect(scopesAt(editor, " X ", 1)).not.toContain("entity.name.function.sofistik");
    editor.getBuffer().setPath(path.join(__dirname, "fixtures", "msh.include"));
    const languageMode = editor.getBuffer().getLanguageMode();
    await languageMode.ready;
    await languageMode.atTransactionEnd();
    expect(editor.getGrammar().scopeName).toBe("source.sofistik.include.sofimshc");
    expect(scopesAt(editor, "CONC")).not.toContain("keyword.control.sofistik");
    expect(scopesAt(editor, "SPT")).toContain("keyword.control.sofistik");
    expect(scopesAt(editor, " X ", 1)).toContain("entity.name.function.sofistik");
    expect(editor.getText()).toBe("CONC NO 1\nSPT NO 2 X 0\n");
  });

  it("folds control blocks and highlights values inside include fragments", async () => {
    const editor = await setUp("aqa.include", "LOOP#i 2\nCONC NO #i FC 30\nENDLOOP\n");
    expect(rootNode(editor).hasError).toBe(false);
    expect(editor.isFoldableAtBufferRow(0)).toBe(true);
    expect(scopesAt(editor, "#i", 1)).toContain("variable.other.sofistik");
    expect(scopesAt(editor, "30")).toContain("constant.numeric.sofistik");
  });

  it("ends a SOFiLOAD include table at a variable while keeping directives transparent", async () => {
    const editor = await setUp(
      "lfd.include",
      "ACT TYPE PART SUP\n    lp_u q_1 cond\n" +
        "#INCLUDE rows.inc\n    lp_x q_1 unsi\nSTO#saved 1\nACT TYPE PART SUP\n    lp_Q q_2 excl\n",
    );
    const root = rootNode(editor);
    expect(root.hasError).toBe(false);
    expect(root.descendantsOfType("program").length).toBe(0);
    expect(root.descendantsOfType("table_row").length).toBe(3);
    const command = root.descendantsOfType("command")[0];
    const statement = root.descendantsOfType("variable_statement")[0];
    expect(statement.parent.id).toBe(command.parent.id);
    expect(command.endIndex).toBeLessThanOrEqual(statement.startIndex);
    expect(command.descendantsOfType("preprocessor_directive").length).toBe(1);
    const restarted = root.descendantsOfType("command")[1];
    expect(restarted.descendantsOfType("table_row").map((node) => node.text.trim())).toEqual([
      "lp_Q q_2 excl",
    ]);
    expect(root.descendantsOfType("variable_keyword").map((node) => node.text)).toEqual(["STO"]);
    expect(scopesAt(editor, "STO#saved", 1)).toContain("keyword.control.sofistik");
    expect(scopesAt(editor, "#saved", 1)).toContain("variable.other.sofistik");
    expect(scopesAt(editor, "#INCLUDE", 1)).toContain("entity.name.section.sofistik");
    expect(scopesAt(editor, "rows.inc", 1)).toContain("string.other.sofistik");
  });

  it("uses the ordinary grammar for other include names and extensions", async () => {
    for (const filename of ["other.include", "aqax.include", "aqa.dat"]) {
      const grammar = lumine.grammars.selectGrammar(filename, "");
      expect(grammar.scopeName).toBe("source.sofistik");
    }
    const editor = await setUp("other.include", "$PROG AQUA\nCONC NO 1\n");
    expect(scopesAt(editor, "CONC")).toContain("keyword.control.sofistik");
    expect(rootNode(editor).hasError).toBe(false);
  });
});
