class DomainError extends Error {
  constructor(message, status = 422, code = 'DOMAIN_ERROR') {
    super(message);
    this.name = 'DomainError';
    this.status = status;
    this.code = code;
  }
}

function assert(condition, message, status = 422, code = 'VALIDATION_ERROR') {
  if (!condition) {
    throw new DomainError(message, status, code);
  }
}

module.exports = {
  DomainError,
  assert,
};
