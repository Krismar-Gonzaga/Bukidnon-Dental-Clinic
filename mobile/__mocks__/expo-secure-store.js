// In-memory stand-in for the device keystore in Jest.
const store = new Map();

module.exports = {
  __esModule: true,
  isAvailableAsync: jest.fn(async () => true),
  getItemAsync: jest.fn(async (key) => (store.has(key) ? store.get(key) : null)),
  setItemAsync: jest.fn(async (key, value) => {
    store.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key) => {
    store.delete(key);
  }),
  __reset: () => store.clear(),
};
