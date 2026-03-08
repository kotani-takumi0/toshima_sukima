const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { extname, join } = require('node:path');

const { createStore } = require('../domain/store');
const { createEligibilityService } = require('../domain/eligibility-service');
const { createGigService } = require('../domain/gig-service');
const { createApplicationService } = require('../domain/application-service');
const { DomainError } = require('../domain/error');
const { sendJson, readJsonBody, handleError, notFound } = require('./http-utils');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const PUBLIC_DIR = join(process.cwd(), 'public');
const TOSHIMA_AREAS = ['池袋', '目白', '大塚', '巣鴨', '駒込', '雑司が谷', '要町', '千川'];

const store = createStore();
const eligibilityService = createEligibilityService(store);
const gigService = createGigService(store);
const applicationService = createApplicationService(store);

let demoSeeded = false;

function enrichGig(gig) {
  const provider = store.findProviderById(gig.providerId);
  const applications = store.listApplicationsByGig(gig.id).map((item) => ({
    ...item,
    student: store.findStudentById(item.studentId),
  }));

  return {
    ...gig,
    provider,
    applications,
  };
}

function sendLog(method, path, status, message) {
  const event = {
    timestamp: new Date().toISOString(),
    method,
    path,
    status,
    message,
  };
  // MVP段階の監視は構造化ログを標準出力に集約する。
  console.log(JSON.stringify(event));
}

function normalizeText(value) {
  return String(value || '');
}

function inferVirtue(gig) {
  const source = `${normalizeText(gig.category)} ${normalizeText(gig.title)} ${normalizeText(gig.description)}`;

  if (/見守り|育児|保育|子ども/.test(source)) {
    return 'childcare';
  }
  if (/多文化|外国|翻訳|校正|言語/.test(source)) {
    return 'multicultural';
  }
  if (/美化|清掃|ごみ|花壇/.test(source)) {
    return 'beautification';
  }
  return 'mobility';
}

function resolveArea(area) {
  return TOSHIMA_AREAS.includes(area) ? area : '池袋';
}

function rewardSummary(reward) {
  if (reward.type === 'cash') {
    return `${reward.amount}円`;
  }
  return reward.detail;
}

function rewardIcon(reward) {
  if (reward.type === 'cash') {
    return '💴';
  }

  const detail = normalizeText(reward.detail);
  if (/和菓子|大福|団子/.test(detail)) {
    return '🍡';
  }
  if (/まかない|ランチ|食事/.test(detail)) {
    return '🍱';
  }
  if (/招待|無料|チケット/.test(detail)) {
    return '🎫';
  }
  return '🎁';
}

function acceptedActivitiesForStudent(studentId) {
  return store
    .listApplications()
    .filter((application) => application.studentId === studentId && application.status === 'accepted')
    .map((application) => {
      const gig = store.findGigById(application.gigId);
      if (!gig) {
        return null;
      }

      return {
        application,
        gig,
        provider: store.findProviderById(gig.providerId),
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date(b.application.createdAt).getTime() - new Date(a.application.createdAt).getTime()
    );
}

function buildBadgeProgress(activities) {
  const mobilityCount = activities.filter((item) => inferVirtue(item.gig) === 'mobility').length;
  const wagashiCount = activities.filter((item) =>
    /和菓子/.test(`${normalizeText(item.provider && item.provider.name)} ${normalizeText(item.gig.reward && item.gig.reward.detail)}`)
  ).length;
  const multilingualCount = activities.filter(
    (item) => inferVirtue(item.gig) === 'multicultural'
  ).length;

  return [
    {
      key: 'stroller-master',
      title: 'ベビーカー・マスター',
      subtitle: '階段救助10回',
      progress: mobilityCount,
      target: 10,
      earned: mobilityCount >= 10,
    },
    {
      key: 'wagashi-apprentice',
      title: '和菓子屋の弟子',
      subtitle: '特定店舗で5回活動',
      progress: wagashiCount,
      target: 5,
      earned: wagashiCount >= 5,
    },
    {
      key: 'multilingual-bridge',
      title: '多言語の架け橋',
      subtitle: '外国人店主支援3回',
      progress: multilingualCount,
      target: 3,
      earned: multilingualCount >= 3,
    },
  ];
}

function buildDashboard(studentId) {
  const student = store.findStudentById(studentId);
  if (!student) {
    throw new DomainError('学生が存在しません', 404, 'NOT_FOUND');
  }

  const activities = acceptedActivitiesForStudent(studentId);
  const virtueCounter = {
    childcare: 0,
    multicultural: 0,
    beautification: 0,
    mobility: 0,
  };

  const areaCounter = new Map(TOSHIMA_AREAS.map((area) => [area, 0]));
  let totalMinutes = 0;

  activities.forEach((item) => {
    const virtue = inferVirtue(item.gig);
    virtueCounter[virtue] += 1;
    totalMinutes += Number(item.gig.durationMinutes || 0);

    const area = resolveArea(item.gig.locationArea);
    areaCounter.set(area, (areaCounter.get(area) || 0) + 1);
  });

  const coloredAreas = [...areaCounter.values()].filter((count) => count > 0).length;
  const colorizedRate = Math.round((coloredAreas / TOSHIMA_AREAS.length) * 100);
  const acceptedCount = activities.length;

  const stage =
    acceptedCount >= 15
      ? { label: '街の守り樹', level: 4 }
      : acceptedCount >= 8
        ? { label: '花咲く成長期', level: 3 }
        : acceptedCount >= 4
          ? { label: '若木フェーズ', level: 2 }
          : acceptedCount >= 1
            ? { label: '芽吹きフェーズ', level: 1 }
            : { label: '種フェーズ', level: 0 };

  const virtueMeta = {
    childcare: { label: '育児支援', color: '#ff946a' },
    multicultural: { label: '多文化交流', color: '#6ec6ff' },
    beautification: { label: '地域美化', color: '#8ad96c' },
    mobility: { label: '移動助っ人', color: '#f5ca62' },
  };

  const virtues = Object.entries(virtueCounter).map(([key, count]) => ({
    key,
    label: virtueMeta[key].label,
    color: virtueMeta[key].color,
    count,
  }));

  const mapAreas = TOSHIMA_AREAS.map((area) => ({
    area,
    visits: areaCounter.get(area) || 0,
    colored: (areaCounter.get(area) || 0) > 0,
  }));

  const badges = buildBadgeProgress(activities);

  const thanksWall = activities.slice(0, 8).map((item, index) => ({
    id: `${item.application.id}-${index}`,
    from: item.provider ? item.provider.name : '地域の方',
    area: resolveArea(item.gig.locationArea),
    at: item.application.createdAt,
    message: `${item.gig.title}を助けてくれて本当に助かりました。次もぜひお願いします。`,
    tone: index % 2 === 0 ? 'warm' : 'fresh',
  }));

  const hospitalityGallery = activities
    .filter((item) => item.gig.reward && item.gig.reward.type === 'hospitality')
    .slice(0, 8)
    .map((item, index) => ({
      id: `${item.application.id}-gift-${index}`,
      icon: rewardIcon(item.gig.reward),
      title: rewardSummary(item.gig.reward),
      caption: `${resolveArea(item.gig.locationArea)}での体験`,
      providerName: item.provider ? item.provider.name : '地域の方',
    }));

  const distinctPeople = new Set(
    activities
      .map((item) => (item.provider ? item.provider.id : null))
      .filter(Boolean)
  ).size;

  const points = acceptedCount * 120 + virtueCounter.multicultural * 25 + virtueCounter.childcare * 20;
  const childcareIndex = virtueCounter.childcare * 3;
  const renovationThreshold = 1800;

  return {
    student,
    summary: {
      acceptedCount,
      metPeople: distinctPeople,
      totalMinutes,
      colorizedRate,
    },
    tree: {
      stage,
      heightPercent: Math.min(100, 18 + acceptedCount * 7),
      virtues,
    },
    map: {
      areas: mapAreas,
    },
    badges,
    thanksWall,
    hospitalityGallery,
    assets: {
      points,
      childcareIndex,
      renovationRemaining: Math.max(0, renovationThreshold - points),
      returnCounterRemaining: Math.max(0, 20 - acceptedCount),
    },
    digest: {
      rescues: virtueCounter.mobility,
      encounters: distinctPeople,
      yearsProjection: Math.round((acceptedCount / 4) * 10),
    },
  };
}

function seedDemoData() {
  if (demoSeeded) {
    return {
      seeded: false,
      students: store.listStudents(),
      providers: store.listProviders(),
      recommendedStudentId: store.listStudents()[0] ? store.listStudents()[0].id : null,
    };
  }

  const studentA = eligibilityService.registerStudent({
    name: '池袋 花子',
    schoolType: 'university',
    schoolName: '豊島未来大学',
    ward: '豊島区',
  });

  const studentB = eligibilityService.registerStudent({
    name: '大塚 太郎',
    schoolType: 'highschool',
    schoolName: '豊島学園高校',
    ward: '豊島区',
  });

  const providerA = eligibilityService.registerProvider({
    name: '巣鴨和菓子 さくら庵',
    providerType: 'sole_proprietor',
    ward: '豊島区',
  });

  const providerB = eligibilityService.registerProvider({
    name: '池袋コミュニティスペース ひだまり',
    providerType: 'community_facility',
    ward: '豊島区',
  });

  const providerC = eligibilityService.registerProvider({
    name: '目白グローバル食堂',
    providerType: 'sole_proprietor',
    ward: '豊島区',
  });

  const acceptedScenarios = [
    {
      providerId: providerB.id,
      studentId: studentA.id,
      title: '宿題見守りサポート',
      description: '親御さんの作業中に60分の宿題見守り',
      category: '育児支援',
      locationArea: '池袋',
      durationMinutes: 60,
      rewardType: 'hospitality',
      hospitalityDetail: 'ドリンクとお礼カード',
    },
    {
      providerId: providerA.id,
      studentId: studentA.id,
      title: 'ベビーカー階段サポート',
      description: '駅階段での移動助っ人',
      category: '移動助っ人',
      locationArea: '巣鴨',
      durationMinutes: 30,
      rewardType: 'hospitality',
      hospitalityDetail: '和菓子セット',
    },
    {
      providerId: providerC.id,
      studentId: studentA.id,
      title: 'メニュー日本語校正',
      description: '外国人店主向けに30分の日本語チェック',
      category: '多文化交流',
      locationArea: '目白',
      durationMinutes: 30,
      rewardType: 'cash',
      cashAmount: 1800,
    },
    {
      providerId: providerB.id,
      studentId: studentA.id,
      title: '高齢者スマホお困り解決',
      description: '文字サイズ設定とLINE操作の説明',
      category: '生活支援',
      locationArea: '大塚',
      durationMinutes: 30,
      rewardType: 'hospitality',
      hospitalityDetail: '地域イベント招待券',
    },
  ];

  acceptedScenarios.forEach((scenario) => {
    const gig = gigService.createGig(scenario);
    const application = applicationService.applyToGig({
      gigId: gig.id,
      studentId: scenario.studentId,
    });
    applicationService.acceptApplication(application.id);
  });

  const openScenarios = [
    {
      providerId: providerA.id,
      title: '和菓子屋の陳列お手伝い',
      description: '開店前の陳列を30分だけお手伝い',
      category: '店舗サポート',
      locationArea: '巣鴨',
      durationMinutes: 30,
      rewardType: 'hospitality',
      hospitalityDetail: 'できたて大福',
    },
    {
      providerId: providerB.id,
      title: 'イベント設営サポート',
      description: '公民館イベントの椅子並べと案内',
      category: '地域イベント',
      locationArea: '雑司が谷',
      durationMinutes: 45,
      rewardType: 'hospitality',
      hospitalityDetail: '豊島区イベント無料招待',
    },
    {
      providerId: providerC.id,
      title: '買い物袋運搬サポート',
      description: '高齢者宅まで買い物袋を運ぶ',
      category: '移動助っ人',
      locationArea: '目白',
      durationMinutes: 30,
      rewardType: 'cash',
      cashAmount: 1200,
    },
    {
      providerId: providerB.id,
      title: '放課後の学習見守り',
      description: 'コミュニティスペースでの宿題見守り',
      category: '育児支援',
      locationArea: '池袋',
      durationMinutes: 60,
      rewardType: 'hospitality',
      hospitalityDetail: 'まかないカレー',
    },
    {
      providerId: providerC.id,
      title: '英語メニューの日本語ニュアンス調整',
      description: '多文化店舗のメニュー改善',
      category: '多文化交流',
      locationArea: '要町',
      durationMinutes: 30,
      rewardType: 'cash',
      cashAmount: 1500,
    },
    {
      providerId: providerA.id,
      title: '商店街花壇の水やり',
      description: '駅前花壇の軽作業',
      category: '地域美化',
      locationArea: '駒込',
      durationMinutes: 30,
      rewardType: 'hospitality',
      hospitalityDetail: '季節のどら焼き',
    },
  ];

  openScenarios.forEach((scenario) => {
    gigService.createGig(scenario);
  });

  demoSeeded = true;

  return {
    seeded: true,
    students: store.listStudents(),
    providers: store.listProviders(),
    recommendedStudentId: studentA.id,
    secondaryStudentId: studentB.id,
  };
}

async function serveStatic(req, res, pathname) {
  const normalizedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = join(PUBLIC_DIR, normalizedPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    notFound(res);
    return;
  }

  try {
    const file = await readFile(filePath);
    const extension = extname(filePath);
    const contentType =
      extension === '.html'
        ? 'text/html; charset=utf-8'
        : extension === '.js'
          ? 'application/javascript; charset=utf-8'
          : extension === '.css'
            ? 'text/css; charset=utf-8'
            : 'text/plain; charset=utf-8';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(file);
  } catch {
    notFound(res);
  }
}

async function handleApi(req, res, url) {
  const { method } = req;
  const { pathname, searchParams } = url;

  try {
    if (method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, { status: 'ok' });
      sendLog(method, pathname, 200, 'health check');
      return;
    }

    if (method === 'GET' && pathname === '/api/bootstrap') {
      sendJson(res, 200, {
        students: store.listStudents(),
        providers: store.listProviders(),
      });
      sendLog(method, pathname, 200, 'bootstrap fetched');
      return;
    }

    if (method === 'POST' && pathname === '/api/demo/seed') {
      const seeded = seedDemoData();
      sendJson(res, 201, seeded);
      sendLog(method, pathname, 201, 'demo data seeded');
      return;
    }

    if (method === 'GET' && pathname === '/api/dashboard') {
      const studentId = searchParams.get('studentId');
      if (!studentId) {
        throw new DomainError('studentIdは必須です', 400, 'VALIDATION_ERROR');
      }

      const dashboard = buildDashboard(studentId);
      sendJson(res, 200, dashboard);
      sendLog(method, pathname, 200, 'dashboard fetched');
      return;
    }

    if (method === 'POST' && pathname === '/api/students') {
      const body = await readJsonBody(req);
      const student = eligibilityService.registerStudent(body);
      sendJson(res, 201, student);
      sendLog(method, pathname, 201, 'student registered');
      return;
    }

    if (method === 'POST' && pathname === '/api/providers') {
      const body = await readJsonBody(req);
      const provider = eligibilityService.registerProvider(body);
      sendJson(res, 201, provider);
      sendLog(method, pathname, 201, 'provider registered');
      return;
    }

    if (method === 'POST' && pathname === '/api/gigs') {
      const body = await readJsonBody(req);
      const gig = gigService.createGig(body);
      sendJson(res, 201, enrichGig(gig));
      sendLog(method, pathname, 201, 'gig created');
      return;
    }

    if (method === 'GET' && pathname === '/api/gigs') {
      const category = searchParams.get('category');
      const gigs = gigService.listOpenGigs({ category }).map(enrichGig);
      sendJson(res, 200, { items: gigs });
      sendLog(method, pathname, 200, 'gig list fetched');
      return;
    }

    const applyMatch = pathname.match(/^\/api\/gigs\/(gig_\d+)\/apply$/);
    if (method === 'POST' && applyMatch) {
      const body = await readJsonBody(req);
      const gigId = applyMatch[1];
      const application = applicationService.applyToGig({ gigId, studentId: body.studentId });
      sendJson(res, 201, application);
      sendLog(method, pathname, 201, 'application created');
      return;
    }

    const acceptMatch = pathname.match(/^\/api\/applications\/(app_\d+)\/accept$/);
    if (method === 'POST' && acceptMatch) {
      const applicationId = acceptMatch[1];
      const application = applicationService.acceptApplication(applicationId);
      sendJson(res, 200, application);
      sendLog(method, pathname, 200, 'application accepted');
      return;
    }

    notFound(res);
    sendLog(method, pathname, 404, 'api route not found');
  } catch (error) {
    handleError(res, error);
    const status = error && typeof error.status === 'number' ? error.status : 500;
    const message = error && error.message ? error.message : 'unexpected error';
    sendLog(method, pathname, status, message);
  }
}

const server = createServer(async (req, res) => {
  const host = req.headers.host || `localhost:${PORT}`;
  const url = new URL(req.url, `http://${host}`);

  if (url.pathname.startsWith('/api/')) {
    await handleApi(req, res, url);
    return;
  }

  await serveStatic(req, res, url.pathname);
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

module.exports = {
  server,
};
