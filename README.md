# language-sofistik

Syntax highlighting for SOFiSTiK structural analysis software.

Provides grammars for input and output files with multi-version keyword support and a programmatic keywords service.

> **NOTE**: This package is not an official SOFiSTiK product and is not affiliated with or endorsed by SOFiSTiK AG.

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

To install `language-sofistik` search for it in the Install pane of the Lumine settings, or run the command `lumine --install lumine-code/language-sofistik`.

## Services

- [`sofistik.keywords`](docs/sofistik.keywords.md): provided to expose SOFiSTiK keyword data — modules, commands, parameters and enum values — for a given release and language.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
