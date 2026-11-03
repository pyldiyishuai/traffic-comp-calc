/* ==========================================================================
 * core/comp.js — 交通事故赔偿计算（纯函数层）
 * --------------------------------------------------------------------------
 * 全部项目按《人身损害赔偿解释》逐条计算。
 * 每一项都返回公式说明，结果页可以逐条复核。
 * ========================================================================== */

var APP = window.APP || {};
window.APP = APP;

APP.Core = APP.Core || {};

(function (Core) {
  'use strict';

  function n(v) {
    var x = Number(v);
    return isFinite(x) ? x : 0;
  }
  function r2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }

  function rules() { return APP.DATA || {}; }

  function getRegion(code) {
    var list = rules().regions || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].code === code) return list[i];
    }
    return list[0];
  }

  /** 伤残系数：1 级 1.0 → 10 级 0.1，0 表示未达伤残 */
  function disabilityFactor(level) {
    var lv = Math.round(n(level));
    var map = rules().disabilityFactors || {};
    return map[lv] === undefined ? 0 : map[lv];
  }

  /**
   * 残疾赔偿金的年限
   * 60 周岁以下 20 年；60–75 每增 1 岁减 1 年；75 以上 5 年
   */
  function compYears(age) {
    var a = n(age);
    if (a < 60) return 20;
    if (a < 75) return 20 - Math.floor(a - 60);
    return 5;
  }

  /* ======================================================================
   * 主计算
   * ==================================================================== */

  /**
   * @param {Object} f
   *  f.region      地区 code
   *  f.level       伤残等级 0–10（0 = 未达伤残）
   *  f.age         受害人年龄
   *  f.fault       责任比例 %（对方应承担的比例）
   *  f.medical     医疗费
   *  f.transport   交通费
   *  f.followup    后续治疗费
   *  f.property    财产损失
   *  f.lostWorkDays 误工天数
   *  f.monthlyIncome 月收入
   *  f.hospitalDays 住院天数
   *  f.nursingDays 护理天数
   *  f.nutritionDays 营养天数
   *  f.dependents  被扶养人人数
   *  f.dependentYears 被扶养年限
   *  f.supporters  扶养义务人数（含受害人本人）
   */
  function buildResult(f) {
    var region = getRegion(f.region);
    var level = Math.min(Math.max(Math.round(n(f.level)), 0), 10);
    var age = Math.max(n(f.age), 0);
    var fault = Math.min(Math.max(n(f.fault), 0), 100) / 100;

    var factor = disabilityFactor(level);
    var years = compYears(age);

    var items = [];
    function push(key, name, amount, detail, extra) {
      var o = { key: key, name: name, amount: r2(amount), detail: detail };
      if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
      items.push(o);
      return o;
    }

    /* ---- 1. 医疗费 ---- */
    var medical = Math.max(n(f.medical), 0);
    push('medical', '医疗费', medical, '按票据金额计算');

    /* ---- 2. 误工费 ---- */
    var lostWorkDays = Math.max(n(f.lostWorkDays), 0);
    var monthlyIncome = Math.max(n(f.monthlyIncome), 0);
    var dailyIncome = monthlyIncome / 30;
    var lostWork = dailyIncome * lostWorkDays;
    push('lostWork', '误工费', lostWork,
      lostWorkDays > 0
        ? lostWorkDays + ' 天 × ' + r2(dailyIncome) + ' 元/天'
        : '未填误工天数');

    /* ---- 3. 护理费 ---- */
    var nursingDays = Math.max(n(f.nursingDays), 0);
    var nursingDaily = Math.max(n(f.nursingDaily) || region.nursing, 0);
    var nursing = nursingDays * nursingDaily;
    push('nursing', '护理费', nursing,
      nursingDays > 0
        ? nursingDays + ' 天 × ' + nursingDaily + ' 元/天（当地护工标准）'
        : '未填护理天数');

    /* ---- 4. 营养费 ---- */
    var nutritionDays = Math.max(n(f.nutritionDays), 0);
    var nutritionDaily = Math.max(n(f.nutritionDaily) || 50, 0);
    var nutrition = nutritionDays * nutritionDaily;
    push('nutrition', '营养费', nutrition,
      nutritionDays > 0
        ? nutritionDays + ' 天 × ' + nutritionDaily + ' 元/天'
        : '未填营养天数（需医嘱支持）');

    /* ---- 5. 住院伙食补助费 ---- */
    var hospitalDays = Math.max(n(f.hospitalDays), 0);
    var meal = hospitalDays * region.meal;
    push('meal', '住院伙食补助费', meal,
      hospitalDays > 0
        ? hospitalDays + ' 天 × ' + region.meal + ' 元/天（' + region.name + '标准）'
        : '未填住院天数');

    /* ---- 6. 交通费 ---- */
    var transport = Math.max(n(f.transport), 0);
    push('transport', '交通费', transport, '凭票据据实计算');

    /* ---- 7. 残疾赔偿金（核心项） ---- */
    var disability = level > 0 ? region.income * years * factor : 0;
    push('disability', '残疾赔偿金', disability,
      level > 0
        ? region.income + ' 元/年 × ' + years + ' 年 × ' + (factor * 100) + '%（' +
          level + ' 级伤残）'
        : '未达伤残等级，此项为 0',
      { highlight: level > 0 });

    /* ---- 8. 被扶养人生活费 ---- */
    var dependents = Math.max(n(f.dependents), 0);
    var dependentYears = Math.max(n(f.dependentYears), 0);
    var supporters = Math.max(n(f.supporters) || 1, 1);
    // 未成年人算至 18 岁，成年人最多 20 年
    var depYearsCapped = Math.min(dependentYears, 20);
    var dependent = (level > 0 && dependents > 0)
      ? region.consume * depYearsCapped * factor * dependents / supporters
      : 0;
    push('dependent', '被扶养人生活费', dependent,
      (level > 0 && dependents > 0)
        ? region.consume + ' 元/年 × ' + depYearsCapped + ' 年 × ' + (factor * 100) +
          '% × ' + dependents + ' 人 ÷ ' + supporters + ' 名扶养人'
        : (level > 0 ? '未填被扶养人' : '未达伤残等级，此项为 0'));

    /* ---- 9. 精神损害抚慰金 ---- */
    var mentalMap = rules().mentalComp || {};
    var mental = level > 0 ? (mentalMap[level] || 0) : 0;
    push('mental', '精神损害抚慰金', mental,
      level > 0 ? level + ' 级伤残的常见判例水平' : '未达伤残等级，此项为 0');

    /* ---- 10. 后续治疗费 ---- */
    var followup = Math.max(n(f.followup), 0);
    push('followup', '后续治疗费', followup, '按鉴定意见确定的必然发生费用');

    /* ---- 11. 财产损失 ---- */
    var property = Math.max(n(f.property), 0);
    push('property', '财产损失', property, '车辆维修、物品损坏等直接损失');

    /* ---- 汇总 ---- */
    var subtotal = 0;
    items.forEach(function (it) { subtotal += it.amount; });
    subtotal = r2(subtotal);

    // 交强险限额内不按责任比例，超出部分才按比例
    var jqMedicalLimit = 18000;    // 医疗费用赔偿限额
    var jqDeathLimit = 180000;     // 死亡伤残赔偿限额
    var jqPropertyLimit = 2000;    // 财产损失赔偿限额

    var medicalItems = ['medical', 'nutrition', 'meal', 'followup'];
    var deathItems = ['lostWork', 'nursing', 'transport', 'disability', 'dependent', 'mental'];
    var propertyItems = ['property'];

    var sumOf = function (keys) {
      return items.filter(function (i) { return keys.indexOf(i.key) > -1; })
                  .reduce(function (s, i) { return s + i.amount; }, 0);
    };

    var medicalSum = r2(sumOf(medicalItems));
    var deathSum = r2(sumOf(deathItems));
    var propertySum = r2(sumOf(propertyItems));

    var jqPay = r2(Math.min(medicalSum, jqMedicalLimit) +
                   Math.min(deathSum, jqDeathLimit) +
                   Math.min(propertySum, jqPropertyLimit));

    var overMedical = Math.max(medicalSum - jqMedicalLimit, 0);
    var overDeath = Math.max(deathSum - jqDeathLimit, 0);
    var overProperty = Math.max(propertySum - jqPropertyLimit, 0);
    var overTotal = r2(overMedical + overDeath + overProperty);

    var commercialPay = r2(overTotal * fault);
    var total = r2(jqPay + commercialPay);

    /* ---- 对比：未达伤残能拿多少 ---- */
    var noInjuryItems = items.filter(function (i) {
      return ['medical', 'lostWork', 'nursing', 'nutrition', 'meal', 'transport', 'followup', 'property']
        .indexOf(i.key) > -1;
    }).reduce(function (s, i) { return s + i.amount; }, 0);
    var noInjuryMedical = r2(sumOf(medicalItems));
    var noInjuryDeath = r2(sumOf(['lostWork', 'nursing', 'transport']));
    var noInjuryProp = propertySum;
    var noInjuryTotal = r2(
      Math.min(noInjuryMedical, jqMedicalLimit) +
      Math.min(noInjuryDeath, jqDeathLimit) +
      Math.min(noInjuryProp, jqPropertyLimit) +
      (Math.max(noInjuryMedical - jqMedicalLimit, 0) +
       Math.max(noInjuryDeath - jqDeathLimit, 0) +
       Math.max(noInjuryProp - jqPropertyLimit, 0)) * fault
    );

    return {
      valid: true,
      input: {
        region: region.code, regionName: region.name, level: level, age: age,
        fault: fault * 100, medical: medical, transport: transport,
        followup: followup, property: property, lostWorkDays: lostWorkDays,
        monthlyIncome: monthlyIncome, hospitalDays: hospitalDays,
        nursingDays: nursingDays, nutritionDays: nutritionDays,
        dependents: dependents, dependentYears: dependentYears, supporters: supporters
      },
      region: region,
      factors: {
        disabilityFactor: factor,
        compYears: years,
        dailyIncome: r2(dailyIncome),
        nursingDaily: nursingDaily,
        nutritionDaily: nutritionDaily
      },
      items: items,
      sums: {
        medical: medicalSum,
        death: deathSum,
        property: propertySum,
        subtotal: subtotal
      },
      insurance: {
        jqMedicalLimit: jqMedicalLimit,
        jqDeathLimit: jqDeathLimit,
        jqPropertyLimit: jqPropertyLimit,
        jqPay: jqPay,
        overTotal: overTotal,
        commercialPay: commercialPay
      },
      total: total,
      fault: fault,
      // 伤残等级对总额的影响
      compare: {
        noInjuryTotal: noInjuryTotal,
        gainFromLevel: r2(total - noInjuryTotal)
      },
      ratio: subtotal > 0 ? total / subtotal : 0,
      tips: buildTips(level, total, items)
    };
  }

  /* ======================================================================
   * 提示
   * ==================================================================== */

  function buildTips(level, total, items) {
    var out = [];
    var notes = rules().notes || {};

    if (level === 0) {
      out.push({
        type: 'warn',
        text: '目前按「未达伤残等级」计算，只能主张实际支出的费用。' +
              '如果伤情可能构成伤残，<b>一定要做伤残鉴定</b>——' +
              '十级伤残的残疾赔偿金就有几万元，是最主要的一笔。'
      });
    } else {
      var d = items.filter(function (i) { return i.key === 'disability'; })[0];
      if (d) {
        out.push({
          type: 'info',
          text: level + ' 级伤残的残疾赔偿金约 <b>' + Math.round(d.amount).toLocaleString('zh-CN') +
                ' 元</b>，这是赔偿里最大的一笔，也是最容易被压价的。'
        });
      }
      var dep = items.filter(function (i) { return i.key === 'dependent'; })[0];
      if (dep && dep.amount <= 0) {
        out.push({
          type: 'tip',
          text: '有未成年子女或无劳动能力的父母吗？' +
                '<b>被扶养人生活费</b>可以单独主张，很多人漏掉这一项。'
        });
      }
    }

    out.push({ type: 'info', text: notes.fault });
    out.push({ type: 'tip', text: notes.year });
    if (notes.mental) out.push({ type: 'info', text: notes.mental });

    if (total > 100000) {
      out.push({
        type: 'warn',
        text: '金额已超过 10 万，建议<b>找专业律师</b>介入。' +
              '律师费通常按标的额 5%–10% 收取，但能把漏项和压价的空间争回来。'
      });
    }

    return out;
  }

  /* ======================================================================
   * 扩展
   * ==================================================================== */

  /** 各等级伤残的赔偿金速查表 */
  function levelTable(regionCode, age) {
    var region = getRegion(regionCode);
    var years = compYears(age);
    var out = [];
    for (var lv = 1; lv <= 10; lv++) {
      out.push({
        level: lv,
        factor: disabilityFactor(lv),
        amount: r2(region.income * years * disabilityFactor(lv)),
        mental: (rules().mentalComp || {})[lv] || 0
      });
    }
    return out;
  }

  Core.Comp = {
    buildResult: buildResult,
    levelTable: levelTable,
    compYears: compYears,
    disabilityFactor: disabilityFactor,
    getRegion: getRegion
  };
})(APP.Core);
