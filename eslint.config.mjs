import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/.expo/',
      '**/coverage/',
      'packages/core/fixtures/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // CommonJS 配置文件(jest/metro 等)
    files: ['**/*.config.js', '**/babel.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'writable',
        __dirname: 'readonly',
      },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  prettier,
);
