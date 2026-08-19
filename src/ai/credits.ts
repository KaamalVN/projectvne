// Optional, metered, opt-in cloud AI credits (Phase 6). The "bring your own key"
// providers stay free permanently; the ProjectVNE Cloud provider meters usage
// through a credit balance. This is the in-editor side: a balance ledger stored
// locally, opt-in, and a per-request metering hook. The actual billing/ledger
// backend is external (docs/cloud-services.md).

const BALANCE_KEY = 'projectvne.ai.cloud.credits';

export interface CloudCreditsState {
  /** Remaining credits (costs 1 credit per request by default). */
  balance: number;
  /** Total credits consumed by this project's cloud usage. */
  consumed: number;
  /** Whether cloud AI credits are opted in for this project. */
  optedIn: boolean;
}

export const DEFAULT_CLOUD_CREDITS: CloudCreditsState = { balance: 0, consumed: 0, optedIn: false };

// A cloud request costs 1 credit (the real pricing lives server-side; the
// editor meters the same unit for transparency).
export const COST_PER_CLOUD_REQUEST = 1;

export function loadCredits(): CloudCreditsState {
  try {
    const raw = localStorage.getItem(BALANCE_KEY);
    if (!raw) return DEFAULT_CLOUD_CREDITS;
    const parsed = JSON.parse(raw);
    return {
      balance: typeof parsed.balance === 'number' ? parsed.balance : 0,
      consumed: typeof parsed.consumed === 'number' ? parsed.consumed : 0,
      optedIn: !!parsed.optedIn,
    };
  } catch {
    return DEFAULT_CLOUD_CREDITS;
  }
}

export function saveCredits(state: CloudCreditsState): void {
  try {
    localStorage.setItem(BALANCE_KEY, JSON.stringify(state));
  } catch {
    // no-op
  }
}

export function optIntoCloudCredits(initialBalance: number): CloudCreditsState {
  const state = loadCredits();
  const next = { ...state, optedIn: true, balance: Math.max(0, state.balance + initialBalance) };
  saveCredits(next);
  return next;
}

export function setCloudBalance(balance: number): CloudCreditsState {
  const state = loadCredits();
  const next = { ...state, balance: Math.max(0, balance) };
  saveCredits(next);
  return next;
}

/**
 * Meter one cloud request. Returns the remaining balance, or null if the user
 * is out of credits (caller should surface a clear "out of credits" error,
 * never a generic failure).
 */
export function spendCredits(cost: number = COST_PER_CLOUD_REQUEST): number | null {
  const state = loadCredits();
  if (!state.optedIn) return null;
  if (state.balance < cost) return null;
  const next = { ...state, balance: state.balance - cost, consumed: state.consumed + cost };
  saveCredits(next);
  return next.balance;
}

/** Project-level opt-in for cloud AI (separate from the provider choice). */
export function cloudAIOptedIn(): boolean {
  return loadCredits().optedIn;
}