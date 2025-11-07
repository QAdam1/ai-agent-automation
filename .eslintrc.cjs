module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 'latest',
  },
  env: {
    node: true,
    es2021: true,
  },
  ignorePatterns: ['dist', 'node_modules'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
  },
};
