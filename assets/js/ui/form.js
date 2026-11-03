/* ==========================================================================
 * ui/form.js — 表单读写与地区联动（交通事故赔偿版）
 * ========================================================================== */

var APP = window.APP || {};
window.APP = APP;

APP.UI = APP.UI || {};

(function (UI) {
  'use strict';

  var FIELDS = {
    age:            { min: 0, max: 120, int: true },
    level:          { min: 0, max: 10, int: true },
    fault:          { min: 0, max: 100, int: true },
    medical:        { min: 0, max: 100000000, money: true },
    lostWorkDays:   { min: 0, max: 3650, int: true },
    monthlyIncome:  { min: 0, max: 1000000, money: true },
    hospitalDays:   { min: 0, max: 3650, int: true },
    nursingDays:    { min: 0, max: 3650, int: true },
    nutritionDays:  { min: 0, max: 3650, int: true },
    transport:      { min: 0, max: 100000000, money: true },
    followup:       { min: 0, max: 100000000, money: true },
    property:       { min: 0, max: 100000000, money: true },
    dependents:     { min: 0, max: 10, int: true },
    dependentYears: { min: 0, max: 20, int: true },
    supporters:     { min: 1, max: 10, int: true }
  };

  var DEFAULTS = {
    age: 40,
    level: 10,
    fault: 100,
    medical: 45000,
    lostWorkDays: 120,
    monthlyIncome: 9000,
    hospitalDays: 25,
    nursingDays: 60,
    nutritionDays: 60,
    transport: 2000,
    followup: 0,
    property: 8000,
    dependents: 0,
    dependentYears: 0,
    supporters: 2
  };

  function stripMoney(s) { return String(s == null ? '' : s).replace(/[^\d.]/g, ''); }

  function groupThousands(s) {
    if (s === '' || s == null) return '';
    var parts = String(s).split('.');
    var intPart = parts[0].replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.length > 1 ? intPart + '.' + parts[1].slice(0, 2) : intPart;
  }

  function readNum(id) {
    var el = document.getElementById(id);
    if (!el) return 0;
    var v = parseFloat(String(el.value == null ? '' : el.value).replace(/[,，\s]/g, ''));
    return isFinite(v) ? v : 0;
  }

  function clamp(v, cfg) {
    if (!isFinite(v)) return cfg.min || 0;
    var x = Math.min(Math.max(v, cfg.min), cfg.max);
    return cfg.int ? Math.round(x) : x;
  }

  function getValues() {
    var v = {};
    Object.keys(FIELDS).forEach(function (id) {
      v[id] = clamp(readNum(id), FIELDS[id]);
    });
    var sel = document.getElementById('region');
    v.region = sel ? sel.value : 'national';
    return v;
  }

  function setValue(id, value, silent) {
    var el = document.getElementById(id);
    if (!el) return;
    var cfg = FIELDS[id] || {};
    if (cfg.money) el.value = groupThousands(String(Math.round(Number(value) || 0)));
    else el.value = String(Number(value) || 0);
    if (!silent) updateHints();
  }

  function formatMoneyInput(el) {
    var caretFromEnd = el.value.length - (el.selectionStart || 0);
    var formatted = groupThousands(stripMoney(el.value));
    if (formatted === el.value) return;
    el.value = formatted;
    var pos = Math.max(formatted.length - caretFromEnd, 0);
    try { el.setSelectionRange(pos, pos); } catch (e) {}
  }

  /* ======================================================================
   * 地区
   * ==================================================================== */

  function renderRegions() {
    var sel = document.getElementById('region');
    var list = (APP.DATA && APP.DATA.regions) || [];
    if (!sel || !list.length) return;
    sel.innerHTML = list.map(function (r) {
      return '<option value="' + r.code + '">' + r.name + '</option>';
    }).join('');
    sel.value = 'national';
  }

  /* ======================================================================
   * 提示
   * ==================================================================== */

  function updateHints() {
    var v = getValues();
    var F = UI.Format;
    var region = APP.Core.Comp.getRegion(v.region);
    var factor = APP.Core.Comp.disabilityFactor(v.level);
    var years = APP.Core.Comp.compYears(v.age);

    // 让 chips 的高亮与当前值保持一致（URL 参数、localStorage 恢复时也要对）
    var lvBox = document.getElementById('levelChips');
    if (lvBox) {
      lvBox.querySelectorAll('button[data-level]').forEach(function (b) {
        b.classList.toggle('is-on', Number(b.dataset.level) === v.level);
      });
    }

    var levelTip = document.getElementById('levelTip');
    if (levelTip) {
      if (v.level === 0) {
        levelTip.innerHTML = '未达伤残等级：只能主张实际支出，<b>没有残疾赔偿金</b>。';
        levelTip.style.color = 'var(--danger)';
      } else {
        var amount = region.income * years * factor;
        levelTip.innerHTML = v.level + ' 级伤残，系数 <b>' + (factor * 100) + '%</b>，' +
          '赔偿年限 <b>' + years + ' 年</b> → 残疾赔偿金约 <b>' +
          F.moneyFree(amount, 0) + '</b>';
        levelTip.style.color = '';
      }
    }

    var ageTip = document.getElementById('ageTip');
    if (ageTip) {
      if (v.age < 60) ageTip.textContent = '60 岁以下按 20 年计算。';
      else if (v.age < 75) ageTip.textContent = v.age + ' 岁 → 赔偿年限 ' + years + ' 年。';
      else ageTip.textContent = '75 岁以上统一按 5 年计算。';
    }

    var depTip = document.getElementById('depTip');
    if (depTip) {
      if (v.level === 0) {
        depTip.textContent = '未达伤残等级时，这一项为 0。';
      } else if (v.dependents <= 0) {
        depTip.textContent = '有未成年子女或无劳动能力的父母？可以单独主张这一项。';
      } else {
        var depAmount = region.consume * Math.min(v.dependentYears, 20) * factor * v.dependents / Math.max(v.supporters, 1);
        depTip.innerHTML = '约 <b>' + F.moneyFree(depAmount, 0) + '</b>（' +
          v.dependents + ' 人 × ' + Math.min(v.dependentYears, 20) + ' 年 ÷ ' +
          v.supporters + ' 名扶养人）';
      }
    }

    var regionTip = document.getElementById('regionTip');
    if (regionTip) {
      regionTip.textContent = region.name + '：人均可支配收入 ' +
        region.income.toLocaleString('zh-CN') + ' 元/年';
    }
  }

  /* ======================================================================
   * 事件
   * ==================================================================== */

  function bind(onChange) {
    Object.keys(FIELDS).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var cfg = FIELDS[id];

      el.addEventListener('input', function () {
        if (cfg.money) formatMoneyInput(el);
        updateHints();
        onChange();
      });

      el.addEventListener('blur', function () {
        setValue(id, clamp(readNum(id), cfg));
        onChange();
      });
    });

    var sel = document.getElementById('region');
    if (sel) {
      sel.addEventListener('change', function () { updateHints(); onChange(); });
    }

    // 伤残等级快捷按钮
    var lvBox = document.getElementById('levelChips');
    if (lvBox) {
      lvBox.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-level]');
        if (!btn) return;
        setValue('level', btn.dataset.level);
        lvBox.querySelectorAll('button').forEach(function (b) {
          b.classList.toggle('is-on', b === btn);
        });
        onChange();
      });
    }
  }

  function reset() {
    Object.keys(DEFAULTS).forEach(function (id) { setValue(id, DEFAULTS[id]); });
    var sel = document.getElementById('region');
    if (sel) sel.value = 'national';
    updateHints();
  }

  function init() {
    renderRegions();
    Object.keys(DEFAULTS).forEach(function (id) { setValue(id, DEFAULTS[id], true); });
    updateHints();
  }

  UI.Form = {
    init: init,
    getValues: getValues,
    setValue: setValue,
    reset: reset,
    bind: bind,
    updateHints: updateHints,
    groupThousands: groupThousands,
    FIELDS: FIELDS,
    DEFAULTS: DEFAULTS
  };
})(APP.UI);
