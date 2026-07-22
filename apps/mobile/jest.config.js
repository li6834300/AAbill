const preset = require('jest-expo/jest-preset');

module.exports = {
  ...preset,
  // workspace 包(@aabill/core)是 ESM 风格 TS:import './x.js' 实为 x.ts
  setupFilesAfterEnv: [
    ...(preset.setupFilesAfterEnv ?? []),
    '<rootDir>/jest.setup.js',
  ],
  moduleNameMapper: {
    ...preset.moduleNameMapper,
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
