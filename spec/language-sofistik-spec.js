describe("language-sofistik", () => {
  let mainModule;

  beforeEach(async () => {
    const { mainModule: main } = await lumine.packages.activatePackage("language-sofistik");
    mainModule = main;
  });

  describe("grammars", () => {
    it("loads the SOFiSTiK grammar", () => {
      const grammar = lumine.grammars.grammarForScopeName("source.sofistik");
      expect(grammar).toBeTruthy();
      expect(grammar.name).toBe("SOFiSTiK");
    });

    it("loads the SOFiSTiK DEF grammar", () => {
      const grammar = lumine.grammars.grammarForScopeName("source.sofistik-def");
      expect(grammar).toBeTruthy();
      expect(grammar.name).toBe("SOFiSTiK DEF");
    });

    it("selects the SOFiSTiK grammar for .dat files", () => {
      const grammar = lumine.grammars.selectGrammar("model.dat", "");
      expect(grammar.scopeName).toBe("source.sofistik");
    });

    it("selects the RAW grammar for output files", () => {
      const grammar = lumine.grammars.selectGrammar("report.lst", "");
      expect(grammar.scopeName).toBe("source.sofistik");
    });

    it("keeps the TextMate grammar as a fallback", () => {
      lumine.config.set("editor.useTreeSitterParsers", false);
      try {
        const grammar = lumine.grammars.grammarForScopeName("source.sofistik");
        expect(grammar.constructor.name).not.toBe("TreeSitterGrammar");
        const { tokens } = grammar.tokenizeLine("+PROG AQUA");
        expect(tokens.length).toBeGreaterThan(0);
        const scopes = tokens.flatMap((token) => token.scopes);
        expect(scopes.some((scope) => scope.includes("sofistik"))).toBe(true);
      } finally {
        lumine.config.set("editor.useTreeSitterParsers", true);
      }
    });

    it("highlights only variables on the right side of a TextMate definition", () => {
      lumine.config.set("editor.useTreeSitterParsers", false);
      try {
        const grammar = lumine.grammars.grammarForScopeName("source.sofistik");
        const line = "#DEFINE macro = poin qgrp 'PP' type pg p #Q_w x #x y #y ! note";
        const { tokens } = grammar.tokenizeLine(line);
        const scopesFor = (needle) => {
          const offset = line.indexOf(needle);
          let tokenStart = 0;
          for (const token of tokens) {
            const tokenEnd = tokenStart + token.value.length;
            if (offset >= tokenStart && offset < tokenEnd) return token.scopes;
            tokenStart = tokenEnd;
          }
          throw new Error(`No token contains ${needle}`);
        };

        expect(scopesFor("macro")).toContain("string.other.sofistik");
        for (const value of ["#Q_w", "#x", "#y"]) {
          expect(scopesFor(value)).toContain("variable.other.sofistik");
        }
        for (const value of ["poin", "'PP'", "type", "pg"]) {
          const scopes = scopesFor(value);
          expect(scopes).not.toContain("string.other.sofistik");
          expect(scopes).not.toContain("string.single.sofistik");
          expect(scopes).not.toContain("variable.other.sofistik");
          expect(scopes).not.toContain("entity.name.function.sofistik");
          expect(scopes).not.toContain("constant.numeric.sofistik");
          expect(scopes).not.toContain("constant.other.sofistik");
        }
        expect(scopesFor("! note")).toContain("comment.line.sofistik");
      } finally {
        lumine.config.set("editor.useTreeSitterParsers", true);
      }
    });

    it("highlights a dollar variable in a TextMate definition value", () => {
      lumine.config.set("editor.useTreeSitterParsers", false);
      try {
        const grammar = lumine.grammars.grammarForScopeName("source.sofistik");
        const line = "#DEFINE project = $(probase)";
        const { tokens } = grammar.tokenizeLine(line);
        const scopesFor = (needle) => {
          const offset = line.indexOf(needle);
          let tokenStart = 0;
          for (const token of tokens) {
            const tokenEnd = tokenStart + token.value.length;
            if (offset >= tokenStart && offset < tokenEnd) return token.scopes;
            tokenStart = tokenEnd;
          }
          throw new Error(`No token contains ${needle}`);
        };

        expect(scopesFor("project")).toContain("string.other.sofistik");
        expect(scopesFor("$(probase)")).toContain("variable.other.sofistik");
        expect(scopesFor(" = ")).not.toContain("keyword.operator.sofistik");
      } finally {
        lumine.config.set("editor.useTreeSitterParsers", true);
      }
    });

    it("highlights TextMate preprocessor include arguments and interpolation", () => {
      lumine.config.set("editor.useTreeSitterParsers", false);
      try {
        const grammar = lumine.grammars.grammarForScopeName("source.sofistik");
        for (const line of ["#INCLUDE maxima-supp", '#INCLUDE "$(project).dat"']) {
          const { tokens } = grammar.tokenizeLine(line);
          const argument = line.slice(line.indexOf(" ") + 1);
          const scopesFor = (needle) => {
            const offset = line.indexOf(needle);
            let tokenStart = 0;
            for (const token of tokens) {
              const tokenEnd = tokenStart + token.value.length;
              if (offset >= tokenStart && offset < tokenEnd) return token.scopes;
              tokenStart = tokenEnd;
            }
            throw new Error(`No token contains ${needle}`);
          };

          expect(scopesFor(argument)).toContain("string.other.sofistik");
          if (line.includes("$(project)")) {
            expect(scopesFor("$(project)")).toContain("variable.other.sofistik");
          }
        }
      } finally {
        lumine.config.set("editor.useTreeSitterParsers", true);
      }
    });

    it("preserves a trailing TextMate comment in a flat definition value", () => {
      lumine.config.set("editor.useTreeSitterParsers", false);
      try {
        const grammar = lumine.grammars.grammarForScopeName("source.sofistik");
        const line = "#DEFINE no = 119 ! only vertical live";
        const { tokens } = grammar.tokenizeLine(line);
        const scopesFor = (needle) => {
          const offset = line.indexOf(needle);
          let tokenStart = 0;
          for (const token of tokens) {
            const tokenEnd = tokenStart + token.value.length;
            if (offset >= tokenStart && offset < tokenEnd) return token.scopes;
            tokenStart = tokenEnd;
          }
          throw new Error(`No token contains ${needle}`);
        };

        expect(scopesFor("no")).toContain("string.other.sofistik");
        expect(scopesFor("119")).not.toContain("constant.numeric.sofistik");
        expect(scopesFor("! only vertical live")).toContain("comment.line.sofistik");
      } finally {
        lumine.config.set("editor.useTreeSitterParsers", true);
      }
    });

    it("highlights only variables in TextMate preprocessor conditions", () => {
      lumine.config.set("editor.useTreeSitterParsers", false);
      try {
        const grammar = lumine.grammars.grammarForScopeName("source.sofistik");
        for (const line of ["#IF #condition + 1", "#ELSEIF $(alternate) <> 2"]) {
          const { tokens } = grammar.tokenizeLine(line);
          expect(tokens.flatMap((token) => token.scopes)).toContain("entity.name.section.sofistik");
          const conditionScopes = tokens
            .filter(
              (token) => token.value.includes("condition") || token.value.includes("alternate"),
            )
            .flatMap((token) => token.scopes);

          expect(conditionScopes.length).toBeGreaterThan(0);
          expect(conditionScopes).toContain("variable.other.sofistik");
          expect(conditionScopes).not.toContain("entity.name.function.sofistik");
          expect(conditionScopes).not.toContain("string.other.sofistik");

          const neutralScopes = tokens
            .filter((token) => /(?:\+|<>|\b[12]\b)/.test(token.value))
            .flatMap((token) => token.scopes);
          expect(neutralScopes).not.toContain("keyword.operator.sofistik");
          expect(neutralScopes).not.toContain("constant.numeric.sofistik");
          expect(neutralScopes).not.toContain("entity.name.function.sofistik");
        }
      } finally {
        lumine.config.set("editor.useTreeSitterParsers", true);
      }
    });

    it("treats a TextMate program option as a header comment", () => {
      lumine.config.set("editor.useTreeSitterParsers", false);
      try {
        const grammar = lumine.grammars.grammarForScopeName("source.sofistik");
        const line = "+PROG TENDON URS:9";
        const { tokens } = grammar.tokenizeLine(line);
        const scopesFor = (needle) => {
          const offset = line.indexOf(needle);
          let tokenStart = 0;
          for (const token of tokens) {
            const tokenEnd = tokenStart + token.value.length;
            if (offset >= tokenStart && offset < tokenEnd) return token.scopes;
            tokenStart = tokenEnd;
          }
          throw new Error(`No token contains ${needle}`);
        };

        expect(scopesFor("+PROG")).toContain("support.class.tendon.sofistik");
        expect(scopesFor("TENDON")).toContain("support.class.tendon.sofistik");
        expect(scopesFor("URS:9")).toContain("comment.line.tendon.sofistik");
      } finally {
        lumine.config.set("editor.useTreeSitterParsers", true);
      }
    });

    it("highlights localized PAGE commands and items in every TextMate module", () => {
      lumine.config.set("editor.useTreeSitterParsers", false);
      try {
        const grammar = lumine.grammars.grammarForScopeName("source.sofistik");
        for (const [moduleName, command, item] of [
          ["ASE", "PAGE", "UNII"],
          ["AQB", "SEIT", "UNIE"],
        ]) {
          const header = grammar.tokenizeLine(`+PROG ${moduleName}`);
          const definition = grammar.tokenizeLine("#DEFINE PAGE_CTRL", header.ruleStack);
          const line = `${command} ${item} 0`;
          const { tokens } = grammar.tokenizeLine(line, definition.ruleStack);
          const scopesFor = (needle) => {
            const offset = line.indexOf(needle);
            let tokenStart = 0;
            for (const token of tokens) {
              const tokenEnd = tokenStart + token.value.length;
              if (offset >= tokenStart && offset < tokenEnd) return token.scopes;
              tokenStart = tokenEnd;
            }
            throw new Error(`No token contains ${needle}`);
          };

          expect(scopesFor(command)).toContain("keyword.control.sofistik");
          expect(scopesFor(item)).toContain("entity.name.function.sofistik");
        }
      } finally {
        lumine.config.set("editor.useTreeSitterParsers", true);
      }
    });
  });

  // The per-grammar settings live in the `grammar` namespace; under the
  // legacy `editor` one nothing reads them.
  describe("scoped settings", () => {
    it("comments a line with a dollar sign", async () => {
      const editor = await lumine.workspace.open("model.dat");
      expect(editor.getGrammar().scopeName).toBe("source.sofistik");

      editor.setText("+PROG AQUA");
      editor.toggleLineCommentsForBufferRows(0, 0);
      expect(editor.lineTextForBufferRow(0)).toBe("$ +PROG AQUA");
    });

    it("keeps the indentation of pasted text", () => {
      expect(lumine.config.get("editor.autoIndentOnPaste", { scope: [".source.sofistik"] })).toBe(
        false,
      );
    });
  });

  describe("keywords service", () => {
    it("provides the sofistik.keywords service", () => {
      const service = mainModule.provideSofistikKeywords();
      expect(service.name).toBe("sofistik-keywords");
      expect(service.version).toBe("1.0.0");
      expect(service.provider).toBeTruthy();
    });

    it("lists available versions", () => {
      const { provider } = mainModule.provideSofistikKeywords();
      const versions = provider.getAvailableVersions();
      expect(versions).toContain("2026");
      expect(versions).toContain("2018");
    });

    it("loads keywords for a specific version and language", () => {
      const { provider } = mainModule.provideSofistikKeywords();
      const keywords = provider.loadKeywords("2026", "en");
      expect(keywords).toBeTruthy();
      expect(Object.keys(keywords).length).toBeGreaterThan(0);
    });

    it("binds a provider to a release and language", () => {
      const { provider } = mainModule.provideSofistikKeywords();
      const ctx = provider.forRelease("2026", "en");
      expect(ctx.getVersion()).toBe("2026");
      expect(ctx.getLanguage()).toBe("en");
      expect(ctx.getModuleNames().length).toBeGreaterThan(0);
    });

    it("provides ordered command schemas without an implicit BASIC fallback", () => {
      const { provider } = mainModule.provideSofistikKeywords();
      const ctx = provider.forRelease("2026", "en");
      const schema = ctx.getCommandSchema("aqua", "conc");

      expect(schema.slots.length).toBeGreaterThan(0);
      expect(schema.slots.map((slot) => slot.position)).toEqual(
        schema.slots.map((_slot, index) => index + 1),
      );
      expect(schema.slots.some((slot) => slot.kind === "placeholder" && slot.name === null)).toBe(
        true,
      );
      expect(schema.slots.some((slot) => slot.dataTypeCode === "1092")).toBe(true);

      const aquaCommands = new Set(ctx.getModuleCommands("AQUA"));
      const basicOnly = ctx
        .getModuleCommands("BASIC")
        .find((command) => !aquaCommands.has(command));
      expect(basicOnly).toBeTruthy();
      expect(ctx.getCommandSchema("AQUA", basicOnly)).toBeNull();
      expect(ctx.getCommandSchema("BASIC", basicOnly)).toBeTruthy();
    });

    it("exposes localized PAGE schemas through the exact BASIC module", () => {
      const { provider } = mainModule.provideSofistikKeywords();
      const english = provider.forRelease("2026", "en");
      const german = provider.forRelease("2026", "de");

      expect(english.getCommandSchema("BASIC", "PAGE").slots.length).toBeGreaterThan(0);
      expect(english.getCommandParams("BASIC", "PAGE")).toContain("UNII");
      expect(german.getCommandSchema("BASIC", "SEIT").slots.length).toBeGreaterThan(0);
      expect(german.getCommandParams("BASIC", "SEIT")).toContain("UNIE");
      expect(english.getCommandSchema("ASE", "PAGE")).toBeNull();
      expect(german.getCommandSchema("AQB", "SEIT")).toBeNull();
    });

    it("resolves enum redirects while preserving their provenance", () => {
      const { provider } = mainModule.provideSofistikKeywords();
      const schema = provider.forRelease("2026", "en").getCommandSchema("AQB", "COMB");
      const redirected = schema.slots.find((slot) => slot.enumRedirect?.command === "XLIT");

      expect(redirected.enumRedirect.item).toBe("FACT");
      expect(redirected.enumValues.length).toBeGreaterThan(0);
    });
  });

  describe("Tree-sitter injections", () => {
    it("injects TODO annotations into comments", () => {
      const calls = [];
      mainModule.consumeTodoInjection({
        addInjectionPoint(scope, options) {
          calls.push({ scope, options });
        },
      });
      expect(calls).toEqual([
        {
          scope: "source.sofistik",
          options: { types: ["comment"] },
        },
      ]);
    });
  });

  describe("the release a consumer asks for", () => {
    let provider;

    beforeEach(() => {
      provider = mainModule.provideSofistikKeywords().provider;
    });

    it("returns the keywords of that release", () => {
      const asked = provider.forRelease("2022", "en");
      expect(asked.getVersion()).toBe("2022");
      expect(asked.getModuleNames().length).toBeGreaterThan(0);
    });

    it("accepts a language as a code or as the word the setting uses", () => {
      expect(provider.forRelease("2026", "de").getLanguage()).toBe("de");
      expect(provider.forRelease("2026", "German").getLanguage()).toBe("de");
      expect(provider.forRelease("2026", "English").getLanguage()).toBe("en");
    });

    it("defaults each argument on its own", () => {
      const newest = provider.getAvailableVersions().at(-1);
      expect(provider.forRelease().getVersion()).toBe(newest);
      expect(provider.forRelease().getLanguage()).toBe("en");
      // "Auto" is what the setting and the picker write for "not chosen".
      expect(provider.forRelease("Auto", null).getVersion()).toBe(newest);
      expect(provider.forRelease("", "").getVersion()).toBe(newest);
      // A release named without a language still gets the default language.
      expect(provider.forRelease("2020").getLanguage()).toBe("en");
    });

    it("resolves nothing itself — no detection, no settings", () => {
      // Which release a file is for belongs to sofistik.environment; this
      // package answering it too is how two packages come to disagree.
      expect(provider.detect).toBeUndefined();
      expect(provider.withContext).toBeUndefined();
      expect(require("../package.json").configSchema).toBeUndefined();
    });
  });
});
