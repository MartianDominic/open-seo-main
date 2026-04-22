/**
 * WordPress Platform Adapter
 * Phase 31-03: Platform Adapters
 *
 * Implements PlatformAdapter interface for WordPress REST API v2.
 * Uses Application Password authentication (Basic Auth).
 *
 * WordPress REST API docs: https://developer.wordpress.org/rest-api/
 * Application Passwords: https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/
 */
import type {
  PlatformAdapter,
  CapabilityResult,
  WordPressAdapterConfig,
} from "./BaseAdapter";

// ============================================================================
// WordPress API Types
// ============================================================================

/**
 * WordPress user object from /users/me endpoint.
 */
interface WPUser {
  id: number;
  name: string;
  capabilities: Record<string, boolean>;
}

/**
 * WordPress post object from REST API.
 * Using raw mode (context=edit) returns raw field values.
 */
export interface WPPost {
  id: number;
  title: { rendered: string; raw?: string };
  content: { rendered: string; raw?: string };
  excerpt: { rendered: string; raw?: string };
  status: string;
  slug: string;
  meta?: Record<string, unknown>;
}

// ============================================================================
// WordPress Adapter Implementation
// ============================================================================

/**
 * WordPress platform adapter using REST API v2.
 *
 * Authentication: Basic Auth with username:appPassword.
 * Base URL: {siteUrl}/wp-json/wp/v2
 *
 * @example
 * ```typescript
 * const adapter = new WordPressAdapter({
 *   siteUrl: 'https://example.com',
 *   username: 'admin',
 *   appPassword: 'abcd 1234 efgh 5678',
 * });
 *
 * const result = await adapter.verifyConnection();
 * if (result.connected) {
 *   const post = await adapter.getPost(123);
 * }
 * ```
 */
export class WordPressAdapter implements PlatformAdapter {
  readonly platform = "wordpress" as const;
  readonly siteUrl: string;
  private baseUrl: string;
  private auth: string;

  constructor(config: WordPressAdapterConfig) {
    // Normalize URL - remove trailing slash
    this.siteUrl = config.siteUrl.replace(/\/$/, "");
    this.baseUrl = `${this.siteUrl}/wp-json/wp/v2`;

    // Pre-compute Basic Auth header value
    this.auth = Buffer.from(
      `${config.username}:${config.appPassword}`
    ).toString("base64");
  }

  /**
   * Make an authenticated request to the WordPress REST API.
   *
   * @param endpoint - API endpoint (e.g., '/posts/123')
   * @param options - Fetch options
   * @returns Parsed JSON response
   * @throws Error if response is not OK
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Basic ${this.auth}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`WordPress API error ${res.status}: ${error}`);
    }

    return res.json();
  }

  /**
   * Verify connection is valid and detect capabilities.
   * Calls /users/me to check authentication and read user capabilities.
   *
   * @returns CapabilityResult with connected status and detected capabilities
   */
  async verifyConnection(): Promise<CapabilityResult> {
    try {
      const user = await this.request<WPUser>("/users/me");

      return {
        connected: true,
        capabilities: {
          // If authenticated, user can read (public endpoints)
          canReadPosts: true,
          canWritePosts: user.capabilities?.edit_posts ?? false,
          canReadPages: true,
          canWritePages: user.capabilities?.edit_pages ?? false,
          canReadMedia: true,
          canWriteMedia: user.capabilities?.upload_files ?? false,
        },
      };
    } catch (error) {
      return {
        connected: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Test if the user has write permission for posts.
   * Relies on verifyConnection capabilities check.
   *
   * @returns true if user can write posts
   */
  async testWritePermission(): Promise<boolean> {
    const result = await this.verifyConnection();
    return result.connected && (result.capabilities?.canWritePosts ?? false);
  }

  /**
   * Get a single post by ID with raw content (context=edit).
   *
   * @param postId - WordPress post ID
   * @returns Post object with raw content fields
   */
  async getPost(postId: number): Promise<WPPost> {
    return this.request<WPPost>(`/posts/${postId}?context=edit`);
  }

  /**
   * Update a post by ID.
   * Uses POST method (not PUT) as per WordPress REST API conventions.
   *
   * @param postId - WordPress post ID
   * @param data - Fields to update (title, content, excerpt, meta, etc.)
   * @returns Updated post object
   */
  async updatePost(
    postId: number,
    data: Partial<Pick<WPPost, "title" | "content" | "excerpt" | "meta">> & {
      title?: string;
      content?: string;
    }
  ): Promise<WPPost> {
    return this.request<WPPost>(`/posts/${postId}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Get paginated list of posts.
   *
   * @param params - Pagination and filter params
   * @returns Array of posts
   */
  async getPosts(params?: {
    page?: number;
    per_page?: number;
    status?: string;
  }): Promise<WPPost[]> {
    const query = new URLSearchParams();

    if (params?.page) query.set("page", String(params.page));
    if (params?.per_page) query.set("per_page", String(params.per_page));
    if (params?.status) query.set("status", params.status);
    query.set("context", "edit");

    return this.request<WPPost[]>(`/posts?${query.toString()}`);
  }
}
