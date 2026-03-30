export const adminDb = {
  collection: jest.fn().mockReturnThis(),
  doc: jest.fn().mockReturnThis(),
  get: jest.fn(),
  set: jest.fn(),
};

export const adminAuth = {
  verifyIdToken: jest.fn(),
};
