(comment) @comment.line.sofistik
((comment) @punctuation.definition.comment.sofistik
  (#set! adjust.endAfterFirstMatchOf "^#"))

(section_header
  name: (section_name) @entity.name.section.sofistik)

(section_header
  "[" @punctuation.definition.section.begin.bracket.square.sofistik
  "]" @punctuation.definition.section.end.bracket.square.sofistik)

(assignment
  key: (key) @variable.other.key.sofistik
  "=" @punctuation.separator.key-value.sofistik)

; DEF values are opaque text, including paths, spaces and command punctuation.
(value) @string.unquoted.sofistik
