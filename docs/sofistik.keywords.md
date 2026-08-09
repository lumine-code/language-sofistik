# sofistik.keywords

Exposes the SOFiSTiK keyword database — modules, commands, parameters, and enum values — resolved for the version and language of a given file.

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
  withContext(editor: TextEditor, filePath?: string): ContextProvider;
};
```

`withContext` is the entry point — **everything else hangs off the context-bound provider it returns**, because the answers depend on the version and language detected for that file.

| Member on the context provider          | Description                                |
| --------------------------------------- | ------------------------------------------ |
| `getVersion()`, `getLanguage()`         | What was detected for this file.           |
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
    const context = this.keywords?.withContext(editor, editor.getPath());
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

**Call `withContext` per request, not once at activation.** Version and language are detected from the file's content and the user's settings, both of which change — a context bound at activation goes stale, and gives the wrong keywords for the next file the user opens.

`withContext` accepts the editor and optionally its path. Pass the path when you have it: detection uses both, and a buffer with no path detects from content alone.

Module and command names are the coordinates for everything else. Resolve them from `getModuleNames` and `getModuleCommands` rather than hardcoding, since the set varies by detected version.

`validateKeyword` is the linting entry point and answers in this file's context — a keyword valid in one version may not be in another, which is the whole reason the context exists.

## Teardown

Return a `Disposable` that drops your reference. Context providers are lightweight values; they need no disposal.

## Versioning

`1.0.0` provided, `^1.0.0` consumed. A change that breaks this shape gets a new service name rather than a new major version, and both sides move in the same release.
