import { LEADERBOARD_CONFIG, hasLeaderboardConfig } from './config.js';
import { buildLeaderboard, normalizePlayerName } from './helpers.js';

export async function fetchLeaderboard() {
  if (!hasLeaderboardConfig()) {
    return {
      enabled: false,
      entries: [],
    };
  }

  const response = await request(
    buildUrl(
      `?select=player_name,score,updated_at&order=score.desc,updated_at.asc&limit=${LEADERBOARD_CONFIG.maxFetchRows}`,
    ),
    {
      method: 'GET',
    },
  );
  const rows = await response.json();

  return {
    enabled: true,
    entries: buildLeaderboard(rows, LEADERBOARD_CONFIG.maxEntries),
  };
}

export async function submitScore(playerName, score) {
  if (!hasLeaderboardConfig()) {
    return { enabled: false, updated: false };
  }

  const normalizedName = normalizePlayerName(playerName);
  const safeScore = Math.max(0, Math.floor(score));
  const existingRecord = await findRecordByPlayerName(normalizedName);

  if (existingRecord && Number(existingRecord.score) >= safeScore) {
    return { enabled: true, updated: false };
  }

  if (existingRecord) {
    await request(buildUrl(`?player_name=eq.${encodeURIComponent(normalizedName)}`), {
      method: 'PATCH',
      body: JSON.stringify({
        score: safeScore,
        updated_at: new Date().toISOString(),
      }),
      headers: {
        Prefer: 'return=minimal',
      },
    });

    return { enabled: true, updated: true };
  }

  await request(buildUrl(), {
    method: 'POST',
    body: JSON.stringify({
      player_name: normalizedName,
      score: safeScore,
    }),
    headers: {
      Prefer: 'return=minimal',
    },
  });

  return { enabled: true, updated: true };
}

async function findRecordByPlayerName(playerName) {
  const response = await request(
    buildUrl(
      `?select=player_name,score&player_name=eq.${encodeURIComponent(playerName)}&limit=1`,
    ),
    {
      method: 'GET',
    },
  );
  const rows = await response.json();
  return rows[0] ?? null;
}

async function request(url, options) {
  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: LEADERBOARD_CONFIG.supabaseAnonKey,
      Authorization: `Bearer ${LEADERBOARD_CONFIG.supabaseAnonKey}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Leaderboard request failed (${response.status}): ${errorText}`);
  }

  return response;
}

function buildUrl(query = '') {
  const baseUrl = LEADERBOARD_CONFIG.supabaseUrl.replace(/\/$/, '');
  return `${baseUrl}/rest/v1/${LEADERBOARD_CONFIG.tableName}${query}`;
}
