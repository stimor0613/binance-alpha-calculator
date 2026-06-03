/* ==========================================================================
   老李肉夹馍大师 · 全套商业配方助手 核心交互脚本
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 初始化应用
    initApp();
});

// --- 全局状态管理 ---
const state = {
    meatWeight: 38,       // 默认肉量（斤）
    spiceMode: 'commercial', // 香料模式: commercial (22味) / simple (3味)
    flourWeight: 1000,    // 默认面粉重（克）
    waterWeight: 50,      // 默认高汤加水量（斤）
    completedSteps: [],   // 已完成的步骤数组
    activeStep: 1,        // 当前进行中的步骤
    activeTimers: {}      // 存放运行中的定时器实例
};

// --- 配方基准常量定义 ---
const RECIPE_BASES = {
    // 卤肉基准：对应38斤肉
    meat: {
        total: 38,
        legMeatRatio: 18 / 38,   // 前/后腿肉比例
        bellyMeatRatio: 20 / 38, // 肥五花肉比例
        baseSoupRatio: 21.5 / 38, // 初始底汤（老汤+高汤桶 20-23斤，取中位数21.5）
        extraWaterRatio: 36.5 / 38, // 补加汤/水量 (58 - 21.5 = 36.5)
        saltRatio: 7,            // 1斤肉7克盐
        msgRatio: 68 / 38,       // 38斤肉放68克味精 (1.79克/斤)
        soySauceRatio: 2.5 / 38, // 38斤放2.5包酱油 (约1250克，单包500克计)
        onionRatio: 1 / 38,      // 38斤1根大葱 (约100g)
        gingerRatio: 150 / 38    // 38斤3块姜 (约150g)
    },
    // 简易香料基准 (对应38斤肉)
    simpleSpices: {
        bayLeaf: 5,
        sichuanPepper: 10,
        starAnise: 15
    },
    // 22味商业香料包基准 (对应20斤肉量，大写便于对齐)
    commercialSpices: [
        { name: '八角', baseVal: 40, note: '提大香，去异味' },
        { name: '花椒', baseVal: 30, note: '提麻香，除肉腥' },
        { name: '肉桂', baseVal: 15, note: '甜香，骨香主要来源' },
        { name: '白芷', baseVal: 30, note: '去腥，肉香增效剂' },
        { name: '白蔻', baseVal: 15, note: '解油腻，回香浓郁' },
        { name: '红蔻', baseVal: 15, note: '去异味，辛辣防腐' },
        { name: '栀子', baseVal: 10, note: '纯天然金黄着色' },
        { name: '肉蔻', baseVal: 30, note: '焖煮肉类核心香气' },
        { name: '丁香', baseVal: 5,  note: '穿透力强，忌多放' },
        { name: '香果', baseVal: 30, note: '除肉腥，出果木香' },
        { name: '毛桃', baseVal: 5,  note: '去浊气，提鲜度' },
        { name: '香叶', baseVal: 10, note: '清新草木香，去腻' },
        { name: '陈皮', baseVal: 10, note: '和胃去脂，解腻理气' },
        { name: '草果', baseVal: 15, note: '拍碎用，增辛辣烟熏香' },
        { name: '草蔻', baseVal: 20, note: '燥湿健脾，去肉腥' },
        { name: '良姜', baseVal: 15, note: '辛辣，抑制瘦肉柴腥' },
        { name: '砂仁', baseVal: 10, note: '醒脾，增加留齿回甜' },
        { name: '香砂', baseVal: 10, note: '去油脂腥味，出奇香' },
        { name: '山楂', baseVal: 15, note: '软化肉纤维，使之易烂' },
        { name: '小茴香', baseVal: 30, note: '清甜芬芳，补足中味' },
        { name: '千里香', baseVal: 15, note: '透骨入髓，香味持久' },
        { name: '小米辣', baseVal: 50, note: '提供微辣燥香，解腻' }
    ],
    // 白吉馍发面基准 (以面粉为100%)
    dough: {
        waterRatio: 0.5,    // 水 50%
        yeastRatio: 0.01,   // 酵母 1% (一斤面粉对应5g酵母)
        alkaliRatio: 0.002, // 碱面 0.2% (一斤面粉对应1g碱面)
        sugarRatio: 0.02    // 白糖 2% (一斤面粉对应10g白糖)
    },
    // 大骨高汤熬制基准 (对应50斤清水)
    soup: {
        baseWater: 50,
        chicken: 1,        // 老母鸡1只
        bone: 10,          // 猪棒骨10斤
        pigSkin: 2,        // 猪皮2斤
        saltPerJinSoup: 8, // 每斤熬好高汤加8g盐
        yieldRatio: 0.85   // 高汤估算出汤率 (85%)
    }
};

// --- 初始化入口 ---
function initApp() {
    // 从 LocalStorage 加载缓存
    loadLocalStorage();
    
    // 绑定事件监听
    bindEvents();
    
    // 渲染所有计算器结果
    renderStewMeat();
    renderDough();
    renderSoup();
    
    // 初始化步骤向导状态
    updateStepsTimeline();
    initTimers();
}

// --- 本地数据加载与缓存 ---
function loadLocalStorage() {
    const savedState = localStorage.getItem('meat_burger_state');
    if (savedState) {
        try {
            const parsed = JSON.parse(savedState);
            state.meatWeight = parsed.meatWeight ?? state.meatWeight;
            state.spiceMode = parsed.spiceMode ?? state.spiceMode;
            state.flourWeight = parsed.flourWeight ?? state.flourWeight;
            state.waterWeight = parsed.waterWeight ?? state.waterWeight;
            state.completedSteps = parsed.completedSteps ?? state.completedSteps;
            state.activeStep = parsed.activeStep ?? state.activeStep;
            
            // 同步输入框的值
            document.getElementById('meat-weight').value = state.meatWeight;
            document.getElementById('flour-weight').value = state.flourWeight;
            document.getElementById('water-weight').value = state.waterWeight;
        } catch (e) {
            console.error('解析缓存出错', e);
        }
    }
}

function saveLocalStorage() {
    localStorage.setItem('meat_burger_state', JSON.stringify({
        meatWeight: state.meatWeight,
        spiceMode: state.spiceMode,
        flourWeight: state.flourWeight,
        waterWeight: state.waterWeight,
        completedSteps: state.completedSteps,
        activeStep: state.activeStep
    }));
}

// --- 事件绑定 ---
function bindEvents() {
    // 1. Tab 切换逻辑
    const tabButtons = document.querySelectorAll('#calc-tabs .tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const targetId = `tab-${btn.dataset.tab}`;
            document.getElementById(targetId).classList.add('active');
        });
    });

    // 2. 卤肉计算器输入和预设
    const inputMeat = document.getElementById('meat-weight');
    inputMeat.addEventListener('input', (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val) || val <= 0) val = 0.5; // 限制最小值
        state.meatWeight = val;
        renderStewMeat();
        saveLocalStorage();
    });

    const meatPresets = document.querySelectorAll('.btn-preset');
    meatPresets.forEach(btn => {
        btn.addEventListener('click', () => {
            meatPresets.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const val = parseFloat(btn.dataset.val);
            state.meatWeight = val;
            inputMeat.value = val;
            renderStewMeat();
            saveLocalStorage();
        });
    });

    // 3. 香料包模式切换
    const modeCommercialBtn = document.getElementById('mode-commercial');
    const modeSimpleBtn = document.getElementById('mode-simple');
    
    // 初始化按钮激活状态
    if (state.spiceMode === 'commercial') {
        modeCommercialBtn.classList.add('active');
        modeSimpleBtn.classList.remove('active');
    } else {
        modeCommercialBtn.classList.remove('active');
        modeSimpleBtn.classList.add('active');
    }

    modeCommercialBtn.addEventListener('click', () => {
        state.spiceMode = 'commercial';
        modeCommercialBtn.classList.add('active');
        modeSimpleBtn.classList.remove('active');
        renderStewMeat();
        saveLocalStorage();
    });

    modeSimpleBtn.addEventListener('click', () => {
        state.spiceMode = 'simple';
        modeCommercialBtn.classList.remove('active');
        modeSimpleBtn.classList.add('active');
        renderStewMeat();
        saveLocalStorage();
    });

    // 4. 白吉馍和面输入和预设
    const inputFlour = document.getElementById('flour-weight');
    inputFlour.addEventListener('input', (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val) || val <= 0) val = 100;
        state.flourWeight = val;
        renderDough();
        saveLocalStorage();
    });

    const flourPresets = document.querySelectorAll('.btn-preset-flour');
    flourPresets.forEach(btn => {
        btn.addEventListener('click', () => {
            flourPresets.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const val = parseFloat(btn.dataset.val);
            state.flourWeight = val;
            inputFlour.value = val;
            renderDough();
            saveLocalStorage();
        });
    });

    // 5. 高汤熬制输入和预设
    const inputWater = document.getElementById('water-weight');
    inputWater.addEventListener('input', (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val) || val <= 0) val = 5;
        state.waterWeight = val;
        renderSoup();
        saveLocalStorage();
    });

    const waterPresets = document.querySelectorAll('.btn-preset-water');
    waterPresets.forEach(btn => {
        btn.addEventListener('click', () => {
            waterPresets.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const val = parseFloat(btn.dataset.val);
            state.waterWeight = val;
            inputWater.value = val;
            renderSoup();
            saveLocalStorage();
        });
    });

    // 6. 制作流程向导步骤完成点击
    const timeline = document.getElementById('steps-container');
    timeline.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-complete-step');
        if (!btn) return;
        
        const stepItem = btn.closest('.step-item');
        const stepNum = parseInt(stepItem.dataset.step);
        
        if (state.completedSteps.includes(stepNum)) {
            // 反选：取消完成状态
            state.completedSteps = state.completedSteps.filter(s => s !== stepNum);
            state.activeStep = Math.min(...[stepNum, ...state.completedSteps]);
            if (state.activeStep === Infinity) state.activeStep = 1;
        } else {
            // 标记为完成
            state.completedSteps.push(stepNum);
            // 激活下一步
            state.activeStep = stepNum + 1;
        }
        
        updateStepsTimeline();
        saveLocalStorage();
    });
}

// --- 格式化单位输出工具 (人性化，克数少时显示 mg，高汤少时换算为 g) ---
function formatWeight(grams, suffix = 'g') {
    if (grams < 0.001) return '0 g';
    if (grams < 1) {
        return `${Math.round(grams * 1000)} 毫克 (mg)`;
    }
    // 保留一位小数，如是整数则不显示小数
    const val = parseFloat(grams.toFixed(1));
    return `${val} ${suffix}`;
}

// --- 1. 渲染秘制卤肉结果 ---
function renderStewMeat() {
    const W = state.meatWeight;
    const base = RECIPE_BASES.meat;
    const mainListEl = document.getElementById('meat-main-list');
    const spiceListEl = document.getElementById('meat-spice-list');
    const totalSpiceWeightEl = document.getElementById('total-spice-weight');

    // --- 主料与调味料计算 ---
    const legWeight = W * base.legMeatRatio;
    const bellyWeight = W * base.bellyMeatRatio;
    const baseSoup = W * base.baseSoupRatio;
    const extraWater = W * base.extraWaterRatio;
    const saltVal = W * base.saltRatio;
    const msgVal = W * base.msgRatio;
    const soySauceVal = W * base.soySauceRatio; // 包数
    const onionVal = W * base.onionRatio;
    const gingerVal = W * base.gingerRatio;

    // 格式化葱的描述
    let onionDesc = `约 ${parseFloat((onionVal * 1.5).toFixed(1))} 根`;
    if (W < 5) onionDesc = '约 1 段';

    // 酱油克数与毫升换算
    const soySauceMl = W * base.soySauceRatio * 500; // 假定一包 500ml

    const mainHtml = `
        <li>
            <div class="ing-name"><i class="fa-solid fa-square-caret-right"></i> 前腿肉/后腿肉 (瘦肉)</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${(legWeight).toFixed(1)} 斤</span>
                <span class="ing-note">约 ${(legWeight * 500).toFixed(0)} 克，入大桶最下层</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-square-caret-right"></i> 肥五花肉 (肥瘦相间)</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${(bellyWeight).toFixed(1)} 斤</span>
                <span class="ing-note">约 ${(bellyWeight * 500).toFixed(0)} 克，摆在最上层吐油</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-square-caret-right"></i> 初始底汤 (老汤)</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${(baseSoup).toFixed(1)} 斤</span>
                <span class="ing-note">可用等量大骨高汤代替</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-square-caret-right"></i> 额外补加水/高汤</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${(extraWater).toFixed(1)} 斤</span>
                <span class="ing-note">加完肉和底汤后，汤面距肉表约 10cm</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-square-caret-right"></i> 优质食盐</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${formatWeight(saltVal)}</span>
                <span class="ing-note">商用标准: 一斤肉 7 克盐</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-square-caret-right"></i> 酿造酱油</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${(soySauceVal).toFixed(1)} 包</span>
                <span class="ing-note">约 ${soySauceMl.toFixed(0)} ml / 克，随汤加水后倒入</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-square-caret-right"></i> 优质大葱</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${onionDesc}</span>
                <span class="ing-note">约 ${Math.round(W * 2.6)} 克，整根包入料包或直接下锅</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-square-caret-right"></i> 鲜生姜</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${formatWeight(gingerVal)}</span>
                <span class="ing-note">拍散，可多放，解腥提味</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-square-caret-right"></i> 味精 (出锅调味)</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${formatWeight(msgVal)}</span>
                <span class="ing-note">焖煮2.5小时开盖、拉出大料包后再放入</span>
            </div>
        </li>
    `;
    mainListEl.innerHTML = mainHtml;

    // --- 香料包计算 ---
    let spiceHtml = '';
    let totalSpiceGrams = 0;

    if (state.spiceMode === 'commercial') {
        // 22味商业料包：基准 20 斤肉
        const scale = W / 20;
        const list = RECIPE_BASES.commercialSpices;
        
        list.forEach(sp => {
            const val = sp.baseVal * scale;
            totalSpiceGrams += val;
            spiceHtml += `
                <div class="spice-card" title="${sp.name}：${sp.note}">
                    <span class="spice-name">${sp.name}</span>
                    <span class="spice-val">${formatWeight(val, 'g')}</span>
                </div>
            `;
        });
    } else {
        // 3味简易家用料包：基准 38 斤肉
        const scale = W / 38;
        const simple = RECIPE_BASES.simpleSpices;
        
        const spLeaf = simple.bayLeaf * scale;
        const spPepper = simple.sichuanPepper * scale;
        const spAnise = simple.starAnise * scale;
        
        totalSpiceGrams = spLeaf + spPepper + spAnise;

        spiceHtml = `
            <div class="spice-card" style="grid-column: span 3; padding: 1rem;" title="八角">
                <span class="spice-name" style="font-size:1.1rem; color: #fff;">八角</span>
                <span class="spice-val" style="font-size:1.5rem;">${formatWeight(spAnise, 'g')}</span>
            </div>
            <div class="spice-card" style="grid-column: span 3; padding: 1rem;" title="花椒">
                <span class="spice-name" style="font-size:1.1rem; color: #fff;">花椒</span>
                <span class="spice-val" style="font-size:1.5rem;">${formatWeight(spPepper, 'g')}</span>
            </div>
            <div class="spice-card" style="grid-column: span 3; padding: 1rem;" title="香叶">
                <span class="spice-name" style="font-size:1.1rem; color: #fff;">香叶</span>
                <span class="spice-val" style="font-size:1.5rem;">${formatWeight(spLeaf, 'g')}</span>
            </div>
        `;
    }
    
    spiceListEl.innerHTML = spiceHtml;
    totalSpiceWeightEl.innerText = `料包共 ${totalSpiceGrams.toFixed(1)} 克`;
}

// --- 2. 渲染白吉馍和面结果 ---
function renderDough() {
    const F = state.flourWeight;
    const base = RECIPE_BASES.dough;
    const listEl = document.getElementById('flour-ingredients-list');

    const water = F * base.waterRatio;
    const yeast = F * base.yeastRatio;
    const alkali = F * base.alkaliRatio;
    const sugar = F * base.sugarRatio;

    // 估算做成的饼的数量
    const doughTotal = F + water; // 不计极少量的辅料
    const estimatedBurgers = Math.round(doughTotal / 75); // 每个白吉馍剂子约 75g-80g

    const html = `
        <li>
            <div class="ing-name"><i class="fa-solid fa-circle-chevron-right"></i> 高筋/中筋面粉</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${formatWeight(F)}</span>
                <span class="ing-note">基准面粉，过筛后口感更佳</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-circle-chevron-right"></i> 清水 (温水/凉水)</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${formatWeight(water)}</span>
                <span class="ing-note">夏天用凉水，冬天用 40℃-60℃ 温水</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-circle-chevron-right"></i> 高活性干酵母</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${formatWeight(yeast)}</span>
                <span class="ing-note">比例 1% (先溶解于温水中激发活性)</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-circle-chevron-right"></i> 碱面 (食用纯碱)</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${formatWeight(alkali)}</span>
                <span class="ing-note">比例 0.2% (中和酸度，使白吉馍更香脆)</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-circle-chevron-right"></i> 细白砂糖</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${formatWeight(sugar)}</span>
                <span class="ing-note">比例 2% (为酵母提供养分，促进发酵)</span>
            </div>
        </li>
        <li style="border-left: 3px solid var(--accent-orange); background: rgba(245, 124, 0, 0.05);">
            <div class="ing-name" style="color: var(--accent-gold);"><i class="fa-solid fa-cookie"></i> 预计可做白吉馍</div>
            <div class="ing-value-wrapper">
                <span class="ing-val" style="color: var(--accent-gold);">${estimatedBurgers} 个</span>
                <span class="ing-note" style="color: var(--text-secondary);">按单张生坯面团重约 75 克估算</span>
            </div>
        </li>
    `;
    listEl.innerHTML = html;
}

// --- 3. 渲染骨头高汤结果 ---
function renderSoup() {
    const L = state.waterWeight;
    const base = RECIPE_BASES.soup;
    const listEl = document.getElementById('soup-ingredients-list');

    const scale = L / base.baseWater;

    const chickenVal = scale * base.chicken;
    const boneVal = scale * base.bone;
    const skinVal = scale * base.pigSkin;
    
    // 熬好后的汤量估计 (出汤率 85%)
    const estSoupWeight = L * base.yieldRatio;
    // 盐量
    const saltVal = estSoupWeight * base.saltPerJinSoup;

    // 格式化鸡的数量描述
    let chickenDesc = `${(chickenVal).toFixed(1)} 只`;
    if (chickenVal < 0.2) chickenDesc = '约 1 块老母鸡肉';
    else if (chickenVal < 0.5) chickenDesc = '约 1/4 只老母鸡';
    else if (chickenVal < 0.8) chickenDesc = '约 半只老母鸡';

    const html = `
        <li>
            <div class="ing-name"><i class="fa-solid fa-circle-chevron-right"></i> 拟加清水</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${L} 斤</span>
                <span class="ing-note">冷水下锅开始熬制</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-circle-chevron-right"></i> 整只老母鸡</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${chickenDesc}</span>
                <span class="ing-note">提供浓郁鲜美的鸡油与高汤底色</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-circle-chevron-right"></i> 大棒骨 (洗净敲碎)</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${(boneVal).toFixed(1)} 斤</span>
                <span class="ing-note">约 ${(boneVal * 500).toFixed(0)} 克，提供骨胶原与汤汁醇厚度</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-circle-chevron-right"></i> 猪皮 (洗净去毛)</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${(skinVal).toFixed(1)} 斤</span>
                <span class="ing-note">约 ${(skinVal * 500).toFixed(0)} 克，增加高汤粘稠感与胶质</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-circle-chevron-right"></i> 熬好高汤后需加盐</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${formatWeight(saltVal)}</span>
                <span class="ing-note">按 85% 出汤率折算（估算熬得高汤 ${(estSoupWeight).toFixed(1)} 斤），每斤汤加 8 克盐</span>
            </div>
        </li>
    `;
    listEl.innerHTML = html;
}

// --- 4. 更新步骤向导 Timeline 状态 ---
function updateStepsTimeline() {
    const steps = document.querySelectorAll('.step-item');
    const progressFill = document.getElementById('flow-progress');
    let completedCount = 0;

    steps.forEach(step => {
        const stepNum = parseInt(step.dataset.step);
        const btn = step.querySelector('.btn-complete-step');
        
        step.classList.remove('active', 'completed');
        
        if (state.completedSteps.includes(stepNum)) {
            step.classList.add('completed');
            btn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> 重做';
            completedCount++;
        } else if (stepNum === state.activeStep) {
            step.classList.add('active');
            btn.innerHTML = '<i class="fa-solid fa-check"></i> 完成';
        } else {
            btn.innerHTML = '<i class="fa-solid fa-check"></i> 完成';
        }
    });

    // 计算总进度
    const progressPercent = (completedCount / steps.length) * 100;
    progressFill.style.width = `${progressPercent}%`;
}

// --- 5. 计时器逻辑组件 ---
function initTimers() {
    const widgets = document.querySelectorAll('.timer-widget');
    
    widgets.forEach(widget => {
        const duration = parseInt(widget.dataset.duration); // 获取倒计时总秒数
        const timerName = widget.dataset.timerName;
        const display = widget.querySelector('.timer-display');
        const startBtn = widget.querySelector('.btn-start');
        const pauseBtn = widget.querySelector('.btn-pause');
        const resetBtn = widget.querySelector('.btn-reset');
        
        let timeLeft = duration;
        let timerInterval = null;

        // 初始化显示
        updateTimerDisplay(display, timeLeft);

        startBtn.addEventListener('click', () => {
            if (timerInterval) return; // 防止重复启动

            widget.classList.add('running');
            widget.classList.remove('finished');
            startBtn.disabled = true;
            pauseBtn.disabled = false;

            timerInterval = setInterval(() => {
                timeLeft--;
                updateTimerDisplay(display, timeLeft);

                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                    timeLeft = duration; // 归位

                    // 状态置换
                    widget.classList.remove('running');
                    widget.classList.add('finished');
                    startBtn.disabled = false;
                    pauseBtn.disabled = true;

                    // 播放完成提示音
                    playAlertTone();
                    
                    // 弹窗提示
                    showNotification(`🛎️ 【${timerName}】时间已到！请进行下一步操作。`);
                }
            }, 1000);

            // 保存计时器实例引用以便全局管理（比如切换页面时）
            state.activeTimers[timerName] = timerInterval;
        });

        pauseBtn.addEventListener('click', () => {
            if (!timerInterval) return;
            
            clearInterval(timerInterval);
            timerInterval = null;
            
            widget.classList.remove('running');
            startBtn.disabled = false;
            pauseBtn.disabled = true;
        });

        resetBtn.addEventListener('click', () => {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            timeLeft = duration;
            updateTimerDisplay(display, timeLeft);
            
            widget.classList.remove('running', 'finished');
            startBtn.disabled = false;
            pauseBtn.disabled = true;
        });
    });
}

// 格式化时间显示 (秒 -> HH:MM:SS 或 MM:SS)
function updateTimerDisplay(el, seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    const pad = (n) => n.toString().padStart(2, '0');
    
    if (h > 0) {
        el.innerText = `${pad(h)}:${pad(m)}:${pad(s)}`;
    } else {
        el.innerText = `${pad(m)}:${pad(s)}`;
    }
}

// --- 6. 核心技术点：Web Audio API 纯代码合成器音效 (叮咚声) ---
function playAlertTone() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        // 叮咚音效，需要两个音符合成
        const playNote = (frequency, startTime, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle'; // 选用柔和的三角形波，类似钟声
            osc.frequency.setValueAtTime(frequency, startTime);

            // 缓入缓出音量包络
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.6, startTime + 0.05); // 快速起音
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration); // 缓慢衰减

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + duration);
        };

        const now = ctx.currentTime;
        // “叮”音：高音 E5 (659.25Hz)
        playNote(659.25, now, 0.6);
        // “咚”音：中音 C5 (523.25Hz)，延迟 0.18 秒播放
        playNote(523.25, now + 0.18, 1.0);

    } catch (e) {
        console.warn('浏览器未授权或不支持 Web Audio API 播放声音', e);
    }
}

// 人性化弹窗提示
function showNotification(msg) {
    // 如果浏览器支持通知且已授权，可以发送系统通知
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('老李肉夹馍大师', { body: msg });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification('老李肉夹馍大师', { body: msg });
            }
        });
    }
    
    // 默认在页面内弹窗提醒
    alert(msg);
}
