const { assert } = require('./error');

const TOSHIMA_WARD = '豊島区';
const STUDENT_TYPES = new Set(['highschool', 'university']);
const PROVIDER_TYPES = new Set(['sole_proprietor', 'community_facility']);

function createEligibilityService(store) {
  return {
    registerStudent(input) {
      const { name, schoolType, schoolName, ward } = input;

      assert(Boolean(name), '学生名は必須です', 400);
      assert(Boolean(schoolName), '学校名は必須です', 400);
      assert(STUDENT_TYPES.has(schoolType), '学校種別は高校または大学のみです');
      assert(ward === TOSHIMA_WARD, '豊島区内の学校のみ登録できます');

      return store.addStudent({ name, schoolType, schoolName, ward });
    },

    registerProvider(input) {
      const { name, providerType, ward } = input;

      assert(Boolean(name), '事業者名は必須です', 400);
      assert(PROVIDER_TYPES.has(providerType), '事業者種別が不正です');
      assert(ward === TOSHIMA_WARD, '豊島区内の事業者のみ登録できます');

      return store.addProvider({ name, providerType, ward });
    },
  };
}

module.exports = {
  createEligibilityService,
  TOSHIMA_WARD,
  STUDENT_TYPES,
  PROVIDER_TYPES,
};
