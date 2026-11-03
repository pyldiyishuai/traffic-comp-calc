/* ==========================================================================
 * ui/result.js — 结果渲染（赔偿清单 / 交强险拆分 / 谈判提示）
 * ========================================================================== */

var APP = window.APP || {};
window.APP = APP;

APP.UI = APP.UI || {};

(function (UI) {
  'use strict';

  var F = null;
  function fmt() { if (!F) F = UI.Format; return F; }

  var animRaf = {};
  function animateValue(el, from, to, formatter, duration) {
    if (!el) return;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !isFinite(from) || !isFinite(to)) {
      el.textContent = formatter(to);
      return;
    }
    var id = el.id || (el.id = 'v' + Math.random().toString(36).slice(2));
    if (animRaf[id]) cancelAnimationFrame(animRaf[id]);
    var start = performance.now(), dur = duration || 660, delta = to - from;

    function step(now) {
      var t = Math.min((now - start) / dur, 1);
      var e = 1 - Math.pow(1 - t, 3);
      el.textContent = formatter(from + delta * e);
      if (t < 1) animRaf[id] = requestAnimationFrame(step);
      else animRaf[id] = null;
    }
    animRaf[id] = requestAnimationFrame(step);
  }

  var prevTotal = 0;

  /* ======================================================================
   * 主渲染
   * ==================================================================== */

  function renderAll(r) {
    var f = fmt();
    renderHero(r, f);
    renderList(r, f);
    renderInsurance(r, f);
    renderCompare(r, f);
    renderTips(r.tips);

    var stamp = document.getElementById('resultStamp');
    if (stamp) {
      stamp.textContent = '已更新 ' + new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit', minute: '2-digit'
      });
      stamp.classList.add('is-fresh');
      setTimeout(function () { stamp.classList.remove('is-fresh'); }, 1400);
    }
    setText('dockSave', f.money((r.total / 10000), 1));
  }

  function renderHero(r, f) {
    animateValue(document.getElementById('heroValue'), prevTotal, r.total,
      function (v) { return f.money(v / 10000, 2); }, 760);
    prevTotal = r.total;

    var sub = document.getElementById('heroSub');
    if (sub) {
      sub.innerHTML = '法定总额 <b>' + f.money(r.sums.subtotal / 10000, 2) + '</b>' +
        (r.fault < 1 ? '，对方承担 ' + Math.round(r.fault * 100) + '% 后' : '') +
        '，实际可得 <b>' + f.money(r.total, 0) + '</b>';
    }

    var badge = document.getElementById('levelBadge');
    if (badge) {
      if (r.input.level === 0) {
        badge.textContent = '未达伤残等级';
        badge.className = 'result__level result__level--none';
      } else {
        badge.textContent = r.input.level + ' 级伤残';
        badge.className = 'result__level';
      }
    }
  }

  /* ---------- 赔偿清单 ---------- */
  function renderList(r, f) {
    var body = document.getElementById('listBody');
    if (!body) return;

    body.innerHTML = r.items.map(function (it) {
      var zero = it.amount <= 0;
      return '<tr class="' + (zero ? 'is-zero' : '') + (it.highlight ? ' is-key' : '') + '">' +
        '<td class="item-name">' + it.name +
          (it.highlight ? '<i class="item-key">主要项</i>' : '') +
          '<span class="item-detail">' + it.detail + '</span>' +
        '</td>' +
        '<td class="item-amount">' + (zero ? '—' : f.moneyFree(it.amount, 0)) + '</td>' +
      '</tr>';
    }).join('') +
    '<tr class="is-total">' +
      '<td>法定赔偿总额</td>' +
      '<td>' + f.moneyFree(r.sums.subtotal, 0) + '</td>' +
    '</tr>';
  }

  /* ---------- 交强险拆分 ---------- */
  function renderInsurance(r, f) {
    var box = document.getElementById('insuranceBox');
    if (!box) return;
    var ins = r.insurance;

    box.innerHTML =
      '<div class="ins-row">' +
        '<span class="ins-row__name">交强险赔付</span>' +
        '<b class="ins-row__val">' + f.moneyFree(ins.jqPay, 0) + '</b>' +
      '</div>' +
      '<p class="ins-row__note">医疗 1.8 万 / 死亡伤残 18 万 / 财产 2,000 元限额内，不按责任比例</p>' +
      '<div class="ins-row">' +
        '<span class="ins-row__name">超出限额部分</span>' +
        '<b class="ins-row__val">' + f.moneyFree(ins.overTotal, 0) + '</b>' +
      '</div>' +
      '<div class="ins-row is-accent">' +
        '<span class="ins-row__name">对方承担 ' + Math.round(r.fault * 100) + '%</span>' +
        '<b class="ins-row__val">' + f.moneyFree(ins.commercialPay, 0) + '</b>' +
      '</div>' +
      '<div class="ins-row is-total">' +
        '<span class="ins-row__name">实际可得合计</span>' +
        '<b class="ins-row__val">' + f.moneyFree(r.total, 0) + '</b>' +
      '</div>';
  }

  /* ---------- 伤残等级的影响 ---------- */
  function renderCompare(r, f) {
    var box = document.getElementById('compareBox');
    if (!box) return;

    if (r.input.level === 0) {
      box.innerHTML =
        '<div class="cmp-card">' +
          '<span class="cmp-card__label">未达伤残</span>' +
          '<b class="cmp-card__val">' + f.moneyFree(r.compare.noInjuryTotal, 0) + '</b>' +
        '</div>' +
        '<p class="cmp-note">' +
          '如果评上十级伤残，按当前地区与年龄，总额还能多拿约 <b>' +
          f.moneyFree(computeLevelGain(r, 10), 0) + '</b>。' +
        '</p>';
      return;
    }

    box.innerHTML =
      '<div class="cmp-grid">' +
        '<div class="cmp-card">' +
          '<span class="cmp-card__label">未达伤残</span>' +
          '<b class="cmp-card__val">' + f.moneyFree(r.compare.noInjuryTotal, 0) + '</b>' +
        '</div>' +
        '<div class="cmp-card is-best">' +
          '<span class="cmp-card__label">' + r.input.level + ' 级伤残</span>' +
          '<b class="cmp-card__val">' + f.moneyFree(r.total, 0) + '</b>' +
        '</div>' +
      '</div>' +
      '<p class="cmp-note">' +
        '伤残等级带来 <b>+' + f.moneyFree(r.compare.gainFromLevel, 0) + '</b>。' +
        '这就是为什么要认真做伤残鉴定。' +
      '</p>';
  }

  function computeLevelGain(r, lv) {
    var region = r.region;
    var factor = APP.Core.Comp.disabilityFactor(lv);
    var years = r.factors.compYears;
    var d = region.income * years * factor;
    var mental = (APP.DATA.mentalComp || {})[lv] || 0;
    return (d + mental) * r.fault;
  }

  /* ---------- 提示 ---------- */
  function renderTips(list) {
    var textEl = document.getElementById('adviceText');
    var box = document.getElementById('advice');
    if (!textEl) return;
    if (!list || !list.length) { if (box) box.style.display = 'none'; return; }
    if (box) box.style.display = '';

    textEl.innerHTML = list.map(function (item, i) {
      var cls = 'advice__item advice__item--' + (item.type || 'info');
      if (i === 0) cls += ' advice__lead';
      return '<span class="' + cls + '">' + item.text + '</span>';
    }).join('');
  }

  /* ---------- 谈判提示（下方独立区块） ---------- */
  function renderNegotiation() {
    var box = document.getElementById('negoList');
    var list = (APP.DATA && APP.DATA.negotiationTips) || [];
    if (!box) return;
    box.innerHTML = list.map(function (t, i) {
      return '<div class="nego__item">' +
        '<span class="nego__num">' + (i + 1) + '</span>' +
        '<div class="nego__body">' +
          '<h3 class="nego__title">' + t.title + '</h3>' +
          '<p class="nego__text">' + t.text + '</p>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* ---------- 等级速查表 ---------- */
  function renderLevelTable() {
    var body = document.getElementById('levelTableBody');
    if (!body) return;
    var regionSel = document.getElementById('region');
    var code = regionSel ? regionSel.value : 'national';
    var rows = APP.Core.Comp.levelTable(code, 40);

    body.innerHTML = rows.map(function (row) {
      return '<tr>' +
        '<td>' + row.level + ' 级</td>' +
        '<td>' + (row.factor * 100) + '%</td>' +
        '<td>' + fmt().moneyFree(row.amount, 0) + '</td>' +
        '<td>' + fmt().moneyFree(row.mental, 0) + '</td>' +
      '</tr>';
    }).join('');
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  UI.Result = {
    renderAll: renderAll,
    renderNegotiation: renderNegotiation,
    renderLevelTable: renderLevelTable
  };
})(APP.UI);
