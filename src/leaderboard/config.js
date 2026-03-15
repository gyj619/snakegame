export const LEADERBOARD_CONFIG = {
  supabaseUrl: 'https://cgkrxsbbpodgiyetfwas.supabase.co',
  supabaseAnonKey: 'sb_publishable_pX6xQrlFIAFfzrnusU81eA_rVIfLixx',
  tableName: 'snake_scores',
  refreshMs: 5000,
  maxEntries: 10,
  maxFetchRows: 100,
};

export function hasLeaderboardConfig() {
  return Boolean(
    LEADERBOARD_CONFIG.supabaseUrl.trim() &&
      LEADERBOARD_CONFIG.supabaseAnonKey.trim(),
  );
}
