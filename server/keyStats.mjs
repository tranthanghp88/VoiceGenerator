let stats = {};

export function initStats(template) {
  stats = template || {};
}

function ensure(label) {
  if (!stats[label]) {
    stats[label] = {
      success: 0,
      fail: 0,
      lastUsed: null
    };
  }
}

export function logSuccess(label) {
  ensure(label);
  stats[label].success += 1;
  stats[label].lastUsed = Date.now();
}

export function logFail(label) {
  ensure(label);
  stats[label].fail += 1;
  stats[label].lastUsed = Date.now();
}

export function getStats() {
  return stats;
}