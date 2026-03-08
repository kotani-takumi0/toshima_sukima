function createStore() {
  const data = {
    students: [],
    providers: [],
    gigs: [],
    applications: [],
  };

  const sequence = {
    stu: 0,
    pro: 0,
    gig: 0,
    app: 0,
  };

  const nextId = (prefix) => {
    sequence[prefix] += 1;
    return `${prefix}_${sequence[prefix]}`;
  };

  return {
    addStudent(input) {
      const student = { id: nextId('stu'), ...input };
      data.students.push(student);
      return student;
    },
    addProvider(input) {
      const provider = { id: nextId('pro'), ...input };
      data.providers.push(provider);
      return provider;
    },
    addGig(input) {
      const gig = {
        id: nextId('gig'),
        status: 'open',
        acceptedApplicationId: null,
        createdAt: new Date().toISOString(),
        ...input,
      };
      data.gigs.push(gig);
      return gig;
    },
    addApplication(input) {
      const application = {
        id: nextId('app'),
        status: 'pending',
        createdAt: new Date().toISOString(),
        ...input,
      };
      data.applications.push(application);
      return application;
    },
    listStudents() {
      return [...data.students];
    },
    listProviders() {
      return [...data.providers];
    },
    listGigs() {
      return [...data.gigs];
    },
    listApplications() {
      return [...data.applications];
    },
    listApplicationsByGig(gigId) {
      return data.applications.filter((item) => item.gigId === gigId);
    },
    findStudentById(id) {
      return data.students.find((item) => item.id === id) || null;
    },
    findProviderById(id) {
      return data.providers.find((item) => item.id === id) || null;
    },
    findGigById(id) {
      return data.gigs.find((item) => item.id === id) || null;
    },
    findApplicationById(id) {
      return data.applications.find((item) => item.id === id) || null;
    },
  };
}

module.exports = {
  createStore,
};
