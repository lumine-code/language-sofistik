((program) @fold
  (#set! fold.endAt endPosition)
  (#set! fold.adjustToEndOfPreviousRow true))

((commented_program_scope) @fold
  (#set! fold.endAt endPosition)
  (#set! fold.adjustToEndOfPreviousRow true))

(preprocessor_define_header) @fold.start
(preprocessor_enddef_record) @fold.end

(preprocessor_if_header) @fold.start
(preprocessor_endif_record) @fold.end

(loop_header) @fold.start
(endloop_record) @fold.end
