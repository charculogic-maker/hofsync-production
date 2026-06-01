/** @type {import('vitest').UserConfig} */
module.exports = {
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['./tests/setup.js'],
    testTimeout: 30000,
  },
};
