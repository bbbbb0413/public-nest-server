const tsEslint = require('typescript-eslint');
const eslint = require('@eslint/js');

module.exports = tsEslint.config({
  plugins: {
    '@typescript-eslint': tsEslint.plugin,
  },
  extends: [
    eslint.configs.recommended,
    ...tsEslint.configs.strict,
    ...tsEslint.configs.stylistic,
  ],
  languageOptions: {
    parser: tsEslint.parser,
    parserOptions: {
      project: true,
      sourceType: 'module',
    },
  },
  files: ['**/*.ts', '**/*.tsx'],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/no-extraneous-class': 'off',
    '@typescript-eslint/prefer-for-of': 'off',
    '@typescript-eslint/require-await': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        args: 'all',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],
    '@typescript-eslint/consistent-type-definitions': 'off', // prevent type transform interface
    '@typescript-eslint/no-unused-expressions': [
      'error',
      { allowTernary: true }, // 삼항 연산자 조건 표현식 허용
    ],
    'no-console': ['error', { allow: ['warn', 'error', 'debug'] }],
    // 'require-await': 'error',
    // 'no-await-in-loop': 'error',
  },
});
