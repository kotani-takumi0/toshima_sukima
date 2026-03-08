const { assert } = require('./error');

function createApplicationService(store) {
  return {
    applyToGig(input) {
      const { gigId, studentId } = input;

      assert(Boolean(gigId), 'gigIdは必須です', 400);
      assert(Boolean(studentId), 'studentIdは必須です', 400);

      const gig = store.findGigById(gigId);
      assert(Boolean(gig), '募集が存在しません', 404, 'NOT_FOUND');
      assert(gig.status === 'open', '公開中の募集のみ応募できます', 409, 'CONFLICT');
      assert(Boolean(store.findStudentById(studentId)), '学生が存在しません', 404, 'NOT_FOUND');

      const alreadyApplied = store
        .listApplicationsByGig(gigId)
        .some((item) => item.studentId === studentId);
      assert(!alreadyApplied, '同じ募集への重複応募はできません', 409, 'CONFLICT');

      return store.addApplication({ gigId, studentId });
    },

    acceptApplication(applicationId) {
      assert(Boolean(applicationId), 'applicationIdは必須です', 400);

      const application = store.findApplicationById(applicationId);
      assert(Boolean(application), '応募が存在しません', 404, 'NOT_FOUND');

      const gig = store.findGigById(application.gigId);
      assert(Boolean(gig), '募集が存在しません', 404, 'NOT_FOUND');

      const alreadyAccepted = Boolean(gig.acceptedApplicationId);
      assert(!alreadyAccepted, 'この募集は既に採用済みです', 409, 'CONFLICT');

      application.status = 'accepted';
      gig.status = 'closed';
      gig.acceptedApplicationId = application.id;

      return application;
    },
  };
}

module.exports = {
  createApplicationService,
};
