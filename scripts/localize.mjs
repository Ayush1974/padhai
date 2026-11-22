import ts from 'typescript';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, dirname } from 'node:path';

const root = process.cwd();
const phrases = new Set();
const print = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
const factory = ts.factory;

function cleanText(value) {
  const lines = value.replace(/\r/g, '').split('\n');
  return lines.map((line, index) => {
    let text = line.replace(/\t/g, ' ');
    if (index !== 0) text = text.replace(/^ +/, '');
    if (index !== lines.length - 1) text = text.replace(/ +$/, '');
    return text;
  }).filter(Boolean).join(' ');
}

function collect(value) {
  const text = value.trim();
  if (text.length < 2 || !/[a-zA-Z]/.test(text) || /https?:|[{}<>]|^\.|^\/|^#|\$\{|^CREATE |^SELECT |^UPDATE |^INSERT |^DELETE /.test(text)) return;
  if (/^[a-z0-9_-]+(?: [a-z0-9_-]+)*$/.test(text) && !['you', 'days', 'minutes', 'today', 'weeks'].includes(text)) return;
  phrases.add(text);
}

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (entry.name === 'i18n') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) results.push(...await filesIn(path));
    else if (/\.(tsx?|mjs)$/.test(path) && !/\.test\./.test(path)) results.push(path);
  }
  return results;
}

for (const path of await filesIn(join(root, 'src'))) {
  const source = await readFile(path, 'utf8');
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  function gather(node) { if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) collect(node.text); if (ts.isJsxText(node)) collect(cleanText(node.text)); ts.forEachChild(node, gather); }
  gather(file);
  if (!path.endsWith('.tsx') || /import \{ t \} from/.test(source)) continue;
  function call(expression) { return factory.createCallExpression(factory.createIdentifier('t'), undefined, [expression]); }
  function visit(node) {
    if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(file) === 'translate' && attribute.initializer && ts.isStringLiteral(attribute.initializer) && attribute.initializer.text === 'no')) return node;
    if (ts.isJsxText(node)) { const text = cleanText(node.text); return text.trim() ? factory.createJsxExpression(undefined, call(factory.createStringLiteral(text))) : node; }
    if (ts.isJsxAttribute(node) && ['placeholder', 'title', 'aria-label', 'alt'].includes(node.name.getText(file)) && node.initializer && ts.isStringLiteral(node.initializer)) return factory.updateJsxAttribute(node, node.name, factory.createJsxExpression(undefined, call(factory.createStringLiteral(node.initializer.text))));
    if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) return factory.updateJsxExpression(node, call(ts.visitNode(node.expression, visit)));
    return ts.visitEachChild(node, visit, context);
  }
  let context;
  const transformed = ts.transform(file, [ctx => { context = ctx; return node => ts.visitNode(node, visit); }]);
  let importPath = relative(dirname(path), join(root, 'src/i18n')).replaceAll('\\', '/');
  if (!importPath.startsWith('.')) importPath = `./${importPath}`;
  await writeFile(path, `import { t } from '${importPath}';\n${print.printFile(transformed.transformed[0])}`);
  transformed.dispose();
}

const keys = [...phrases];
const codes = process.argv.slice(2).length ? process.argv.slice(2) : ['hi', 'as', 'bn', 'doi', 'gu', 'kn', 'gom', 'mai', 'ml', 'mni-Mtei', 'mr', 'ne', 'or', 'pa', 'sa', 'sat', 'sd', 'ta', 'te', 'ur'];
await mkdir('src/i18n/locales', { recursive: true });
await writeFile('src/i18n/locales/en.json', JSON.stringify(Object.fromEntries(keys.map(key => [key, key])), null, 2));
if (process.argv.includes('--prepare-only')) { console.log(`Prepared ${keys.length} interface phrases.`); process.exit(0); }
console.log('Use the app’s Translate interface button to create missing translations with the configured Gemini key.');
