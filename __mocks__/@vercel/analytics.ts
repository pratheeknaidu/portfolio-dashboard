// Jest auto-mock (same convention as firebase-admin / yahoo-finance2): placed
// next to node_modules, it replaces the module in every test with no explicit
// jest.mock() call. Two reasons it has to exist:
//   1. The real package ships ESM (dist/index.mjs), which Jest does not
//      transform inside node_modules — importing it throws a parse error.
//   2. Tests should never emit real analytics events.
export const track = jest.fn();
