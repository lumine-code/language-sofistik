; PROGRAMS AND RECORDS
; ====================

(program_sigil) @support.class.sofistik
(module_name) @support.class.sofistik
(command_name) @keyword.control.sofistik
(item_name) @entity.name.function.sofistik
(enum_value) @constant.other.sofistik

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
(dollar_variable) @variable.other.sofistik
(hash_variable) @variable.other.sofistik
(unit) @constant.other.sofistik
[(expression) (generic_expression)] @entity.name.function.sofistik

((string) @string.double.sofistik
  (#match? @string.double.sofistik "^\""))

((string) @string.single.sofistik
  (#match? @string.single.sofistik "^'"))

; TEXT AND METADATA
; =================

[(text_start) (text_end)] @support.function.sofistik
(text_content) @string.unquoted.sofistik
(metadata) @meta.sofistik

((metadata) @meta.version.sofistik
  (#match? @meta.version.sofistik "^@\\s*[Ss][Oo][Ff][Ii][Ss][Tt][Ii][Kk]\\s+[0-9]{4}"))

; COMMENTS AND INVALID INPUT
; ==========================

(comment) @comment.line.sofistik

[(invalid_module) (invalid_command) (invalid_item) (ERROR)] @invalid.illegal.sofistik
