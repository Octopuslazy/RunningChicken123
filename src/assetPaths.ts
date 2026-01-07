export type AssetAlias = 'art' | 'arts' | 'sounds' | 'anim' | 'fonts' | string;

export const ASSET_PATHS: Record<AssetAlias, string> = {
  art: '/Assets/...',
  arts: '/Assets/...',
  sounds: '/Assets/...',
  anim: '/Assets/...',
  fonts: '/Assets/...'
};

export function resolveAsset(aliasOrPath: string, filename?: string) {
  if (!filename) {
    // If aliasOrPath is an alias, return mapped base; otherwise return as-is
    return (ASSET_PATHS as any)[aliasOrPath] || aliasOrPath;
  }

  // If aliasOrPath looks like an absolute path, join it with filename
  if (aliasOrPath.startsWith('/')) {
    return aliasOrPath.replace(/\/$/, '') + '/' + filename;
  }

  const base = (ASSET_PATHS as any)[aliasOrPath] || aliasOrPath;
  return String(base).replace(/\/$/, '') + '/' + filename;
}

export default ASSET_PATHS;
