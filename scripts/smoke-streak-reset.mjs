import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [source, index] = await Promise.all([
  readFile(path.join(root, "chat-site-sync.js"), "utf8"),
  readFile(path.join(root, "index.html"), "utf8")
]);

function functionBlock(name, nextName) {
  const start = source.indexOf(`  function ${name}(`);
  const end = source.indexOf(`\n  function ${nextName}(`, start + 1);
  assert.notEqual(start, -1, `Missing ${name}`);
  assert.notEqual(end, -1, `Missing boundary after ${name}`);
  return source.slice(start, end).trim();
}

const streakFunctions = [
  functionBlock("normalizeIsoDay", "isoDayFromStamp"),
  functionBlock("isoDayFromStamp", "streakDayNumber"),
  functionBlock("streakDayNumber", "sortedUniqueDays"),
  functionBlock("sortedUniqueDays", "streakStateFromSource"),
  functionBlock("streakStateFromSource", "currentStreakClockStamp"),
  functionBlock("currentStreakClockStamp", "currentStreakDay"),
  functionBlock("currentStreakDay", "activeStreakStateForDay"),
  functionBlock("activeStreakStateForDay", "applyStreakPlay"),
  functionBlock("applyStreakPlay", "mergeStreakPlayedDays")
].join("\n\n");

const makeStreakApi = new Function(
  "STREAK_DAY_MS",
  "STREAK_MILESTONES",
  "streakServerClockCache",
  `${streakFunctions}
  return { activeStreakStateForDay, applyStreakPlay };`
);

const { activeStreakStateForDay, applyStreakPlay } = makeStreakApi(
  24 * 60 * 60 * 1000,
  [3, 7, 14, 30, 100],
  null
);
const existing = {
  currentStreak: 2,
  longestStreak: 6,
  lastActiveDate: "2026-07-24",
  streakDays: ["2026-07-23", "2026-07-24"]
};

assert.deepEqual(
  { current: activeStreakStateForDay(existing, "2026-07-24").current, expired: activeStreakStateForDay(existing, "2026-07-24").expired },
  { current: 2, expired: false },
  "A same-day visit must preserve the streak"
);
assert.deepEqual(
  { current: activeStreakStateForDay(existing, "2026-07-25").current, expired: activeStreakStateForDay(existing, "2026-07-25").expired },
  { current: 2, expired: false },
  "The streak remains active through the next calendar day"
);

const missed = activeStreakStateForDay(existing, "2026-07-26");
assert.equal(missed.current, 0, "Missing one full day must reset the current streak");
assert.equal(missed.longest, 6, "Resetting must preserve the longest streak");
assert.equal(missed.lastActiveDate, "2026-07-24", "Resetting must preserve the last active date");
assert.equal(missed.expired, true);

const monthBoundary = {
  current: 4,
  longest: 4,
  lastActiveDate: "2026-07-31",
  playedDays: ["2026-07-31"]
};
assert.equal(activeStreakStateForDay(monthBoundary, "2026-08-01").current, 4);
assert.equal(activeStreakStateForDay(monthBoundary, "2026-08-02").current, 0);

const restarted = applyStreakPlay(existing, "2026-07-26");
assert.equal(restarted.current, 1, "Playing after a missed day must start a new one-day streak");
assert.equal(restarted.longest, 6);
assert.equal(restarted.changed, true);

assert.match(source, /function streakProfilePatch\(streak\)\s*\{\s*const clean = activeStreakStateForDay\(streak\);/);
assert.match(source, /function renderHeaderStreak\(\)[\s\S]*?const streak = activeStreakStateForDay\(/);
assert.match(source, /function renderSiteProfile\(\)[\s\S]*?const streak = activeStreakStateForDay\(/);
assert.match(source, /function scheduleStreakExpiryRefresh\(\)[\s\S]*?nextMidnight[\s\S]*?renderHeaderStreak\(\);[\s\S]*?renderSiteProfile\(\);/);
assert.match(source, /document\.addEventListener\("visibilitychange"[\s\S]*?scheduleStreakExpiryRefresh\(\);/);
assert.match(index, /chat-site-sync\.js\?v=20260724-savefeedback2/);

console.log(JSON.stringify({
  passed: true,
  sameDayPreserved: true,
  nextDayPreserved: true,
  missedDayReset: true,
  monthBoundaryCovered: true,
  restartAtOne: true,
  longestStreakPreserved: true,
  midnightRefreshScheduled: true,
  wakeRefreshScheduled: true
}, null, 2));
