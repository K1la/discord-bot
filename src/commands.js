const actionCommand = {
  name: "action",
  description: "Взаимодействие с пользователем",
  options: [
    {
      name: "user",
      description: "Выберите нужного пользователя",
      type: 6,
      required: true,
    },
  ],
};

module.exports = {actionCommand};