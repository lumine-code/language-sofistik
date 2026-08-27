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
