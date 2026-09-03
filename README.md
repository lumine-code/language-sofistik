# language-sofistik

Syntax highlighting for SOFiSTiK structural analysis software.

Provides a Tree-sitter input grammar for SOFiSTiK CADINP files. The central `language-log` package supplies the output grammar.

> **NOTE**: This package is not an official SOFiSTiK product and is not affiliated with or endorsed by SOFiSTiK AG.

## Features

- **Grammars**: provides the Tree-sitter grammar for SOFiSTiK input files.
- **Syntax highlighting**: complete support for `.dat`, `.gra`, `.grb` and `.results` input files.
- **Structure**: provides folding and outline symbols for programs, commands and control blocks.
- **Output file support**: the central `language-log` package provides the grammar for `.erg`, `.lst`, `.prt` and `.urs` files.
- **Language coverage**: recognizes English and German CADINP vocabulary from supported SOFiSTiK releases.
- **Snippets**: `prog` snippet scaffolds a PROG block with HEAD and END.

## Installation

To install `language-sofistik` search for it in the Install pane of the Lumine settings, or run the command `lumine --install lumine-code/language-sofistik`.

## Services

- `todo.injection`: consumed to highlight TODO-style annotations in comments.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
