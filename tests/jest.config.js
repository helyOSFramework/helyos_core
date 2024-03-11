module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./jest.setup.js'],
  testTimeout: 150000,
  globalTeardown: './jest.teardown.js'
};