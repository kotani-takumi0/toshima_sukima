const test = require('node:test');
const assert = require('node:assert/strict');

const { createStore } = require('../src/domain/store');
const { createEligibilityService } = require('../src/domain/eligibility-service');
const { createGigService } = require('../src/domain/gig-service');
const { createApplicationService } = require('../src/domain/application-service');

function createFixture() {
  const store = createStore();
  return {
    store,
    eligibilityService: createEligibilityService(store),
    gigService: createGigService(store),
    applicationService: createApplicationService(store),
  };
}

test('豊島区外の学生は登録拒否される', () => {
  const { eligibilityService } = createFixture();

  assert.throws(
    () => {
      eligibilityService.registerStudent({
        name: 'A',
        schoolType: 'university',
        schoolName: '区外大学',
        ward: '新宿区',
      });
    },
    {
      message: '豊島区内の学校のみ登録できます',
    }
  );
});

test('cash報酬は金額が必須', () => {
  const { eligibilityService, gigService } = createFixture();

  const provider = eligibilityService.registerProvider({
    name: 'としま工房',
    providerType: 'sole_proprietor',
    ward: '豊島区',
  });

  assert.throws(
    () => {
      gigService.createGig({
        providerId: provider.id,
        title: '買い物補助',
        description: '袋運搬',
        category: '移動助っ人',
        durationMinutes: 30,
        rewardType: 'cash',
      });
    },
    {
      message: 'cash報酬は金額が必須です',
    }
  );
});

test('公開中募集のみカテゴリ絞り込みで取得できる', () => {
  const { eligibilityService, gigService } = createFixture();

  const provider = eligibilityService.registerProvider({
    name: 'コミュニティ拠点',
    providerType: 'community_facility',
    ward: '豊島区',
  });

  gigService.createGig({
    providerId: provider.id,
    title: '宿題見守り',
    description: '60分の見守り',
    category: '見守り',
    durationMinutes: 60,
    rewardType: 'hospitality',
    hospitalityDetail: 'ドリンクチケット',
  });

  gigService.createGig({
    providerId: provider.id,
    title: 'スマホ相談',
    description: '30分の操作サポート',
    category: 'スマホ',
    durationMinutes: 30,
    rewardType: 'cash',
    cashAmount: 1500,
  });

  const onlySmartphone = gigService.listOpenGigs({ category: 'スマホ' });
  assert.equal(onlySmartphone.length, 1);
  assert.equal(onlySmartphone[0].category, 'スマホ');
});

test('採用済み募集には追加採用できない', () => {
  const { eligibilityService, gigService, applicationService } = createFixture();

  const provider = eligibilityService.registerProvider({
    name: '地域店',
    providerType: 'sole_proprietor',
    ward: '豊島区',
  });

  const studentA = eligibilityService.registerStudent({
    name: '学生A',
    schoolType: 'university',
    schoolName: '豊島大学',
    ward: '豊島区',
  });

  const studentB = eligibilityService.registerStudent({
    name: '学生B',
    schoolType: 'highschool',
    schoolName: '豊島高校',
    ward: '豊島区',
  });

  const gig = gigService.createGig({
    providerId: provider.id,
    title: 'メニュー校正',
    description: '外国語メニューの日本語確認',
    category: '校正',
    durationMinutes: 30,
    rewardType: 'hospitality',
    hospitalityDetail: 'ランチ提供',
  });

  const app1 = applicationService.applyToGig({ gigId: gig.id, studentId: studentA.id });
  const app2 = applicationService.applyToGig({ gigId: gig.id, studentId: studentB.id });

  const accepted = applicationService.acceptApplication(app1.id);
  assert.equal(accepted.status, 'accepted');

  assert.throws(
    () => {
      applicationService.acceptApplication(app2.id);
    },
    {
      message: 'この募集は既に採用済みです',
    }
  );
});
