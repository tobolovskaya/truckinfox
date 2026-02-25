# Unit Tests Documentation

## Overview

This project includes comprehensive unit tests for critical business logic, utilities, and hooks. Tests are written using Jest and React Native Testing Library.

## Test Structure

```
__tests__/
├── hooks/
│   ├── useCargoRequests.test.ts      # Cargo request fetching and filtering
│   ├── useCurrentUser.test.ts        # User authentication and profile
│   ├── useFilterState.test.ts        # Filter state management
│   └── useNotifications.test.ts      # Notification handling
├── utils/
│   ├── sanitization.test.ts          # Input validation and XSS prevention
│   ├── fetchWithTimeout.test.ts      # HTTP retry logic and timeouts
│   ├── analytics.test.ts             # Event tracking
│   └── googlePlaces.test.ts          # Google Places API integration
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm test -- --watch
```

### Run tests with coverage
```bash
npm test -- --coverage
```

### Run specific test file
```bash
npm test -- __tests__/hooks/useCargoRequests.test.ts
```

### Run tests matching pattern
```bash
npm test -- --testNamePattern="should fetch"
```

## Test Categories

### 1. Hook Tests

#### useCargoRequests
- Fetching and filtering cargo requests
- Handling loading states
- Error handling
- Sorting functionality
- Cleanup on unmount

#### useCurrentUser
- User authentication flow
- Profile data fetching
- Loading states
- Error handling
- Verified user status checks

#### useFilterState
- Filter state management
- Adding/removing filters
- Clear all filters
- Filter counting and activation checks

#### useNotifications
- Fetching user notifications
- Marking as read
- Deleting notifications
- Unread count tracking
- Grouping by type

### 2. Utility Tests

#### Sanitization
- XSS prevention (script injections)
- HTML tag removal
- SQL injection prevention
- Input length enforcement
- Special character handling

#### Fetch Utilities
- Timeout handling
- Automatic retry with exponential backoff
- HTTP status code handling (4xx, 5xx)
- 408 and 429 retry logic
- Error recovery and logging

#### Analytics
- Event tracking for:
  - Cargo request deletion
  - Review submissions
  - User registration
- Event parameters validation
- Multiple account type support

#### Google Places
- Autocomplete suggestions
- Place details retrieval
- Distance calculations
- Offline fallback (Norwegian cities)
- API retry logic

## Test Coverage

Target coverage by area:
- **Hooks**: 85%+
- **Utilities**: 90%+
- **Critical business logic**: 80%+

Current test count: **100+ test cases**

## Writing New Tests

### Test Template

```typescript
import { renderHook, waitFor } from '@testing-library/react-native';
import { useMyHook } from '../../hooks/useMyHook';

describe('useMyHook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should perform expected behavior', async () => {
    const { result } = renderHook(() => useMyHook());

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.data).toBeDefined();
  });
});
```

## Testing Best Practices

1. **Clear test names**: Use descriptive test names that explain what is being tested
2. **Isolation**: Each test should be independent and not rely on other tests
3. **Mock external dependencies**: Firebase, APIs, and module dependencies should be mocked
4. **Setup and teardown**: Use `beforeEach` and `afterEach` for test setup
5. **Async handling**: Use `waitFor` for async operations
6. **Error scenarios**: Test both happy path and error cases
7. **Edge cases**: Test boundary conditions and special cases

## Common Testing Patterns

### Testing Async Hooks

```typescript
const { result } = renderHook(() => useMyHook());

await waitFor(() => {
  expect(result.current.loading).toBe(false);
});

expect(result.current.data).toBeDefined();
```

### Testing Firebase Calls

```typescript
jest.mock('firebase/firestore', () => ({
  onSnapshot: jest.fn((query, callback) => {
    callback(mockSnapshot);
    return jest.fn(); // unsubscribe
  }),
}));
```

### Testing Retry Logic

```typescript
jest.useFakeTimers();
const promise = fetchWithRetry('url', { retries: 2 });
jest.advanceTimersByTime(100);
await promise;
jest.useRealTimers();
```

## Debugging Tests

### Run single test
```bash
npm test -- --testNamePattern="specific test"
```

### Debug mode
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Check test output
```bash
npm test -- --verbose
```

## CI/CD Integration

Tests can be integrated into CI/CD pipeline:

```bash
npm test -- --coverage --watchAll=false
```

This generates coverage reports for verification gates.

## Known Limitations

1. React Native components require additional mocking
2. Navigation mocking requires explicit configuration
3. Image and animation tests may need special setup
4. Network mocking requires proper fetch/axios stubbing

## Troubleshooting

### "Cannot find module" errors
- Ensure mocks are properly configured in `jest.setup.js`
- Check import paths match actual file locations

### "Timeout" errors
- Increase timeout in test: `jest.setTimeout(10000)`
- Check that promises are properly awaited
- Verify `waitFor` conditions are achievable

### "Act" warnings
- Wrap state changes in `act()`
- Use `waitFor` instead of `setTimeout`

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Native Testing Library](https://testing-library.com/react-native/)
- [Firebase Testing](https://firebase.google.com/docs/emulator-suite/connect_and_prototype)
