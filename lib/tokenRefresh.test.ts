/**
 * Token Refresh Tests
 * Run with: npm test -- tokenRefresh.test.ts
 */

import { refreshAccessTokenIfNeeded } from "./tokenRefresh";

// Mock fetch globally
global.fetch = jest.fn();

// Mock Supabase
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({ error: null })),
      })),
    })),
  })),
}));

describe("refreshAccessTokenIfNeeded", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
    process.env.MICROSOFT_CLIENT_ID = "test-client-id";
    process.env.MICROSOFT_CLIENT_SECRET = "test-secret";
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return existing token if not expired", async () => {
    const futureExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min future
    const oldToken = "old-token";

    const result = await refreshAccessTokenIfNeeded(
      "user-123",
      oldToken,
      "refresh-token",
      futureExpiry
    );

    expect(result).toBe(oldToken);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("should refresh token if expired", async () => {
    const pastExpiry = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min past
    const newToken = "new-access-token";

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: newToken,
        refresh_token: "new-refresh-token",
        expires_in: 3600,
      }),
    });

    const result = await refreshAccessTokenIfNeeded(
      "user-123",
      "old-token",
      "refresh-token",
      pastExpiry
    );

    expect(result).toBe(newToken);
    expect(fetch).toHaveBeenCalledWith(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("should return old token if refresh fails", async () => {
    const pastExpiry = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const oldToken = "old-token";

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      text: async () => "Error refreshing token",
    });

    const result = await refreshAccessTokenIfNeeded(
      "user-123",
      oldToken,
      "refresh-token",
      pastExpiry
    );

    expect(result).toBe(oldToken); // Falls back to old token
  });
});
