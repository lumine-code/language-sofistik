# sofistik.keywords

Exposes the SOFiSTiK keyword database — modules, commands, parameters, and enum values — for a given release and language.

|             |                                                                         |
| ----------- | ----------------------------------------------------------------------- |
| Version     | `1.0.0`                                                                 |
| Provided by | `provideSofistikKeywords()` returning the service wrapper               |
| Consumed by | `consumeSofistikKeywords(service)`                                      |
| Owner       | [`language-sofistik`](https://github.com/lumine-code/language-sofistik) |

Consumed by the SOFiSTiK completion, linting, and tooling packages so all three answer from one keyword database rather than shipping three copies.

## Registration

In your `package.json`:

```json
{
  "consumedServices": {
    "sofistik.keywords": {
      "versions": { "^1.0.0": "consumeSofistikKeywords" }
    }
  }
}
```

## Contract

```ts
type SofistikKeywords = {
  name: "sofistik-keywords";
  version: string;
  provider: KeywordsProvider;
};

type KeywordsProvider = {
  forRelease(version?: string, language?: string): ReleaseKeywords;
  getAvailableVersions(): string[];
};
```

`forRelease` is the entry point — **everything else hangs off the release-bound provider it returns**, because every answer depends on which release is being asked about.

| Member on the release provider          | Description                                |
| --------------------------------------- | ------------------------------------------ |
| `getVersion()`, `getLanguage()`         | What this provider is bound to.            |
| `getKeywords()`                         | Every keyword available in this context.   |
| `getModuleNames()`                      | The module names.                          |
| `getModuleKeywords(module)`             | Keywords belonging to one module.          |
| `getModuleCommands(module)`             | The commands a module offers.              |
| `getCommandKeywords(module, command)`   | Keywords under one command.                |
| `getCommandParams(module, command)`     | That command's parameters.                 |
| `getParamEnums(module, command, param)` | The allowed values of a parameter.         |
| `searchKeyword(keyword)`                | Looks a keyword up across the context.     |
| `validateKeyword(word)`                 | Whether a word is valid here, for linting. |
| `getStatistics()`                       | Counts, for diagnostics.                   |

## Minimal example

```js
const { Disposable } = require("lumine");

module.exports = {
  consumeSofistikKeywords(service) {
    this.keywords = service.provider;
    return new Disposable(() => (this.keywords = null));
  },

  getSuggestions({ editor, prefix }) {
    const { version, language } = this.environment.resolve({ editor });
    const context = this.keywords?.forRelease(version, language);
    if (!context) return [];
    return context
      .getKeywords()
      .filter((keyword) => keyword.startsWith(prefix))
      .map((text) => ({ text, type: "keyword" }));
  },
};
```

## Behavior

**The service is a wrapper, not the provider.** Reach through `service.provider`; the `name` and `version` fields beside it identify the database, not the service contract.

**This service resolves nothing.** Which release a file is for — and in which language — is [`sofistik.environment`](https://github.com/lumine-code/sofistik-environment)'s question: it owns the settings, the installed releases and the order the evidence is consulted. Ask there, then ask here. That indirection is the point: two packages that each guessed would eventually guess differently about the same file.

```js
const { version, language } = this.environment.resolve({ editor });
const keywords = this.keywords.forRelease(version, language);
```

**Call `forRelease` per request, not once at activation.** The release changes with the file the user is looking at, so a provider bound at activation gives the wrong keywords for the next file they open.

Both arguments are optional and independently defaulted: an unknown release falls back to the newest keyword data ships for, and an unknown language to English. `"Auto"` counts as unknown, since that is what the setting and the version picker write when the user has not chosen.

Module and command names are the coordinates for everything else. Resolve them from `getModuleNames` and `getModuleCommands` rather than hardcoding, since the set varies by release.

`validateKeyword` is the linting entry point and answers for the bound release — a keyword valid in one is not necessarily valid in another, which is the whole reason the binding exists.

## Teardown

Return a `Disposable` that drops your reference. Context providers are lightweight values; they need no disposal.

## Versioning

`1.0.0` provided, `^1.0.0` consumed. A change that breaks this shape gets a new service name rather than a new major version, and both sides move in the same release.
