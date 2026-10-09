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
const MODERN_SYNTAX_FIXTURE = fs.readFileSync(
  path.join(__dirname, "fixtures", "modern-syntax.dat"),
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

  const scopeForNode = (node, offset = 0) => {
    const position = editor.getBuffer().positionForCharacterIndex(node.startIndex + offset);
    return editor.scopeDescriptorForBufferPosition(position).toString();
  };

  const foldedBufferRanges = () =>
    editor.displayLayer.foldRangesSnapshot().map((range) => [range.start.row, range.end.row]);

  const rootNode = (targetEditor = editor) => {
    const root = targetEditor.getSyntaxNodeAtBufferPosition([0, 0], (node) => node.parent == null);
    expect(root).not.toBeNull();
    return root;
  };

  const expectNoSyntaxError = async (targetEditor = editor) => {
    await targetEditor.getBuffer().getLanguageMode().atTransactionEnd();
    expect(rootNode(targetEditor).hasError).toBe(false);
  };

  const expectOrphanRowError = (row) => {
    const root = rootNode();
    const errors = root.descendantsOfType("ERROR");
    expect(root.hasError).toBe(true);
    expect(errors.length).toBeGreaterThan(0);
    for (const error of errors) {
      expect(error.startPosition.row).toBe(row);
      expect(error.endPosition.row).toBe(row);
    }
  };

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

    await expectNoSyntaxError();
    const program = rootNode().descendantsOfType("program")[0];
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

  it("keeps STO definitions highlighted after an ACT table", async () => {
    await setUp(
      "+prog sofiload\n" +
        "head acts\n" +
        "act type part sup gamu gamf gama psi0 psi1 psi2 titl\n" +
        "    lp_u q_1 cond 1.35 0.00 1.00 0.40 0.40 0.00 'live:u-z'\n" +
        "    lp_x q_1 unsi 1.35 0.00 1.00 0.40 0.40 0.00 'live:u-x'\n" +
        "    lp_Q q_2 excl 1.35 0.00 1.00 0.00 0.00 0.00 'live:Q-z'\n" +
        "    lp_p q_4 excl 1.35 0.00 1.00 0.00 0.00 0.00 'live:ped'\n" +
        "sto#D_f 0.21 ! grubość płyty betonowej\n" +
        "sto#B_1 -1.175 ! lewy krawężnik względem osi\n" +
        "sto#B_2 +1.175 ! prawy krawężnik względem osi\n" +
        "sto#L_1 0.000 ! początek trasy przejazdu\n" +
        "sto#L_2 25.100 ! koniec trasy przejazdu\n" +
        "end\n",
    );

    await expectNoSyntaxError();
    const root = rootNode();
    expect(root.descendantsOfType("table_definition").length).toBe(1);
    expect(root.descendantsOfType("table_row").length).toBe(4);
    const act = root
      .descendantsOfType("command")
      .find((node) => node.childForFieldName("name").text === "act");
    const statements = root.descendantsOfType("variable_statement");
    expect(act.descendantsOfType("variable_statement").length).toBe(0);
    expect(act.endIndex).toBeLessThanOrEqual(statements[0].startIndex);
    for (const statement of statements) expect(statement.parent.id).toBe(act.parent.id);
    const keywords = root.descendantsOfType("variable_keyword");
    expect(keywords.map((node) => node.text)).toEqual(["sto", "sto", "sto", "sto", "sto"]);
    for (const keyword of keywords) {
      expect(scopeForNode(keyword, 1)).toContain("keyword.control.sofistik");
    }
    for (const variable of ["#D_f", "#B_1", "#B_2", "#L_1", "#L_2"]) {
      expect(scopeFor(variable, 1)).toContain("variable.other.sofistik");
    }
    expect(scopeFor("type", 1)).toContain("entity.name.function.sofistik");
    expect(scopeFor("1.35", 1)).toContain("constant.numeric.sofistik");
    expect(scopeFor("'live:u-z'", 1)).toContain("string.single.sofistik");
  });

  it("ends a table at each variable command and requires an explicit new table header", async () => {
    await setUp("");
    for (const source of [
      "LeT#saved 1",
      "sTo #saved 2",
      "RCL#saved",
      "DEL #saved",
      "PRT#saved",
      "DBG #saved",
    ]) {
      editor.setText(
        "+PROG SOFILOAD\nACT TYPE PART SUP TITL\n" +
          "    lp_u q_1 cond STO\n    STO q_1 cond plain\n    let q_1 unsi plain\n" +
          `    ${source};\n` +
          "ACT TYPE PART SUP\n    lp_Q q_2 excl\nLC 1 TYPE NONE\nEND\n",
      );
      await expectNoSyntaxError();
      const root = rootNode();
      const commands = root.descendantsOfType("command");
      const command = commands[0];
      const statement = root.descendantsOfType("variable_statement")[0];
      const keyword = statement.childForFieldName("keyword");
      expect(keyword.text.toUpperCase()).toBe(source.slice(0, 3).toUpperCase());
      expect(scopeForNode(keyword, 1)).toContain("keyword.control.sofistik");
      expect(statement.parent.id).toBe(command.parent.id);
      expect(command.endIndex).toBeLessThanOrEqual(statement.startIndex);
      expect(command.descendantsOfType("variable_statement").length).toBe(0);
      expect(command.descendantsOfType("table_row").map((node) => node.text.trim())).toEqual([
        "lp_u q_1 cond STO",
        "STO q_1 cond plain",
        "let q_1 unsi plain",
      ]);
      expect(commands[1].descendantsOfType("table_row").map((node) => node.text.trim())).toEqual([
        "lp_Q q_2 excl",
      ]);
      for (const value of ["STO q_1", "let q_1"]) {
        expect(scopeFor(value, 1)).not.toContain("keyword.control.sofistik");
      }
      expect(scopeFor("LC 1", 1)).toContain("keyword.control.sofistik");
    }
  });

  it("recognizes commands, control, preprocessing, and CDB statements after tables", async () => {
    await setUp("");
    const boundaries = [
      ["    LOOP#i 2\n    ENDLOOP\n", "loop_block", "LOOP#i", "keyword.control.sofistik"],
      ["    IF 1\n    ENDIF\n", "if_block", "IF 1", "keyword.control.sofistik"],
      ["    #IF 1\n    #ENDIF\n", "preprocessor_if_header", "#IF", "entity.name.section.sofistik"],
      [
        "    #DEFINE value = 1\n",
        "preprocessor_define_statement",
        "#DEFINE",
        "entity.name.section.sofistik",
      ],
      ["    @KEY SECRET\n", "cdb_statement", "@KEY", "keyword.control.sofistik"],
      ["    LC 7 TYPE NONE\n", "command", "LC 7", "keyword.control.sofistik"],
    ];
    for (const [source, type, needle, scope] of boundaries) {
      editor.setText(
        "+PROG SOFILOAD\nACT TYPE PART SUP\n    lp_u q_1 cond\n" + source + "LC 1 TYPE NONE\nEND\n",
      );
      await expectNoSyntaxError();
      const root = rootNode();
      expect(root.descendantsOfType("table_row").length).toBe(1);
      expect(root.descendantsOfType(type).length).toBeGreaterThan(0);
      expect(scopeFor(needle, 1)).toContain(scope);
      expect(scopeFor("LC 1", 1)).toContain("keyword.control.sofistik");
    }
  });

  it("highlights INCLUDE and UNDEF directives between and after table rows", async () => {
    await setUp(
      "+PROG SOFILOAD\nACT TYPE PART SUP\n" +
        "    lp_u q_1 cond\n    #include rows.inc\n" +
        "    lp_x q_1 unsi\n    #undef macro\n" +
        "    STO#remaining 1\nEND\n",
    );

    await expectNoSyntaxError();
    const root = rootNode();
    const command = root.descendantsOfType("command")[0];
    expect(command.descendantsOfType("table_definition").length).toBe(1);
    expect(command.descendantsOfType("table_row").map((node) => node.text.trim())).toEqual([
      "lp_u q_1 cond",
      "lp_x q_1 unsi",
    ]);
    expect(
      command
        .descendantsOfType("preprocessor_directive")
        .map((node) => node.childForFieldName("keyword").text.toUpperCase()),
    ).toEqual(["#INCLUDE", "#UNDEF"]);
    for (const directive of ["#include", "#undef"]) {
      expect(scopeFor(directive, 1)).toContain("entity.name.section.sofistik");
    }
    for (const argument of ["rows.inc", "macro"]) {
      expect(scopeFor(argument, 1)).toContain("string.other.sofistik");
    }
    expect(scopeFor("STO#remaining", 1)).toContain("keyword.control.sofistik");
    const statement = root.descendantsOfType("variable_statement")[0];
    expect(statement.parent.id).toBe(command.parent.id);
    expect(command.endIndex).toBeLessThanOrEqual(statement.startIndex);
  });

  it("preserves variable highlighting when an ACT header becomes and stops being tabular", async () => {
    await setUp(
      "+PROG SOFILOAD\nACT TYPE 'G'\n    lp_u q_1 cond\n" + "STO#saved 1\n    lp_x q_1 unsi\nEND\n",
    );
    const buffer = editor.getBuffer();
    for (const header of ["ACT TYPE PART SUP", "ACT TYPE 'G'", "ACT TYPE PART SUP"]) {
      buffer.setTextInRange(
        [
          [1, 0],
          [1, Infinity],
        ],
        header,
      );
      await languageMode.atTransactionEnd();
      const root = rootNode();
      const isTable = header === "ACT TYPE PART SUP";
      if (isTable) expectOrphanRowError(4);
      else await expectNoSyntaxError();
      expect(root.descendantsOfType("table_definition").length).toBe(isTable ? 1 : 0);
      expect(root.descendantsOfType("table_row").length).toBe(isTable ? 1 : 0);
      if (isTable) {
        const command = root.descendantsOfType("command")[0];
        const statement = root.descendantsOfType("variable_statement")[0];
        expect(statement.parent.id).toBe(command.parent.id);
        expect(command.endIndex).toBeLessThanOrEqual(statement.startIndex);
      }
      expect(root.descendantsOfType("variable_keyword").map((node) => node.text)).toEqual(["STO"]);
      expect(scopeFor("STO#saved", 1)).toContain("keyword.control.sofistik");
      expect(scopeFor("#saved", 1)).toContain("variable.other.sofistik");
    }
  });

  it("updates table boundaries after inserting and removing a variable statement", async () => {
    await setUp("+PROG SOFILOAD\nACT TYPE PART SUP\n    lp_u q_1 cond\n    lp_x q_1 unsi\nEND\n");
    const buffer = editor.getBuffer();
    for (const keyword of ["STO#saved 1", "LET #saved 1"]) {
      buffer.insert([3, 0], keyword + "\n");
      await languageMode.atTransactionEnd();
      let root = rootNode();
      expectOrphanRowError(4);
      const command = root.descendantsOfType("command")[0];
      const statement = root.descendantsOfType("variable_statement")[0];
      expect(root.descendantsOfType("table_row").length).toBe(1);
      expect(statement.parent.id).toBe(command.parent.id);
      expect(command.endIndex).toBeLessThanOrEqual(statement.startIndex);
      expect(scopeFor(keyword, 1)).toContain("keyword.control.sofistik");
      expect(scopeFor("lp_x", 1)).not.toContain("keyword.control.sofistik");
      expect(scopeFor("lp_x", 1)).not.toContain("entity.name.function.sofistik");

      buffer.delete([
        [3, 0],
        [4, 0],
      ]);
      await expectNoSyntaxError();
      root = rootNode();
      expect(root.descendantsOfType("table_row").map((node) => node.text.trim())).toEqual([
        "lp_u q_1 cond",
        "lp_x q_1 unsi",
      ]);
      expect(root.descendantsOfType("variable_statement").length).toBe(0);
    }
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

  it("highlights executable module aliases with their schema commands", async () => {
    await setUp(
      "+prog dbmerg\nhead Copy results\ncdb from 1\nend\n" +
        "+prog star2\nbeme am1 1\nend\n" +
        "+prog tunars\ngeo no 1\nend\n",
    );

    await expectNoSyntaxError();
    const root = rootNode();
    expect(root.descendantsOfType("invalid_module").length).toBe(0);
    expect(root.descendantsOfType("invalid_command").length).toBe(0);

    const modules = root.descendantsOfType("module_name");
    expect(modules.map((node) => node.text.toUpperCase())).toEqual(["DBMERG", "STAR2", "TUNARS"]);
    for (const module of modules) {
      expect(editor.scopeDescriptorForBufferPosition(module.startPosition).toString()).toContain(
        "support.class.sofistik",
      );
    }

    const commands = root.descendantsOfType("command_name");
    expect(commands.map((node) => node.text.toUpperCase())).toEqual(["HEAD", "CDB", "BEME", "GEO"]);
    for (const command of commands) {
      expect(editor.scopeDescriptorForBufferPosition(command.startPosition).toString()).toContain(
        "keyword.control.sofistik",
      );
    }
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

  it("keeps incomplete and unknown command words plain while typing", async () => {
    await setUp("\n+prog sofiload\n");
    const buffer = editor.getBuffer();

    for (const word of ["h", "he", "hea", "head", "hea", "unknown"]) {
      buffer.setTextInRange(
        [
          [2, 0],
          [2, Infinity],
        ],
        word,
      );
      await languageMode.atTransactionEnd();

      for (let column = 0; column < word.length; column++) {
        const scope = editor.scopeDescriptorForBufferPosition([2, column]).toString();
        expect(scope).not.toContain("string.");
        expect(scope.includes("keyword.control.sofistik")).toBe(word === "head");
      }
    }

    for (const suffix of ["\n", "\nend\n"]) {
      buffer.setText(`+prog sofiload\nhea${suffix}`);
      await languageMode.atTransactionEnd();
      expect(scopeFor("hea", 1)).not.toContain("string.");
      expect(scopeFor("hea", 1)).not.toContain("keyword.control.sofistik");
    }
  });

  it("highlights names in DEFINE and UNDEF directives", async () => {
    await setUp(
      "#DEFINE block_name\n#ENDDEF\n#DEFINE value_name = 1\n" +
        "#UNDEF block_name value_name\n#DEFINE partial_name",
    );

    await expectNoSyntaxError();
    const names = rootNode().descendantsOfType("preprocessor_name");
    expect(names.map((node) => node.text)).toEqual([
      "block_name",
      "value_name",
      "block_name",
      "value_name",
      "partial_name",
    ]);
    for (const name of names) {
      expect(scopeForNode(name, 1)).toContain("string.other.sofistik");
    }
  });

  it("treats program options as comments and enum-like values as plain text", async () => {
    await setUp("+PROG TENDON URS:9\nAXES VAL3 11 KIND QUAD\nAXES VAL3 12 quad\nEND\n");

    await expectNoSyntaxError();
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

    await expectNoSyntaxError();
    expect(rootNode().descendantsOfType("invalid_command").length).toBe(0);
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

    await expectNoSyntaxError();
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

    await expectNoSyntaxError();
    const strings = rootNode().descendantsOfType("string");
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

  it("highlights comma-separated strings and punctuated item names", async () => {
    await setUp(
      "+PROG TEMPLATE\n" +
        "LET#literal 'Literal0','Literal1'\n" +
        "END\n" +
        "+PROG AQUA\n" +
        "SMAT NO 111 P+ 1 P- -1\n" +
        "END\n",
    );

    await expectNoSyntaxError();
    expect(scopeFor("'Literal0'", 1)).toContain("string.single.sofistik");
    expect(scopeFor("'Literal1'", 1)).toContain("string.single.sofistik");
    expect(scopeFor("P+", 1)).toContain("entity.name.function.sofistik");
    expect(scopeFor("P-", 1)).toContain("entity.name.function.sofistik");
  });

  it("highlights record terminators but not semicolons inside strings or comments", async () => {
    await setUp("+PROG AQUA\nHEAD 'a;b'; HEAD next ! comment ; remains text\nEND\n");

    await expectNoSyntaxError();
    const source = editor.getText();
    const scopeAtIndex = (index) =>
      editor
        .scopeDescriptorForBufferPosition(editor.getBuffer().positionForCharacterIndex(index))
        .toString();
    const terminatorScope = scopeAtIndex(source.indexOf("';") + 1);
    const stringScope = scopeAtIndex(source.indexOf("a;b") + 1);
    const commentScope = scopeAtIndex(source.indexOf("; remains"));

    expect(terminatorScope).toContain("punctuation.terminator.record.sofistik");
    expect(stringScope).toContain("string.single.sofistik");
    expect(stringScope).not.toContain("punctuation.terminator.record.sofistik");
    expect(commentScope).toContain("comment.line.sofistik");
    expect(commentScope).not.toContain("punctuation.terminator.record.sofistik");
  });

  it("highlights continuation comments", async () => {
    await setUp("+PROG AQUA\nHEAD first $$ continued note\nEND\n");

    await expectNoSyntaxError();
    expect(scopeFor("$$ continued note", 1)).toContain("comment.line.sofistik");
  });

  it("highlights SYS inside and outside a flat preprocessor condition", async () => {
    await setUp(
      "#IF #copy_enabled\n+SYS wait copy 'inside.dat' 'inside-copy.dat'\n#ENDIF\n+SYS wait copy \"outside.dat\" \"outside-copy.dat\"\n",
    );

    await expectNoSyntaxError();
    expect(rootNode().descendantsOfType("sys_statement").length).toBe(2);
    expect(scopeFor("#IF", 1)).toContain("entity.name.section.sofistik");
    expect(scopeFor("#copy_enabled", 1)).toContain("variable.other.sofistik");
    expect(scopeFor("+SYS", 1)).toContain("support.class.sofistik");
    expect(scopeFor('SYS wait copy "outside.dat"', 1)).toContain("support.class.sofistik");
    expect(scopeFor("'inside.dat'", 1)).toContain("string.single.sofistik");
    expect(scopeFor('"outside.dat"', 1)).toContain("string.double.sofistik");
  });

  it("highlights an APPLY sigil and its interpolated string argument", async () => {
    await setUp('+APPLY "$(project)_csm.dat"\n');

    await expectNoSyntaxError();
    expect(rootNode().descendantsOfType("apply_statement").length).toBe(1);
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

    await expectNoSyntaxError();
    expect(scopeFor("$(asetxt1)", 2)).toContain("variable.other.sofistik");
    expect(scopeFor("$(asetxt2)", 2)).toContain("variable.other.sofistik");
    expect(scopeFor('"$(asetxt1)"', 0)).toContain("string.double.sofistik");
    expect(scopeFor("'$(asetxt2)'", 0)).toContain("string.single.sofistik");
    expect(scopeFor('"#plain"', 1)).toContain("string.double.sofistik");
    expect(scopeFor('"#plain"', 1)).not.toContain("variable.other.sofistik");
  });

  it("keeps closed quotes and following record arguments separate from incomplete substitutions", async () => {
    await setUp("");
    for (const quote of ["'", '"']) {
      const value = `${quote}cost $(missing${quote}`;
      editor.setText(`+PROG AQUA\nHEAD ${value} outside 7 (1); HEAD next\nEND\n`);
      await expectNoSyntaxError();
      const root = rootNode();
      expect(root.descendantsOfType("dollar_variable")).toEqual([]);
      expect(root.descendantsOfType("unterminated_string")).toEqual([]);
      expect(root.descendantsOfType("command_name").map((node) => node.text)).toEqual([
        "HEAD",
        "HEAD",
      ]);
      const record = root.descendantsOfType("command")[0].childForFieldName("record");
      expect(record.namedChildren.map((node) => node.type)).toEqual([
        "string",
        "bare_value",
        "number",
        "parenthesized_expression",
      ]);
      const string = record.namedChild(0);
      expect(string.text).toBe(value);
      expect(string.startPosition.column).toBe(5);
      expect(string.endPosition.column).toBe(5 + value.length);
      const scope = quote === "'" ? "string.single.sofistik" : "string.double.sofistik";
      expect(scopeFor(value, value.length - 1)).toContain(scope);
      expect(scopeFor("$(missing", 2)).toContain(scope);
      expect(scopeFor("$(missing", 2)).not.toContain("variable.other.sofistik");
      expect(scopeFor("outside", 1)).not.toContain("string.");
      expect(scopeFor("outside", 1)).not.toContain("variable.other.sofistik");
      expect(scopeFor("7")).toContain("constant.numeric.sofistik");
      expect(scopeFor(";")).toContain("punctuation.terminator.record.sofistik");
      expect(scopeFor(";")).not.toContain("string.");
    }
  });

  it("keeps doubled quote escapes and complete substitutions scoped within their string", async () => {
    await setUp("");
    for (const quote of ["'", '"']) {
      const substitution = `$(name${quote}${quote}tail)`;
      const value = `${quote}cost ${quote}${quote}quoted${quote}${quote} ${substitution}${quote}`;
      editor.setText(`+PROG AQUA\nHEAD ${value} outside\nEND\n`);
      await expectNoSyntaxError();
      expect(
        rootNode()
          .descendantsOfType("string")
          .map((node) => node.text),
      ).toEqual([value]);
      expect(
        rootNode()
          .descendantsOfType("dollar_variable")
          .map((node) => node.text),
      ).toEqual([substitution]);
      const scope = quote === "'" ? "string.single.sofistik" : "string.double.sofistik";
      expect(scopeFor(value, value.length - 1)).toContain(scope);
      expect(scopeFor("quoted", 1)).toContain(scope);
      expect(scopeFor(substitution, 2)).toContain("variable.other.sofistik");
      expect(scopeFor("outside", 1)).not.toContain("string.");
    }
  });

  it("updates quote recovery and following argument scopes after incremental delimiter edits", async () => {
    await setUp("");
    for (const quote of ["'", '"']) {
      editor.setText(`+PROG AQUA\nHEAD ${quote}cost $(NAME)${quote} outside 7 (1)\nEND\n`);
      await expectNoSyntaxError();
      const buffer = editor.getBuffer();
      const replace = async (index, length, text) => {
        buffer.setTextInRange(
          [
            buffer.positionForCharacterIndex(index),
            buffer.positionForCharacterIndex(index + length),
          ],
          text,
        );
        await expectNoSyntaxError();
      };
      await replace(editor.getText().indexOf(")"), 1, "");
      expect(rootNode().descendantsOfType("dollar_variable")).toEqual([]);
      expect(rootNode().descendantsOfType("unterminated_string")).toEqual([]);
      expect(scopeFor("$(NAME", 2)).not.toContain("variable.other.sofistik");
      expect(scopeFor("outside", 1)).not.toContain("string.");

      let end = editor.getText().indexOf(`${quote} outside`);
      await replace(end, 1, "");
      expect(rootNode().descendantsOfType("unterminated_string").length).toBe(1);
      expect(scopeFor("outside", 1)).toContain(
        quote === "'" ? "string.single.sofistik" : "string.double.sofistik",
      );
      await replace(end, 0, quote);
      expect(rootNode().descendantsOfType("unterminated_string")).toEqual([]);
      expect(scopeFor("outside", 1)).not.toContain("string.");

      end = editor.getText().indexOf(`${quote} outside`);
      await replace(end, 0, `${quote}${quote}`);
      end = editor.getText().indexOf(`${quote} outside`);
      await replace(end, 0, ")");
      expect(
        rootNode()
          .descendantsOfType("dollar_variable")
          .map((node) => node.text),
      ).toEqual([`$(NAME${quote}${quote})`]);
      expect(scopeFor("$(NAME", 2)).toContain("variable.other.sofistik");
      expect(scopeFor("outside", 1)).not.toContain("string.");
      expect(scopeFor("7")).toContain("constant.numeric.sofistik");
      expect(
        rootNode()
          .descendantsOfType("parenthesized_expression")
          .map((node) => node.text),
      ).toEqual(["(1)"]);
    }
  });

  it("highlights variables but not literals in a sequence generator", async () => {
    await setUp("+PROG CSM\nGRP (24001 24000+#idt 1) ICS1 11 PHIF 0\nEND\n");

    await expectNoSyntaxError();
    expect(rootNode().descendantsOfType("sequence_generator").length).toBe(1);
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

  it("highlights dotted DEFINE names without extending STO or LET variables", async () => {
    await setUp(
      "#define ella-dyn-t.1-1=1.291354058607521\n" +
        "#define ella-linf-t.1\n" +
        "+PROG TEMPLATE\n" +
        "STO#plain.name 1\n" +
        "LET#other.name 2\n" +
        "END\n",
    );

    const root = rootNode();
    expect(root.hasError).toBe(false);
    const defineNames = root.descendantsOfType("preprocessor_name");
    expect(defineNames.map((node) => node.text)).toEqual(["ella-dyn-t.1-1", "ella-linf-t.1"]);
    for (const name of defineNames) {
      expect(scopeForNode(name, name.text.indexOf(".") + 1)).toContain("string.other.sofistik");
    }

    const variables = root.descendantsOfType("hash_variable");
    expect(variables.map((node) => node.text)).toEqual(["#plain", "#other"]);
    for (const variable of variables) {
      expect(scopeForNode(variable, 1)).toContain("variable.other.sofistik");
    }
    for (const suffix of root
      .descendantsOfType("bare_value")
      .filter((node) => node.text === ".name")) {
      expect(scopeForNode(suffix, 1)).not.toContain("variable.other.sofistik");
    }
  });

  it("does not highlight unknown TEMPLATE records as commands", async () => {
    await setUp("+PROG TEMPLATE\nGRP2 1\nasdasdasdas 2\nTEST OPT1 1\nEND\n");

    const root = rootNode();
    expect(root.hasError).toBe(false);
    expect(root.descendantsOfType("invalid_command").map((node) => node.text)).toEqual([
      "GRP2",
      "asdasdasdas",
    ]);
    expect(root.descendantsOfType("command_name").map((node) => node.text)).toEqual(["TEST"]);
    expect(scopeFor("GRP2", 1)).not.toContain("keyword.control.sofistik");
    expect(scopeFor("asdasdasdas", 1)).not.toContain("keyword.control.sofistik");
    expect(scopeFor("TEST", 1)).toContain("keyword.control.sofistik");
  });

  it("highlights a dollar variable on the right side of a definition", async () => {
    await setUp("#DEFINE project = $(probase)\n");

    expect(scopeFor("project", 1)).toContain("string.other.sofistik");
    expect(scopeFor("$(probase)", 2)).toContain("variable.other.sofistik");
    expect(scopeFor(" = ", 1)).not.toContain("keyword.operator.sofistik");
  });

  it("highlights variables in DEFINE bodies before the first program", async () => {
    await setUp(
      "#define ella-lanes\n" +
        "lane t.1 $(lanes-props)\n" +
        "lane t.2 $(lanes-props)\n" +
        "lane t.3 $(lanes-props)\n" +
        "lane t.4 $(lanes-props)\n" +
        "#enddef\n",
    );

    const root = rootNode();
    expect(root.hasError).toBe(false);
    expect(root.descendantsOfType("unscoped_record").length).toBe(4);
    const variables = root.descendantsOfType("dollar_variable");
    expect(variables.map((node) => node.text)).toEqual(Array(4).fill("$(lanes-props)"));
    for (const variable of variables) {
      expect(scopeForNode(variable, 2)).toContain("variable.other.sofistik");
    }
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

    await expectNoSyntaxError();
    expect(scopeFor("no", 1)).toContain("string.other.sofistik");
    expect(scopeFor("119", 1)).not.toContain("constant.numeric.sofistik");
    expect(scopeFor("119", 1)).not.toContain("entity.name.function.sofistik");
    expect(scopeFor("! only vertical live", 1)).toContain("comment.line.sofistik");
  });

  it("keeps preprocessor conditionals flat and their bodies in module scope", async () => {
    await setUp(FLAT_PREPROCESSOR_FIXTURE);

    await expectNoSyntaxError();
    expect(
      rootNode()
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

    const root = rootNode();
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

    await expectNoSyntaxError();
    const statement = rootNode().descendantsOfType("variable_statement")[1];
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

    await expectNoSyntaxError();
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

    await expectNoSyntaxError();
    const commands = rootNode().descendantsOfType("command_name");
    expect(commands.map((node) => node.text.toUpperCase())).toEqual(["LC", "LC", "LC"]);
    for (const command of commands) {
      expect(editor.scopeDescriptorForBufferPosition(command.startPosition).toString()).toContain(
        "keyword.control.sofistik",
      );
    }
  });

  it("highlights named quoted and unterminated string variants", async () => {
    await setUp(MODERN_SYNTAX_FIXTURE);

    const root = rootNode();
    const expected = [
      ["single_doubled_quoted_string", "''single doubled''", "string.single.sofistik"],
      ["double_doubled_quoted_string", '""double doubled""', "string.double.sofistik"],
      ["single_quoted_string", "'single $(one)'", "string.single.sofistik"],
      ["double_quoted_string", '"double $(two)"', "string.double.sofistik"],
      ["unterminated_single_quoted_string", "'unterminated", "string.single.sofistik"],
      ["unterminated_double_quoted_string", '"unterminated', "string.double.sofistik"],
    ];

    for (const [type, text, expectedScope] of expected) {
      const node = root.descendantsOfType(type).find((candidate) => candidate.text === text);
      expect(node).toBeDefined();
      for (const offset of [0, 1, text.length - 1]) {
        const scope = scopeForNode(node, offset);
        expect(scope).toContain(expectedScope);
        expect(scope).not.toContain("invalid.illegal.sofistik");
      }
    }

    for (const variable of ["$(one)", "$(two)"]) {
      expect(scopeFor(variable, 2)).toContain("variable.other.sofistik");
    }
    for (const bareValue of ["BAUMANN'S", "f'=", "tent'"]) {
      expect(scopeFor(bareValue, 1)).not.toContain("string.");
    }
  });

  it("highlights CDB, references, numbers, and recursive hash names by node type", async () => {
    await setUp(MODERN_SYNTAX_FIXTURE);

    const root = rootNode();
    const cdbStatements = root.descendantsOfType("cdb_statement");
    expect(cdbStatements.map((statement) => statement.childForFieldName("keyword").text)).toEqual([
      "@KEY",
      "@CDB",
    ]);
    for (const statement of cdbStatements) {
      expect(scopeForNode(statement.childForFieldName("keyword"), 1)).toContain(
        "keyword.control.sofistik",
      );
    }

    const references = root.descendantsOfType("at_reference");
    expect(references.map((node) => node.text)).toEqual(["@name", "@1", "@-2", "@(#A+1)"]);
    for (const reference of references) {
      expect(scopeForNode(reference, 1)).toContain("variable.other.sofistik");
    }

    const invalidReference = root.descendantsOfType("invalid_at_reference")[0];
    expect(invalidReference.text).toBe("@???");
    expect(scopeForNode(invalidReference, 1)).not.toContain("invalid.illegal.sofistik");
    expect(scopeForNode(invalidReference, 1)).not.toContain("variable.other.sofistik");

    const numericValues = [
      ...root.descendantsOfType("number"),
      ...root.descendantsOfType("number_list"),
    ];
    expect(numericValues.map((node) => node.text)).toContain("1,2,3");
    for (const value of numericValues) {
      expect(scopeForNode(value)).toContain("constant.numeric.sofistik");
    }
    expect(root.descendantsOfType("punctuated_value").map((node) => node.text)).toEqual([
      ":AXIS",
      "~OR",
      "\\REF",
    ]);

    const outerVariable = root
      .descendantsOfType("hash_variable")
      .find((node) => node.text === "#BN(#BN(0))");
    expect(outerVariable).toBeDefined();
    expect(outerVariable.childForFieldName("arguments").type).toBe("hash_arguments");
    expect(
      outerVariable
        .childForFieldName("arguments")
        .descendantsOfType("hash_variable")
        .map((node) => node.text),
    ).toEqual(["#BN(0)"]);

    for (const name of root.descendantsOfType("hash_variable_name")) {
      expect(scopeForNode(name, 1)).toContain("variable.other.sofistik");
    }

    const formatted = root.descendantsOfType("formatted_value")[0];
    expect(formatted.text).toBe("#(#Nold,8.1)");
    expect(formatted.childForFieldName("value").type).toBe("parenthesized_expression");
    expect(scopeForNode(formatted)).not.toContain("variable.other.sofistik");

    const literalHash = root.descendantsOfType("literal_hash")[0];
    expect(literalHash.text).toBe("#");
    expect(scopeForNode(literalHash)).not.toContain("variable.other.sofistik");
    expect(scopeForNode(literalHash)).not.toContain("invalid.illegal.sofistik");
  });

  it("marks unknown TEMPLATE commands invalid while keeping tolerated syntax in named nodes", async () => {
    await setUp(MODERN_SYNTAX_FIXTURE);

    const root = rootNode();
    expect(root.hasError).toBe(false);
    expect(root.toString()).not.toContain("(ERROR");
    expect(root.toString()).not.toContain("(MISSING");
    expect(root.descendantsOfType("invalid_command").map((node) => node.text)).toEqual([
      "WHATEVER",
      "CUSTOM",
    ]);
    expect(root.descendantsOfType("variable_keyword").map((node) => node.text)).toEqual(["LET"]);
    expect(root.descendantsOfType("command_name").map((node) => node.text)).toContain("KOPF");

    const orphanTypes = [
      "orphan_elseif_record",
      "orphan_else_record",
      "orphan_endif_record",
      "orphan_endloop_record",
      "orphan_text_end",
      "orphan_picture_end",
    ];
    for (const type of orphanTypes) {
      const orphan = root.descendantsOfType(type)[0];
      expect(orphan).toBeDefined();
      expect(scopeForNode(orphan, 1)).not.toContain("invalid.illegal.sofistik");
    }

    for (const type of [
      "orphan_elseif_record",
      "orphan_else_record",
      "orphan_endif_record",
      "orphan_endloop_record",
    ]) {
      const keyword = root.descendantsOfType(type)[0].childForFieldName("keyword");
      expect(scopeForNode(keyword, 1)).toContain("keyword.control.sofistik");
    }
    for (const type of ["orphan_text_end", "orphan_picture_end"]) {
      const delimiter = root.descendantsOfType(type)[0].childForFieldName("delimiter");
      expect(scopeForNode(delimiter, 1)).toContain("support.function.sofistik");
    }

    expect(root.descendantsOfType("apply_statement").length).toBe(0);
  });

  it("keeps highlighting and folds scoped when END is missing", async () => {
    await setUp("+PROG AQUA\nHEAD first\n+PROG ASE\nHEAD second\nEND\n");

    const root = rootNode();
    const programs = root.descendantsOfType("program");
    expect(root.hasError).toBe(false);
    expect(root.toString()).not.toContain("(ERROR");
    expect(root.toString()).not.toContain("(MISSING");
    expect(programs.length).toBe(2);
    expect(programs[0].descendantsOfType("unterminated_input_block").length).toBe(1);

    for (const program of programs) {
      const module = program.descendantsOfType("module_name")[0];
      const command = program.descendantsOfType("command_name")[0];
      expect(scopeForNode(module, 1)).toContain("support.class.sofistik");
      expect(scopeForNode(command, 1)).toContain("keyword.control.sofistik");
    }

    expect(editor.isFoldableAtBufferRow(0)).toBe(true);
    expectFoldAt(0, [0, 1]);
  });

  it("keeps control highlighting after repeated END records", async () => {
    await setUp(
      "+PROG ASE\nHEAD example\nEND\nLOOP#i ASE_ITER ; STO#iter50(#i) #ASE_ITER(#i) ; ENDLOOP\nEND\nLC 5002\nEND\n",
    );

    const root = rootNode();
    const program = root.descendantsOfType("program")[0];
    expect(root.hasError).toBe(false);
    expect(root.descendantsOfType("program").length).toBe(1);
    expect(program.descendantsOfType("end_record").length).toBe(3);
    expect(program.descendantsOfType("loop_block").length).toBe(1);
    for (const text of ["LOOP#i", "ENDLOOP", "STO#iter50", "LC 5002"]) {
      expect(scopeFor(text, 1)).toContain("keyword.control.sofistik");
    }
    for (const variable of ["#i", "#iter50", "#ASE_ITER"]) {
      expect(scopeFor(variable, 1)).toContain("variable.other.sofistik");
    }
  });

  it("keeps command words inside legacy multiline text unscoped", async () => {
    await setUp(
      '+PROG SOFIMSHA\nTXBB Analysis\nMASS #A "$(B)" remains prose\nTXEN\nPAGE UNII 0\nEND\n',
    );

    const root = rootNode();
    expect(root.hasError).toBe(false);
    expect(root.descendantsOfType("command_name").map((node) => node.text)).toEqual([
      "TXBB",
      "TXEN",
      "PAGE",
    ]);
    expect(scopeFor("MASS", 1)).not.toContain("keyword.control.sofistik");
    expect(scopeFor("#A", 1)).toContain("variable.other.sofistik");
    expect(scopeFor("$(B)", 2)).toContain("variable.other.sofistik");
    expect(scopeFor('"$(B)"', 0)).toContain("string.double.sofistik");
  });

  it("parses, highlights, and folds PICT blocks in a program body and tail", async () => {
    await setUp(MODERN_SYNTAX_FIXTURE);

    const root = rootNode();
    const program = root.descendantsOfType("program")[0];
    const pictures = root.descendantsOfType("picture_block");
    expect(pictures.length).toBe(2);
    expect(pictures[0].parent.type).toBe("input_block");
    expect(
      program
        .childrenForFieldName("tail")
        .some(
          (node) => node.type === "picture_block" && node.startIndex === pictures[1].startIndex,
        ),
    ).toBe(true);
    expect(
      pictures.map((picture) => picture.descendantsOfType("command_name").map((node) => node.text)),
    ).toEqual([["KOPF"], ["HEAD"]]);

    for (const picture of pictures) {
      for (const delimiter of picture.descendantsOfType("picture_delimiter")) {
        const scope = scopeForNode(delimiter, 1);
        expect(scope).toContain("support.function.sofistik");
        expect(scope).not.toContain("invalid.illegal.sofistik");
      }
      expect(editor.isFoldableAtBufferRow(picture.startPosition.row)).toBe(true);
    }
  });

  it("exposes nested program and command symbols", async () => {
    await setUp("+PROG AQUA\nCONC 1 C 30\nEND\n");
    const groups = await editor.getGrammarQueryCaptureGroups("tagsQuery");
    const captures = groups.find(({ grammar }) => grammar === editor.getGrammar()).captures;

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

  it("preserves ordered symbol captures and definition ranges across syntax fixtures", async () => {
    for (const text of [REGRESSION_FIXTURE, FLAT_PREPROCESSOR_FIXTURE, MODERN_SYNTAX_FIXTURE]) {
      await setUp(text);
      const root = rootNode();
      const expected = [];
      for (const program of root.descendantsOfType("program")) {
        const module = program.childForFieldName("header")?.childForFieldName("module");
        if (module?.type !== "module_name") continue;
        expected.push({ name: "definition.module", node: program }, { name: "name", node: module });
      }
      for (const command of root.descendantsOfType("command")) {
        const name = command.childForFieldName("name");
        if (name?.type !== "command_name") continue;
        expected.push({ name: "definition.method", node: command }, { name: "name", node: name });
      }
      expected.sort(
        (first, second) =>
          first.node.startIndex - second.node.startIndex ||
          second.node.endIndex - first.node.endIndex,
      );
      const groups = await editor.getGrammarQueryCaptureGroups("tagsQuery");
      const captures = groups.find(({ grammar }) => grammar === editor.getGrammar()).captures;
      const describe = ({ name, node }) => [name, node.type, node.startIndex, node.endIndex];
      expect(captures.map(describe)).toEqual(expected.map(describe));
    }
  });

  it("retains all command symbols and the complete program range after editing a large tail", async () => {
    const commandCount = 2048;
    const text = "+PROG AQUA\n" + "CONC NO 1\n".repeat(commandCount) + "END\n";
    await setUp(text);
    const buffer = editor.getBuffer();
    buffer.append("x");
    await expectNoSyntaxError();

    const groups = await editor.getGrammarQueryCaptureGroups("tagsQuery");
    const captures = groups.find(({ grammar }) => grammar === editor.getGrammar()).captures;
    const programs = captures.filter((capture) => capture.name === "definition.module");
    const commands = captures.filter((capture) => capture.name === "definition.method");
    expect(programs.length).toBe(1);
    expect(programs[0].node.text).toBe(text + "x");
    expect(commands.length).toBe(commandCount);
    expect(commands[0].node.startPosition.row).toBe(1);
    expect(commands.at(-1).node.startPosition.row).toBe(commandCount);
    expect(captures.filter((capture) => capture.name === "name").length).toBe(commandCount + 1);

    buffer.delete([
      [commandCount + 2, 0],
      [commandCount + 2, 1],
    ]);
    await expectNoSyntaxError();
    const restored = await editor.getGrammarQueryCaptureGroups("tagsQuery");
    const restoredCaptures = restored.find(
      ({ grammar }) => grammar === editor.getGrammar(),
    ).captures;
    expect(restoredCaptures.find((capture) => capture.name === "definition.module").node.text).toBe(
      text,
    );
    expect(restoredCaptures.filter((capture) => capture.name === "definition.method").length).toBe(
      commandCount,
    );
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
