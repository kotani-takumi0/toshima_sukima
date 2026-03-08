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
      ? { label: '満開のソメイヨシノ', level: 4 }
      : acceptedCount >= 8
        ? { label: '五分咲き', level: 3 }
        : acceptedCount >= 4
          ? { label: 'つぼみフェーズ', level: 2 }
          : acceptedCount >= 1
            ? { label: '芽吹きフェーズ', level: 1 }
            : { label: '植樹フェーズ', level: 0 };

  const virtueMeta = {
    childcare: { label: '育児支援', color: '#f7a0b8' },
    multicultural: { label: '多文化交流', color: '#f5c2d4' },
    beautification: { label: '地域美化', color: '#fbd5e3' },
    mobility: { label: '移動助っ人', color: '#e8789a' },
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

  const thanksMessages = [
    'いつも来てくれてありがとう。あなたがいると場が明るくなるって、常連さんも言ってたよ。',
    'おかげさまで本当に助かりました。うちの孫と同い年くらいかな、また気軽に来てね。',
    'この前教えてもらったやり方、まだちゃんと覚えてるよ！また来てくれたら嬉しいな。',
    'あなたが手伝ってくれた日は、いつもより笑い声が多い気がするんです。ありがとう。',
    '若い人が来てくれるだけで元気が出るのよ。無理しないで、また空いてるときにね。',
    '子どもたちが「また来て！」って言ってたよ。あなたの読み聞かせ、人気だったみたい。',
    '一緒に打ち水してくれてありがとう。通りがかりのお客さんにも褒められちゃったよ。',
    'ナマステ！あなたが書いてくれたPOP、お客さんに大好評です。本当にありがとう！',
  ];

  const thanksWall = activities.slice(0, 8).map((item, index) => ({
    id: `${item.application.id}-${index}`,
    from: item.provider ? item.provider.name : '地域の方',
    area: resolveArea(item.gig.locationArea),
    at: item.application.createdAt,
    message: thanksMessages[index % thanksMessages.length],
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
    name: '染井 さくら',
    schoolType: 'university',
    schoolName: '立教大学',
    ward: '豊島区',
  });

  const studentB = eligibilityService.registerStudent({
    name: '雑司ヶ谷 ゆうと',
    schoolType: 'highschool',
    schoolName: '豊島高校',
    ward: '豊島区',
  });

  const providerA = eligibilityService.registerProvider({
    name: 'すがも園 よしだ',
    providerType: 'sole_proprietor',
    ward: '豊島区',
  });

  const providerB = eligibilityService.registerProvider({
    name: '雑司が谷 みらい子ども食堂',
    providerType: 'community_facility',
    ward: '豊島区',
  });

  const providerC = eligibilityService.registerProvider({
    name: 'カフェ・ナマステ 大塚店',
    providerType: 'sole_proprietor',
    ward: '豊島区',
  });

  const providerD = eligibilityService.registerProvider({
    name: '駒込銭湯 殿上湯',
    providerType: 'sole_proprietor',
    ward: '豊島区',
  });

  const providerE = eligibilityService.registerProvider({
    name: '目白台 よりあい広場',
    providerType: 'community_facility',
    ward: '豊島区',
  });

  const acceptedScenarios = [
    {
      providerId: providerA.id,
      studentId: studentA.id,
      title: '買い物袋持ち帰りのお手伝い',
      description: 'よしださんの奥さんがスーパーで買いすぎちゃって…。お店からお家まで一緒に持って帰ってくれると助かります',
      category: '移動助っ人',
      locationArea: '巣鴨',
      durationMinutes: 20,
      rewardType: 'hospitality',
      hospitalityDetail: '塩大福と麦茶',
    },
    {
      providerId: providerC.id,
      studentId: studentA.id,
      title: 'お店の日本語メニュー手書き',
      description: 'ラムさんが新しいカレーを出すんだけど、日本語の手書きメニューが上手く書けなくて。一緒に書いてくれる？',
      category: '多文化交流',
      locationArea: '大塚',
      durationMinutes: 30,
      rewardType: 'hospitality',
      hospitalityDetail: 'できたてのチャイとカレー',
    },
    {
      providerId: providerE.id,
      studentId: studentA.id,
      title: 'おじいちゃんのLINE設定',
      description: '「孫にLINEしたいんだけど文字が小さくて…」田中さん（82歳）のスマホ設定を一緒にやってほしい',
      category: '生活支援',
      locationArea: '目白',
      durationMinutes: 30,
      rewardType: 'hospitality',
      hospitalityDetail: 'おばあちゃん手作りの煮物',
    },
    {
      providerId: providerB.id,
      studentId: studentA.id,
      title: 'お迎え待ちの子どもと遊ぶ',
      description: 'お母さんが15分だけ遅れるとき、子どもと一緒に絵を描いたりして待っててくれると助かります',
      category: '育児支援',
      locationArea: '雑司が谷',
      durationMinutes: 20,
      rewardType: 'hospitality',
      hospitalityDetail: 'おやつのホットケーキ',
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
      title: 'お店の前の落ち葉はき',
      description: 'この時期は落ち葉がすごくて…。開店前にお店の前だけサッと掃いてくれると助かります',
      category: '地域美化',
      locationArea: '巣鴨',
      durationMinutes: 20,
      rewardType: 'hospitality',
      hospitalityDetail: 'みたらし団子とお茶',
    },
    {
      providerId: providerD.id,
      title: 'お風呂上がりのおじいちゃんの話し相手',
      description: '常連の佐藤さん、お風呂上がりにいつも一人でラムネ飲んでるんです。30分くらいおしゃべり相手になってくれませんか',
      category: '生活支援',
      locationArea: '駒込',
      durationMinutes: 30,
      rewardType: 'hospitality',
      hospitalityDetail: '瓶ラムネと入浴券',
    },
    {
      providerId: providerC.id,
      title: 'ランチのお皿洗い助っ人',
      description: 'お昼どきだけお皿が追いつかなくて。30分だけ洗い物手伝ってくれたら、ごはん食べていって！',
      category: '店舗サポート',
      locationArea: '大塚',
      durationMinutes: 30,
      rewardType: 'hospitality',
      hospitalityDetail: 'ナンカレーセット',
    },
    {
      providerId: providerE.id,
      title: '回覧板を3軒に届ける',
      description: '足が悪くて回覧板を回せなくなっちゃって…。ご近所3軒にポストインしてくれるだけで大丈夫です',
      category: '生活支援',
      locationArea: '目白',
      durationMinutes: 15,
      rewardType: 'hospitality',
      hospitalityDetail: '庭で採れたみかん',
    },
    {
      providerId: providerB.id,
      title: '公園で子どもの見守り',
      description: 'ちょっとだけ目を離せない子どもたち。ベンチに座って見ててくれるだけで、お母さんたちは安心です',
      category: '育児支援',
      locationArea: '雑司が谷',
      durationMinutes: 30,
      rewardType: 'hospitality',
      hospitalityDetail: 'おにぎりとお味噌汁',
    },
    {
      providerId: providerA.id,
      title: '重い荷物の二階への運び上げ',
      description: 'お米とお砂糖の袋が届いたんだけど、腰が痛くて二階に上げられなくて…。5分で終わります',
      category: '移動助っ人',
      locationArea: '巣鴨',
      durationMinutes: 15,
      rewardType: 'hospitality',
      hospitalityDetail: 'どら焼きとお茶',
    },
    {
      providerId: providerD.id,
      title: '自転車のパンク修理を一緒に',
      description: 'うちのおじいちゃんが自転車のパンク修理やりたいけど目が見えにくくて。横で手元を見てくれるだけでいいんです',
      category: '生活支援',
      locationArea: '駒込',
      durationMinutes: 30,
      rewardType: 'hospitality',
      hospitalityDetail: 'アイスキャンディー',
    },
    {
      providerId: providerC.id,
      title: 'ゴミ出しの曜日を教えてあげて',
      description: '最近引っ越してきたネパール人の家族がゴミの分別がわからなくて困ってます。一緒に説明してくれませんか',
      category: '多文化交流',
      locationArea: '大塚',
      durationMinutes: 20,
      rewardType: 'hospitality',
      hospitalityDetail: 'ラッシーとサモサ',
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
