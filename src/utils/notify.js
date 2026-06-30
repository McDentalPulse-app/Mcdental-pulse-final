let handlers = {
  toast: {
    success: () => {},
    error: () => {},
    warning: () => {},
    info: () => {},
  },
  confirm: async () => false,
  prompt: async () => null,
};

export const registerNotificationHandlers = (next) => {
  handlers = { ...handlers, ...next };
  if (next.toast) {
    handlers.toast = { ...handlers.toast, ...next.toast };
  }
};

export const notify = {
  toast: {
    success: (message) => handlers.toast.success(message),
    error: (message) => handlers.toast.error(message),
    warning: (message) => handlers.toast.warning(message),
    info: (message) => handlers.toast.info(message),
  },
  confirm: (options) => handlers.confirm(options),
  prompt: (options) => handlers.prompt(options),
};
