'use strict';

const globals = require('globals');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'assets/**',
      'placamhub-multimedia/**',
      '**/*.min.js',
    ],
  },

  // Node / Electron main + backend (CommonJS)
  {
    files: [
      'main.js',
      'preload.js',
      'eslint.config.js',
      'scripts/**/*.js',
      'src/backend/**/*.js',
      'src/main/**/*.js',
      'plugins/**/backend/**/*.js',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
    },
  },

  // Renderer (browser, ES modules)
  {
    files: ['src/renderer/**/*.js', 'plugins/**/frontend/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
    },
  },

  // Tests + config (ESM, Node globals)
  {
    files: ['tests/**/*.js', 'vitest.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];
