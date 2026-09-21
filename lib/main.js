exports.consumeTodoInjection = (todo) => {
  return todo.addInjectionPoint("source.sofistik", {
    types: ["comment"],
  });
};
