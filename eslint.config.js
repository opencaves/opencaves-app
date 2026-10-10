// ESLint, for the JSDoc only (npm run lint:jsdoc): the comments' format
// (AGENTS.md, "Code comments") and their drift from the code - a parameter
// renamed while its @param still names the old one, a type that doesn't
// parse. No other rules: the code's style isn't checked here.
import jsdoc from 'eslint-plugin-jsdoc'

// The code's eslint-disable comments name React's hook rules, which aren't
// loaded here: stand-ins that check nothing, so those comments don't error.
const noCheck = { create: () => ({}) }
const reactHooks = { rules: { 'exhaustive-deps': noCheck, 'rules-of-hooks': noCheck } }

// jsdoc/check-param-names, without its "Missing @param props.x" reports: a
// destructured parameter documents only the properties worth it, but one it
// names must still exist (the plugin has no option for that alone).
const checkParamNames = jsdoc.rules['check-param-names']
const ocJsdoc = {
  rules: {
    'check-param-names': {
      meta: checkParamNames.meta,
      create(context) {
        const report = (descriptor) => {
          if (!/^Missing @/.test(descriptor.message ?? '')) context.report(descriptor)
        }
        // A stand-in context (the real one is frozen): its report filtered,
        // the rest forwarded.
        const get = (_, key) => (key === 'report' ? report : typeof context[key] === 'function' ? context[key].bind(context) : context[key])
        return checkParamNames.create(new Proxy({}, { get }))
      },
    },
  },
}

export default [
  {
    ignores: [
      'build/**',
      'scripts/**',
      // Built (the app rendered on the server), and vendored code with its own JSDoc.
      'functions/js/ssr/**',
      'functions/js/resize-images/**',
      'src/hooks/useBroadcastChannel.jsx',
    ],
  },
  {
    files: ['src/**/*.{js,jsx}', 'functions/js/**/*.js'],
    plugins: { jsdoc, 'oc-jsdoc': ocJsdoc, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    settings: {
      // TypeScript's type syntax (`A & B`, `(x: T) => U`, import('...').T),
      // as the JSDoc and the global types (src/types.js) are written. Type
      // names aren't checked (no-undefined-types): DOM, React and Firebase
      // types, and the global ones, would all need declaring.
      jsdoc: { mode: 'typescript' },
    },
    rules: {
      // Drift: names and types that no longer match the code. A destructured
      // parameter documents only the properties worth it (props.x), so a
      // missing one isn't reported (oc-jsdoc's) - a wrong one is.
      'oc-jsdoc/check-param-names': ['warn', { disableMissingParamChecks: true }],
      'jsdoc/check-property-names': 'warn',
      'jsdoc/check-tag-names': 'warn',
      'jsdoc/check-types': 'warn',
      'jsdoc/valid-types': 'warn',
      'jsdoc/require-param-name': 'warn',
      'jsdoc/require-param-type': 'warn',
      'jsdoc/require-returns-type': 'warn',
      'jsdoc/require-property-type': 'warn',
      'jsdoc/require-throws-type': 'warn',
      'jsdoc/require-property-name': 'warn',
      'jsdoc/empty-tags': 'warn',
      // The format: description first, a blank line, then the tags with no
      // blank line between them; " - " before a parameter's description.
      'jsdoc/check-alignment': 'warn',
      'jsdoc/multiline-blocks': 'warn',
      'jsdoc/no-multi-asterisks': 'warn',
      'jsdoc/require-asterisk-prefix': 'warn',
      'jsdoc/tag-lines': ['warn', 'never', { startLines: 1 }],
      'jsdoc/require-hyphen-before-param-description': ['warn', 'always'],
      'jsdoc/no-blank-blocks': 'warn',
    },
  },
]
