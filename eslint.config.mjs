import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/.expo/',
      '**/.vercel/',
      '**/coverage/',
      // git worktrees(如 UI 设计系统分支)自带一份仓库副本,不该被本分支 lint
      '.claude/worktrees/',
      'packages/core/fixtures/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // CommonJS 配置文件(jest/metro 等)
    files: ['**/*.config.js', '**/babel.config.js', '**/jest.setup.js'],
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
  {
    // 测试里为拿到「全新模块状态」需要 isolateModules + require(jest 跑 CJS)
    files: ['**/__tests__/**/*.ts', '**/__tests__/**/*.tsx'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // 构建期脚本(Node 环境,不进产物)
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        fetch: 'readonly',
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  prettier,
);
