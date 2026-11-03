/* ==========================================================================
 * config.js — 全局配置中心（交通事故赔偿计算器）
 * ========================================================================== */

var APP = window.APP || {};
window.APP = APP;

APP.SITE = {
  name: '交通事故赔偿计算器',
  domain: 'https://pyldiyishuai.github.io/traffic-comp-calc',
  contactEmail: 'hello@example.com',
  icp: '',
  beian: '',
  year: 2025
};

APP.DEBUG = { enabled: false, noDebounce: false };

APP.ADS = {
  enabled: false,
  provider: '',
  slots: {
    resultInline: { id: '', format: 'fluid', label: 'result-inline' },
    contentBanner: { id: '', format: 'horizontal', label: 'content-banner' },
    leadBox: { id: '', format: 'fluid', label: 'lead-box' }
  },
  afterCalcDelay: 600,
  refreshOnRecalc: false
};

APP.ANALYTICS = {
  enabled: false,
  provider: '',
  id: '',
  debug: false,
  events: { pageView: 'page_view', calcRun: 'calc_run', leadClick: 'lead_click' }
};

APP.API = {
  enabled: false,
  baseUrl: '',
  timeout: 8000,
  endpoints: {
    regions: '/api/regions',
    savePlan: '/api/case',
    feedback: '/api/feedback',
    leadSubmit: '/api/lead'
  }
};

APP.AUTH = {
  enabled: false,
  provider: '',
  loginUrl: '/login',
  storageKey: 'comp_auth_token'
};

APP.FEATURES = {
  // ---- 已实现 ----
  fullCalc: true,         // 11 项赔偿完整计算
  regionData: true,       // 省级收入/支出基数
  insuranceSplit: true,   // 交强险 + 商业险拆分
  faultRatio: true,       // 责任比例
  levelCompare: true,     // 伤残等级对总额的影响
  negotiationTips: true,  // 谈判提示

  // ---- 预留 ----
  levelTable: false,      // 1–10 级赔偿金速查表
  deathCase: false,       // 死亡赔偿（含丧葬费、死亡赔偿金）
  multiYear: false,       // 多年度分段计算（跨年案件）
  exportReport: false,    // 导出赔偿清单 PDF
  shareCard: false,
  lawyerLead: false,      // 律师咨询线索 ★ 核心变现
  caseTimeline: false,    // 办案流程时间线
  cloudSave: false,
  i18n: false,
  darkMode: false
};

APP.CONST = {
  MAX_AMOUNT: 100000000,
  MAX_DAYS: 3650,
  MONEY_DECIMALS: 2,
  STORAGE_PREFIX: 'comp_',
  ANIM_DURATION: 660
};
