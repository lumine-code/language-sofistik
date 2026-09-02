const fs = require("fs");
const path = require("path");

const REGRESSION_FIXTURE = fs.readFileSync(
  path.join(__dirname, "fixtures", "tree-sitter-regressions.dat"),
  "utf8",
);
const FLAT_PREPROCESSOR_FIXTURE = fs.readFileSync(
  path.join(__dirname, "fixtures", "flat-preprocessor.dat"),
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
    await languageMode.atTransactionEnd();
  };

  const scopeFor = (needle, offset = 0) => {
    const index = editor.getText().indexOf(needle);
    expect(index).not.toBe(-1);
    const position = editor.getBuffer().positionForCharacterIndex(index + offset);
    return editor.scopeDescriptorForBufferPosition(position).toString();
  };

  const foldedBufferRanges = () =>
    editor.displayLayer.foldRangesSnapshot().map((range) => [range.start.row, range.end.row]);

  const expectFoldableRows = (foldableRows, otherRows) => {
    for (const row of foldableRows) expect(editor.isFoldableAtBufferRow(row)).toBe(true);
    for (const row of otherRows) expect(editor.isFoldableAtBufferRow(row)).toBe(false);
  };

  const expectFoldAt = (row, expectedRange) => {
    editor.unfoldAll();
    editor.foldBufferRow(row);
    expect(foldedBufferRanges()).toEqual([expectedRange]);
  };

  beforeEach(async () => {
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

  it("treats program options as comments and enum-like values as plain text", async () => {
    await setUp("+PROG TENDON URS:9\nAXES VAL3 11 KIND QUAD\nAXES VAL3 12 quad\nEND\n");

    expect(languageMode.tree.rootNode.hasError).toBe(false);
    expect(scopeFor("+PROG", 1)).toContain("support.class.sofistik");
    expect(scopeFor("TENDON", 1)).toContain("support.class.sofistik");
    expect(scopeFor("URS:9", 1)).toContain("comment.line.sofistik");
    for (const value of ["QUAD", "quad"]) {
      expect(scopeFor(value, 1)).not.toContain("constant.other.sofistik");
    }
  });

  it("inherits localized PAGE commands and items in every program scope", async () => {
    await setUp(
      "$PROG ASE\n#DEFINE ASE_CTRL\nPAGE UNII 0\n#ENDDEF\n" +
        "$PROG AQB\n#DEFINE AQB_CTRL\nSEIT UNIE 0\n#ENDDEF\n",
    );

    expect(languageMode.tree.rootNode.hasError).toBe(false);
    expect(languageMode.tree.rootNode.descendantsOfType("invalid_command").length).toBe(0);
    for (const command of ["PAGE", "SEIT"]) {
      expect(scopeFor(command, 1)).toContain("keyword.control.sofistik");
    }
    for (const item of ["UNII", "UNIE"]) {
      expect(scopeFor(item, 1)).toContain("entity.name.function.sofistik");
    }
  });

  it("does not assign a function scope to a complete expression", async () => {
    await setUp(
      "+PROG SOFILOAD\nLC 1\nLINE QGRP 'PP' TYPE PG P 1.51*(#p_z3+0.36*0.06*26)[N/m] X1 0 X2 1\nEND\n",
    );

    expect(languageMode.tree.rootNode.hasError).toBe(false);
    expect(scopeFor("(#p_z3", 0)).not.toContain("entity.name.function.sofistik");
    expect(scopeFor("+0.36", 0)).not.toContain("entity.name.function.sofistik");
    expect(scopeFor("[N/m]", 1)).toContain("constant.other.sofistik");
  });

  it("highlights complete quoted TITL values after an equals sign", async () => {
    await setUp(
      "+PROG AQB\n" +
        'COMB EXTR MAX TITL="Sum_11 G1 activating new"\n' +
        "COMB EXTR MAX TITL='Sum_12 G2 activating old'\n" +
        "END\n",
    );

    expect(languageMode.tree.rootNode.hasError).toBe(false);
    const strings = languageMode.tree.rootNode.descendantsOfType("string");
    expect(strings.map((node) => node.text)).toEqual([
      '"Sum_11 G1 activating new"',
      "'Sum_12 G2 activating old'",
    ]);

    for (const [value, expectedScope] of [
      ['"Sum_11 G1 activating new"', "string.double.sofistik"],
      ["'Sum_12 G2 activating old'", "string.single.sofistik"],
    ]) {
      for (const offset of [0, 1, value.length - 1]) {
        expect(scopeFor(value, offset)).toContain(expectedScope);
      }
    }
  });

  it("highlights SYS inside and outside a flat preprocessor condition", async () => {
    await setUp(
      "#IF #copy_enabled\n+SYS wait copy 'inside.dat' 'inside-copy.dat'\n#ENDIF\n+SYS wait copy \"outside.dat\" \"outside-copy.dat\"\n",
    );

    expect(languageMode.tree.rootNode.hasError).toBe(false);
    expect(languageMode.tree.rootNode.descendantsOfType("sys_statement").length).toBe(2);
    expect(scopeFor("#IF", 1)).toContain("entity.name.section.sofistik");
    expect(scopeFor("#copy_enabled", 1)).toContain("variable.other.sofistik");
    expect(scopeFor("+SYS", 1)).toContain("support.class.sofistik");
    expect(scopeFor('SYS wait copy "outside.dat"', 1)).toContain("support.class.sofistik");
    expect(scopeFor("'inside.dat'", 1)).toContain("string.single.sofistik");
    expect(scopeFor('"outside.dat"', 1)).toContain("string.double.sofistik");
  });

  it("highlights an APPLY sigil and its interpolated string argument", async () => {
    await setUp('+APPLY "$(project)_csm.dat"\n');

    expect(languageMode.tree.rootNode.hasError).toBe(false);
    expect(languageMode.tree.rootNode.descendantsOfType("apply_statement").length).toBe(1);
    expect(scopeFor("+APPLY", 1)).toContain("support.class.sofistik");
    expect(scopeFor('"$(project)_csm.dat"', 0)).toContain("string.double.sofistik");
    expect(scopeFor("$(project)", 2)).toContain("variable.other.sofistik");
  });

  it("highlights dollar variables but not hash syntax inside strings", async () => {
    await setUp(
      "+PROG ASE\n" +
        'CTRL ASE TEXT "$(asetxt1)"\n' +
        "CTRL ASE TEXT '$(asetxt2)'\n" +
        'CTRL ASE TEXT "#plain"\n' +
        "END\n",
    );

    expect(languageMode.tree.rootNode.hasError).toBe(false);
    expect(scopeFor("$(asetxt1)", 2)).toContain("variable.other.sofistik");
    expect(scopeFor("$(asetxt2)", 2)).toContain("variable.other.sofistik");
    expect(scopeFor('"$(asetxt1)"', 0)).toContain("string.double.sofistik");
    expect(scopeFor("'$(asetxt2)'", 0)).toContain("string.single.sofistik");
    expect(scopeFor('"#plain"', 1)).toContain("string.double.sofistik");
    expect(scopeFor('"#plain"', 1)).not.toContain("variable.other.sofistik");
  });

  it("highlights variables but not literals in a sequence generator", async () => {
    await setUp("+PROG CSM\nGRP (24001 24000+#idt 1) ICS1 11 PHIF 0\nEND\n");

    expect(languageMode.tree.rootNode.hasError).toBe(false);
    expect(languageMode.tree.rootNode.descendantsOfType("sequence_generator").length).toBe(1);
    expect(scopeFor("#idt", 1)).toContain("variable.other.sofistik");
    for (const literal of ["(24001", "24000+#idt", "1)"]) {
      const scope = scopeFor(literal, literal.startsWith("(") ? 1 : 0);
      expect(scope).not.toContain("constant.numeric.sofistik");
      expect(scope).not.toContain("entity.name.function.sofistik");
    }
  });

  it("highlights variables and quoted strings on the right side of a definition", async () => {
    await setUp("#DEFINE macro = poin qgrp 'PP' type pg p #Q_w x #x y #y ! note\n");

    expect(scopeFor("#DEFINE", 1)).toContain("entity.name.section.sofistik");
    expect(scopeFor("macro", 1)).toContain("string.other.sofistik");
    for (const value of ["#Q_w", "#x", "#y"]) {
      expect(scopeFor(value, 1)).toContain("variable.other.sofistik");
    }
    expect(scopeFor("'PP'", 1)).toContain("string.single.sofistik");
    for (const value of ["poin", "qgrp", "type", "pg"]) {
      const scope = scopeFor(value, 1);
      expect(scope).not.toContain("entity.name.function.sofistik");
      expect(scope).not.toContain("string.");
      expect(scope).not.toContain("variable.other.sofistik");
      expect(scope).not.toContain("constant.numeric.sofistik");
      expect(scope).not.toContain("constant.other.sofistik");
    }
    expect(scopeFor("! note", 1)).toContain("comment.line.sofistik");
  });

  it("highlights a dollar variable on the right side of a definition", async () => {
    await setUp("#DEFINE project = $(probase)\n");

    expect(scopeFor("project", 1)).toContain("string.other.sofistik");
    expect(scopeFor("$(probase)", 2)).toContain("variable.other.sofistik");
    expect(scopeFor(" = ", 1)).not.toContain("keyword.operator.sofistik");
  });

  it("highlights preprocessor directive arguments by value type", async () => {
    await setUp(
      '#INCLUDE maxima-supp\n#INCLUDE "$(project).dat"\n#INCLUDE $(include_path)\n#INCLUDE #i_results\n',
    );

    expect(scopeFor("maxima-supp", 1)).toContain("string.other.sofistik");
    expect(scopeFor('"$(project).dat"', 1)).toContain("string.other.sofistik");
    expect(scopeFor("$(include_path)", 2)).toContain("variable.other.sofistik");
    expect(scopeFor("#i_results", 1)).toContain("variable.other.sofistik");
  });

  it("preserves a trailing comment after a flat definition value", async () => {
    await setUp("#DEFINE no = 119 ! only vertical live\n");

    expect(languageMode.tree.rootNode.hasError).toBe(false);
    expect(scopeFor("no", 1)).toContain("string.other.sofistik");
    expect(scopeFor("119", 1)).not.toContain("constant.numeric.sofistik");
    expect(scopeFor("119", 1)).not.toContain("entity.name.function.sofistik");
    expect(scopeFor("! only vertical live", 1)).toContain("comment.line.sofistik");
  });

  it("keeps preprocessor conditionals flat and their bodies in module scope", async () => {
    await setUp(FLAT_PREPROCESSOR_FIXTURE);

    expect(languageMode.tree.rootNode.hasError).toBe(false);
    expect(
      languageMode.tree.rootNode
        .descendantsOfType("preprocessor_keyword")
        .map((node) => node.text.toUpperCase()),
    ).toEqual(["#IF", "#ELSEIF", "#ELSE", "#ENDIF"]);

    for (const keyword of ["#IF", "#ELSEIF", "#ELSE", "#ENDIF"]) {
      expect(scopeFor(keyword, 1)).toContain("entity.name.section.sofistik");
    }

    for (const condition of ["#first_condition", "$(alternate)"]) {
      const scope = scopeFor(condition, 1);
      expect(scope).toContain("variable.other.sofistik");
      expect(scope).not.toContain("entity.name.function.sofistik");
      expect(scope).not.toContain("string.other.sofistik");
    }

    for (const command of ["NODE 1", "NODE 2", "NODE 3"]) {
      expect(scopeFor(command, 1)).toContain("keyword.control.sofistik");
    }
    for (const item of ["X #first_x", "X #alternate_x", "X #fallback_x"]) {
      expect(scopeFor(item)).toContain("entity.name.function.sofistik");
    }
    for (const variable of ["#first_x", "#alternate_x", "#fallback_x"]) {
      expect(scopeFor(variable, 1)).toContain("variable.other.sofistik");
    }
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
    expect(scopeFor("(80 89 1)", 1)).not.toContain("constant.numeric.sofistik");
    expect(scopeFor("(80 89 1)", 1)).not.toContain("entity.name.function.sofistik");
    expect(scopeFor("lc #lc0", 1)).toContain("keyword.control.sofistik");
    expect(scopeFor("copy #lc0", 1)).toContain("keyword.control.sofistik");
    expect(scopeFor("supp $(no)", 1)).toContain("keyword.control.sofistik");
    expect(scopeFor("maxima-supp", 1)).toContain("string.other.sofistik");
    expect(scopeFor("#enddef", 1)).toContain("entity.name.section.sofistik");
    expect(scopeFor("11 Belki", 1)).not.toContain("invalid.illegal.sofistik");
  });

  it("highlights every variable occurrence inside a parenthesized expression", async () => {
    await setUp(REGRESSION_FIXTURE);

    const expression = "(#L_1)+(#L_2-#L_1+#L_0)*(#i/(#L_n-1))";
    const expressionStart = editor.getText().indexOf(expression);
    expect(expressionStart).not.toBe(-1);
    const matches = [...expression.matchAll(/#[A-Za-z][A-Za-z0-9_]*/g)];
    expect(matches.map((match) => match[0])).toEqual([
      "#L_1",
      "#L_2",
      "#L_1",
      "#L_0",
      "#i",
      "#L_n",
    ]);

    for (const match of matches) {
      const position = editor
        .getBuffer()
        .positionForCharacterIndex(expressionStart + match.index + 1);
      expect(editor.scopeDescriptorForBufferPosition(position).toString()).toContain(
        "variable.other.sofistik",
      );
    }

    for (const literal of ["(", ")", "+", "-", "*", "/", "1"]) {
      const position = editor
        .getBuffer()
        .positionForCharacterIndex(expressionStart + expression.indexOf(literal));
      const scope = editor.scopeDescriptorForBufferPosition(position).toString();
      expect(scope).not.toContain("constant.numeric.sofistik");
      expect(scope).not.toContain("entity.name.function.sofistik");
    }
  });

  it("highlights both variable syntaxes and quoted strings in a LET definition", async () => {
    await setUp(
      "+PROG SOFILOAD\n" +
        "LET#D_1 1.2+0.40+#D_F ; " +
        "LET#POS #L_1+#D_1+(#L_2-#L_1-#D_1)*(#I/(#L_N-1))+$(OFFSET) \"double\" 'single'\n" +
        "END\n",
    );

    expect(languageMode.tree.rootNode.hasError).toBe(false);
    const statement = languageMode.tree.rootNode.descendantsOfType("variable_statement")[1];
    const variables = [
      ...statement.descendantsOfType("hash_variable"),
      ...statement.descendantsOfType("dollar_variable"),
    ];
    expect(variables.map((node) => node.text)).toEqual([
      "#POS",
      "#L_1",
      "#D_1",
      "#L_2",
      "#L_1",
      "#D_1",
      "#I",
      "#L_N",
      "$(OFFSET)",
    ]);
    for (const variable of variables) {
      expect(editor.scopeDescriptorForBufferPosition(variable.startPosition).toString()).toContain(
        "variable.other.sofistik",
      );
    }

    const strings = statement.descendantsOfType("string");
    expect(strings.map((node) => node.text)).toEqual(['"double"', "'single'"]);
    expect(editor.scopeDescriptorForBufferPosition(strings[0].startPosition).toString()).toContain(
      "string.double.sofistik",
    );
    expect(editor.scopeDescriptorForBufferPosition(strings[1].startPosition).toString()).toContain(
      "string.single.sofistik",
    );

    const expression = "#L_1+#D_1+(#L_2-#L_1-#D_1)*(#I/(#L_N-1))";
    const expressionStart = editor.getText().indexOf(expression);
    for (const token of ["+", "-", "*", "/", "(", ")"]) {
      const position = editor
        .getBuffer()
        .positionForCharacterIndex(expressionStart + expression.indexOf(token));
      const scope = editor.scopeDescriptorForBufferPosition(position).toString();
      expect(scope).not.toContain("variable.other.sofistik");
      expect(scope).not.toContain("string.");
      expect(scope).not.toContain("keyword.operator.sofistik");
      expect(scope).not.toContain("entity.name.function.sofistik");
    }
  });

  it("highlights variables and quoted strings inside TEXT blocks", async () => {
    await setUp(
      "+PROG AQUA\n" +
        "<TEXT,FILE=+#outfile,PATH=$(folder),TITLE='PP'>\n" +
        "plain #title $(project) \"double\" 'single'\n" +
        "<\\TEXT>\nEND\n",
    );

    expect(languageMode.tree.rootNode.hasError).toBe(false);
    for (const variable of ["#outfile", "$(folder)", "#title", "$(project)"]) {
      expect(scopeFor(variable, 1)).toContain("variable.other.sofistik");
    }
    expect(scopeFor("'PP'", 1)).toContain("string.single.sofistik");
    expect(scopeFor('"double"', 1)).toContain("string.double.sofistik");
    expect(scopeFor("'single'", 1)).toContain("string.single.sofistik");
    expect(scopeFor("plain", 1)).toContain("string.unquoted.sofistik");
    expect(scopeFor("<TEXT", 1)).toContain("support.function.sofistik");
    expect(scopeFor(">\nplain", 0)).toContain("support.function.sofistik");
    expect(scopeFor("<\\TEXT>", 1)).toContain("support.function.sofistik");
  });

  it("highlights variables but not operators in a flat preprocessor condition", async () => {
    await setUp("#IF $(project)<>$(probase)\n#ENDIF\n");

    for (const variable of ["$(project)", "$(probase)"]) {
      expect(scopeFor(variable, 2)).toContain("variable.other.sofistik");
    }
    const operatorScope = scopeFor("<>", 0);
    expect(operatorScope).not.toContain("keyword.operator.sofistik");
    expect(operatorScope).not.toContain("constant.numeric.sofistik");
    expect(operatorScope).not.toContain("entity.name.function.sofistik");
  });

  it("keeps every command in an AQB definition after END in module scope", async () => {
    await setUp("+PROG AQB\nEND\n#DEFINE aqblcs\nLC 1\nLC 2\nLC 3\n#ENDDEF\n");

    expect(languageMode.tree.rootNode.hasError).toBe(false);
    const commands = languageMode.tree.rootNode.descendantsOfType("command_name");
    expect(commands.map((node) => node.text.toUpperCase())).toEqual(["LC", "LC", "LC"]);
    for (const command of commands) {
      expect(editor.scopeDescriptorForBufferPosition(command.startPosition).toString()).toContain(
        "keyword.control.sofistik",
      );
    }
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

  it("folds complete real and commented program scopes plus flat definitions", async () => {
    await setUp(
      "+PROG AQB\n" +
        "HEAD ULS/E+P\n" +
        "END\n" +
        "#DEFINE aqblcs\n" +
        "LC 1\n" +
        "LC 2\n" +
        "#ENDDEF\n" +
        "+PROG TEMPLATE\n" +
        "HEAD variables\n" +
        "END\n" +
        "$PROG ASE\n" +
        "#DEFINE ASE_CTRL\n" +
        "PAGE UNII 0\n" +
        "#ENDDEF\n" +
        "$PROG AQB\n" +
        "#DEFINE AQB_CTRL\n" +
        "PAGE UNII 0\n" +
        "PAGE UNII 1\n" +
        "#ENDDEF\n",
    );

    expectFoldableRows([0, 3, 7, 10, 11, 14, 15], [1, 2, 4, 5, 8, 9, 12, 13, 16, 17, 18]);
    expectFoldAt(0, [0, 6]);
    expectFoldAt(3, [3, 5]);
    expectFoldAt(10, [10, 13]);
    expectFoldAt(14, [14, 18]);
  });

  it("folds nested and flat preprocessor conditions only from their IF headers", async () => {
    await setUp(
      "+PROG SOFIMSHA\n" +
        "#IF #outer\n" +
        "NODE 1 X 0\n" +
        "#IF #inner\n" +
        "NODE 2 X 1\n" +
        "#ELSEIF #alternate\n" +
        "NODE 3 X 2\n" +
        "#ELSE\n" +
        "NODE 4 X 3\n" +
        "#ENDIF\n" +
        "#ENDIF\n" +
        "#IF #flat\n" +
        "NODE 5 X 4\n" +
        "#ENDIF\n" +
        "END\n",
    );

    expectFoldableRows([0, 1, 3, 11], [2, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14]);
    expectFoldAt(1, [1, 9]);
    expectFoldAt(3, [3, 8]);
    expectFoldAt(11, [11, 12]);
  });

  it("folds balanced nested loops only from their LOOP headers", async () => {
    await setUp(
      "+PROG SOFIMSHA\n" +
        "LOOP 2\n" +
        "LOOP 3\n" +
        "NODE 1 X 0\n" +
        "ENDLOOP\n" +
        "ENDLOOP\n" +
        "END\n",
    );

    expectFoldableRows([0, 1, 2], [3, 4, 5, 6]);
    expectFoldAt(1, [1, 4]);
    expectFoldAt(2, [2, 3]);
  });
});
