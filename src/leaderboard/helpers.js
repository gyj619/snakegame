export function normalizePlayerName(input) {
  return String(input ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 20);
}

export function isValidPlayerName(name) {
  return normalizePlayerName(name).length >= 2;
}

export function buildLeaderboard(rows, limit = 10) {
  const bestByPlayer = new Map();

  for (const row of rows) {
    const playerName = normalizePlayerName(row.player_name);
    const score = Number(row.score);
    const updatedAt = row.updated_at ?? '';

    if (!playerName || !Number.isFinite(score)) {
      continue;
    }

    const currentBest = bestByPlayer.get(playerName);
    if (
      !currentBest ||
      score > currentBest.score ||
      (score === currentBest.score && updatedAt < currentBest.updatedAt)
    ) {
      bestByPlayer.set(playerName, {
        playerName,
        score,
        updatedAt,
      });
    }
  }

  return [...bestByPlayer.values()]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.updatedAt.localeCompare(right.updatedAt);
    })
    .slice(0, limit);
}
