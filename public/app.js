const state = {
  students: [],
  providers: [],
  selectedStudentId: '',
};

const numberFormat = new Intl.NumberFormat('ja-JP');
const timeFormat = new Intl.DateTimeFormat('ja-JP', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/* ── Tab navigation ── */
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

function switchTab(tabId) {
  tabButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  tabContents.forEach((content) => {
    content.classList.toggle('active', content.id === `tab-${tabId}`);
  });

  if (tabId === 'quests') {
    renderGigs().catch((error) => appendLog(`クエスト更新失敗: ${error.message}`, true));
    updateOnboardingBanner();
  }
  if (tabId === 'mypage' || tabId === 'thanks') {
    loadAndRenderDashboard().catch((error) => appendLog(`マイページ更新失敗: ${error.message}`, true));
  }
}

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

/* ── DOM elements ── */
const studentForm = document.getElementById('student-form');
const providerForm = document.getElementById('provider-form');
const gigForm = document.getElementById('gig-form');
const providerSelect = document.getElementById('provider-select');
const rewardTypeSelect = document.getElementById('reward-type');
const rewardLabel = document.getElementById('reward-label');
const rewardValue = document.getElementById('reward-value');
const seedDemoButton = document.getElementById('seed-demo');
const seedDemoInlineButton = document.getElementById('seed-demo-inline');
const refreshAllButton = document.getElementById('refresh-all');
const ctaFindQuest = document.getElementById('cta-find-quest');
const ctaDemo = document.getElementById('cta-demo');
const onboardingBanner = document.getElementById('onboarding-banner');

const slotTemplate = document.getElementById('slot-template');
const slotMinutesInput = document.getElementById('slot-minutes');
const slotAreaFilter = document.getElementById('slot-area-filter');
const categoryFilter = document.getElementById('category-filter');
const refreshGigsButton = document.getElementById('refresh-gigs');
const gigList = document.getElementById('gig-list');

const studentApplySelect = document.getElementById('student-apply-select');
const studentDashboardSelect = document.getElementById('student-dashboard-select');
const refreshDashboardButton = document.getElementById('refresh-dashboard');

const treeStage = document.getElementById('tree-stage');
const treeTrunk = document.getElementById('tree-trunk');
const treeCrown = document.getElementById('tree-crown');
const treeFruitCloud = document.getElementById('tree-fruit-cloud');
const treeGrowthProgress = document.getElementById('tree-growth-progress');
const treeGrowthMeta = document.getElementById('tree-growth-meta');
const treeKpiCount = document.getElementById('tree-kpi-count');
const treeKpiPeople = document.getElementById('tree-kpi-people');
const treeKpiTime = document.getElementById('tree-kpi-time');

const virtueFruits = document.getElementById('virtue-fruits');
const mapRate = document.getElementById('map-rate');
const areaMap = document.getElementById('area-map');
const badgeList = document.getElementById('badge-list');
const thanksWall = document.getElementById('thanks-wall');
const hospitalityGallery = document.getElementById('hospitality-gallery');
const logFeed = document.getElementById('log-feed');

const SLOT_PRESETS = {
  campus_morning: { minutes: 30, area: '池袋' },
  between_classes: { minutes: 60, area: '目白' },
  after_school: { minutes: 45, area: '巣鴨' },
};

const FRUIT_POSITIONS = [
  [48, 20],
  [30, 28],
  [66, 30],
  [21, 43],
  [74, 42],
  [41, 38],
  [58, 45],
  [34, 58],
  [63, 58],
  [49, 52],
  [25, 34],
  [69, 20],
  [38, 23],
  [57, 26],
  [45, 65],
  [27, 52],
  [73, 53],
  [53, 36],
  [35, 46],
  [61, 44],
];

function formatNumber(value) {
  return numberFormat.format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function appendLog(message, isError = false) {
  const row = document.createElement('p');
  row.textContent = `${timeFormat.format(new Date())} ${message}`;
  row.style.color = isError ? '#a32626' : '#223035';
  logFeed.prepend(row);
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  const text = await response.text();
  let body = {};

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = {};
    }
  }

  if (!response.ok) {
    const message = body && body.error && body.error.message ? body.error.message : 'APIエラー';
    throw new Error(message);
  }

  return body;
}

function fillSelect(select, items, labelBuilder) {
  select.innerHTML = '';

  if (!items.length) {
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '学生を選択してください';
    select.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = labelBuilder(item);
    select.appendChild(option);
  });
}

function syncSelectedStudent(idFromAction) {
  const validIds = new Set(state.students.map((student) => student.id));

  if (idFromAction && validIds.has(idFromAction)) {
    state.selectedStudentId = idFromAction;
  } else if (!validIds.has(state.selectedStudentId)) {
    state.selectedStudentId = state.students[0] ? state.students[0].id : '';
  }

  if (state.selectedStudentId) {
    studentApplySelect.value = state.selectedStudentId;
    studentDashboardSelect.value = state.selectedStudentId;
  }
}

function syncSelects(preferredStudentId) {
  fillSelect(providerSelect, state.providers, (provider) => `${provider.name}`);
  fillSelect(studentApplySelect, state.students, (student) => student.name);
  fillSelect(studentDashboardSelect, state.students, (student) => student.name);
  syncSelectedStudent(preferredStudentId);
}

function updateOnboardingBanner() {
  if (onboardingBanner) {
    onboardingBanner.style.display = state.students.length === 0 ? 'block' : 'none';
  }
}

async function loadBootstrap(preferredStudentId) {
  const result = await request('/api/bootstrap');
  state.students = result.students;
  state.providers = result.providers;
  syncSelects(preferredStudentId);
  updateOnboardingBanner();
}

function rewardIcon(reward) {
  if (!reward) {
    return '🎁';
  }
  if (reward.type === 'cash') {
    return '💴';
  }
  if (/和菓子|大福|どら焼き|団子/.test(reward.detail || '')) {
    return '🍡';
  }
  if (/まかない|ランチ|カレー/.test(reward.detail || '')) {
    return '🍱';
  }
  if (/招待|チケット|無料/.test(reward.detail || '')) {
    return '🎫';
  }
  return '🎁';
}

function rewardText(reward) {
  if (!reward) {
    return '未設定';
  }
  return reward.type === 'cash' ? `${formatNumber(reward.amount)}円` : reward.detail;
}

function appRows(gig) {
  return '';
}

function matchingScore(gig, slotMinutes, slotArea) {
  const duration = Number(gig.durationMinutes || 0);
  const diff = Math.abs(duration - slotMinutes);
  let score = Math.max(0, 40 - diff);

  if (slotArea && gig.locationArea === slotArea) {
    score += 35;
  }

  return score;
}

async function renderGigs() {
  const category = categoryFilter.value.trim();
  const slotMinutes = Number(slotMinutesInput.value || 60);
  const slotArea = slotAreaFilter.value.trim();
  const query = category ? `?category=${encodeURIComponent(category)}` : '';

  const result = await request(`/api/gigs${query}`);

  const matched = result.items
    .filter((gig) => Number(gig.durationMinutes) <= slotMinutes + 15)
    .filter((gig) => (slotArea ? gig.locationArea === slotArea : true))
    .sort((a, b) => matchingScore(b, slotMinutes, slotArea) - matchingScore(a, slotMinutes, slotArea));

  if (!matched.length) {
    gigList.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon" aria-hidden="true">&#128270;</div>
      <h3>条件に合うクエストがありません</h3>
      <p>テンプレートか絞り込み条件を変更してみましょう</p>
    </div>`;
    return;
  }

  gigList.innerHTML = matched
    .map((gig) => {
      const providerName = gig.provider ? gig.provider.name : gig.providerId;
      const score = matchingScore(gig, slotMinutes, slotArea);

      return `<article class="quest-card">
        <div class="quest-top">
          <div>
            <h3 class="quest-title">${escapeHtml(gig.title)}</h3>
            <p class="quest-meta">${escapeHtml(gig.description)}</p>
          </div>
          <div class="chip">適合度 ${Math.max(0, Math.min(100, score))}%</div>
        </div>
        <div class="chips">
          <span class="chip">${escapeHtml(formatNumber(gig.durationMinutes))}分</span>
          <span class="chip">${escapeHtml(gig.locationArea || '池袋')}</span>
          <span class="chip">${escapeHtml(gig.category)}</span>
          <span class="chip">${rewardIcon(gig.reward)} ${escapeHtml(rewardText(gig.reward))}</span>
          <span class="chip">${escapeHtml(providerName)}</span>
        </div>
        <div class="quest-actions">
          <button data-apply="${escapeHtml(gig.id)}" class="btn-sub" type="button">このクエストに応募</button>
        </div>
      </article>`;
    })
    .join('');
}

function renderTreeFruitCloud(virtues) {
  if (!treeFruitCloud) {
    return;
  }

  treeFruitCloud.innerHTML = '';

  const pool = [];
  virtues.forEach((virtue) => {
    const count = Math.min(virtue.count, 8);
    for (let index = 0; index < count; index += 1) {
      pool.push(virtue.color);
    }
  });

  if (!pool.length) {
    return;
  }

  // Render blossoms on the crown
  pool.slice(0, FRUIT_POSITIONS.length).forEach((color, index) => {
    const [left, top] = FRUIT_POSITIONS[index];
    const blossom = document.createElement('span');
    blossom.className = 'tree-fruit';
    blossom.style.left = `${left}%`;
    blossom.style.top = `${top}%`;
    blossom.style.background = color;
    treeFruitCloud.appendChild(blossom);
  });

  // Add falling petals
  const petalCount = Math.min(pool.length, 8);
  for (let i = 0; i < petalCount; i += 1) {
    const petal = document.createElement('span');
    petal.className = 'tree-petal';
    const startLeft = 20 + Math.random() * 60;
    const startTop = 15 + Math.random() * 30;
    petal.style.left = `${startLeft}%`;
    petal.style.top = `${startTop}%`;
    petal.style.background = pool[i % pool.length];
    petal.style.animationDuration = `${3 + Math.random() * 4}s`;
    petal.style.animationDelay = `${Math.random() * 5}s`;
    treeFruitCloud.appendChild(petal);
  }
}

function renderDashboard(dashboard) {
  const stageLevel = Number(dashboard.tree.stage.level || 0);

  treeStage.textContent = `${dashboard.student.name}さんのソメイヨシノ: ${dashboard.tree.stage.label} / 活動${formatNumber(dashboard.summary.acceptedCount)}回`;

  if (treeTrunk) {
    treeTrunk.style.height = `${Math.max(30, dashboard.tree.heightPercent)}%`;
  }

  if (treeCrown) {
    treeCrown.style.transform = `translateX(-50%) scale(${0.88 + stageLevel * 0.08})`;
  }

  if (treeGrowthProgress) {
    treeGrowthProgress.value = Math.max(0, Math.min(100, dashboard.summary.colorizedRate));
  }

  if (treeGrowthMeta) {
    treeGrowthMeta.textContent = `地図色づき率 ${formatNumber(dashboard.summary.colorizedRate)}%`;
  }

  if (treeKpiCount) {
    treeKpiCount.textContent = `${formatNumber(dashboard.summary.acceptedCount)}回`;
  }

  if (treeKpiPeople) {
    treeKpiPeople.textContent = `${formatNumber(dashboard.summary.metPeople)}人`;
  }

  if (treeKpiTime) {
    treeKpiTime.textContent = `${formatNumber(dashboard.summary.totalMinutes)}分`;
  }

  renderTreeFruitCloud(dashboard.tree.virtues);

  virtueFruits.innerHTML = dashboard.tree.virtues
    .map(
      (virtue) => `<div class="fruit-item"><strong><span class="fruit-dot" style="background:${escapeHtml(virtue.color)}"></span>${escapeHtml(virtue.label)}</strong><div>${formatNumber(virtue.count)}輪の花</div></div>`
    )
    .join('');

  mapRate.textContent = `${formatNumber(dashboard.summary.colorizedRate)}%`;
  areaMap.innerHTML = dashboard.map.areas
    .map(
      (area) => `<div class="area-cell ${area.colored ? 'colored' : ''}">${escapeHtml(area.area)}<br/>${formatNumber(area.visits)}回</div>`
    )
    .join('');

  badgeList.innerHTML = dashboard.badges
    .map(
      (badge) => `<article class="badge-item ${badge.earned ? 'earned' : ''}"><strong>${escapeHtml(badge.title)}</strong><div>${escapeHtml(badge.subtitle)}</div><div class="progress">${formatNumber(badge.progress)} / ${formatNumber(badge.target)} ${badge.earned ? '達成' : '進行中'}</div></article>`
    )
    .join('');

  thanksWall.innerHTML = dashboard.thanksWall.length
    ? dashboard.thanksWall
        .map(
          (note) => `<article class="sticky-note ${escapeHtml(note.tone)}"><p>${escapeHtml(note.message)}</p><span>${escapeHtml(note.from)} / ${escapeHtml(note.area)}</span></article>`
        )
        .join('')
    : `<div class="empty-state">
        <div class="empty-state-icon" aria-hidden="true">&#128140;</div>
        <h3>メッセージはまだありません</h3>
        <p>クエストに参加して採用されると、事業者からのメッセージが届きます</p>
      </div>`;

  hospitalityGallery.innerHTML = dashboard.hospitalityGallery.length
    ? dashboard.hospitalityGallery
        .map(
          (item) => `<article class="gallery-item"><div class="gallery-icon">${escapeHtml(item.icon)}</div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.providerName)}</span><span>${escapeHtml(item.caption)}</span></article>`
        )
        .join('')
    : '<div class="card-lite" style="grid-column:1/-1;text-align:center;padding:20px;color:var(--ink-500);">おもてなし履歴がまだありません</div>';

}

async function loadAndRenderDashboard() {
  if (!state.selectedStudentId) {
    treeStage.textContent = '学生を登録またはデモデータ投入してください。';
    return;
  }

  const dashboard = await request(`/api/dashboard?studentId=${encodeURIComponent(state.selectedStudentId)}`);
  renderDashboard(dashboard);
}

/* ── Seed demo helper ── */
async function seedDemo() {
  try {
    const result = await request('/api/demo/seed', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    state.students = result.students;
    state.providers = result.providers;
    syncSelects(result.recommendedStudentId);
    updateOnboardingBanner();
    appendLog(result.seeded ? 'デモデータを投入しました' : 'デモデータは投入済みです');
    await renderGigs();
    await loadAndRenderDashboard();
  } catch (error) {
    appendLog(`デモ投入失敗: ${error.message}`, true);
  }
}

/* ── Event listeners ── */

// Hero CTA buttons
ctaFindQuest.addEventListener('click', () => switchTab('quests'));
ctaDemo.addEventListener('click', async () => {
  await seedDemo();
  switchTab('quests');
});

studentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(studentForm);

  try {
    const student = await request('/api/students', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    state.students.push(student);
    syncSelects(student.id);
    updateOnboardingBanner();
    appendLog(`学生登録: ${student.name}`);
    studentForm.reset();
    studentForm.ward.value = '豊島区';
    await loadAndRenderDashboard();
  } catch (error) {
    appendLog(`学生登録失敗: ${error.message}`, true);
  }
});

providerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(providerForm);

  try {
    const provider = await request('/api/providers', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    state.providers.push(provider);
    syncSelects();
    appendLog(`事業者登録: ${provider.name}`);
    providerForm.reset();
    providerForm.ward.value = '豊島区';
  } catch (error) {
    appendLog(`事業者登録失敗: ${error.message}`, true);
  }
});

rewardTypeSelect.addEventListener('change', () => {
  if (rewardTypeSelect.value === 'cash') {
    rewardLabel.textContent = '金額（円）';
    rewardValue.type = 'number';
    rewardValue.placeholder = '1200';
  } else {
    rewardLabel.textContent = '内容説明';
    rewardValue.type = 'text';
    rewardValue.placeholder = '和菓子セット / まかない / イベント招待…';
  }
});

gigForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(gigForm);
  const raw = Object.fromEntries(formData.entries());

  const payload = {
    providerId: raw.providerId,
    title: raw.title,
    description: raw.description,
    category: raw.category,
    locationArea: raw.locationArea,
    durationMinutes: Number(raw.durationMinutes),
    rewardType: raw.rewardType,
  };

  if (raw.rewardType === 'cash') {
    payload.cashAmount = Number(raw.rewardValue);
  } else {
    payload.hospitalityDetail = raw.rewardValue;
  }

  try {
    await request('/api/gigs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    appendLog(`クエスト公開: ${raw.title}`);
    gigForm.reset();
    rewardTypeSelect.value = 'cash';
    rewardLabel.textContent = '金額（円）';
    rewardValue.type = 'number';
    await renderGigs();
  } catch (error) {
    appendLog(`クエスト作成失敗: ${error.message}`, true);
  }
});

seedDemoButton.addEventListener('click', seedDemo);

if (seedDemoInlineButton) {
  seedDemoInlineButton.addEventListener('click', async () => {
    await seedDemo();
  });
}

refreshAllButton.addEventListener('click', async () => {
  try {
    await loadBootstrap(state.selectedStudentId);
    await renderGigs();
    await loadAndRenderDashboard();
    appendLog('全体を再読み込みしました');
  } catch (error) {
    appendLog(`再読み込み失敗: ${error.message}`, true);
  }
});

slotTemplate.addEventListener('change', () => {
  const preset = SLOT_PRESETS[slotTemplate.value];
  if (!preset) {
    return;
  }

  slotMinutesInput.value = String(preset.minutes);
  slotAreaFilter.value = preset.area;
  renderGigs().catch((error) => appendLog(`クエスト更新失敗: ${error.message}`, true));
});

refreshGigsButton.addEventListener('click', () => {
  renderGigs().catch((error) => appendLog(`クエスト更新失敗: ${error.message}`, true));
});

categoryFilter.addEventListener('change', () => {
  renderGigs().catch((error) => appendLog(`クエスト更新失敗: ${error.message}`, true));
});

slotMinutesInput.addEventListener('change', () => {
  renderGigs().catch((error) => appendLog(`クエスト更新失敗: ${error.message}`, true));
});

slotAreaFilter.addEventListener('change', () => {
  renderGigs().catch((error) => appendLog(`クエスト更新失敗: ${error.message}`, true));
});

studentApplySelect.addEventListener('change', () => {
  syncSelectedStudent(studentApplySelect.value);
  loadAndRenderDashboard().catch((error) => appendLog(`マイページ更新失敗: ${error.message}`, true));
});

studentDashboardSelect.addEventListener('change', () => {
  syncSelectedStudent(studentDashboardSelect.value);
  loadAndRenderDashboard().catch((error) => appendLog(`マイページ更新失敗: ${error.message}`, true));
});

refreshDashboardButton.addEventListener('click', () => {
  loadAndRenderDashboard().catch((error) => appendLog(`マイページ更新失敗: ${error.message}`, true));
});

gigList.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const applyId = target.getAttribute('data-apply');

  if (applyId) {
    try {
      if (!state.selectedStudentId) {
        appendLog('応募には学生登録が必要です', true);
        return;
      }

      await request(`/api/gigs/${applyId}/apply`, {
        method: 'POST',
        body: JSON.stringify({ studentId: state.selectedStudentId }),
      });
      appendLog(`応募完了`);
      await renderGigs();
    } catch (error) {
      appendLog(`応募失敗: ${error.message}`, true);
    }
  }
});

async function bootstrap() {
  try {
    await loadBootstrap();
    appendLog('初期化完了');
  } catch (error) {
    appendLog(`初期化失敗: ${error.message}`, true);
  }
}

bootstrap();
