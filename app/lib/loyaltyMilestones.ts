export interface LoyaltyMilestoneRule {
  every: number;
  reward: string;
}

export interface NextMilestoneResult {
  rule: LoyaltyMilestoneRule;
  remaining: number;
  reward: string;
  nextMilestoneVisit: number;
}

export const DEFAULT_MILESTONE_INTERVAL = 5;
export const DEFAULT_MILESTONE_REWARD = "10% off next visit";
export const MAX_MILESTONE_RULES = 3;
export const MAX_REWARD_LENGTH = 120;
export const MIN_INTERVAL = 1;
export const MAX_INTERVAL = 9999;

/**
 * Validates whether a raw 'every' value is an integer between 1 and 9999.
 */
export function isValidMilestoneInterval(val: any): boolean {
  if (typeof val === "number") {
    return Number.isInteger(val) && val >= MIN_INTERVAL && val <= MAX_INTERVAL;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!/^\d+$/.test(trimmed)) return false;
    const num = Number(trimmed);
    return Number.isInteger(num) && num >= MIN_INTERVAL && num <= MAX_INTERVAL;
  }
  return false;
}

/**
 * Validates and trims a reward description to a maximum of 120 characters.
 * Returns null if invalid or empty.
 */
export function sanitizeRewardDescription(val: any): string | null {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, MAX_REWARD_LENGTH);
}

/**
 * Parses raw loyalty config into a list of up to 3 valid rules.
 * If milestones is missing or empty, returns one rule built from legacy fields.
 */
export function parseLoyaltyRules(config: any): LoyaltyMilestoneRule[] {
  if (!config || typeof config !== "object") {
    return [
      {
        every: DEFAULT_MILESTONE_INTERVAL,
        reward: DEFAULT_MILESTONE_REWARD,
      },
    ];
  }

  const rawMilestones = config.milestones;
  if (Array.isArray(rawMilestones) && rawMilestones.length > 0) {
    const validRules: LoyaltyMilestoneRule[] = [];
    const seenIntervals = new Set<number>();

    for (const item of rawMilestones) {
      if (!item || typeof item !== "object") continue;

      const everyRaw = item.every !== undefined ? item.every : item.milestone_interval ?? item.interval;
      const rewardRaw = item.reward !== undefined ? item.reward : item.milestone_reward ?? item.reward_text;

      if (!isValidMilestoneInterval(everyRaw)) continue;
      const reward = sanitizeRewardDescription(rewardRaw);
      if (!reward) continue;

      const every = typeof everyRaw === "number" ? Math.floor(everyRaw) : parseInt(String(everyRaw).trim(), 10);
      if (seenIntervals.has(every)) continue; // ignore duplicate intervals

      seenIntervals.add(every);
      validRules.push({ every, reward });

      if (validRules.length >= MAX_MILESTONE_RULES) {
        break;
      }
    }

    if (validRules.length > 0) {
      return validRules;
    }
  }

  // Fallback to legacy single rule
  const legacyIntervalRaw =
    config.milestone_interval !== undefined
      ? config.milestone_interval
      : config.visits_required !== undefined
      ? config.visits_required
      : config.interval;

  const legacyRewardRaw =
    config.milestone_reward !== undefined
      ? config.milestone_reward
      : config.reward !== undefined
      ? config.reward
      : config.reward_text;

  const every = isValidMilestoneInterval(legacyIntervalRaw)
    ? typeof legacyIntervalRaw === "number"
      ? Math.floor(legacyIntervalRaw)
      : parseInt(String(legacyIntervalRaw).trim(), 10)
    : DEFAULT_MILESTONE_INTERVAL;

  const reward = sanitizeRewardDescription(legacyRewardRaw) || DEFAULT_MILESTONE_REWARD;

  return [{ every, reward }];
}

/**
 * Calculates the next milestone across a list of rules for a given visit count.
 * Returns the rule whose next multiple is nearest (ties: the larger every).
 * If visits is already an exact multiple of every, remaining is every.
 */
export function getNextMilestone(
  visitsInput: number | null | undefined,
  rulesInput?: LoyaltyMilestoneRule[]
): NextMilestoneResult {
  const visits =
    typeof visitsInput === "number" && !isNaN(visitsInput) && visitsInput >= 0
      ? Math.floor(visitsInput)
      : 0;

  const rules =
    Array.isArray(rulesInput) && rulesInput.length > 0
      ? rulesInput
      : [
          {
            every: DEFAULT_MILESTONE_INTERVAL,
            reward: DEFAULT_MILESTONE_REWARD,
          },
        ];

  let bestRule = rules[0];
  let minRemaining = Infinity;

  for (const rule of rules) {
    const E = rule.every;
    // If visits is exact multiple of E (including 0), remaining is E
    const remMod = visits % E;
    const remaining = remMod === 0 ? E : E - remMod;

    if (remaining < minRemaining) {
      minRemaining = remaining;
      bestRule = rule;
    } else if (remaining === minRemaining) {
      // Tie-breaker: pick the rule with the larger every
      if (rule.every > bestRule.every) {
        bestRule = rule;
      }
    }
  }

  return {
    rule: bestRule,
    remaining: minRemaining,
    reward: bestRule.reward,
    nextMilestoneVisit: visits + minRemaining,
  };
}
