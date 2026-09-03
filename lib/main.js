exports.consumeTodoInjection = (todo) => {
  todo.addInjectionPoint("source.sofistik", {
    types: ["comment"],
  });
};
