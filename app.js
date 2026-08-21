import { deleteCurrentAccount, getAuthUser, onAuthChange, resendSignupEmail, signIn, signOut, signUp, verifySignupCode } from "./src/auth.js";
import { completeOnboarding, loadCloudState, loadProfile, saveCloudState } from "./src/cloud.js";

const STORAGE_KEY = "trading-journal-platform-v1";
const STORAGE_OWNER_KEY = "trading-journal-platform-legacy-owner";
const ASSET_CATALOG_VERSION = 3;
const RESULT_OPTIONS = ["TP", "SL", "Miss", "BE"];
const RULE_LABELS = {
  strategy: "Strategy rules",
  entry: "Entry criteria",
  indicator: "Indicator rules",
  protection: "Capital protection",
};
const PHASE_LABELS = {
  pre: "Pre-trade",
  in: "In-trade",
  post: "Post-trade",
};
const IDEA_DIRECTIONS = ["Long", "Short"];
const CONVICTION_OPTIONS = ["A", "B", "C"];
const IDEA_STATUS_LABELS = {
  watching: "Watching",
  triggered: "Triggered",
  taken: "Taken",
  invalidated: "Invalidated",
  expired: "Expired",
};

const defaultState = {
  assetCatalogVersion: ASSET_CATALOG_VERSION,
  strategies: [
    {
      id: "strategy-continuation",
      name: "HTF Continuation",
      style: "Intraday",
      timeframes: "4H bias, 15m execution",
      biasLogic: "Trade only in the direction of higher-timeframe displacement and structure.",
      enabled: true,
    },
    {
      id: "strategy-reversal",
      name: "Liquidity Reversal",
      style: "Session scalp",
      timeframes: "1H context, 5m trigger",
      biasLogic: "Wait for sweep, displacement, and retest into a refined point of interest.",
      enabled: true,
    },
  ],
  assets: buildDefaultAssets(),
  risk: {
    maxLosses: 2,
    maxWins: 3,
    maxTrades: 5,
  },
  rules: {
    strategy: [
      { id: "rule-strategy-1", text: "Trade only the active strategy profile.", enabled: true },
      { id: "rule-strategy-2", text: "Skip setups that do not match the defined bias logic.", enabled: true },
    ],
    entry: [
      { id: "rule-entry-1", text: "Point of interest tapped before entry.", enabled: true },
      { id: "rule-entry-2", text: "Clear invalidation level before risking capital.", enabled: true },
    ],
    indicator: [
      { id: "rule-indicator-1", text: "Momentum confirms direction on execution timeframe.", enabled: true },
    ],
    protection: [
      { id: "rule-protection-1", text: "Stop after daily loss limit is reached.", enabled: true },
      { id: "rule-protection-2", text: "No revenge trades after emotional flag.", enabled: true },
    ],
  },
  checklists: {
    pre: [
      { id: "check-pre-1", text: "Bias confirmed", mandatory: true, enabled: true },
      { id: "check-pre-2", text: "POI tapped", mandatory: true, enabled: true },
      { id: "check-pre-3", text: "HTF alignment present", mandatory: true, enabled: true },
    ],
    in: [
      { id: "check-in-1", text: "Stop loss fixed", mandatory: true, enabled: true },
      { id: "check-in-2", text: "No emotional management", mandatory: true, enabled: true },
      { id: "check-in-3", text: "Stacking only if original thesis remains valid", mandatory: false, enabled: true },
    ],
    post: [
      { id: "check-post-1", text: "Followed plan", mandatory: true, enabled: true },
      { id: "check-post-2", text: "Moved stop loss", mandatory: false, enabled: true },
      { id: "check-post-3", text: "Loss classified as planned or self-inflicted", mandatory: true, enabled: true },
    ],
  },
  trades: [],
  ideas: [],
  activeTrade: null,
  coolOffUntil: null,
  banner: "Protect discipline first. Payouts are a byproduct of clean execution.",
  preferences: { theme: "dark", currency: "USD", timezone: "local", compact: false },
  weeklyReviews: {},
};

let activeStorageKey = STORAGE_KEY;
let state = loadState(activeStorageKey);
let preChecks = {};
let liveInChecks = {};
let livePostChecks = {};
let assetSearchQuery = "";
let ideaAssetSearchQuery = "";
let ideaStatusFilter = "all";
let calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let currentAuthUser = null;
let cloudSyncTimer = null;
let cloudSyncReady = false;
let authFormMode = "signin";
let pendingVerificationEmail = "";
let currentProfile = null;
let tutorialStep = 0;

function buildDefaultAssets() {
  const fxSymbols = "EURUSD GBPUSD USDJPY USDCHF USDCAD AUDUSD NZDUSD EURGBP EURJPY EURCHF EURCAD EURAUD EURNZD GBPJPY GBPCHF GBPCAD GBPAUD GBPNZD AUDJPY AUDNZD AUDCAD AUDCHF NZDJPY NZDCAD NZDCHF CADJPY CADCHF CHFJPY USDZAR USDMXN USDTRY USDSEK USDNOK USDDKK USDPLN USDHUF USDCZK USDSGD USDHKD USDTHB USDCNH EURTRY EURZAR EURSEK EURNOK EURDKK EURPLN EURHUF EURCZK EURSGD GBPZAR GBPTRY GBPSEK GBPNOK GBPSGD AUDSGD SGDJPY";
  const cryptoBases = "BTC ETH SOL XRP BNB ADA DOGE AVAX LINK DOT LTC BCH UNI AAVE ATOM FIL ETC XLM HBAR NEAR ARB OP INJ TRX TON SUI APT SEI RENDER PEPE SHIB";
  const syntheticNames = "Volatility 10 Index|Volatility 25 Index|Volatility 50 Index|Volatility 75 Index|Volatility 100 Index|Volatility 10 (1s) Index|Volatility 15 (1s) Index|Volatility 25 (1s) Index|Volatility 30 (1s) Index|Volatility 50 (1s) Index|Volatility 75 (1s) Index|Volatility 90 (1s) Index|Volatility 100 (1s) Index|Volatility 150 (1s) Index|Volatility 250 (1s) Index|Boom 50 Index|Boom 100 Index|Boom 150 Index|Boom 200 Index|Boom 300 Index|Boom 500 Index|Boom 600 Index|Boom 900 Index|Boom 1000 Index|Crash 50 Index|Crash 100 Index|Crash 150 Index|Crash 200 Index|Crash 300 Index|Crash 500 Index|Crash 600 Index|Crash 900 Index|Crash 1000 Index|Jump 10 Index|Jump 25 Index|Jump 50 Index|Jump 75 Index|Jump 100 Index|Step Index|Step 0.1 Index|Step 0.2 Index|Step 0.3 Index|Step 0.4 Index|Step 0.5 Index|Range Break 100 Index|Range Break 200 Index|DEX 600UP Index|DEX 600DN Index|DEX 900UP Index|DEX 900DN Index|DEX 1500UP Index|DEX 1500DN Index|Volatility Switch 10 Index|Volatility Switch 50 Index|Volatility Switch 100 Index|Drift Switch 10 Index|Drift Switch 20 Index|Drift Switch 30 Index|Trek Up Index|Trek Down Index|Skew Step 80 Index|Skew Step 90 Index|Daily Reset Bull Index|Daily Reset Bear Index|Multi Step Index|Boom 300 Hybrid Index|Boom 500 Hybrid Index|Boom 1000 Hybrid Index|Crash 300 Hybrid Index|Crash 500 Hybrid Index|Crash 1000 Hybrid Index";

  const fx = fxSymbols.split(" ").map((symbol) => buildAsset("FX", symbol, `${symbol.slice(0, 3)} / ${symbol.slice(3)}`, true, false));
  const crypto = cryptoBases.split(" ").flatMap((base) => [
    buildAsset("Crypto", `${base}USD`, `${base} / USD`, true, true),
    buildAsset("Crypto", `${base}USDT`, `${base} / USDT`, true, true),
  ]);
  const synthetics = syntheticNames.split("|").map((name) => buildAsset("Synthetic Indices", name, syntheticGroupName(name), true, true));

  return [...fx, ...crypto, ...synthetics];
}

function syntheticGroupName(name) {
  if (name.includes("Volatility Switch")) return "Volatility Switch";
  if (name.includes("Volatility")) return "Volatility Index";
  if (name.includes("Boom")) return "Boom Index";
  if (name.includes("Crash")) return "Crash Index";
  if (name.includes("Jump")) return "Jump Index";
  if (name.includes("Step")) return "Step Index";
  if (name.includes("Range Break")) return "Range Break Index";
  if (name.includes("DEX")) return "DEX Index";
  if (name.includes("Drift")) return "Drift Switching Index";
  if (name.includes("Trek")) return "Trek Index";
  if (name.includes("Daily Reset")) return "Daily Reset Index";
  return "Synthetic Index";
}

function buildAsset(market, symbol, name, weekdays, weekends) {
  return {
    id: `asset-${symbol.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    market,
    symbol,
    name,
    weekdays,
    weekends,
    enabled: true,
  };
}

const views = {
  dashboard: document.getElementById("view-dashboard"),
  setups: document.getElementById("view-setups"),
  "new-trade": document.getElementById("view-new-trade"),
  live: document.getElementById("view-live"),
  journal: document.getElementById("view-journal"),
  settings: document.getElementById("view-settings"),
  account: document.getElementById("view-account"),
};

const viewTitles = {
  dashboard: "Dashboard",
  setups: "Trade Ideas",
  "new-trade": "New Trade",
  live: "Live Trade Tracker",
  journal: "Journal",
  settings: "Strategy & Rules Manager",
  account: "Account",
};

document.addEventListener("DOMContentLoaded", async () => {
  bindNavigation();
  bindForms();
  bindImportExport();
  bindAuth();
  applyPreferences();

  const user = await getAuthUser();
  if (user) {
    await enterApp(user);
  } else {
    showLogin();
  }

  onAuthChange((nextUser) => {
    if (!nextUser) {
      showLogin();
    } else if (document.getElementById("appShell").classList.contains("hidden")) {
      enterApp(nextUser);
    }
  });

  setInterval(renderLockout, 1000);
});

function bindAuth() {
  document.getElementById("loginForm").addEventListener("submit", handleLogin);
  document.getElementById("authModeBtn").addEventListener("click", toggleAuthMode);
  document.getElementById("authSwitchBtn").addEventListener("click", toggleAuthMode);
  document.getElementById("verifyCodeBtn").addEventListener("click", handleVerifyCode);
  document.getElementById("resendCodeBtn").addEventListener("click", handleResendCode);
  document.getElementById("accountDeleteBtn").addEventListener("click", handleDeleteAccount);
  document.getElementById("tutorialNextBtn").addEventListener("click", advanceTutorial);
  document.getElementById("tutorialSkipBtn").addEventListener("click", finishTutorial);
  document.getElementById("logoutBtn").addEventListener("click", handleLogout);
  document.getElementById("accountLogoutBtn").addEventListener("click", handleLogout);
  document.getElementById("accountExportBtn").addEventListener("click", () => document.getElementById("exportDataBtn").click());
}

async function handleLogin(event) {
  event.preventDefault();

  if (authFormMode === "signup") {
    await handleSignup();
    return;
  }

  const email = document.getElementById("loginUser").value.trim();
  const password = document.getElementById("loginPass").value;
  const message = document.getElementById("loginMessage");
  const button = document.getElementById("authSubmitBtn");

  message.textContent = "";
  button.disabled = true;
  button.textContent = "Signing in...";

  try {
    const user = await signIn(email, password);
    document.getElementById("loginPass").value = "";
    await enterApp(user);
  } catch (error) {
    message.textContent = error.message || "Unable to sign in.";
    document.getElementById("loginPass").value = "";
    document.getElementById("loginPass").focus();
  } finally {
    button.disabled = false;
    button.textContent = "Sign in";
  }
}

async function handleSignup() {
  const email = document.getElementById("loginUser").value.trim();
  const password = document.getElementById("loginPass").value;
  const confirmation = document.getElementById("loginConfirmPass").value;
  const fullName = document.getElementById("signupName").value.trim();
  const username = document.getElementById("signupUsername").value.trim();
  const message = document.getElementById("loginMessage");
  const button = document.getElementById("authSubmitBtn");

  if (!email || password.length < 6 || !fullName || !/^[A-Za-z0-9_]{3,24}$/.test(username)) {
    message.textContent = "Complete every field. Usernames use 3-24 letters, numbers, or underscores.";
    return;
  }

  if (password !== confirmation) {
    message.textContent = "Passwords do not match.";
    document.getElementById("loginConfirmPass").focus();
    return;
  }

  button.disabled = true;
  button.textContent = "Creating account...";
  message.textContent = "";

  try {
    const result = await signUp({ email, password, fullName, username });
    if (result.session && result.user) {
      await enterApp(result.user);
    } else {
      showVerification(email);
    }
  } catch (error) {
    message.textContent = error.message || "Unable to create the account.";
  } finally {
    button.disabled = false;
    button.textContent = authFormMode === "signup" ? "Create account" : "Sign in";
  }
}

function toggleAuthMode() {
  authFormMode = authFormMode === "signin" ? "signup" : "signin";
  updateAuthMode();
}

function updateAuthMode() {
  const signup = authFormMode === "signup";
  document.getElementById("signupFields").classList.toggle("hidden", !signup);
  document.getElementById("confirmPasswordField").classList.toggle("hidden", !signup);
  document.getElementById("passwordHint").classList.toggle("hidden", !signup);
  document.getElementById("loginConfirmPass").required = signup;
  document.getElementById("signupName").required = signup;
  document.getElementById("signupUsername").required = signup;
  document.getElementById("loginPass").autocomplete = signup ? "new-password" : "current-password";
  document.getElementById("authSubmitBtn").textContent = signup ? "Create account" : "Sign in";
  document.getElementById("authModeBtn").textContent = signup ? "Back to sign in" : "Create account";
  document.getElementById("authSwitchBtn").textContent = signup
    ? "Already have an account? Sign in"
    : "Need an account? Create one";
  document.getElementById("loginMessage").textContent = "";
}

async function handleLogout() {
  try {
    await signOut();
  } catch (error) {
    alert(error.message || "Unable to log out.");
    return;
  }
  currentAuthUser = null;
  showLogin();
}

async function enterApp(user) {
  currentAuthUser = user || currentAuthUser;
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appShell").classList.remove("hidden");
  await initializeCloudState(currentAuthUser);
  await loadCurrentProfile();
  hydrateSettingsForms();
  renderAll();
  await showFirstRunTutorial();
}

function showLogin() {
  document.getElementById("appShell").classList.add("hidden");
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("loginForm").classList.remove("hidden");
  document.getElementById("verificationPanel").classList.add("hidden");
  pendingVerificationEmail = "";
  document.getElementById("loginForm").reset();
  authFormMode = "signin";
  updateAuthMode();
  document.getElementById("loginMessage").textContent = "";
  document.getElementById("loginUser").focus();
}

function loadState(storageKey = activeStorageKey) {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return structuredClone(defaultState);
    const parsed = JSON.parse(saved);
    const merged = mergeState(structuredClone(defaultState), parsed);
    if (Number(parsed.assetCatalogVersion || 0) < ASSET_CATALOG_VERSION) {
      localStorage.setItem(storageKey, JSON.stringify(merged));
    }
    return merged;
  } catch {
    return structuredClone(defaultState);
  }
}
function mergeState(base, saved) {
  const savedAssets = Array.isArray(saved.assets) ? saved.assets : base.assets;
  const savedAssetCatalogVersion = Number(saved.assetCatalogVersion || 0);
  const assets = upgradeAssetCatalog(savedAssets, savedAssetCatalogVersion, base.assets);

  return {
    ...base,
    ...saved,
    assetCatalogVersion: Math.max(savedAssetCatalogVersion, ASSET_CATALOG_VERSION),
    risk: { ...base.risk, ...(saved.risk || {}) },
    rules: { ...base.rules, ...(saved.rules || {}) },
    checklists: { ...base.checklists, ...(saved.checklists || {}) },
    preferences: { ...base.preferences, ...(saved.preferences || {}) },
    weeklyReviews: { ...base.weeklyReviews, ...(saved.weeklyReviews || {}) },
    strategies: Array.isArray(saved.strategies) ? saved.strategies : base.strategies,
    assets,
    trades: Array.isArray(saved.trades) ? saved.trades : base.trades,
    ideas: Array.isArray(saved.ideas) ? saved.ideas : base.ideas,
  };
}

function upgradeAssetCatalog(savedAssets, savedAssetCatalogVersion, baseAssets) {
  let assets = savedAssets.map((asset) => ({
    ...asset,
    market: asset.market === "Forex" ? "FX" : asset.market,
  }));

  if (savedAssetCatalogVersion < 3) {
    assets = assets.filter((asset) => asset.market !== "Stocks");
  }

  if (savedAssetCatalogVersion < ASSET_CATALOG_VERSION) {
    return mergeUniqueById(assets, baseAssets);
  }

  return assets;
}
function mergeUniqueById(primary, additions) {
  const merged = primary.map((item) => ({ ...item }));
  const existingIds = new Set(merged.map((item) => item.id));
  additions.forEach((item) => {
    if (!existingIds.has(item.id)) {
      merged.push({ ...item });
      existingIds.add(item.id);
    }
  });
  return merged;
}

function saveState() {
  localStorage.setItem(activeStorageKey, JSON.stringify(state));
  scheduleCloudSave();
}

function scheduleCloudSave() {
  if (!cloudSyncReady || !currentAuthUser?.id || currentAuthUser.id === "local-development-user") return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(async () => {
    try {
      await saveCloudState(currentAuthUser.id, state);
      setCloudStatus("Synced", "ok");
    } catch (error) {
      console.error("Cloud sync failed", error);
      setCloudStatus("Sync pending", "warn");
    }
  }, 700);
}

function setCloudStatus(label, tone = "") {
  const status = document.getElementById("cloudSyncStatus");
  if (!status) return;
  status.textContent = label;
  status.className = "pill" + (tone === "warn" ? " warn" : "");
}

async function initializeCloudState(user) {
  cloudSyncReady = false;
  if (!user?.id || user.id === "local-development-user") {
    activeStorageKey = STORAGE_KEY;
    state = loadState(activeStorageKey);
    cloudSyncReady = true;
    setCloudStatus("Local mode");
    return;
  }

  activeStorageKey = STORAGE_KEY + ":" + user.id;
  const existingUserCache = localStorage.getItem(activeStorageKey);
  const legacyOwner = localStorage.getItem(STORAGE_OWNER_KEY);
  let localCandidate = existingUserCache ? loadState(activeStorageKey) : structuredClone(defaultState);

  if (!existingUserCache && !legacyOwner) {
    localCandidate = loadState(STORAGE_KEY);
    localStorage.setItem(STORAGE_OWNER_KEY, user.id);
  }

  state = localCandidate;
  setCloudStatus("Connecting...");
  try {
    const cloud = await loadCloudState(user.id);
    if (cloud?.state) {
      state = mergeState(structuredClone(defaultState), cloud.state);
    } else {
      await saveCloudState(user.id, state);
    }
    localStorage.setItem(activeStorageKey, JSON.stringify(state));
    setCloudStatus("Synced", "ok");
  } catch (error) {
    console.error("Cloud initialization failed", error);
    localStorage.setItem(activeStorageKey, JSON.stringify(state));
    setCloudStatus("Sync pending", "warn");
  } finally {
    cloudSyncReady = true;
  }
}
function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isWeekend(date = new Date()) {
  return [0, 6].includes(date.getDay());
}

function formatMoney(value) {
  const number = Number(value) || 0;
  return number.toLocaleString(undefined, { style: "currency", currency: state.preferences?.currency || "USD" });
}

function formatNumber(value, decimals = 2) {
  return (Number(value) || 0).toFixed(decimals);
}

function getEnabledStrategies() {
  return state.strategies.filter((strategy) => strategy.enabled);
}

function getAvailableAssets() {
  const weekend = isWeekend();
  return state.assets.filter((asset) => asset.enabled && (weekend ? asset.weekends : asset.weekdays));
}

// Ideas are planned ahead of time, so they ignore the weekday/weekend restriction that
// getAvailableAssets() applies - you document an FX setup on Sunday to take it on Monday.
function getEnabledAssets() {
  return state.assets.filter((asset) => asset.enabled);
}

function getStrategy(id) {
  return state.strategies.find((strategy) => strategy.id === id);
}

function getAsset(id) {
  return state.assets.find((asset) => asset.id === id);
}

function getActiveChecklist(phase) {
  return (state.checklists[phase] || []).filter((item) => item.enabled);
}

function getIdea(id) {
  return state.ideas.find((idea) => idea.id === id);
}

function selectedValues(id) {
  return Array.from(document.getElementById(id).selectedOptions, (option) => option.value);
}

function setSelectedValues(id, values = []) {
  const selected = new Set(values);
  Array.from(document.getElementById(id).options).forEach((option) => {
    option.selected = selected.has(option.value);
  });
}

function enhanceChoiceButtons(root) {
  root.querySelectorAll(".analysis-grid select").forEach((select) => {
    let buttons = select.nextElementSibling;
    if (!buttons || !buttons.classList.contains("choice-buttons")) {
      buttons = document.createElement("div");
      buttons.className = "choice-buttons";
      buttons.innerHTML = Array.from(select.options, (option) => `<button type="button" data-choice-value="${escapeHtml(option.value)}" aria-pressed="false">${escapeHtml(option.textContent)}</button>`).join("");
      select.insertAdjacentElement("afterend", buttons);
      buttons.addEventListener("click", (event) => {
        const button = event.target.closest("button");
        if (!button) return;
        const option = Array.from(select.options).find((item) => item.value === button.dataset.choiceValue);
        if (select.multiple) option.selected = !option.selected;
        else select.value = option.value;
        const selected = new Set(Array.from(select.selectedOptions, (item) => item.value));
        buttons.querySelectorAll("button").forEach((item) => item.classList.toggle("active", selected.has(item.dataset.choiceValue)));
      });
    }
    const selected = new Set(Array.from(select.selectedOptions, (item) => item.value));
    buttons.querySelectorAll("button").forEach((item) => item.classList.toggle("active", selected.has(item.dataset.choiceValue)));
  });
}

function readTechnicalAnalysis(prefix) {
  return {
    marketBias: document.getElementById(`${prefix}MarketBias`).value,
    structure: document.getElementById(`${prefix}Structure`).value,
    valueAreas: selectedValues(`${prefix}ValueAreas`),
    priceAction: selectedValues(`${prefix}PriceAction`),
    rsi: document.getElementById(`${prefix}Rsi`).value,
    rsiDivergence: document.getElementById(`${prefix}RsiDivergence`).value,
    chartPattern: document.getElementById(`${prefix}ChartPattern`).value,
    candleConfirmation: document.getElementById(`${prefix}CandleConfirmation`).value.trim(),
    technicalThesis: document.getElementById(`${prefix}TechnicalThesis`).value.trim(),
  };
}

function writeTechnicalAnalysis(prefix, analysis = {}) {
  document.getElementById(`${prefix}MarketBias`).value = analysis.marketBias || "Neutral";
  document.getElementById(`${prefix}Structure`).value = analysis.structure || "Range";
  setSelectedValues(`${prefix}ValueAreas`, analysis.valueAreas);
  setSelectedValues(`${prefix}PriceAction`, analysis.priceAction);
  document.getElementById(`${prefix}Rsi`).value = analysis.rsi || "Neutral";
  document.getElementById(`${prefix}RsiDivergence`).value = analysis.rsiDivergence || "None";
  document.getElementById(`${prefix}ChartPattern`).value = analysis.chartPattern || "None";
  document.getElementById(`${prefix}CandleConfirmation`).value = analysis.candleConfirmation || "";
  document.getElementById(`${prefix}TechnicalThesis`).value = analysis.technicalThesis || "";
  enhanceChoiceButtons(document.getElementById(`${prefix}MarketBias`).closest(".technical-analysis"));
}

function technicalAnalysisDetails(analysis) {
  if (!analysis) return "";
  const items = [
    ["Market structure", [analysis.marketBias, analysis.structure].filter(Boolean).join(" / ")],
    ["Areas of value", (analysis.valueAreas || []).join(", ")],
    ["Price action", (analysis.priceAction || []).join(", ")],
    ["Technical confluence", [analysis.rsi ? `RSI ${analysis.rsi}` : "", analysis.rsiDivergence && analysis.rsiDivergence !== "None" ? `${analysis.rsiDivergence} divergence` : "", analysis.chartPattern && analysis.chartPattern !== "None" ? analysis.chartPattern : "", analysis.candleConfirmation].filter(Boolean).join("; ")],
    ["Technical thesis", analysis.technicalThesis],
  ];
  return items.filter(([, value]) => value).map(([label, value]) => `<div class="idea-detail"><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
}

// trade.ideaId is the only stored link. "Taken" and "Expired" are derived from it and from
// validUntil, so there is no idea-side state that can drift out of sync with the journal.
function effectiveIdeaStatus(idea) {
  const trades = state.trades.filter((trade) => trade.ideaId === idea.id);
  if (trades.length) return { key: "taken", trades };
  if (idea.status === "invalidated") return { key: "invalidated", trades: [] };
  if (idea.validUntil && idea.validUntil < todayKey()) return { key: "expired", trades: [] };
  return { key: idea.status === "triggered" ? "triggered" : "watching", trades: [] };
}

function ideaLabel(idea) {
  const asset = getAsset(idea.assetId);
  const created = new Date(idea.createdAt);
  const date = Number.isNaN(created.getTime()) ? "" : created.toLocaleDateString();
  return `${asset?.symbol || "Unknown"} ${idea.direction || ""} - ${date}`.replace(/\s+/g, " ").trim();
}

// R:R is only meaningful when all three levels exist and the stop is a real distance away.
function ideaRiskReward(idea) {
  const entry = Number(idea.entryPrice);
  const stop = Number(idea.stopLoss);
  const target = Number(idea.takeProfit);
  if (![idea.entryPrice, idea.stopLoss, idea.takeProfit].every((value) => value !== "" && value !== null && value !== undefined)) return null;
  if (![entry, stop, target].every(Number.isFinite)) return null;
  const risk = Math.abs(entry - stop);
  if (!risk) return null;
  return Math.abs(target - entry) / risk;
}

function safeUrl(value) {
  const url = String(value || "").trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

function getRiskUsage() {
  const today = todayKey();
  const closedToday = state.trades.filter((trade) => trade.openedAt?.slice(0, 10) === today);
  const activeToday = state.activeTrade && state.activeTrade.openedAt?.slice(0, 10) === today ? 1 : 0;
  return {
    losses: closedToday.filter((trade) => trade.result === "SL").length,
    wins: closedToday.filter((trade) => trade.result === "TP").length,
    total: closedToday.length + activeToday,
  };
}

function isRiskBlocked() {
  const usage = getRiskUsage();
  return (
    usage.losses >= Number(state.risk.maxLosses) ||
    usage.wins >= Number(state.risk.maxWins) ||
    usage.total >= Number(state.risk.maxTrades) ||
    isLockoutActive()
  );
}

function isLockoutActive() {
  return Boolean(state.coolOffUntil && new Date(state.coolOffUntil).getTime() > Date.now());
}

function bindNavigation() {
  document.getElementById("navTabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (!button) return;
    showView(button.dataset.view);
  });

  document.body.addEventListener("click", (event) => {
    const button = event.target.closest("[data-goto]");
    if (!button) return;
    showView(button.dataset.goto);
  });
}

function showView(name) {
  Object.entries(views).forEach(([viewName, element]) => {
    element.classList.toggle("active", viewName === name);
  });
  document.querySelectorAll(".nav-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === name);
  });
  document.getElementById("viewTitle").textContent = viewTitles[name] || "Dashboard";
  if (name === "new-trade") renderNewTradeForm();
  if (name === "live") renderLiveTrade();
  if (name === "setups") renderSetups();
  if (name === "dashboard") renderInsights();
  if (name === "account") renderAccount();
}


function renderAccount() {
  document.getElementById("accountUsername").textContent = currentProfile?.username ? "@" + currentProfile.username : currentAuthUser?.email || "Trader";
  document.getElementById("accountFullName").textContent = currentProfile?.full_name || currentAuthUser?.email || "Authenticated trader";
}
function bindForms() {
  document.getElementById("newTradeForm").addEventListener("submit", handleNewTrade);
  document.getElementById("startNewTradeBtn")?.addEventListener("click", () => { document.getElementById("newTradeEmpty")?.classList.add("hidden"); document.getElementById("newTradeForm")?.classList.remove("hidden"); });
  const assetSearch = document.getElementById("assetSearch");
  assetSearch.addEventListener("input", (event) => {
    assetSearchQuery = event.target.value;
    renderNewTradeForm();
  });
  assetSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      document.getElementById("tradeAsset").focus();
    }
  });
  document.getElementById("tradeAsset").addEventListener("change", renderNewTradeGate);

  const ideaAssetSearch = document.getElementById("ideaAssetSearch");
  ideaAssetSearch.addEventListener("input", (event) => {
    ideaAssetSearchQuery = event.target.value;
    renderSetupsForm();
  });
  ideaAssetSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      document.getElementById("ideaAsset").focus();
    }
  });
  document.getElementById("ideaForm").addEventListener("submit", handleIdeaSave);
  document.getElementById("startSetupBtn")?.addEventListener("click", () => { document.getElementById("setupEmpty")?.classList.add("hidden"); document.getElementById("ideaForm")?.classList.remove("hidden"); });          document.getElementById("newSetupBtn")?.addEventListener("click", () => { document.getElementById("ideaForm").classList.remove("hidden"); document.getElementById("ideaForm").scrollIntoView({ behavior: "smooth", block: "start" }); });
  document.getElementById("cancelIdeaEdit").addEventListener("click", resetIdeaForm);
  document.getElementById("strategyForm").addEventListener("submit", handleStrategySave);
  document.getElementById("assetForm").addEventListener("submit", handleAssetSave);
  document.getElementById("riskForm").addEventListener("submit", handleRiskSave);
  document.getElementById("ruleForm").addEventListener("submit", handleRuleSave);
  document.getElementById("checklistForm").addEventListener("submit", handleChecklistSave);
  document.getElementById("cancelStrategyEdit").addEventListener("click", resetStrategyForm);
  document.getElementById("cancelAssetEdit").addEventListener("click", resetAssetForm);
  document.getElementById("cancelRuleEdit").addEventListener("click", resetRuleForm);
  document.getElementById("cancelChecklistEdit").addEventListener("click", resetChecklistForm);
  document.getElementById("clearLockoutBtn").addEventListener("click", clearLockout);
  document.getElementById("clearClosedTradesBtn").addEventListener("click", clearClosedTrades);
  document.getElementById("calendarPrev").addEventListener("click", () => { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1); renderTradeCalendar(); });
  document.getElementById("calendarNext").addEventListener("click", () => { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1); renderTradeCalendar(); });
  document.getElementById("calendarToday").addEventListener("click", () => { calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1); renderTradeCalendar(); });
  document.getElementById("saveWeeklyFocus").addEventListener("click", saveWeeklyFocus);
  document.getElementById("preferencesForm").addEventListener("submit", handlePreferencesSave);
}

function bindImportExport() {
  document.getElementById("exportDataBtn").addEventListener("click", () => {
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `trading-journal-${todayKey()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  document.getElementById("importDataInput").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      state = mergeState(structuredClone(defaultState), imported);
      saveState();
      preChecks = {};
      liveInChecks = {};
      livePostChecks = {};
      hydrateSettingsForms();
      renderAll();
    } catch {
      alert("Import failed. Choose a valid journal JSON export.");
    } finally {
      event.target.value = "";
    }
  });
}

function renderAll() {
  renderBanner();
  renderLockout();
  renderChallenge();
  renderDashboard();
  renderSetups();
  renderNewTradeForm();
  renderLiveTrade();
  renderJournal();
  renderSettings();
  renderInsights();
  hydratePreferences();
  applyPreferences();
}

function renderBanner() {
  document.getElementById("disciplineBanner").textContent = state.banner;
}

function renderLockout() {
  const banner = document.getElementById("lockoutBanner");
  const text = document.getElementById("lockoutText");
  if (!isLockoutActive()) {
    if (state.coolOffUntil) {
      state.coolOffUntil = null;
      saveState();
    }
    banner.classList.add("hidden");
    renderNewTradeGate();
    return;
  }

  const remainingMs = new Date(state.coolOffUntil).getTime() - Date.now();
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  text.textContent = `${minutes}:${String(seconds).padStart(2, "0")} remaining before new trades unlock.`;
  banner.classList.remove("hidden");
  renderNewTradeGate();
}

function renderChallenge() {
  const count = state.trades.length;
  const progress = Math.min(100, count);
  document.getElementById("challengeProgress").style.width = `${progress}%`;
  document.getElementById("challengeText").textContent = `${count} / 100 closed`;
}

function renderDashboard() {
  const closed = state.trades;
  const total = closed.length;
  const compliant = closed.filter((trade) => trade.compliant).length;
  const wins = closed.filter((trade) => trade.result === "TP").length;
  const avgScore = total ? closed.reduce((sum, trade) => sum + Number(trade.score || 0), 0) / total : 0;
  const netR = closed.reduce((sum, trade) => sum + Number(trade.rRatio || 0), 0);
  const profit = closed.reduce((sum, trade) => sum + Number(trade.profit || 0), 0);

  document.getElementById("metricCompliance").textContent = total ? `${Math.round((compliant / total) * 100)}%` : "0%";
  document.getElementById("metricComplianceMeta").textContent = total ? `${compliant} of ${total} clean executions` : "No closed trades";
  document.getElementById("metricScore").textContent = avgScore.toFixed(1);
  document.getElementById("metricWinRate").textContent = total ? `${Math.round((wins / total) * 100)}%` : "0%";
  document.getElementById("metricWinMeta").textContent = total ? `${wins} TP results` : "TP vs closed trades";
  document.getElementById("metricNetR").textContent = `${netR >= 0 ? "" : "-"}${Math.abs(netR).toFixed(2)}R`;
  document.getElementById("metricProfitMeta").textContent = `${formatMoney(profit)} profit`;

  // Planned vs impulsive. Requires the linked setup to still exist, so a deleted or
  // partially-imported setup cannot inflate the number.
  const planned = closed.filter((trade) => trade.ideaId && getIdea(trade.ideaId)).length;
  const waiting = state.ideas.filter((idea) => ["watching", "triggered"].includes(effectiveIdeaStatus(idea).key)).length;
  document.getElementById("metricPlanned").textContent = total ? `${Math.round((planned / total) * 100)}%` : "0%";
  document.getElementById("metricPlannedMeta").textContent = !state.ideas.length
    ? "No setups documented"
    : total
      ? `${planned} of ${total} from setups - ${waiting} waiting`
      : `${waiting} setup${waiting === 1 ? "" : "s"} waiting`;

  renderRiskStatus();
  renderActiveTradeSummary();
  renderStrategyBreakdown();
}

function renderRiskStatus() {
  const usage = getRiskUsage();
  const rows = [
    { label: "Losses", current: usage.losses, max: Number(state.risk.maxLosses) },
    { label: "Wins", current: usage.wins, max: Number(state.risk.maxWins) },
    { label: "Total trades", current: usage.total, max: Number(state.risk.maxTrades) },
  ];
  document.getElementById("riskStatus").innerHTML = rows
    .map((row) => {
      const blocked = row.current >= row.max;
      const close = !blocked && row.max > 0 && row.current >= row.max - 1;
      const dotClass = blocked ? "stop" : close ? "warn" : "";
      const pillClass = blocked ? "stop" : close ? "warn" : "";
      return `
        <div class="risk-line">
          <span><i class="status-dot ${dotClass}"></i>${row.label}</span>
          <strong class="pill ${pillClass}">${row.current} / ${row.max}</strong>
        </div>
      `;
    })
    .join("");
}

function renderActiveTradeSummary() {
  const element = document.getElementById("activeTradeSummary");
  if (!state.activeTrade) {
    element.innerHTML = "<strong>No active trade</strong><span>Open a setup after the pre-trade gate is complete.</span>";
    return;
  }

  const asset = getAsset(state.activeTrade.assetId);
  const strategy = getStrategy(state.activeTrade.strategyId);
  element.innerHTML = `
    <strong>${asset?.symbol || "Unknown asset"} - ${strategy?.name || "Unknown strategy"}</strong>
    <span>Entry ${state.activeTrade.entryPrice} - SL ${state.activeTrade.stopLoss} - TP ${state.activeTrade.takeProfit}</span>
    <span>Opened ${new Date(state.activeTrade.openedAt).toLocaleString()}</span>
  `;
}

function renderStrategyBreakdown() {
  const container = document.getElementById("strategyBreakdown");
  if (!state.trades.length) {
    container.innerHTML = '<div class="empty-state"><strong>No strategy data yet</strong><span>Closed trades will populate performance by strategy and pair.</span></div>';
    return;
  }

  const groups = new Map();
  state.trades.forEach((trade) => {
    const strategy = getStrategy(trade.strategyId)?.name || "Unknown strategy";
    const asset = getAsset(trade.assetId)?.symbol || "Unknown asset";
    const key = `${strategy} - ${asset}`;
    const row = groups.get(key) || { total: 0, wins: 0, compliant: 0, r: 0 };
    row.total += 1;
    row.wins += trade.result === "TP" ? 1 : 0;
    row.compliant += trade.compliant ? 1 : 0;
    row.r += Number(trade.rRatio || 0);
    groups.set(key, row);
  });

  container.innerHTML = Array.from(groups.entries())
    .map(([name, row]) => {
      const winRate = Math.round((row.wins / row.total) * 100);
      const compliance = Math.round((row.compliant / row.total) * 100);
      return `
        <article class="breakdown-item">
          <strong>${escapeHtml(name)}</strong>
          <div class="bar" aria-hidden="true"><div style="width:${winRate}%"></div></div>
          <span>${winRate}% win rate - ${compliance}% compliant - ${row.r.toFixed(2)}R</span>
        </article>
      `;
    })
    .join("");
}

// Shared by the New Trade gate and the trade-idea form. Keeps the current selection when it
// survives the filter, otherwise falls back to the first match.
function renderAssetPicker(searchInput, assetSelect, assets, query) {
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? assets.filter((asset) => `${asset.symbol} ${asset.market} ${asset.name}`.toLowerCase().includes(needle))
    : assets;
  const selectedAssetId = assetSelect.value;

  if (searchInput.value !== query) searchInput.value = query;
  assetSelect.innerHTML = filtered.length
    ? filtered.map((asset) => `<option value="${asset.id}">${escapeHtml(asset.symbol)} - ${escapeHtml(asset.market)}</option>`).join("")
    : '<option value="">No matching instruments</option>';

  if (selectedAssetId && filtered.some((asset) => asset.id === selectedAssetId)) {
    assetSelect.value = selectedAssetId;
  } else if (filtered.length) {
    assetSelect.value = filtered[0].id;
  }
  return filtered;
}

function renderStrategyOptions(select) {
  const strategies = getEnabledStrategies();
  const selected = select.value;
  select.innerHTML = strategies.length
    ? strategies.map((strategy) => `<option value="${strategy.id}">${escapeHtml(strategy.name)}</option>`).join("")
    : '<option value="">No enabled strategies</option>';
  if (selected && strategies.some((strategy) => strategy.id === selected)) select.value = selected;
  return strategies;
}

function fillSelect(select, values) {
  const selected = select.value;
  select.innerHTML = values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  if (selected && values.includes(selected)) select.value = selected;
}

function renderSetups() {
  renderSetupsForm();
  renderIdeaFilters();
  renderIdeaList();
}

function renderSetupsForm() {
  renderStrategyOptions(document.getElementById("ideaStrategy"));
  fillSelect(document.getElementById("ideaDirection"), IDEA_DIRECTIONS);
  fillSelect(document.getElementById("ideaConviction"), CONVICTION_OPTIONS);
  renderAssetPicker(
    document.getElementById("ideaAssetSearch"),
    document.getElementById("ideaAsset"),
    getEnabledAssets(),
    ideaAssetSearchQuery,
  );
  enhanceChoiceButtons(document.getElementById("ideaForm"));
}

function renderIdeaFilters() {
  const counts = { all: state.ideas.length };
  Object.keys(IDEA_STATUS_LABELS).forEach((key) => {
    counts[key] = 0;
  });
  state.ideas.forEach((idea) => {
    const key = effectiveIdeaStatus(idea).key;
    counts[key] = (counts[key] || 0) + 1;
  });

  const chips = [["all", "All"], ...Object.entries(IDEA_STATUS_LABELS)];
  const container = document.getElementById("ideaFilters");
  container.innerHTML = chips
    .map(
      ([key, label]) => `
        <button type="button" class="filter-chip ${ideaStatusFilter === key ? "active" : ""}" data-idea-filter="${key}">
          ${label} <span>${counts[key] || 0}</span>
        </button>
      `,
    )
    .join("");

  container.querySelectorAll("[data-idea-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      ideaStatusFilter = button.dataset.ideaFilter;
      renderIdeaFilters();
      renderIdeaList();
    });
  });
}

function renderIdeaList() {
  const container = document.getElementById("ideaList");
  const ordered = state.ideas.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const visible = ideaStatusFilter === "all" ? ordered : ordered.filter((idea) => effectiveIdeaStatus(idea).key === ideaStatusFilter);

  if (!visible.length) {
    container.innerHTML = state.ideas.length
      ? '<div class="empty-state"><strong>Nothing in this view</strong><span>No documented setups match the selected status.</span></div>'
      : '<div class="empty-state"><strong>No setups yet</strong><span>Start with a clear plan, then connect it to the trade when you execute.</span><button class="primary-button" data-new-setup-empty type="button">+ New setup</button></div>';
    return;
  }

  container.innerHTML = visible.map(renderIdeaCard).join("");
  bindIdeaActions(container);  container.querySelector("[data-new-setup-empty]")?.addEventListener("click", () => document.getElementById("newSetupBtn")?.click());
}

function renderIdeaCard(idea) {
  const asset = getAsset(idea.assetId);
  const strategy = getStrategy(idea.strategyId);
  const status = effectiveIdeaStatus(idea);
  const isTaken = status.key === "taken";
  const direction = idea.direction === "Short" ? "Short" : "Long";
  const chartUrl = safeUrl(idea.chartUrl);
  const rr = ideaRiskReward(idea);

  const levels = [
    ["Entry", idea.entryPrice],
    ["Stop", idea.stopLoss],
    ["Target", idea.takeProfit],
  ].filter(([, value]) => value !== "" && value !== null && value !== undefined);

  // A taken setup is settled, and an invalidated one only offers a way back.
  const statusButtons = isTaken
    ? ""
    : idea.status === "invalidated"
      ? '<button class="secondary-button" data-idea-action="invalidate" type="button">Reactivate</button>'
      : `<button class="secondary-button" data-idea-action="trigger" type="button">${
          idea.status === "triggered" ? "Back to watching" : "Mark triggered"
        }</button>
         <button class="secondary-button" data-idea-action="invalidate" type="button">Invalidate</button>`;

  const detail = (label, value) =>
    value ? `<div class="idea-detail"><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>` : "";

  const meta = [
    idea.conviction ? `Conviction ${escapeHtml(idea.conviction)}` : "",
    idea.timeframe ? escapeHtml(idea.timeframe) : "",
    idea.validUntil ? `Valid until ${escapeHtml(idea.validUntil)}` : "",
    `Logged ${new Date(idea.createdAt).toLocaleDateString()}`,
  ].filter(Boolean);

  const takenLine = isTaken
    ? `<p class="idea-taken">Taken as ${status.trades
        .map((trade) => `#${trade.number} (${escapeHtml(trade.result || "?")}, ${formatNumber(trade.rRatio)}R)`)
        .join(", ")}</p>`
    : "";

  return `
    <article class="idea-card" data-idea-id="${idea.id}">
      <div class="idea-card-head">
        <div>
          <strong>
            ${escapeHtml(asset?.symbol || "Unknown asset")}
            <span class="direction-badge ${direction.toLowerCase()}">${direction}</span>
          </strong>
          <p>${escapeHtml(strategy?.name || "Unknown strategy")}</p>
        </div>
        <span class="pill ${ideaStatusPill(status.key)}">${IDEA_STATUS_LABELS[status.key]}</span>
      </div>

      ${
        levels.length
          ? `<div class="idea-levels">
               ${levels.map(([label, value]) => `<span><small>${label}</small>${escapeHtml(String(value))}</span>`).join("")}
               ${rr === null ? "" : `<span><small>R:R</small>${formatNumber(rr)}</span>`}
             </div>`
          : '<p class="idea-zone-note">No exact levels yet - zone idea.</p>'
      }

      <dl class="idea-details">
        ${detail("Trigger", idea.trigger)}
        ${detail("Invalidation", idea.invalidation)}
        ${technicalAnalysisDetails(idea.technicalAnalysis)}
        ${detail("Notes", idea.notes)}
      </dl>

      <p class="idea-meta">${meta.join(" - ")}${
        chartUrl ? ` - <a href="${escapeHtml(chartUrl)}" target="_blank" rel="noopener noreferrer">Chart</a>` : ""
      }</p>
      ${takenLine}

      <div class="item-actions idea-actions">
        ${statusButtons}
        <button class="icon-button" data-idea-action="edit" type="button" title="Edit" aria-label="Edit setup">Ed</button>
        <button class="icon-button danger" data-idea-action="delete" type="button" title="Delete" aria-label="Delete setup">X</button>
      </div>
    </article>
  `;
}

function ideaStatusPill(key) {
  if (key === "triggered") return "warn";
  if (key === "invalidated") return "stop";
  if (key === "expired") return "muted";
  if (key === "watching") return "info";
  return "";
}

function bindIdeaActions(root) {
  root.querySelectorAll("[data-idea-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const card = event.target.closest("[data-idea-id]");
      handleIdeaAction(card.dataset.ideaId, button.dataset.ideaAction);
    });
  });
}

function handleIdeaAction(id, action) {
  const idea = getIdea(id);
  if (!idea) return;

  if (action === "edit") {
    loadIdeaIntoForm(idea);
    return;
  }

  if (action === "trigger") {
    idea.status = idea.status === "triggered" ? "watching" : "triggered";
  } else if (action === "invalidate") {
    idea.status = idea.status === "invalidated" ? "watching" : "invalidated";
  } else if (action === "delete") {
    const linked = state.trades.filter((trade) => trade.ideaId === id);
    const warning = linked.length
      ? `Delete this setup? ${linked.length} journal trade(s) linked to it will be marked as impulse instead.`
      : "Delete this documented setup?";
    if (!confirm(warning)) return;
    // Clear the link so no trade points at a setup that no longer exists.
    linked.forEach((trade) => {
      delete trade.ideaId;
    });
    state.ideas = state.ideas.filter((item) => item.id !== id);
    if (document.getElementById("ideaId").value === id) resetIdeaForm();
  }

  saveState();
  renderAll();
}

function loadIdeaIntoForm(idea) {
  const asset = getAsset(idea.assetId);
  // Filter the picker to this symbol first, otherwise the option may not exist to select.
  ideaAssetSearchQuery = asset ? asset.symbol : "";
  renderSetupsForm();

  document.getElementById("ideaId").value = idea.id;
  document.getElementById("ideaAsset").value = idea.assetId;
  document.getElementById("ideaStrategy").value = idea.strategyId;
  document.getElementById("ideaDirection").value = idea.direction === "Short" ? "Short" : "Long";
  document.getElementById("ideaConviction").value = idea.conviction || "B";
  document.getElementById("ideaTimeframe").value = idea.timeframe || "";
  document.getElementById("ideaEntry").value = idea.entryPrice ?? "";
  document.getElementById("ideaStop").value = idea.stopLoss ?? "";
  document.getElementById("ideaTarget").value = idea.takeProfit ?? "";
  document.getElementById("ideaValidUntil").value = idea.validUntil || "";
  document.getElementById("ideaChartUrl").value = idea.chartUrl || "";
  document.getElementById("ideaTrigger").value = idea.trigger || "";
  document.getElementById("ideaInvalidation").value = idea.invalidation || "";
  document.getElementById("ideaNotes").value = idea.notes || "";
  writeTechnicalAnalysis("idea", idea.technicalAnalysis);
  document.getElementById("ideaFormMode").textContent = "Editing setup";
  document.getElementById("ideaFormMessage").textContent = "";
  document.getElementById("ideaForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

function handleIdeaSave(event) {
  event.preventDefault();
  const message = document.getElementById("ideaFormMessage");
  const id = document.getElementById("ideaId").value;
  const assetId = document.getElementById("ideaAsset").value;
  const strategyId = document.getElementById("ideaStrategy").value;

  if (!assetId || !strategyId) {
    message.textContent = "Pick an instrument and an enabled strategy profile first.";
    return;
  }

  const existing = id ? getIdea(id) : null;
  const payload = {
    id: existing ? existing.id : uid("idea"),
    createdAt: existing ? existing.createdAt : new Date().toISOString(),
    assetId,
    strategyId,
    direction: document.getElementById("ideaDirection").value || IDEA_DIRECTIONS[0],
    conviction: document.getElementById("ideaConviction").value || CONVICTION_OPTIONS[1],
    timeframe: document.getElementById("ideaTimeframe").value.trim(),
    entryPrice: document.getElementById("ideaEntry").value,
    stopLoss: document.getElementById("ideaStop").value,
    takeProfit: document.getElementById("ideaTarget").value,
    validUntil: document.getElementById("ideaValidUntil").value,
    chartUrl: document.getElementById("ideaChartUrl").value.trim(),
    trigger: document.getElementById("ideaTrigger").value.trim(),
    invalidation: document.getElementById("ideaInvalidation").value.trim(),
    notes: document.getElementById("ideaNotes").value.trim(),
    technicalAnalysis: readTechnicalAnalysis("idea"),
    status: existing ? existing.status : "watching",
  };

  if (existing) {
    Object.assign(existing, payload);
  } else {
    state.ideas.push(payload);
  }

  saveState();
  resetIdeaForm();
  renderAll();
  document.getElementById("ideaFormMessage").textContent = existing ? "Setup updated." : "Setup documented.";
}

function resetIdeaForm() {
  document.getElementById("ideaForm").reset();
  document.getElementById("ideaId").value = "";
  document.getElementById("ideaFormMode").textContent = "New setup";
  document.getElementById("ideaFormMessage").textContent = "";
  ideaAssetSearchQuery = "";
  renderSetupsForm();
}

// Options for "which documented setup did this trade come from?". Same-instrument setups are
// listed first so the relevant one is at the top of a long list.
function ideaOptionsHtml(assetId, selectedId) {
  const usable = state.ideas.filter((idea) => idea.status !== "invalidated" || idea.id === selectedId);
  const sorted = [
    ...usable.filter((idea) => idea.assetId === assetId),
    ...usable.filter((idea) => idea.assetId !== assetId),
  ];

  return [`<option value="">- impulse (no setup) -</option>`]
    .concat(
      sorted.map((idea) => {
        const key = effectiveIdeaStatus(idea).key;
        const suffix = key === "expired" ? " (expired)" : key === "taken" ? " (taken)" : "";
        const selected = idea.id === selectedId ? " selected" : "";
        return `<option value="${idea.id}"${selected}>${escapeHtml(ideaLabel(idea))}${suffix}</option>`;
      }),
    )
    .join("");
}

function renderNewTradeForm() {
  renderStrategyOptions(document.getElementById("tradeStrategy"));
  renderAssetPicker(
    document.getElementById("assetSearch"),
    document.getElementById("tradeAsset"),
    getAvailableAssets(),
    assetSearchQuery,
  );
  enhanceChoiceButtons(document.getElementById("newTradeForm"));

  const ideaSelect = document.getElementById("tradeIdeaId");
  const selectedIdeaId = ideaSelect.value;
  ideaSelect.innerHTML = ideaOptionsHtml(document.getElementById("tradeAsset").value, selectedIdeaId);
  ideaSelect.value = selectedIdeaId;
  updateTradeAnalysisVisibility();
  ideaSelect.onchange = updateTradeAnalysisVisibility;

  const checklist = getActiveChecklist("pre");
  document.getElementById("preTradeChecklist").innerHTML = checklist.length
    ? checklist
        .map((item) => {
          const checked = preChecks[item.id] ? "checked" : "";
          return `
            <div class="checklist-item">
              <input id="pre-${item.id}" data-pre-id="${item.id}" type="checkbox" ${checked} />
              <label for="pre-${item.id}">
                ${escapeHtml(item.text)}
                ${item.mandatory ? "<small>Mandatory</small>" : "<small>Optional</small>"}
              </label>
            </div>
          `;
        })
        .join("")
    : '<div class="empty-state"><strong>No pre-trade checks configured</strong><span>Add checklist items in settings.</span></div>';

  document.querySelectorAll("[data-pre-id]").forEach((input) => {
    input.addEventListener("change", (event) => {
      preChecks[event.target.dataset.preId] = event.target.checked;
      renderNewTradeGate();
    });
  });

  renderNewTradeGate();
}

function updateTradeAnalysisVisibility() {
  const linked = Boolean(document.getElementById("tradeIdeaId").value);
  document.getElementById("tradeAnalysisSection").hidden = linked;
  document.getElementById("tradeUpdateField").hidden = !linked;
}

function renderNewTradeGate() {
  const checklist = getActiveChecklist("pre");
  const mandatory = checklist.filter((item) => item.mandatory);
  const completedMandatory = mandatory.filter((item) => preChecks[item.id]).length;
  const completedTotal = checklist.filter((item) => preChecks[item.id]).length;
  const status = document.getElementById("preChecklistStatus");
  const message = document.getElementById("newTradeMessage");
  const button = document.getElementById("openTradeBtn");
  const hasStrategy = getEnabledStrategies().length > 0;
  const hasAsset = getAvailableAssets().length > 0;
  const hasSelectedAsset = Boolean(document.getElementById("tradeAsset").value);
  const riskBlocked = isRiskBlocked();
  const hasActive = Boolean(state.activeTrade);
  const ready = mandatory.length === completedMandatory && hasStrategy && hasAsset && hasSelectedAsset && !riskBlocked && !hasActive;

  status.textContent = `${completedTotal} / ${checklist.length}`;
  status.classList.toggle("warn", mandatory.length !== completedMandatory);
  button.disabled = !ready;

  if (hasActive) {
    message.textContent = "Close the active trade before opening another.";
  } else if (isLockoutActive()) {
    message.textContent = "Cool-off is active.";
  } else if (riskBlocked) {
    message.textContent = "A daily risk limit has been reached.";
  } else if (!hasStrategy) {
    message.textContent = "Enable or create a strategy profile first.";
  } else if (!hasAsset) {
    message.textContent = "No enabled instruments are available today.";
  } else if (!hasSelectedAsset) {
    message.textContent = "Select an instrument from the list.";
  } else if (mandatory.length !== completedMandatory) {
    message.textContent = "Complete all mandatory pre-trade checks.";
  } else {
    message.textContent = "Setup cleared for logging.";
  }
}

function handleNewTrade(event) {
  event.preventDefault();
  if (isRiskBlocked() || state.activeTrade) {
    renderNewTradeGate();
    return;
  }

  const checklist = getActiveChecklist("pre");
  const mandatoryReady = checklist.filter((item) => item.mandatory).every((item) => preChecks[item.id]);
  if (!mandatoryReady) {
    renderNewTradeGate();
    return;
  }

  const assetId = document.getElementById("tradeAsset").value;
  const strategyId = document.getElementById("tradeStrategy").value;
  if (!assetId || !strategyId) {
    renderNewTradeGate();
    return;
  }

  state.activeTrade = {
    id: uid("trade"),
    openedAt: new Date().toISOString(),
    strategyId,
    assetId,
    entryPrice: document.getElementById("entryPrice").value,
    stopLoss: document.getElementById("stopLoss").value,
    takeProfit: document.getElementById("takeProfit").value,
    positionSize: document.getElementById("positionSize").value,
    ideaId: document.getElementById("tradeIdeaId").value,
    technicalAnalysis: document.getElementById("tradeIdeaId").value ? null : readTechnicalAnalysis("trade"),
    duringTradeUpdate: document.getElementById("tradeDuringUpdate").value.trim(),
    preChecklist: Object.fromEntries(checklist.map((item) => [item.id, Boolean(preChecks[item.id])])),
  };

  preChecks = {};
  event.target.reset();
  saveState();
  renderAll();
  showView("live");
}

function renderLiveTrade() {
  const panel = document.getElementById("liveTradePanel");
  if (!state.activeTrade) {
    panel.innerHTML = `
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Tracker</p>
          <h3>No live position</h3>
        </div>
      </div>
      <div class="empty-state">
        <strong>Nothing is active right now</strong>
        <span>Use the new trade gate to start a tracked execution.</span>
      </div>
    `;
    return;
  }

  const trade = state.activeTrade;
  const asset = getAsset(trade.assetId);
  const strategy = getStrategy(trade.strategyId);
  const inChecklist = getActiveChecklist("in");
  const postChecklist = getActiveChecklist("post");

  panel.innerHTML = `
    <div class="panel-heading">
      <div>
        <p class="eyebrow">Tracker</p>
        <h3>${escapeHtml(asset?.symbol || "Unknown asset")} - ${escapeHtml(strategy?.name || "Unknown strategy")}</h3>
      </div>
      <span class="pill">Active</span>
    </div>

    <div class="live-grid">
      <div>
        <div class="trade-facts">
          ${factRow("Opened", new Date(trade.openedAt).toLocaleString())}
          ${factRow("Market", asset ? `${asset.market} - ${asset.name}` : "Unknown")}
          ${factRow("Entry", trade.entryPrice)}
          ${factRow("Stop loss", trade.stopLoss)}
          ${factRow("Take profit", trade.takeProfit)}
          ${factRow("Position size", trade.positionSize)}
        </div>

        <div class="cooloff-controls">
          <input id="cooloffMinutes" type="number" min="1" step="1" value="30" aria-label="Cool-off minutes" />
          <button class="secondary-button" id="startCooloffBtn" type="button">Start Cool-Off</button>
        </div>

        <div class="checklist-heading" style="margin-top:18px">
          <div>
            <p class="eyebrow">Manage</p>
            <h3>In-trade checklist</h3>
          </div>
        </div>
        <div class="checklist" id="liveInChecklist">
          ${renderRuntimeChecklist(inChecklist, liveInChecks, "in")}
        </div>
      </div>

      <form class="close-trade-form" id="closeTradeForm">
        <label>
          Documented setup
          <select id="closeIdeaId">${ideaOptionsHtml(trade.assetId, trade.ideaId || "")}</select>
        </label>
        <label>
          Result
          <select id="closeResult" required>${RESULT_OPTIONS.map((option) => `<option>${option}</option>`).join("")}</select>
        </label>
        <label>
          Execution score
          <input id="closeScore" type="range" min="1" max="10" step="1" value="8" />
          <span class="pill" id="scoreReadout">8 / 10</span>
        </label>
        <label class="checkbox-label">
          <input id="closeCompliant" type="checkbox" checked />
          Rule compliant
        </label>
        <div class="form-grid">
          <label>
            R-ratio
            <input id="closeR" type="number" step="0.01" value="1" required />
          </label>
          <label>
            Profit / loss
            <input id="closeProfit" type="number" step="0.01" value="0" required />
          </label>
        </div>
        <div>
          <div class="checklist-heading">
            <div>
              <p class="eyebrow">Review</p>
              <h3>Post-trade checklist</h3>
            </div>
          </div>
          <div class="checklist" id="livePostChecklist">
            ${renderRuntimeChecklist(postChecklist, livePostChecks, "post")}
          </div>
        </div>
        <label>
          Post-trade notes
          <textarea id="closeNotes" rows="4" placeholder="What happened? What will be repeated or corrected?"></textarea>
        </label>
        <div class="screenshot-fields">
          <label>
            Before-entry chart
            <input id="closeBeforeImage" type="file" accept="image/png,image/jpeg,image/webp" />
          </label>
          <label>
            After-exit chart
            <input id="closeAfterImage" type="file" accept="image/png,image/jpeg,image/webp" />
          </label>
        </div>
        <p class="upload-hint">PNG, JPEG, or WebP. Keep each image under 1.5 MB.</p>
        <div class="form-actions">
          <button class="secondary-button danger-text" id="discardActiveTradeBtn" type="button">Discard</button>
          <button class="primary-button" type="submit">Close to Journal</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById("startCooloffBtn").addEventListener("click", () => {
    const minutes = Number(document.getElementById("cooloffMinutes").value) || 30;
    state.coolOffUntil = new Date(Date.now() + minutes * 60000).toISOString();
    saveState();
    renderLockout();
  });

  document.getElementById("closeScore").addEventListener("input", (event) => {
    document.getElementById("scoreReadout").textContent = `${event.target.value} / 10`;
  });

  document.querySelectorAll("[data-live-check]").forEach((input) => {
    input.addEventListener("change", (event) => {
      const { phase, id } = event.target.dataset;
      const target = phase === "in" ? liveInChecks : livePostChecks;
      target[id] = event.target.checked;
    });
  });

  document.getElementById("discardActiveTradeBtn").addEventListener("click", () => {
    if (!confirm("Discard the active trade without journaling it?")) return;
    state.activeTrade = null;
    liveInChecks = {};
    livePostChecks = {};
    saveState();
    renderAll();
  });

  document.getElementById("closeTradeForm").addEventListener("submit", handleCloseTrade);
}

function factRow(label, value) {
  return `<div class="trade-fact"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function renderRuntimeChecklist(items, checks, phase) {
  if (!items.length) {
    return '<div class="empty-state"><strong>No checklist items configured</strong><span>Add items in settings.</span></div>';
  }

  return items
    .map((item) => {
      const checked = checks[item.id] ? "checked" : "";
      return `
        <div class="checklist-item">
          <input id="${phase}-${item.id}" data-live-check data-phase="${phase}" data-id="${item.id}" type="checkbox" ${checked} />
          <label for="${phase}-${item.id}">
            ${escapeHtml(item.text)}
            ${item.mandatory ? "<small>Mandatory</small>" : "<small>Optional</small>"}
          </label>
        </div>
      `;
    })
    .join("");
}

async function handleCloseTrade(event) {
  event.preventDefault();
  const active = state.activeTrade;
  if (!active) return;

  let beforeImage = "";
  let afterImage = "";
  try {
    [beforeImage, afterImage] = await Promise.all([
      imageFileToDataUrl(document.getElementById("closeBeforeImage")),
      imageFileToDataUrl(document.getElementById("closeAfterImage")),
    ]);
  } catch (error) {
    alert(error.message);
    return;
  }

  const trade = {
    ...active,
    number: nextTradeNumber(),
    closedAt: new Date().toISOString(),
    ideaId: document.getElementById("closeIdeaId").value,
    result: document.getElementById("closeResult").value,
    score: Number(document.getElementById("closeScore").value),
    compliant: document.getElementById("closeCompliant").checked,
    rRatio: Number(document.getElementById("closeR").value),
    profit: Number(document.getElementById("closeProfit").value),
    notes: document.getElementById("closeNotes").value.trim(),
    beforeImage,
    afterImage,
    inChecklist: Object.fromEntries(getActiveChecklist("in").map((item) => [item.id, Boolean(liveInChecks[item.id])])),
    postChecklist: Object.fromEntries(getActiveChecklist("post").map((item) => [item.id, Boolean(livePostChecks[item.id])])),
  };

  state.trades.push(trade);
  state.activeTrade = null;
  liveInChecks = {};
  livePostChecks = {};
  saveState();
  renderAll();
  showView("journal");
}

function nextTradeNumber() {
  const highest = state.trades.reduce((max, trade) => Math.max(max, Number(trade.number || 0)), 0);
  return highest + 1;
}

function renderJournal() {
  const body = document.getElementById("journalBody");
  if (!state.trades.length) {
    body.innerHTML = '<tr><td class="no-rows" colspan="10">No closed trades yet.</td></tr>';
    return;
  }

  body.innerHTML = state.trades
    .slice()
    .sort((a, b) => Number(a.number) - Number(b.number))
    .map((trade) => {
      const asset = getAsset(trade.assetId);
      const strategy = getStrategy(trade.strategyId);
      return `
        <tr data-trade-id="${trade.id}">
          <td>
            <strong>#${trade.number}</strong><br />
            <small>${new Date(trade.openedAt).toLocaleDateString()}</small>
          </td>
          <td>${escapeHtml(asset?.symbol || "Unknown")}</td>
          <td>${escapeHtml(strategy?.name || "Unknown")}</td>
          <td>
            <select data-field="ideaId" aria-label="Linked setup">${ideaOptionsHtml(trade.assetId, trade.ideaId || "")}</select>
          </td>
          <td>
            <select data-field="result">
              ${RESULT_OPTIONS.map((option) => `<option ${trade.result === option ? "selected" : ""}>${option}</option>`).join("")}
            </select>
          </td>
          <td>
            <input data-field="score" type="number" min="1" max="10" step="1" value="${Number(trade.score || 1)}" />
          </td>
          <td>
            <label class="checkbox-label">
              <input data-field="compliant" type="checkbox" ${trade.compliant ? "checked" : ""} />
              Yes
            </label>
          </td>
          <td>
            <div class="rr-profit">
              <input data-field="rRatio" type="number" step="0.01" value="${Number(trade.rRatio || 0)}" aria-label="R-ratio" />
              <input data-field="profit" type="number" step="0.01" value="${Number(trade.profit || 0)}" aria-label="Profit" />
            </div>
          </td>
          <td>${tradeShotsHtml(trade)}</td>
          <td>
            <textarea data-field="notes" rows="2">${escapeHtml(trade.notes || "")}</textarea>
          </td>
        </tr>
      `;
    })
    .join("");

  body.querySelectorAll("[data-field]").forEach((input) => {
    input.addEventListener("change", handleJournalEdit);
  });
}

function handleJournalEdit(event) {
  const row = event.target.closest("[data-trade-id]");
  const trade = state.trades.find((item) => item.id === row.dataset.tradeId);
  if (!trade) return;
  const field = event.target.dataset.field;

  if (field === "compliant") {
    trade[field] = event.target.checked;
  } else if (["score", "rRatio", "profit"].includes(field)) {
    trade[field] = Number(event.target.value);
  } else {
    trade[field] = event.target.value;
  }

  saveState();
  renderDashboard();
  // A setup's status is derived from trade.ideaId, so relinking changes the watchlist. The
  // journal table is deliberately not re-rendered - that would drop focus mid-edit.
  if (field === "ideaId") {
    renderIdeaFilters();
    renderIdeaList();
  }
}

function clearClosedTrades() {
  if (!state.trades.length) return;
  if (!confirm("Clear all closed journal trades? Settings and active trade will remain.")) return;
  state.trades = [];
  saveState();
  renderAll();
}

function hydrateSettingsForms() {
  document.getElementById("maxLosses").value = state.risk.maxLosses;
  document.getElementById("maxWins").value = state.risk.maxWins;
  document.getElementById("maxTrades").value = state.risk.maxTrades;
  document.getElementById("bannerText").value = state.banner;
}

function renderSettings() {
  renderStrategies();
  renderAssets();
  renderRules();
  renderChecklistSettings();
}

function renderStrategies() {
  const list = document.getElementById("strategyList");
  list.innerHTML = state.strategies
    .map((strategy) =>
      renderListItem({
        id: strategy.id,
        type: "strategy",
        title: strategy.name,
        meta: `${strategy.style} - ${strategy.timeframes}`,
        enabled: strategy.enabled,
      }),
    )
    .join("");
  bindListActions(list);
}

function renderAssets() {
  const list = document.getElementById("assetList");
  list.innerHTML = state.assets
    .map((asset) =>
      renderListItem({
        id: asset.id,
        type: "asset",
        title: `${asset.symbol} - ${asset.market}`,
        meta: `${asset.weekdays ? "Weekdays" : "No weekdays"} - ${asset.weekends ? "Weekends" : "No weekends"}`,
        enabled: asset.enabled,
      }),
    )
    .join("");
  bindListActions(list);
}

function renderRules() {
  const container = document.getElementById("ruleLists");
  container.innerHTML = Object.entries(RULE_LABELS)
    .map(([category, label]) => {
      const items = state.rules[category] || [];
      return `
        <section class="rule-column">
          <h4>${label}</h4>
          ${items.length ? items.map((rule) => renderListItem({ id: rule.id, type: `rule:${category}`, title: rule.text, meta: rule.enabled ? "Enabled" : "Disabled", enabled: rule.enabled })).join("") : '<div class="empty-state">No rules yet.</div>'}
        </section>
      `;
    })
    .join("");
  bindListActions(container);
}

function renderChecklistSettings() {
  const container = document.getElementById("checklistLists");
  container.innerHTML = Object.entries(PHASE_LABELS)
    .map(([phase, label]) => {
      const items = state.checklists[phase] || [];
      return `
        <section class="checklist-column">
          <h4>${label}</h4>
          ${items.length ? items.map((item) => renderListItem({ id: item.id, type: `checklist:${phase}`, title: item.text, meta: `${item.mandatory ? "Mandatory" : "Optional"} - ${item.enabled ? "Enabled" : "Disabled"}`, enabled: item.enabled })).join("") : '<div class="empty-state">No checklist items yet.</div>'}
        </section>
      `;
    })
    .join("");
  bindListActions(container);
}

function renderListItem({ id, type, title, meta, enabled }) {
  return `
    <article class="list-item ${enabled ? "" : "disabled"}" data-id="${id}" data-type="${type}">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(meta || "")}</p>
      </div>
      <div class="item-actions">
        <button class="icon-button toggle-item" type="button" title="Toggle enabled" aria-label="Toggle enabled">${enabled ? "On" : "Off"}</button>
        <button class="icon-button edit-item" type="button" title="Edit" aria-label="Edit">Ed</button>
        <button class="icon-button delete-item danger" type="button" title="Delete" aria-label="Delete">X</button>
      </div>
    </article>
  `;
}

function bindListActions(root) {
  root.querySelectorAll(".toggle-item").forEach((button) => {
    button.addEventListener("click", (event) => handleListAction(event, "toggle"));
  });
  root.querySelectorAll(".edit-item").forEach((button) => {
    button.addEventListener("click", (event) => handleListAction(event, "edit"));
  });
  root.querySelectorAll(".delete-item").forEach((button) => {
    button.addEventListener("click", (event) => handleListAction(event, "delete"));
  });
}

function handleListAction(event, action) {
  const item = event.target.closest("[data-id]");
  const { id, type } = item.dataset;
  const [kind, subtype] = type.split(":");

  if (kind === "strategy") return handleStrategyAction(id, action);
  if (kind === "asset") return handleAssetAction(id, action);
  if (kind === "rule") return handleRuleAction(subtype, id, action);
  if (kind === "checklist") return handleChecklistAction(subtype, id, action);
}

function handleStrategySave(event) {
  event.preventDefault();
  const id = document.getElementById("strategyId").value;
  const payload = {
    id: id || uid("strategy"),
    name: document.getElementById("strategyName").value.trim(),
    style: document.getElementById("strategyStyle").value.trim(),
    timeframes: document.getElementById("strategyTimeframes").value.trim(),
    biasLogic: document.getElementById("strategyBias").value.trim(),
    enabled: true,
  };

  const existing = id ? state.strategies.find((strategy) => strategy.id === id) : null;
  if (existing) {
    Object.assign(existing, payload, { enabled: existing.enabled });
  } else {
    state.strategies.push(payload);
  }

  saveState();
  resetStrategyForm();
  renderAll();
}

function handleStrategyAction(id, action) {
  const strategy = state.strategies.find((item) => item.id === id);
  if (!strategy) return;

  if (action === "toggle") {
    strategy.enabled = !strategy.enabled;
  } else if (action === "edit") {
    document.getElementById("strategyId").value = strategy.id;
    document.getElementById("strategyName").value = strategy.name;
    document.getElementById("strategyStyle").value = strategy.style;
    document.getElementById("strategyTimeframes").value = strategy.timeframes;
    document.getElementById("strategyBias").value = strategy.biasLogic;
  } else if (action === "delete") {
    if (!confirm(`Delete strategy "${strategy.name}"? Existing journal rows will keep their historical reference.`)) return;
    state.strategies = state.strategies.filter((item) => item.id !== id);
  }

  saveState();
  renderAll();
}

function resetStrategyForm() {
  document.getElementById("strategyForm").reset();
  document.getElementById("strategyId").value = "";
}

function handleAssetSave(event) {
  event.preventDefault();
  const id = document.getElementById("assetId").value;
  const payload = {
    id: id || uid("asset"),
    market: document.getElementById("assetMarket").value,
    symbol: document.getElementById("assetSymbol").value.trim().toUpperCase(),
    name: document.getElementById("assetName").value.trim(),
    weekdays: document.getElementById("assetWeekdays").checked,
    weekends: document.getElementById("assetWeekends").checked,
    enabled: document.getElementById("assetEnabled").checked,
  };

  const existing = id ? state.assets.find((asset) => asset.id === id) : null;
  if (existing) {
    Object.assign(existing, payload);
  } else {
    state.assets.push(payload);
  }

  saveState();
  resetAssetForm();
  renderAll();
}

function handleAssetAction(id, action) {
  const asset = state.assets.find((item) => item.id === id);
  if (!asset) return;

  if (action === "toggle") {
    asset.enabled = !asset.enabled;
  } else if (action === "edit") {
    const marketSelect = document.getElementById("assetMarket");
    if (asset.market && !Array.from(marketSelect.options).some((option) => option.value === asset.market)) {
      marketSelect.add(new Option(asset.market, asset.market));
    }
    document.getElementById("assetId").value = asset.id;
    marketSelect.value = asset.market;
    document.getElementById("assetSymbol").value = asset.symbol;
    document.getElementById("assetName").value = asset.name;
    document.getElementById("assetWeekdays").checked = asset.weekdays;
    document.getElementById("assetWeekends").checked = asset.weekends;
    document.getElementById("assetEnabled").checked = asset.enabled;
  } else if (action === "delete") {
    if (!confirm(`Delete asset "${asset.symbol}"? Existing journal rows will keep their historical reference.`)) return;
    state.assets = state.assets.filter((item) => item.id !== id);
  }

  saveState();
  renderAll();
}

function resetAssetForm() {
  document.getElementById("assetForm").reset();
  document.getElementById("assetId").value = "";
  document.getElementById("assetWeekdays").checked = true;
  document.getElementById("assetWeekends").checked = false;
  document.getElementById("assetEnabled").checked = true;
}

function handleRiskSave(event) {
  event.preventDefault();
  state.risk = {
    maxLosses: Number(document.getElementById("maxLosses").value),
    maxWins: Number(document.getElementById("maxWins").value),
    maxTrades: Number(document.getElementById("maxTrades").value),
  };
  state.banner = document.getElementById("bannerText").value.trim();
  saveState();
  renderAll();
}

function handleRuleSave(event) {
  event.preventDefault();
  const id = document.getElementById("ruleId").value;
  const category = document.getElementById("ruleCategory").value;
  const payload = {
    id: id || uid("rule"),
    text: document.getElementById("ruleText").value.trim(),
    enabled: true,
  };

  if (id) {
    const existing = Object.values(state.rules)
      .flat()
      .find((rule) => rule.id === id);
    const oldCategory = Object.entries(state.rules).find(([, rules]) => rules.some((rule) => rule.id === id))?.[0];
    if (oldCategory && oldCategory !== category) {
      state.rules[oldCategory] = state.rules[oldCategory].filter((rule) => rule.id !== id);
      state.rules[category].push(payload);
    } else if (existing) {
      Object.assign(existing, payload, { enabled: existing.enabled });
    }
  } else {
    state.rules[category].push(payload);
  }

  saveState();
  resetRuleForm();
  renderAll();
}

function handleRuleAction(category, id, action) {
  const rule = state.rules[category].find((item) => item.id === id);
  if (!rule) return;

  if (action === "toggle") {
    rule.enabled = !rule.enabled;
  } else if (action === "edit") {
    document.getElementById("ruleId").value = rule.id;
    document.getElementById("ruleCategory").value = category;
    document.getElementById("ruleText").value = rule.text;
  } else if (action === "delete") {
    state.rules[category] = state.rules[category].filter((item) => item.id !== id);
  }

  saveState();
  renderAll();
}

function resetRuleForm() {
  document.getElementById("ruleForm").reset();
  document.getElementById("ruleId").value = "";
}

function handleChecklistSave(event) {
  event.preventDefault();
  const id = document.getElementById("checklistId").value;
  const phase = document.getElementById("checklistPhase").value;
  const payload = {
    id: id || uid("checklist"),
    text: document.getElementById("checklistText").value.trim(),
    mandatory: document.getElementById("checklistMandatory").checked,
    enabled: true,
  };

  if (id) {
    const existing = Object.values(state.checklists)
      .flat()
      .find((item) => item.id === id);
    const oldPhase = Object.entries(state.checklists).find(([, items]) => items.some((item) => item.id === id))?.[0];
    if (oldPhase && oldPhase !== phase) {
      state.checklists[oldPhase] = state.checklists[oldPhase].filter((item) => item.id !== id);
      state.checklists[phase].push(payload);
    } else if (existing) {
      Object.assign(existing, payload, { enabled: existing.enabled });
    }
  } else {
    state.checklists[phase].push(payload);
  }

  saveState();
  resetChecklistForm();
  renderAll();
}

function handleChecklistAction(phase, id, action) {
  const checklistItem = state.checklists[phase].find((item) => item.id === id);
  if (!checklistItem) return;

  if (action === "toggle") {
    checklistItem.enabled = !checklistItem.enabled;
  } else if (action === "edit") {
    document.getElementById("checklistId").value = checklistItem.id;
    document.getElementById("checklistPhase").value = phase;
    document.getElementById("checklistText").value = checklistItem.text;
    document.getElementById("checklistMandatory").checked = checklistItem.mandatory;
  } else if (action === "delete") {
    state.checklists[phase] = state.checklists[phase].filter((item) => item.id !== id);
  }

  saveState();
  renderAll();
}

function resetChecklistForm() {
  document.getElementById("checklistForm").reset();
  document.getElementById("checklistId").value = "";
  document.getElementById("checklistMandatory").checked = true;
}

function clearLockout() {
  state.coolOffUntil = null;
  saveState();
  renderLockout();
}



function applyPreferences() {
  const preferences = state.preferences || defaultState.preferences;
  let theme = preferences.theme || "dark";
  if (theme === "system") {
    theme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  document.documentElement.dataset.theme = theme;
  document.body.classList.toggle("compact-mode", Boolean(preferences.compact));
}

function handlePreferencesSave(event) {
  event.preventDefault();
  state.preferences = {
    theme: document.getElementById("preferenceTheme").value,
    currency: document.getElementById("preferenceCurrency").value,
    timezone: document.getElementById("preferenceTimezone").value,
    compact: document.getElementById("preferenceCompact").checked,
  };
  saveState();
  applyPreferences();
  renderAll();
}

function hydratePreferences() {
  const preferences = state.preferences || defaultState.preferences;
  document.getElementById("preferenceTheme").value = preferences.theme;
  document.getElementById("preferenceCurrency").value = preferences.currency;
  document.getElementById("preferenceTimezone").value = preferences.timezone;
  document.getElementById("preferenceCompact").checked = Boolean(preferences.compact);
}

function renderInsights() {
  renderPerformanceCharts();
  renderTradeCalendar();
  renderWeeklyReview();
  renderDisciplineStreaks();
}

function sortedClosedTrades() {
  return state.trades.slice().sort((a, b) => new Date(a.closedAt || a.openedAt) - new Date(b.closedAt || b.openedAt));
}

function drawCurve(canvas, values, color) {
  if (!canvas) return;
  const width = Math.max(280, Math.floor(canvas.parentElement.clientWidth - 26));
  const height = 180;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  const context = canvas.getContext("2d");
  context.scale(ratio, ratio);
  context.clearRect(0, 0, width, height);
  const css = getComputedStyle(document.documentElement);
  const line = css.getPropertyValue("--line").trim() || "#263244";
  const muted = css.getPropertyValue("--muted").trim() || "#8e9bad";
  context.strokeStyle = line;
  context.lineWidth = 1;
  for (let row = 1; row < 4; row += 1) {
    const y = (height / 4) * row;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  if (!values.length) {
    context.fillStyle = muted;
    context.font = "12px system-ui";
    context.fillText("Close trades to build this curve", 12, height / 2);
    return;
  }
  const plotted = [0, ...values];
  const min = Math.min(0, ...plotted);
  const max = Math.max(0, ...plotted);
  const range = max - min || 1;
  const x = (index) => (index / Math.max(1, plotted.length - 1)) * (width - 12) + 6;
  const y = (value) => height - 12 - ((value - min) / range) * (height - 24);
  context.strokeStyle = color;
  context.lineWidth = 2.5;
  context.lineJoin = "round";
  context.beginPath();
  plotted.forEach((value, index) => {
    if (index) context.lineTo(x(index), y(value));
    else context.moveTo(x(index), y(value));
  });
  context.stroke();
  const zeroY = y(0);
  context.strokeStyle = muted;
  context.globalAlpha = 0.35;
  context.beginPath();
  context.moveTo(0, zeroY);
  context.lineTo(width, zeroY);
  context.stroke();
  context.globalAlpha = 1;
}

function renderPerformanceCharts() {
  const trades = sortedClosedTrades();
  let cumulativeR = 0;
  let cumulativeProfit = 0;
  const rValues = trades.map((trade) => (cumulativeR += Number(trade.rRatio || 0)));
  const profitValues = trades.map((trade) => (cumulativeProfit += Number(trade.profit || 0)));
  document.getElementById("chartTradeCount").textContent = trades.length + (trades.length === 1 ? " trade" : " trades");
  document.getElementById("chartRTotal").textContent = cumulativeR.toFixed(2) + "R";
  document.getElementById("chartProfitTotal").textContent = formatMoney(cumulativeProfit);
  requestAnimationFrame(() => {
    drawCurve(document.getElementById("rCurveChart"), rValues, "#00c9a7");
    drawCurve(document.getElementById("profitCurveChart"), profitValues, "#ffb84d");
  });
}

function renderDisciplineStreaks() {
  const trades = sortedClosedTrades();
  let current = 0;
  let best = 0;
  let running = 0;
  trades.forEach((trade) => {
    running = trade.compliant ? running + 1 : 0;
    best = Math.max(best, running);
  });
  for (let index = trades.length - 1; index >= 0 && trades[index].compliant; index -= 1) current += 1;
  const recent = trades.slice(-10);
  const rate = recent.length ? Math.round((recent.filter((trade) => trade.compliant).length / recent.length) * 100) : 0;
  document.getElementById("currentStreak").textContent = current;
  document.getElementById("bestStreak").textContent = best;
  document.getElementById("recentCompliance").textContent = rate + "%";
  document.getElementById("streakMessage").textContent = !trades.length
    ? "Close trades to begin tracking execution consistency."
    : current >= 5
      ? "Strong process streak. Protect the routine, not the outcome."
      : current
        ? current + " clean execution" + (current === 1 ? "" : "s") + " in a row."
        : "The last trade broke the clean streak. Reset on the next decision.";
}

function tradeDateKey(trade) {
  return String(trade.closedAt || trade.openedAt || "").slice(0, 10);
}

function renderTradeCalendar() {
  const cursor = calendarCursor;
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  document.getElementById("calendarTitle").textContent = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const first = new Date(year, month, 1);
  const leading = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const byDay = new Map();
  state.trades.forEach((trade) => {
    const key = tradeDateKey(trade);
    const row = byDay.get(key) || { trades: 0, r: 0 };
    row.trades += 1;
    row.r += Number(trade.rRatio || 0);
    byDay.set(key, row);
  });
  const cells = Array.from({ length: leading }, () => '<div class="calendar-day is-empty" aria-hidden="true"></div>');
  for (let day = 1; day <= days; day += 1) {
    const date = new Date(year, month, day);
    const key = todayKey(date);
    const row = byDay.get(key);
    const classes = ["calendar-day"];
    if (key === todayKey()) classes.push("is-today");
    if (row) classes.push("has-trades", row.r >= 0 ? "is-positive" : "is-negative");
    cells.push('<div class="' + classes.join(" ") + '"><strong>' + day + '</strong>' + (row ? '<small>' + row.trades + 'T / ' + row.r.toFixed(1) + 'R</small>' : "") + '</div>');
  }
  document.getElementById("tradeCalendar").innerHTML = cells.join("");
}

function weekBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end, key: todayKey(start) };
}

function renderWeeklyReview() {
  const bounds = weekBounds();
  const trades = state.trades.filter((trade) => {
    const date = new Date(trade.closedAt || trade.openedAt);
    return date >= bounds.start && date < bounds.end;
  });
  const netR = trades.reduce((sum, trade) => sum + Number(trade.rRatio || 0), 0);
  const wins = trades.filter((trade) => trade.result === "TP").length;
  const compliance = trades.length ? Math.round((trades.filter((trade) => trade.compliant).length / trades.length) * 100) : 0;
  const avgScore = trades.length ? trades.reduce((sum, trade) => sum + Number(trade.score || 0), 0) / trades.length : 0;
  document.getElementById("weeklyRange").textContent = bounds.start.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " - " + new Date(bounds.end.getTime() - 1).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const stats = [["Trades", trades.length], ["Net R", netR.toFixed(2) + "R"], ["Win rate", trades.length ? Math.round((wins / trades.length) * 100) + "%" : "0%"], ["Compliance", compliance + "%"], ["Avg score", avgScore.toFixed(1)], ["P&L", formatMoney(trades.reduce((sum, trade) => sum + Number(trade.profit || 0), 0))]];
  document.getElementById("weeklySummary").innerHTML = stats.map(([label, value]) => '<div class="weekly-stat"><span>' + label + '</span><strong>' + value + '</strong></div>').join("");
  document.getElementById("weeklyFocus").value = state.weeklyReviews?.[bounds.key] || "";
}

function saveWeeklyFocus() {
  const bounds = weekBounds();
  state.weeklyReviews = state.weeklyReviews || {};
  state.weeklyReviews[bounds.key] = document.getElementById("weeklyFocus").value.trim();
  saveState();
  const button = document.getElementById("saveWeeklyFocus");
  button.textContent = "Saved";
  setTimeout(() => { button.textContent = "Save Focus"; }, 1200);
}

async function imageFileToDataUrl(input) {
  const file = input.files?.[0];
  if (!file) return "";
  if (file.size > 8388608) throw new Error("Choose a chart image under 8 MB.");
  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read chart image."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("The selected chart image is not valid."));
    element.src = source;
  });
  const scale = Math.min(1, 1400 / image.width, 900 / image.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.78);
}

function tradeShotsHtml(trade) {
  const shots = [["Before", trade.beforeImage], ["After", trade.afterImage]].filter((item) => item[1]);
  if (!shots.length) return '<span class="no-shot">No charts</span>';
  return '<div class="trade-shots">' + shots.map(([label, source]) => '<a class="trade-shot" href="' + source + '" target="_blank" rel="noopener" title="' + label + ' chart"><img src="' + source + '" alt="' + label + ' chart for trade ' + trade.number + '" /></a>').join("") + '</div>';
}


async function loadCurrentProfile() {
  if (!currentAuthUser?.id || currentAuthUser.id === "local-development-user") {
    currentProfile = {
      full_name: currentAuthUser?.email || "Local trader",
      username: "local_trader",
      onboarding_completed: true,
    };
    return currentProfile;
  }
  try {
    currentProfile = await loadProfile(currentAuthUser.id);
  } catch (error) {
    console.error("Profile load failed", error);
    currentProfile = null;
  }
  return currentProfile;
}

async function showFirstRunTutorial() {
  if (!currentProfile || currentProfile.onboarding_completed) return;
  tutorialStep = 0;
  renderTutorialStep();
  document.getElementById("tutorialBackdrop").classList.remove("hidden");
}

function renderTutorialStep() {
  const steps = [
    {
      title: "Plan before execution",
      copy: "Document the setup, invalidation, direction, and strategy before opening a position.",
    },
    {
      title: "Protect the process",
      copy: "Use checklists and risk limits while the trade is live. A clean decision matters more than one outcome.",
    },
    {
      title: "Review and improve",
      copy: "Close trades with screenshots, notes, and an execution score. Analytics will reveal the habits behind your results.",
    },
  ];
  const step = steps[tutorialStep];
  document.getElementById("tutorialStepLabel").textContent = String(tutorialStep + 1).padStart(2, "0") + " / " + String(steps.length).padStart(2, "0");
  document.getElementById("tutorialTitle").textContent = step.title;
  document.getElementById("tutorialCopy").textContent = step.copy;
  document.getElementById("tutorialNextBtn").textContent = tutorialStep === steps.length - 1 ? "Start journaling" : "Next";
}

async function advanceTutorial() {
  if (tutorialStep < 2) {
    tutorialStep += 1;
    renderTutorialStep();
    return;
  }
  await finishTutorial();
}

async function finishTutorial() {
  document.getElementById("tutorialBackdrop").classList.add("hidden");
  if (currentProfile) currentProfile.onboarding_completed = true;
  try {
    await completeOnboarding(currentAuthUser?.id);
  } catch (error) {
    console.error("Could not save tutorial completion", error);
  }
}

function showVerification(email) {
  pendingVerificationEmail = email;
  document.getElementById("loginForm").classList.add("hidden");
  document.getElementById("verificationPanel").classList.remove("hidden");
  document.getElementById("verificationCode").value = "";
  document.getElementById("verificationMessage").textContent = "We sent a confirmation link and code to " + email + ".";
}

async function handleVerifyCode() {
  const token = document.getElementById("verificationCode").value.trim();
  const message = document.getElementById("verificationMessage");
  if (!pendingVerificationEmail || !token) {
    message.textContent = "Enter the confirmation code from your email.";
    return;
  }
  try {
    const result = await verifySignupCode(pendingVerificationEmail, token);
    if (result.user) await enterApp(result.user);
  } catch (error) {
    message.textContent = error.message || "The confirmation code is invalid or expired.";
  }
}

async function handleResendCode() {
  const message = document.getElementById("verificationMessage");
  try {
    await resendSignupEmail(pendingVerificationEmail);
    message.textContent = "A new confirmation email was sent.";
  } catch (error) {
    message.textContent = error.message || "Unable to resend the confirmation email.";
  }
}

async function handleDeleteAccount() {
  const confirmation = prompt('Type DELETE to permanently remove your account and journal data.');
  if (confirmation !== "DELETE") return;
  const button = document.getElementById("accountDeleteBtn");
  button.disabled = true;
  button.textContent = "Deleting...";
  try {
    await deleteCurrentAccount();
    localStorage.removeItem(activeStorageKey);
    state = structuredClone(defaultState);
    currentAuthUser = null;
    currentProfile = null;
    cloudSyncReady = false;
    showLogin();
  } catch (error) {
    alert(error.message || "Account deletion failed. The delete-account function may not be deployed yet.");
    button.disabled = false;
    button.textContent = "Delete account";
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
