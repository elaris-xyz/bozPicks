import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * Lean, headless ESLint for the monorepo. Type-unaware (no tsconfig project) so
 * it runs fast in CI. Real bugs are errors; stylistic/opinion rules are warnings
 * or off, so `eslint .` exits 0 unless something is actually broken. Tighten
 * over time. `next lint` is deliberately not used — this avoids its interactive
 * first-run setup and heavy plugin surface.
 */

// The codebase carries `// eslint-disable-next-line @next/next/no-img-element`
// comments. Rather than pull in the whole Next ESLint plugin, register that one
// rule name as a no-op so the disable directives resolve instead of erroring.
const nextShim = {
  rules: { 'no-img-element': { meta: {}, create: () => ({}) } },
};

export default tseslint.config(
  {
    ignores: [
      '**/.next/**',
      '**/.next-dev/**',
      '**/dist/**',
      '**/node_modules/**',
      '**/target/**',
      '**/*.config.*',
      '**/next-env.d.ts',
      'subscribe-txline.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { '@next/next': nextShim },
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      // TypeScript already resolves identifiers/types — core no-undef is noise.
      'no-undef': 'off',
      // surface, don't block
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-escape': 'warn',
      'no-useless-assignment': 'warn',
      'no-misleading-character-class': 'warn',
      'prefer-const': 'warn',
    },
  },
);
