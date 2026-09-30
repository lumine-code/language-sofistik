; Resolve the header field before traversing a potentially wide program body.
(program
  header: (program_header
    module: (module_name) @name)) @definition.module

(command
  name: (command_name) @name) @definition.method
