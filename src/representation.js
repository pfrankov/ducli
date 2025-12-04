export function buildRepresentation(component, styleText) {
  const lines = [];
  lines.push(`COMPONENT ${component.name}`);
  lines.push(
    `PROPS ${component.props.names.join(',') || 'none'} spreads:${component.props.spreads}`
  );
  lines.push(`HOOKS ${unique(component.hooks).join(',') || 'none'}`);
  lines.push(`LOGIC ${unique(component.logicTokens).join(',') || 'none'}`);
  lines.push(`JSX ${summarizeJsx(component.jsxTags)}`);
  lines.push(`CLASSES ${unique(component.classNames).join(',') || 'none'}`);
  lines.push(`LITERALS ${unique(component.literals).join(',') || 'none'}`);
  const codeRep = normalize(lines.join('\n'));
  const styleRep = normalize(styleText || '');
  const structureRep = buildStructureRepresentation(component);
  const holisticRep = buildHolisticRepresentation(component, styleText, structureRep, codeRep);
  return { codeRep, styleRep, structureRep, holisticRep };
}

function normalize(text) {
  return (text || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function summarizeJsx(tags = []) {
  if (!tags.length) return 'none';
  return tags.slice(0, 20).join(' -> ');
}

function buildStructureRepresentation(component) {
  const paths = summarizePaths(component.jsxPaths || []);
  const textNodes = summarizeTextNodes(component.textNodes || []);
  const classes = unique(component.classNames).join(',') || 'none';
  return normalize(
    [
      `VDOM PATHS ${paths || 'none'}`,
      `VDOM TEXT ${textNodes || 'none'}`,
      `VDOM CLASSES ${classes}`,
    ].join('\n')
  );
}

function buildHolisticRepresentation(component, styleText, structureRep, codeRep) {
  const normalizedSource = normalize((component.source || '').slice(0, 4000));
  const parts = [
    `NAME ${component.name}`,
    `STRUCTURE ${structureRep}`,
    `CODE ${codeRep}`,
    styleText ? `STYLE ${normalize(styleText)}` : '',
    normalizedSource ? `SOURCE ${normalizedSource}` : '',
  ].filter(Boolean);
  return normalize(parts.join('\n'));
}

function summarizePaths(paths) {
  if (!paths.length) return '';
  const uniquePaths = unique(paths).slice(0, 25);
  return uniquePaths.map((p) => truncatePath(p)).join(' | ');
}

function truncatePath(path) {
  const segments = path.split('>');
  if (segments.length <= 5) return path;
  return `${segments.slice(0, 2).join('>')}...${segments.slice(-2).join('>')}`;
}

function summarizeTextNodes(nodes) {
  if (!nodes.length) return '';
  const cleaned = nodes
    .map((text) => text.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map((text) => (text.length > 40 ? `${text.slice(0, 37)}...` : text));
  return cleaned.join(' | ');
}

function unique(items = []) {
  return Array.from(new Set(items.filter(Boolean)));
}
