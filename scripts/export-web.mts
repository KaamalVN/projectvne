// Materialize a Web export for testing/preview: validates constraints with real
// file sizes, copies assets into the export bundle, writes story.json +
// constraints.json + index.html under public/web-export/<projectId>/.
//
// Usage: npx tsx scripts/export-web.mts [storyPath] [projectId]
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, statSync, existsSync } from 'fs';
import path from 'path';
import { prepareWebExport, validateWebConstraints } from '../src/export/web-export';
import { MigrationRunner } from '../src/migrations/migration-runner';

const storyArg = process.argv[2] || 'public/stories/demo-story.json';
const projectIdArg = process.argv[3] || 'demo-story';
const root = process.cwd();
const publicDir = path.join(root, 'public');

const raw = JSON.parse(readFileSync(path.join(root, storyArg), 'utf8'));
const project = MigrationRunner.migrate(raw);

// Real asset sizes from the source asset files under public/.
const sizes: Record<string, number> = {};
for (const a of Object.values(project.assets)) {
  const src = path.join(publicDir, (a as any).fileReference || '');
  sizes[(a as any).fileReference] = existsSync(src) ? statSync(src).size : 0;
}

const report = validateWebConstraints(project, sizes);
const exportDir = path.join(publicDir, 'web-export', projectIdArg);
mkdirSync(exportDir, { recursive: true });
mkdirSync(path.join(exportDir, 'assets'), { recursive: true });

const payload = prepareWebExport(project, projectIdArg, sizes);

// Copy each referenced asset into the bundle.
for (const m of payload.assetManifest) {
  const src = path.join(publicDir, m.sourceRef);
  if (existsSync(src)) {
    copyFileSync(src, path.join(exportDir, 'assets', path.basename(m.exportRef)));
  }
}

writeFileSync(path.join(exportDir, 'story.json'), payload.storyJson);
writeFileSync(path.join(exportDir, 'constraints.json'), JSON.stringify({ constraints: report }, null, 2));
writeFileSync(path.join(exportDir, 'index.html'), payload.html);

console.log(`Web export written to public/web-export/${projectIdArg}/`);
for (const c of report) {
  console.log(`  [${c.status.toUpperCase()}] ${c.label}: ${c.detail}`);
}
console.log(report.some((c) => c.status === 'block') ? 'EXPORT BLOCKED: fix blocked constraints first.' : 'EXPORT OK.');