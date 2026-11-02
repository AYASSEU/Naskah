import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['apps/web/src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/services/mock/*', '@/services/http/*'],
              message: 'Features use ports and the service provider.',
            },
          ],
        },
      ],
    },
  },
);
