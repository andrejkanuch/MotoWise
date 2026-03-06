/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./test/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|@urql|urql|zustand)',
  ],
  moduleNameMapper: {
    '^@motolearn/types(.*)$': '<rootDir>/../../packages/types/src$1',
    '^@motolearn/graphql(.*)$': '<rootDir>/../../packages/graphql/src$1',
  },
};
