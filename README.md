# language-sofistik

Syntax highlighting for SOFiSTiK structural analysis software.

Provides a Tree-sitter input grammar for SOFiSTiK CADINP files. The central `language-log` package supplies the output grammar.

> **NOTE**: This package is not an official SOFiSTiK product and is not affiliated with or endorsed by SOFiSTiK AG.

## Features

- **Grammars**: provides Tree-sitter grammars for SOFiSTiK input files.
- **Syntax highlighting**: supports `.dat`, `.gra`, `.grb`, `.results` and `.include` input files.
- **Include context**: selects the SOFiPLUS module vocabulary from the include filename without requiring a PROG header.
- **Structure**: provides folding and outline symbols for programs, commands and control blocks.
- **Output file support**: the central `language-log` package provides the grammar for `.erg`, `.lst`, `.prt` and `.urs` files.
- **Language coverage**: recognizes English and German CADINP vocabulary from supported SOFiSTiK releases.
- **Snippets**: `prog` snippet scaffolds a PROG block with HEAD and END.

## Installation

To install `language-sofistik` search for it in the Install pane of the Lumine settings, or run the command `lumine --install lumine-code/language-sofistik`.

## Include files

The [SOFiPLUS include filenames](https://docs.sofistik.com/2025/en/sofiplus/working_with_include_files/working_with_include_files.html) select the initial module for command and parameter highlighting:

| Filename                     | Module    |
| ---------------------------- | --------- |
| `aqa.include`                | AQUA      |
| `msh.include`                | SOFiMSHC  |
| `lfd.include`                | SOFiLOAD  |
| `dsn.include`                | DECREATOR |
| `spt.include`, `tnd.include` | TENDON    |

Names are matched without regard to case. The file remains a fragment: no PROG header or END record is added. An explicit `+PROG` or `$PROG` header selects its own module. Other `.include` files use the ordinary CADINP grammar and can declare their context with `$PROG`. SOFiPLUS expects include input in English.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
