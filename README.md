# language-sofistik

Syntax highlighting for SOFiSTiK structural analysis software. Provides grammars for input and output files with multi-version keyword support and a programmatic keywords service.

## Features

- **Grammars**: provides TextMate grammars.
- **Syntax highlighting**: complete support for `.dat`, `.gra`, `.grb` and `.results` input files.
- **RAW file support**: grammar for output files `.erg`, `.lst`, `.prt` and `.urs`.
- **DEF file support**: grammar for `sofistik.def` variable files.
- **Multi-version**: keywords for SOFiSTiK versions 2018-2026.
- **Multi-language**: English and German keyword sets.
- **Keywords service**: programmatic access to keywords for other packages.
- **Snippets**: `prog` snippet scaffolds a PROG block with HEAD and END.

## Installation

To install `language-sofistik` search for _language-sofistik_ in the Install pane of the Lumine settings or run `lumine --install lumine-code/language-sofistik`.

## Usage

The package detects the SOFiSTiK version from:

1. **File shebang** (first line): `@ SOFiSTiK 2026` or `@ SOFiSTiK 2026 EN`
2. **sofistik.def file** in the same directory: `SOF_VERSION = 2026`
3. **Config setting**: if a specific version is selected
4. **Auto fallback**: latest version

Keywords and enum values are extracted from SOFiSTiK module `.err` files.

## Services

- **sofistik.keywords** (`1.0.0`): provided to expose SOFiSTiK keyword data — modules, commands, parameters and enum values — resolved per version and language. Consumers call `service.provider.withContext(editor)` to get a context-bound provider with methods such as `getKeywords()`, `getModuleNames()`, `getModuleCommands()`, `searchKeyword()` and `validateKeyword()`.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
