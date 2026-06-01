export const createSessionRepositoryMock = () => ({
  getSession: jest.fn(),
  setSession: jest.fn(),
  deleteSession: jest.fn(),
});
