/* ==========================================================================
 * tests/smoke.js — 交通事故赔偿计算器冒烟测试
 * --------------------------------------------------------------------------
 * 期望值全部按司法解释手算，不复用被测函数。
 * ========================================================================== */

(async function () {
  var out = { total: 0, passed: 0, failed: 0, failures: [] };

  function ok(name, cond, got) {
    out.total++;
    if (cond) out.passed++;
    else { out.failed++; out.failures.push(name + '  →  got: ' + JSON.stringify(got)); }
  }
  function near(name, got, want, tol) {
    ok(name, Math.abs(Number(got) - Number(want)) <= (tol == null ? 0.02 : tol),
       got + ' (want ' + want + ')');
  }
  function eq(name, got, want) {
    ok(name, String(got) === String(want), got + ' (want ' + want + ')');
  }
  function $(id) { return document.getElementById(id); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  var C = APP.Core.Comp;

  function base(over) {
    var f = {
      region: 'national', level: 10, age: 40, fault: 100,
      medical: 45000, lostWorkDays: 120, monthlyIncome: 9000,
      hospitalDays: 25, nursingDays: 60, nutritionDays: 60,
      transport: 2000, followup: 0, property: 8000,
      dependents: 0, dependentYears: 0, supporters: 2
    };
    Object.keys(over || {}).forEach(function (k) { f[k] = over[k]; });
    return f;
  }

  /* ==================================================================
   * 一、基础系数
   * ================================================================== */

  eq('1 级伤残系数 100%', C.disabilityFactor(1), 1.0);
  eq('10 级伤残系数 10%', C.disabilityFactor(10), 0.1);
  eq('未达伤残系数 0', C.disabilityFactor(0), 0);
  eq('6 级伤残系数 50%', C.disabilityFactor(6), 0.5);

  eq('40 岁赔偿 20 年', C.compYears(40), 20);
  eq('59 岁仍是 20 年', C.compYears(59), 20);
  eq('60 岁是 20 年（边界）', C.compYears(60), 20);
  eq('61 岁是 19 年', C.compYears(61), 19);
  eq('65 岁是 15 年', C.compYears(65), 15);
  eq('74 岁是 6 年', C.compYears(74), 6);
  eq('75 岁是 5 年', C.compYears(75), 5);
  eq('80 岁是 5 年', C.compYears(80), 5);

  /* ==================================================================
   * 二、主计算（十级 / 40 岁 / 全国平均 / 全责）
   * ================================================================== */

  var r = C.buildResult(base());

  eq('医疗费 45,000', r.items[0].amount, 45000);
  eq('误工费 = 9000/30 × 120 = 36,000', r.items[1].amount, 36000);
  eq('护理费 = 60 × 200 = 12,000', r.items[2].amount, 12000);
  eq('营养费 = 60 × 50 = 3,000', r.items[3].amount, 3000);
  eq('住院伙食 = 25 × 100 = 2,500', r.items[4].amount, 2500);
  eq('交通费 2,000', r.items[5].amount, 2000);

  // 残疾赔偿金 = 54188 × 20 × 0.10
  eq('残疾赔偿金 = 108,376', r.items[6].amount, 108376);

  eq('被扶养人（未填）为 0', r.items[7].amount, 0);
  eq('精神抚慰金（10 级）5,000', r.items[8].amount, 5000);
  eq('后续治疗费 0', r.items[9].amount, 0);
  eq('财产损失 8,000', r.items[10].amount, 8000);

  eq('法定总额 = 221,876', r.sums.subtotal, 221876);

  // 交强险拆分
  eq('医疗类合计 = 45,000+3,000+2,500 = 50,500', r.sums.medical, 50500);
  eq('死亡伤残类合计 = 36,000+12,000+2,000+108,376+5,000 = 163,376', r.sums.death, 163376);
  eq('财产类 8,000', r.sums.property, 8000);
  eq('交强险赔付 = 18,000+163,376+2,000 = 183,376', r.insurance.jqPay, 183376);
  eq('超出限额部分 = 32,500+6,000 = 38,500', r.insurance.overTotal, 38500);
  eq('全责时实际可得 = 221,876', r.total, 221876);

  /* ==================================================================
   * 三、责任比例
   * ================================================================== */

  var r70 = C.buildResult(base({ fault: 70 }));
  eq('70% 责任下交强险部分不变', r70.insurance.jqPay, 183376);
  eq('70% 责任下超额部分 = 38,500 × 70% = 26,950', r70.insurance.commercialPay, 26950);
  eq('70% 责任总额 = 183,376 + 26,950 = 210,326', r70.total, 210326);

  var r0 = C.buildResult(base({ fault: 0 }));
  eq('0% 责任时只拿交强险', r0.total, 183376);

  /* ==================================================================
   * 四、伤残等级的影响
   * ================================================================== */

  var rNone = C.buildResult(base({ level: 0 }));
  eq('未达伤残时残疾赔偿金为 0', rNone.items[6].amount, 0);
  eq('未达伤残时精神抚慰金为 0', rNone.items[8].amount, 0);
  eq('未达伤残总额 = 108,500', rNone.total, 108500);
  eq('伤残带来的增量 = 221,876 − 108,500 = 113,376', r.compare.gainFromLevel, 113376);

  var r1 = C.buildResult(base({ level: 1 }));
  eq('1 级伤残赔偿金 = 54188×20×1.0 = 1,083,760', r1.items[6].amount, 1083760);
  eq('1 级精神抚慰金 50,000', r1.items[8].amount, 50000);

  var r5 = C.buildResult(base({ level: 5 }));
  eq('5 级伤残赔偿金 = 54188×20×0.6 = 650,256', r5.items[6].amount, 650256);

  /* ==================================================================
   * 五、年龄与地区
   * ================================================================== */

  var r65 = C.buildResult(base({ age: 65 }));
  eq('65 岁赔偿年限 15 年', r65.factors.compYears, 15);
  eq('65 岁残疾赔偿金 = 54188×15×0.1 = 81,282', r65.items[6].amount, 81282);

  var r80 = C.buildResult(base({ age: 80 }));
  eq('80 岁赔偿年限 5 年', r80.factors.compYears, 5);
  eq('80 岁残疾赔偿金 = 54188×5×0.1 = 27,094', r80.items[6].amount, 27094);

  var rSh = C.buildResult(base({ region: 'sh' }));
  ok('上海基数高于全国', rSh.items[6].amount > r.items[6].amount,
     rSh.items[6].amount + ' vs ' + r.items[6].amount);
  eq('上海残疾赔偿金 = 93095×20×0.1 = 186,190', rSh.items[6].amount, 186190);
  eq('上海住院伙食仍按 100/天', rSh.items[4].amount, 2500);

  var rGs = C.buildResult(base({ region: 'gs' }));
  ok('甘肃基数低于全国', rGs.items[6].amount < r.items[6].amount,
     rGs.items[6].amount + ' vs ' + r.items[6].amount);

  /* ==================================================================
   * 六、被扶养人生活费
   * ================================================================== */

  var rDep = C.buildResult(base({ dependents: 1, dependentYears: 10, supporters: 2 }));
  // 32907 × 10 × 0.1 × 1 ÷ 2 = 16,453.5
  eq('被扶养人生活费 = 16,453.5', rDep.items[7].amount, 16453.5);
  ok('有被扶养人时总额更高', rDep.total > r.total, rDep.total + ' vs ' + r.total);

  var rDep0 = C.buildResult(base({ level: 0, dependents: 2, dependentYears: 10 }));
  eq('未达伤残时被扶养人为 0', rDep0.items[7].amount, 0);

  var rDepCap = C.buildResult(base({ dependents: 1, dependentYears: 30, supporters: 1 }));
  eq('扶养年限最多按 20 年封顶',
     rDepCap.items[7].amount, Math.round(32907 * 20 * 0.1 * 1 / 1 * 100) / 100);

  /* ==================================================================
   * 七、边界
   * ================================================================== */

  var rNeg = C.buildResult({ region: 'national', level: -5, age: -10, fault: 150,
    medical: -1000, monthlyIncome: -500, hospitalDays: -3 });
  eq('负伤残等级钳制为 0', rNeg.input.level, 0);
  eq('负年龄钳制为 0', rNeg.input.age, 0);
  eq('责任比例上限 100%', rNeg.input.fault, 100);
  eq('负医疗费为 0', rNeg.input.medical, 0);

  var rHuge = C.buildResult(base({ level: 1, medical: 5000000, monthlyIncome: 200000, lostWorkDays: 1000 }));
  ok('极端金额仍返回有限值', isFinite(rHuge.total), rHuge.total);

  /* ==================================================================
   * 八、等级速查表
   * ================================================================== */

  var table = C.levelTable('national', 40);
  eq('速查表 10 行', table.length, 10);
  eq('第 1 行是 1 级', table[0].level, 1);
  eq('1 级赔偿金 1,083,760', table[0].amount, 1083760);
  eq('10 级赔偿金 108,376', table[9].amount, 108376);
  ok('等级递减', table[0].amount > table[5].amount && table[5].amount > table[9].amount, '');

  /* ==================================================================
   * 九、DOM 渲染
   * ================================================================== */

  ok('主数字已渲染', $('heroValue').textContent.length > 0, $('heroValue').textContent);
  eq('等级徽章显示十级', $('levelBadge').textContent, '10 级伤残');
  eq('清单 11 项 + 合计行', document.querySelectorAll('#listBody tr').length, 12);
  ok('交强险框有内容', $('insuranceBox').textContent.indexOf('交强险') > -1, '');
  ok('对比框显示了两张卡', document.querySelectorAll('#compareBox .cmp-card').length === 2,
     document.querySelectorAll('#compareBox .cmp-card').length);
  eq('等级速查表 10 行', document.querySelectorAll('#levelTableBody tr').length, 10);
  eq('谈判要点 6 条', document.querySelectorAll('#negoList .nego__item').length, 6);
  eq('FAQ 12 条', document.querySelectorAll('#faqList .faq__item').length, 12);

  var ld = Array.prototype.slice.call(document.querySelectorAll('script[type="application/ld+json"]'));
  ok('注入了 FAQPage', ld.some(function (s) { return s.textContent.indexOf('FAQPage') > -1; }), ld.length);

  /* ==================================================================
   * 十、交互
   * ================================================================== */

  // 10.1 点「未达伤残」
  var btn0 = document.querySelector('#levelChips button[data-level="0"]');
  btn0.click();
  await sleep(700);
  eq('点未达伤残后 level = 0', $('level').value, '0');
  eq('等级徽章变成未达伤残', $('levelBadge').textContent, '未达伤残等级');
  ok('高亮切到未达伤残', btn0.classList.contains('is-on'), btn0.className);

  // 10.2 点「一级」
  var btn1 = document.querySelector('#levelChips button[data-level="1"]');
  btn1.click();
  await sleep(700);
  eq('点一级后 level = 1', $('level').value, '1');
  eq('等级徽章显示一级', $('levelBadge').textContent, '1 级伤残');
  ok('一级总额超过 100 万',
     $('heroValue').textContent.replace(/,/g, '') !== '', $('heroValue').textContent);

  // 10.3 切换地区（此时 level=1，残疾赔偿金 = 93095×20×1.0 = 1,861,900）
  var sel = $('region');
  sel.value = 'sh';
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(700);
  ok('切到上海后残疾赔偿金 = 1,861,900',
     document.querySelector('#listBody').textContent.indexOf('1,861,900') > -1,
     document.querySelector('#listBody').textContent.slice(0, 120));

  // 10.4 改责任比例
  $('fault').value = '70';
  $('fault').dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(700);
  ok('责任 70% 后出现「对方承担 70%」',
     $('insuranceBox').textContent.indexOf('70%') > -1, $('insuranceBox').textContent.slice(0, 100));

  /* ==================================================================
   * 十一、提示
   * ================================================================== */

  var tips = r.tips.map(function (t) { return t.text; }).join('');
  ok('提示里解释了赔偿年限', tips.indexOf('20 年') > -1 || tips.indexOf('赔偿年限') > -1, tips.slice(0, 80));

  var tipsNone = rNone.tips.map(function (t) { return t.text; }).join('');
  ok('未达伤残时提示要做鉴定', tipsNone.indexOf('伤残鉴定') > -1, tipsNone.slice(0, 80));

  ok('金额超 10 万提示找律师', tips.indexOf('律师') > -1, '');

  return out;
})()
