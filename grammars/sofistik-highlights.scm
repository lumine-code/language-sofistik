; PROGRAMS AND RECORDS
; ====================

(program_sigil) @support.class.sofistik
(commented_program_sigil) @support.class.sofistik
[(sys_sigil)
 (apply_sigil)] @support.class.sofistik
(module_name) @support.class.sofistik
(program_option) @comment.line.sofistik
(command_name) @keyword.control.sofistik
(dynamic_command_name) @keyword.control.sofistik
(item_name) @entity.name.function.sofistik

; CADINP CONTROL AND PREPROCESSING
; ================================

(control_keyword) @keyword.control.sofistik
(variable_keyword) @keyword.control.sofistik
(preprocessor_keyword) @entity.name.section.sofistik
(preprocessor_name) @string.other.sofistik

; VALUES
; ======

(number) @constant.numeric.sofistik
(number_list) @constant.numeric.sofistik
(unit) @constant.other.sofistik

((string) @string.double.sofistik
  (#match? @string.double.sofistik "^\""))

((string) @string.single.sofistik
  (#match? @string.single.sofistik "^'"))

(preprocessor_directive
  argument: (_) @string.other.sofistik)

(dollar_variable) @variable.other.sofistik
(hash_variable) @variable.other.sofistik

; TEXT AND METADATA
; =================

[(text_delimiter) (text_end)] @support.function.sofistik
(text_content) @string.unquoted.sofistik
(text_fragment) @string.unquoted.sofistik
(metadata) @meta.sofistik

((metadata) @meta.version.sofistik
  (#match? @meta.version.sofistik "^@\\s*[Ss][Oo][Ff][Ii][Ss][Tt][Ii][Kk]\\s+[0-9]{4}"))

; COMMENTS
; ========

(comment) @comment.line.sofistik
