import fs from 'node:fs';
const mapping = JSON.parse(fs.readFileSync('lib/weather-static-routes.json', 'utf8'));
const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
config.framework = 'nextjs';
config.outputDirectory = null;
for (const rewrite of config.rewrites || []) {
  const route = rewrite.source.replace(/\/+$/, '') || '/';
  if (Object.hasOwn(mapping.routes, route)) rewrite.destination = '/weather-response?route=' + encodeURIComponent(route);
}
fs.writeFileSync('vercel.json', JSON.stringify(config, null, 2) + '\n');
// Native Next hosting serves its own assets and dynamic route responses.
// Legacy "Other" hosting exporters cannot require prerendered weather HTML.
const legacyExporter = 'scripts/sync-next-static-pages.cjs';
if (fs.existsSync(legacyExporter)) {
  const legacySource = fs.readFileSync(legacyExporter, 'utf8');
  if (!legacySource.includes('CRA native Next hosting')) {
    fs.writeFileSync(legacyExporter, `// CRA native Next hosting\nconst craWeatherHostingConfig = JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'vercel.json'), 'utf8'));\nif (craWeatherHostingConfig.framework === 'nextjs' && !process.env.EXPORT_NEXT_STATIC) {\n  console.log('Native Next hosting: skipping legacy static export.');\n  process.exit(0);\n}\n` + legacySource);
  }
}
// Dynamic filesystem reads need explicit tracing in the hosted server bundle.
// Include only the approved HTML documents used by this route, not image assets.
const configFile = ['next.config.js', 'next.config.mjs', 'next.config.ts'].find(file => fs.existsSync(file));
const files = [...new Set(Object.values(mapping.routes))].map(file => './public' + file);
const marker = '// CRA weather response file tracing';
let source = configFile ? fs.readFileSync(configFile, 'utf8') : 'module.exports = {};\n';
if (source.includes(marker)) source = source.slice(0, source.indexOf(marker)).trimEnd() + '\n';
const types = configFile?.endsWith('.ts') ? ': any' : '';
const weatherRewrites = Object.keys(mapping.routes).map(route => ({ source: route, destination: '/weather-response?route=' + encodeURIComponent(route) }));
const helper = `${marker}\nfunction withCraWeatherTracing(value${types}) {\n  const add = (config${types}) => ({ ...config, async rewrites() { const prior = typeof config.rewrites === 'function' ? await config.rewrites() : []; const grouped = Array.isArray(prior) ? { beforeFiles: [], afterFiles: prior, fallback: [] } : prior; return { ...grouped, beforeFiles: [...${JSON.stringify(weatherRewrites)}, ...(grouped.beforeFiles || [])] }; }, outputFileTracingIncludes: { ...(config.outputFileTracingIncludes || {}), '/weather-response': ${JSON.stringify(files)} } });\n  return typeof value === 'function' ? async (...args${types ? ': any[]' : ''}) => add(await value(...args)) : add(value);\n}\n`;
if (/module\.exports\s*=/.test(source)) {
  source += helper + 'module.exports = withCraWeatherTracing(module.exports);\n';
} else {
  // Keep an ESM config's original declaration and wrap its exported value.
  if (!source.includes('const craWeatherBaseConfig =')) source = source.replace(/export\s+default\s+/, 'const craWeatherBaseConfig = ');
  source += helper + 'export default withCraWeatherTracing(craWeatherBaseConfig);\n';
}
fs.writeFileSync(configFile || 'next.config.js', source);
