/**
 * Base Platform Adapter Interface
 * Phase 31-03: Platform Adapters
 *
 * Defines the contract for all platform adapters (WordPress, Shopify, etc.).
 * Each adapter must implement verifyConnection and testWritePermission.
 */
import type { PlatformType } from "../types";

// ============================================================================
// Capability Result
// ============================================================================

/**
 * Result from verifyConnection() - indicates connection status and capabilities.
 */
export interface CapabilityResult {
  /** Whether the connection is valid and authenticated */
  connected: boolean;

  /** Error message if connection failed */
  error?: string;

  /** Platform capabilities detected from the connection */
  capabilities?: {
    canReadPosts?: boolean;
    canWritePosts?: boolean;
    canReadPages?: boolean;
    canWritePages?: boolean;
    canReadMedia?: boolean;
    canWriteMedia?: boolean;
    canReadProducts?: boolean;
    canWriteProducts?: boolean;
    canReadSeo?: boolean;
    canWriteSeo?: boolean;
  };
}

// ============================================================================
// Platform Adapter Interface
// ============================================================================

/**
 * Base interface for all platform adapters.
 * WordPress, Shopify, Wix, etc. must implement this interface.
 */
export interface PlatformAdapter {
  /** The platform type this adapter handles */
  platform: PlatformType;

  /** The site URL this adapter is connected to */
  siteUrl: string;

  /**
   * Verify connection is valid and detect capabilities.
   * Returns capabilities object showing what operations are available.
   */
  verifyConnection(): Promise<CapabilityResult>;

  /**
   * Test write permission by attempting a no-op or draft update.
   * Returns true if write operations will succeed.
   */
  testWritePermission(): Promise<boolean>;
}

// ============================================================================
// Platform-Specific Config Types
// ============================================================================

/**
 * WordPress adapter configuration.
 * Uses Application Password authentication with REST API v2.
 */
export interface WordPressAdapterConfig {
  /** WordPress site URL (e.g., https://example.com) */
  siteUrl: string;

  /** WordPress username */
  username: string;

  /** WordPress Application Password (generated in user profile) */
  appPassword: string;
}

/**
 * Shopify adapter configuration.
 * Uses Admin API access token with GraphQL endpoint.
 */
export interface ShopifyAdapterConfig {
  /** Shopify store domain (e.g., mystore.myshopify.com) */
  shopDomain: string;

  /** Admin API access token */
  accessToken: string;

  /** API version (defaults to 2026-04) */
  apiVersion?: string;
}

// ============================================================================
// Factory Type
// ============================================================================

/**
 * Factory function type for creating adapters from config.
 */
export type AdapterFactory = (config: unknown) => PlatformAdapter;
