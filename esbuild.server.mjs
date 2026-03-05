import { build } from 'esbuild';

await build({
  entryPoints: ['src/server/standalone.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/server/standalone.js',
  external: ['express'],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});

console.log('Server built → dist/server/standalone.js');
