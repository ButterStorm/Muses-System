export const createAgentSession = jest.fn(async () => ({
  session: {
    subscribe: jest.fn(() => jest.fn()),
    prompt: jest.fn(async () => undefined),
    dispose: jest.fn(),
  },
}));

export const getAgentDir = jest.fn(() => '/tmp/pi-agent');

export const AuthStorage = {
  inMemory: jest.fn(() => ({
    setRuntimeApiKey: jest.fn(),
  })),
};

export const ModelRegistry = {
  inMemory: jest.fn(() => ({
    find: jest.fn(() => undefined),
  })),
};

export const SessionManager = {
  inMemory: jest.fn(() => ({ type: 'memory-session-manager' })),
};

export const DefaultResourceLoader = jest.fn().mockImplementation(() => ({
  reload: jest.fn(async () => undefined),
  getSkills: jest.fn(() => ({ skills: [], diagnostics: [] })),
}));

export const defineTool = jest.fn((tool) => tool);

export const createReadToolDefinition = jest.fn((_cwd, _options) => ({ name: 'read' }));

export const createBashToolDefinition = jest.fn((_cwd, _options) => ({ name: 'bash' }));

export const createWriteToolDefinition = jest.fn((_cwd, _options) => ({ name: 'write' }));

export const createEditToolDefinition = jest.fn((_cwd, _options) => ({ name: 'edit' }));
