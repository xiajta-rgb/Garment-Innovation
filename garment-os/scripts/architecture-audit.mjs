import ts from 'typescript';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const relative = file => path.relative(root, file).split(path.sep).join('/');
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
const options = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const files = walk(path.join(root, 'src')).filter(f => /\.(ts|tsx|json)$/.test(f) && !f.endsWith('.d.ts') && !f.includes(`${path.sep}test${path.sep}`));
const graph = new Map(), imports = [], external = [], violations = [];
for (const file of files) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const edges = [];
  const add = (specifier, typeOnly = false, dynamic = false) => {
    const resolvedFile = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule?.resolvedFileName;
    const resolved = resolvedFile ? path.resolve(resolvedFile) : undefined;
    const from = relative(file);
    const isLocal = specifier.startsWith('.') || specifier.startsWith('@/');
    if (isLocal && !resolved && !fs.existsSync(path.resolve(path.dirname(file),specifier))) violations.push({rule:'unresolved-import',from,specifier});
    if (/research\/legacy|parametricStore|types\/gene|data\/(garmentParts|geneLibrary|sizeCharts|templates)|patterns\/(blocks|block-library|anchor-registry)|lib\/(parametric|bom-engine|sqlite)|store\/(bomStore|canvasStore|workspaceStore)|design-db/.test(specifier)) violations.push({rule:'retired-runtime-import',from,specifier});
    if (resolved && resolved.startsWith(path.join(root, 'src'))) {
      const edge = { from: relative(file), to: relative(resolved), typeOnly, dynamic };
      imports.push(edge);
      const core = /^src\/(types|data|application)\//.test(from) || /^src\/lib\/patterns?\//.test(from);
      if (core && /^src\/(features|components|store|hooks|lib\/db)\//.test(edge.to)) violations.push({rule:'core-depends-on-ui-or-storage',...edge});
      if (/^src\/types\//.test(from) && !/^src\/types\//.test(edge.to)) violations.push({rule:'contract-depends-on-implementation',...edge});
      if (/^src\/store\/designStore\.ts$/.test(from) && /^src\/(features|components|lib\/db)\//.test(edge.to)) violations.push({rule:'editor-depends-on-adapter',...edge});
      if (!typeOnly) edges.push(edge.to);
    } else if (!isLocal) {
      const packageName = specifier.startsWith('@') ? specifier.split('/').slice(0,2).join('/') : specifier.split('/')[0];
      external.push({ from, package:packageName,typeOnly });
      const pure = /^src\/(types|data|application)\//.test(from) || /^src\/lib\/patterns?\//.test(from);
      if (pure && /^(react|react-dom|zustand|antd|konva|react-konva)$/.test(packageName)) violations.push({rule:'core-imports-framework',from,specifier});
      if (/^(immer|konva|react-konva|react-router-dom)$/.test(packageName)) violations.push({rule:'retired-dependency',from,specifier});
    }
  };
  const visit = node => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const names = clause?.namedBindings;
      const typeOnly = !!clause?.isTypeOnly || (!!names && ts.isNamedImports(names) && !clause.name && names.elements.length > 0 && names.elements.every(e => e.isTypeOnly));
      add(node.moduleSpecifier.text, typeOnly);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) add(node.moduleSpecifier.text, node.isTypeOnly);
    else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) add(node.arguments[0].text, false, true);
    else if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Worker') {
      const url = node.arguments?.[0];
      if (url && ts.isNewExpression(url) && ts.isIdentifier(url.expression) && url.expression.text === 'URL' && url.arguments?.[0] && ts.isStringLiteral(url.arguments[0])) add(url.arguments[0].text, false, true);
    }
    const pureModule = /^src\/(types|data|application)\//.test(relative(file)) || /^src\/lib\/(patterns?|svg-export)\//.test(relative(file));
    if (pureModule && ts.isIdentifier(node) && ['document','window','localStorage','indexedDB','Blob','Image'].includes(node.text)) violations.push({rule:'pure-module-uses-browser-global',from:relative(file),identifier:node.text});
    ts.forEachChild(node, visit);
  };
  visit(source);
  graph.set(relative(file), edges);
}
const reachable = new Set();
function reach(file) { if (reachable.has(file)) return; reachable.add(file); for (const next of graph.get(file) ?? []) reach(next); }
reach('src/main.tsx');
const activeStack = [], visited = new Set(), cycles = [];
function detect(file) {
  const at = activeStack.indexOf(file);
  if (at !== -1) { cycles.push([...activeStack.slice(at), file]); return; }
  if (visited.has(file)) return;
  visited.add(file); activeStack.push(file);
  for (const next of graph.get(file) ?? []) detect(next);
  activeStack.pop();
}
for (const file of reachable) detect(file);
const activeFiles = [...reachable].filter(f => fs.existsSync(path.join(root, f)));
const report = { generatedAt: new Date().toISOString(), runtimeFiles: activeFiles.length,
  runtimeLines: activeFiles.reduce((sum, f) => sum + fs.readFileSync(path.join(root, f), 'utf8').split('\n').length, 0),
  violations, cycles, reachable: [...reachable].sort(), unreachable: [...graph.keys()].filter(f => !reachable.has(f)).sort(), imports,
  runtimeExternals: [...new Set(external.filter(e => reachable.has(e.from) && !e.typeOnly).map(e => e.package))].sort(),
  declaredSourceExternals: [...new Set(external.map(e => e.package))].sort() };
const manifestFile=path.join(root,'doc/evidence/architecture-20261110/retired-files.json');
const archived=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
for(const item of archived) {
  const target=path.resolve(root,item.archive);
  if(!target.startsWith(path.join(root,'research','legacy')+path.sep) || !fs.existsSync(target) || createHash('sha256').update(fs.readFileSync(target)).digest('hex')!==item.sha256) violations.push({rule:'archive-integrity',archive:item.archive});
}
report.archiveFilesVerified=archived.length;
const output = process.argv.find(a => a.startsWith('--output='))?.slice(9);
if (output) { fs.mkdirSync(path.dirname(path.resolve(root, output)), { recursive: true }); fs.writeFileSync(path.resolve(root, output), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ runtimeFiles: report.runtimeFiles, runtimeLines: report.runtimeLines, cycles: report.cycles, violations:report.violations, archiveFilesVerified:report.archiveFilesVerified, unreachable: report.unreachable }, null, 2));

if (cycles.length || violations.length) process.exitCode = 1;
