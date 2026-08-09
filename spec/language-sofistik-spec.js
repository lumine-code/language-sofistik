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

    it("tokenizes a PROG line", () => {
      const grammar = lumine.grammars.grammarForScopeName("source.sofistik");
      const { tokens } = grammar.tokenizeLine("+PROG AQUA");
      expect(tokens.length).toBeGreaterThan(0);
      const scopes = tokens.flatMap((token) => token.scopes);
      expect(scopes.some((scope) => scope.includes("sofistik"))).toBe(true);
    });
  });

  // The per-grammar settings live in the `language` namespace; under the
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
      expect(lumine.config.get("language.autoIndentOnPaste", { scope: [".source.sofistik"] })).toBe(
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

    it("creates a context with resolved version and language", () => {
      const { provider } = mainModule.provideSofistikKeywords();
      const ctx = provider.withContext();
      expect(ctx.getVersion()).toBeTruthy();
      expect(ctx.getLanguage()).toBeTruthy();
      expect(ctx.getModuleNames().length).toBeGreaterThan(0);
    });
  });
});
