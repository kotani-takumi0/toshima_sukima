const { assert } = require('./error');

const REWARD_TYPES = new Set(['cash', 'hospitality']);

function createGigService(store) {
  return {
    createGig(input) {
      const {
        providerId,
        title,
        description,
        category,
        locationArea,
        durationMinutes,
        rewardType,
        cashAmount,
        hospitalityDetail,
      } = input;

      assert(Boolean(providerId), 'providerIdは必須です', 400);
      assert(Boolean(store.findProviderById(providerId)), '事業者が存在しません', 404, 'NOT_FOUND');
      assert(Boolean(title), 'タイトルは必須です', 400);
      assert(Boolean(description), '説明は必須です', 400);
      assert(Boolean(category), 'カテゴリは必須です', 400);

      const numericDuration = Number(durationMinutes);
      assert(Number.isFinite(numericDuration), '所要時間は数値で入力してください', 400);
      assert(numericDuration >= 15 && numericDuration <= 120, '所要時間は15〜120分にしてください');

      assert(REWARD_TYPES.has(rewardType), '報酬種別はcashまたはhospitalityのみです');

      let reward;
      if (rewardType === 'cash') {
        const amount = Number(cashAmount);
        assert(Number.isFinite(amount) && amount > 0, 'cash報酬は金額が必須です');
        reward = { type: 'cash', amount };
      } else {
        assert(Boolean(hospitalityDetail), 'hospitality報酬は内容説明が必須です');
        reward = { type: 'hospitality', detail: hospitalityDetail };
      }

      return store.addGig({
        providerId,
        title,
        description,
        category,
        locationArea: locationArea ? String(locationArea) : '池袋',
        durationMinutes: numericDuration,
        reward,
      });
    },

    listOpenGigs(filter = {}) {
      const category = filter.category ? String(filter.category) : '';

      return store
        .listGigs()
        .filter((gig) => gig.status === 'open')
        .filter((gig) => (category ? gig.category === category : true))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
  };
}

module.exports = {
  createGigService,
  REWARD_TYPES,
};
