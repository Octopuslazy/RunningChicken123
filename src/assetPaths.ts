export type AssetAlias = 'art' | 'arts' | 'sounds' | 'anim' | 'fonts' | string;

export const ASSET_PATHS: Record<AssetAlias, string> = {
  art: '/Assets/_arts',
  arts: '/Assets/Arts',
  sounds: '/Assets/Sounds',
  anim: '/Assets/Arts/anim',
  fonts: '/Assets/Fonts'
};

/**
 * Resolve an alias or an absolute path to a usable asset URL.
 * Usage:
 *   resolveAsset('art', 'bg_1_groundmid.png') -> '/Assets/_arts/bg_1_groundmid.png'
 *   resolveAsset('/some/custom/path', 'file.png') -> '/some/custom/path/file.png'
 */
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
