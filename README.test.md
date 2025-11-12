# Testing Guide

This document explains how to run tests for the Attendance System.

## Frontend Tests (React Components)

### Setup

All necessary testing dependencies are installed:
- Vitest (test runner)
- React Testing Library (component testing)
- @testing-library/jest-dom (custom matchers)
- @testing-library/user-event (user interaction simulation)
- jsdom (DOM environment)

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Test Structure

Tests are located next to the files they test:
- `src/contexts/__tests__/AuthContext.test.tsx` - Authentication logic tests
- `src/components/__tests__/PublicFaceScanDialog.test.tsx` - Face scanning component tests

### What's Tested

#### AuthContext Tests
- ✓ Sign in with valid credentials
- ✓ Invalid username handling
- ✓ Wrong password handling
- ✓ RPC error handling
- ✓ Sign out functionality
- ✓ User role fetching
- ✓ Missing user role handling
- ✓ Hook usage validation

#### PublicFaceScanDialog Tests
- ✓ Dialog rendering
- ✓ Camera initialization
- ✓ GPS location display
- ✓ Camera access errors
- ✓ Image capture and upload
- ✓ Geolocation errors
- ✓ Location mismatch handling
- ✓ Dialog closing and cleanup
- ✓ Processing state management

## Test Coverage

### Frontend Components
- **AuthContext**: 100% coverage of authentication flows
- **PublicFaceScanDialog**: Comprehensive coverage of face scanning workflow

## Writing New Tests

### Frontend Component Test Example

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '../../tests/utils/test-utils';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

## Edge Function Testing

Edge functions can be tested locally using Deno's test framework if needed:

```bash
deno test --allow-env --allow-net supabase/functions/your-function/__tests__/index.test.ts
```

**Note**: Edge function tests are not included in the main test suite to avoid Deno dependency downloads during builds.

## Continuous Integration

Tests should be run before:
- Committing code
- Creating pull requests
- Deploying to production

## Troubleshooting

### Common Issues

1. **Tests failing due to missing mocks**: Check `src/tests/mocks/supabase.ts`
2. **Environment variables**: Ensure test environment is properly configured
3. **Async issues**: Use `waitFor` for async operations
4. **Clean up**: Tests clean up automatically via `afterEach`

## Best Practices

1. **Arrange-Act-Assert**: Structure tests clearly
2. **Mock external dependencies**: Don't hit real APIs
3. **Test user behavior**: Focus on what users do, not implementation
4. **Keep tests isolated**: Each test should be independent
5. **Use descriptive names**: Test names should explain what's being tested
