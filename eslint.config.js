import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(
 { ignores: ['dist/**','node_modules/**','tests/runtime.js','bootstrap.js','content/**'] },
 eslint.configs.recommended,
 ...tseslint.configs.recommended,
 { files:['src/**/*.ts','tests/*.ts'], rules:{'@typescript-eslint/no-explicit-any':'error'} },
 { files:['scripts/*.mjs'], languageOptions:{globals:{console:'readonly',process:'readonly',URL:'readonly',performance:'readonly',setTimeout:'readonly',clearTimeout:'readonly'}} }
);
