/* ==========================================================================
   老老老老老老老老老老老老老老老老老老老老老老老老老老老老老老老老老老
   老李肉夹馍大师 · 家庭温馨版 核心逻辑脚本 (支持8味/22味模式切换)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initFamilyApp();
});

// --- 全局状态管理 ---
const state = {
    meatWeight: 3,        // 家庭默认肉量（斤）
    flourWeight: 500,     // 家庭默认面粉重（克，约10个馍）
    spiceMode: 'family-8', // 默认香料模式: family-8 (8味) / commercial-22 (22味)
    completedSteps: [],   // 已完成的步骤
    activeStep: 1,        // 当前步骤
    activeTimers: {}      // 运行中的计时器
};

// --- 配方基准常量 ---
const RECIPE_BASES = {
    // 卤肉主料基准：同步商用版推荐比例
    meat: {
        total: 38,
        legMeatRatio: 18 / 38,   // 前腿肉比例
        bellyMeatRatio: 20 / 38, // 肥五花肉比例
        waterRatio: 58 / 38,     // 纯净清水比例 (38斤肉配58斤清水)
        saltRatio: 7,            // 黄金盐量: 一斤肉 7 克
        msgRatio: 68 / 38,       // 味精比例 (38 斤放 68 克)
        soySauceRatio: 2.5 / 38, // 酱油比例
        onionRatio: 1 / 38,      // 大葱比例
        gingerRatio: 150 / 38    // 生姜比例
    },
    // 家用 8 味精选香料（以 3 斤肉量为基准进行等比换算）
    familySpices: [
        { name: '八角', baseVal: 4, pieceWeight: 1.3, unitName: '个', note: '提供浓厚大香' },
        { name: '花椒', baseVal: 3, pieceWeight: 3.0, unitName: '汤匙', note: '提供醇厚麻香' },
        { name: '桂皮', baseVal: 2, pieceWeight: 2.0, unitName: '小节', note: '骨香与甜香气' },
        { name: '香叶', baseVal: 1, pieceWeight: 0.25, unitName: '片', note: '清新草木香气' },
        { name: '小茴香', baseVal: 2, pieceWeight: 2.0, unitName: '小匙', note: '清甜中草药香' },
        { name: '陈皮', baseVal: 1, pieceWeight: 1.0, unitName: '小片', note: '和胃解腻理气' }
    ],
    // 商业 22 味绝密草药大料包（基准为 20 斤肉）
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
    // 发面基准
    dough: {
        waterRatio: 0.5,
        yeastRatio: 0.01,
        alkaliRatio: 0.002,
        sugarRatio: 0.02
    }
};

// --- 初始化入口 ---
function initFamilyApp() {
    loadLocalStorage();
    bindEvents();
    
    renderStewMeat();
    renderDough();
    
    updateStepsTimeline();
    initTimers();
}

// --- 本地数据加载与缓存 ---
function loadLocalStorage() {
    const savedState = localStorage.getItem('meat_burger_family_state');
    if (savedState) {
        try {
            const parsed = JSON.parse(savedState);
            state.meatWeight = parsed.meatWeight ?? state.meatWeight;
            state.flourWeight = parsed.flourWeight ?? state.flourWeight;
            state.spiceMode = parsed.spiceMode ?? state.spiceMode;
            state.completedSteps = parsed.completedSteps ?? state.completedSteps;
            state.activeStep = parsed.activeStep ?? state.activeStep;
            
            document.getElementById('meat-weight').value = state.meatWeight;
            document.getElementById('flour-weight').value = state.flourWeight;
        } catch (e) {
            console.error('解析缓存出错', e);
        }
    }
}

function saveLocalStorage() {
    localStorage.setItem('meat_burger_family_state', JSON.stringify({
        meatWeight: state.meatWeight,
        flourWeight: state.flourWeight,
        spiceMode: state.spiceMode,
        completedSteps: state.completedSteps,
        activeStep: state.activeStep
    }));
}

// --- 事件绑定 ---
function bindEvents() {
    // 1. Tab 切换
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

    // 2. 卤肉计算器输入与快速预设
    const inputMeat = document.getElementById('meat-weight');
    inputMeat.addEventListener('input', (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val) || val <= 0) val = 0.5;
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

    // 3. 香料包模式双向切换
    const modeFamilyBtn = document.getElementById('mode-family-8');
    const modeCommercialBtn = document.getElementById('mode-commercial-22');

    // 初始化 Toggle 按钮状态
    if (state.spiceMode === 'family-8') {
        modeFamilyBtn.classList.add('active');
        modeCommercialBtn.classList.remove('active');
    } else {
        modeFamilyBtn.classList.remove('active');
        modeCommercialBtn.classList.add('active');
    }

    modeFamilyBtn.addEventListener('click', () => {
        state.spiceMode = 'family-8';
        modeFamilyBtn.classList.add('active');
        modeCommercialBtn.classList.remove('active');
        renderStewMeat();
        saveLocalStorage();
    });

    modeCommercialBtn.addEventListener('click', () => {
        state.spiceMode = 'commercial-22';
        modeFamilyBtn.classList.remove('active');
        modeCommercialBtn.classList.add('active');
        renderStewMeat();
        saveLocalStorage();
    });

    // 4. 白吉馍和面输入与快速预设
    const inputFlour = document.getElementById('flour-weight');
    inputFlour.addEventListener('input', (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val) || val <= 0) val = 50;
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

    // 5. 步骤完成点击
    const timeline = document.getElementById('steps-container');
    timeline.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-complete-step');
        if (!btn) return;
        
        const stepItem = btn.closest('.step-item');
        const stepNum = parseInt(stepItem.dataset.step);
        
        if (state.completedSteps.includes(stepNum)) {
            state.completedSteps = state.completedSteps.filter(s => s !== stepNum);
            state.activeStep = Math.min(...[stepNum, ...state.completedSteps]);
            if (state.activeStep === Infinity) state.activeStep = 1;
        } else {
            state.completedSteps.push(stepNum);
            state.activeStep = stepNum + 1;
        }
        
        updateStepsTimeline();
        saveLocalStorage();
    });
}

// --- 格式化单位输出工具 ---
function formatWeight(grams, suffix = 'g') {
    if (grams < 0.001) return '0 g';
    if (grams < 1) {
        return `${Math.round(grams * 1000)} 毫克 (mg)`;
    }
    const val = parseFloat(grams.toFixed(1));
    return `${val} ${suffix}`;
}

// --- 1. 渲染家庭版卤肉配方 ---
function renderStewMeat() {
    const W = state.meatWeight;
    const base = RECIPE_BASES.meat;
    const mainListEl = document.getElementById('meat-main-list');
    const spiceListEl = document.getElementById('meat-spice-list');
    const totalSpiceWeightEl = document.getElementById('total-spice-weight');

    // 计算主料与调味料
    const legWeight = W * base.legMeatRatio;
    const bellyWeight = W * base.bellyMeatRatio;
    const waterWeight = W * base.waterRatio; // 清水总量
    const saltVal = W * base.saltRatio;
    const msgVal = W * base.msgRatio;
    const soySauceVal = W * base.soySauceRatio * 500; // 克/ml
    const onionVal = W * base.onionRatio;
    const gingerVal = W * base.gingerRatio;

    // 量化生姜和大葱的提示
    let onionDesc = `约 ${(onionVal * 38).toFixed(1)} 根`;
    if (W < 10) {
        const onionGrams = W * base.onionRatio * 100;
        onionDesc = `约 ${Math.max(1, Math.round(onionGrams / 15))} 段 (共 ${Math.round(onionGrams)}g)`;
    }

    const mainHtml = `
        <li>
            <div class="ing-name"><i class="fa-solid fa-square-caret-right"></i> 前腿肉/后腿肉 (瘦肉)</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${(legWeight).toFixed(1)} 斤</span>
                <span class="ing-note">约 ${(legWeight * 500).toFixed(0)} 克 (商用黄金比例)</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-square-caret-right"></i> 肥五花肉 (肥瘦相间)</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${(bellyWeight).toFixed(1)} 斤</span>
                <span class="ing-note">约 ${(bellyWeight * 500).toFixed(0)} 克 (商用黄金比例)</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-square-caret-right"></i> 纯净清水 (不加高汤)</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${(waterWeight).toFixed(1)} 斤</span>
                <span class="ing-note">约 ${(waterWeight * 500).toFixed(0)} ml，水面距肉表约 10cm</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-square-caret-right"></i> 优质食盐</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${formatWeight(saltVal)}</span>
                <span class="ing-note">比例: 一斤肉 7 克盐</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-square-caret-right"></i> 酿造酱油</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${formatWeight(soySauceVal, 'ml')}</span>
                <span class="ing-note">约 ${(soySauceVal / 15).toFixed(1)} 汤匙，用于酱红着色</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-square-caret-right"></i> 优质大葱</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${onionDesc}</span>
                <span class="ing-note">洗净切成长段入锅</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-square-caret-right"></i> 鲜生姜</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${formatWeight(gingerVal)}</span>
                <span class="ing-note">洗净拍扁，解腥提味</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-square-caret-right"></i> 味精 (起锅鲜味)</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${formatWeight(msgVal)}</span>
                <span class="ing-note">焖2小时出锅、取出料包后再放</span>
            </div>
        </li>
    `;
    mainListEl.innerHTML = mainHtml;

    // 渲染香料包结果
    let spiceHtml = '';
    let totalSpiceGrams = 0;

    if (state.spiceMode === 'family-8') {
        // 8味精选香料包 (基准 3 斤肉)
        const scale = W / 3;
        RECIPE_BASES.familySpices.forEach(sp => {
            const val = sp.baseVal * scale;
            totalSpiceGrams += val;
            
            const pieceCount = Math.round(val / sp.pieceWeight);
            let qtyNote = '';
            if (pieceCount > 0) {
                qtyNote = `<span class="ing-note" style="font-size:0.65rem; color:var(--text-muted);">约 ${pieceCount} ${sp.unitName}</span>`;
            }

            spiceHtml += `
                <div class="spice-card" title="${sp.name}：${sp.note}">
                    <span class="spice-name">${sp.name}</span>
                    <span class="spice-val">${formatWeight(val, 'g')}</span>
                    ${qtyNote}
                </div>
            `;
        });
    } else {
        // 22味商业大料包 (基准 20 斤肉)
        const scale = W / 20;
        RECIPE_BASES.commercialSpices.forEach(sp => {
            const val = sp.baseVal * scale;
            totalSpiceGrams += val;
            spiceHtml += `
                <div class="spice-card" title="${sp.name}：${sp.note}">
                    <span class="spice-name">${sp.name}</span>
                    <span class="spice-val">${formatWeight(val, 'g')}</span>
                </div>
            `;
        });
    }

    spiceListEl.innerHTML = spiceHtml;
    totalSpiceWeightEl.innerText = `家用料包共 ${totalSpiceGrams.toFixed(1)} 克`;
}

// --- 2. 渲染家庭发面结果 ---
function renderDough() {
    const F = state.flourWeight;
    const base = RECIPE_BASES.dough;
    const listEl = document.getElementById('flour-ingredients-list');

    const water = F * base.waterRatio;
    const yeast = F * base.yeastRatio;
    const alkali = F * base.alkaliRatio;
    const sugar = F * base.sugarRatio;

    const doughTotal = F + water;
    const estimatedBurgers = Math.round(doughTotal / 75);

    const html = `
        <li>
            <div class="ing-name"><i class="fa-solid fa-circle-chevron-right"></i> 中筋面粉</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${formatWeight(F)}</span>
                <span class="ing-note">高/中筋皆可</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-circle-chevron-right"></i> 清水 (温水/冷水)</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${formatWeight(water, 'ml')}</span>
                <span class="ing-note">冬天用 40℃-60℃ 温水</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-circle-chevron-right"></i> 高活性干酵母</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${formatWeight(yeast)}</span>
                <span class="ing-note">比例 1% (约 ${(yeast / 3).toFixed(1)} 小茶匙)</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-circle-chevron-right"></i> 食用纯碱 (碱面)</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${formatWeight(alkali)}</span>
                <span class="ing-note">比例 0.2% (调水溶化)</span>
            </div>
        </li>
        <li>
            <div class="ing-name"><i class="fa-solid fa-circle-chevron-right"></i> 细白砂糖</div>
            <div class="ing-value-wrapper">
                <span class="ing-val">${formatWeight(sugar)}</span>
                <span class="ing-note">比例 2% (约 ${(sugar / 5).toFixed(1)} 匙)</span>
            </div>
        </li>
        <li style="border-left: 3px solid var(--accent-orange); background: rgba(245, 124, 0, 0.05);">
            <div class="ing-name" style="color: var(--accent-gold);"><i class="fa-solid fa-cookie"></i> 预计可做白吉馍</div>
            <div class="ing-value-wrapper">
                <span class="ing-val" style="color: var(--accent-gold);">${estimatedBurgers} 个</span>
                <span class="ing-note" style="color: var(--text-secondary);">按单个面团 75 克计</span>
            </div>
        </li>
    `;
    listEl.innerHTML = html;
}

// --- 3. 更新步骤时间轴状态 ---
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

    const progressPercent = (completedCount / steps.length) * 100;
    progressFill.style.width = `${progressPercent}%`;
}

// --- 4. 计时器控制器 ---
function initTimers() {
    const widgets = document.querySelectorAll('.timer-widget');
    
    widgets.forEach(widget => {
        const duration = parseInt(widget.dataset.duration);
        const timerName = widget.dataset.timerName;
        const display = widget.querySelector('.timer-display');
        const startBtn = widget.querySelector('.btn-start');
        const pauseBtn = widget.querySelector('.btn-pause');
        const resetBtn = widget.querySelector('.btn-reset');
        
        let timeLeft = duration;
        let timerInterval = null;

        updateTimerDisplay(display, timeLeft);

        startBtn.addEventListener('click', () => {
            if (timerInterval) return;

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
                    timeLeft = duration;

                    widget.classList.remove('running');
                    widget.classList.add('finished');
                    startBtn.disabled = false;
                    pauseBtn.disabled = true;

                    playAlertTone();
                    showNotification(`🛎️ 家用【${timerName}】时间已到！请进行下一步。`);
                }
            }, 1000);

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

// --- 5. Web Audio API 音效播放器 ---
function playAlertTone() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        const playNote = (frequency, startTime, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequency, startTime);

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.5, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + duration);
        };

        const now = ctx.currentTime;
        playNote(783.99, now, 0.5);
        playNote(523.25, now + 0.15, 0.8);

    } catch (e) {
        console.warn('音频阻断', e);
    }
}

function showNotification(msg) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('家用肉夹馍助手', { body: msg });
    }
    alert(msg);
}
