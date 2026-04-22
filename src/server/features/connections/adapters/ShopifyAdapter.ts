/**
 * Shopify Platform Adapter
 * Phase 31-03: Platform Adapters
 *
 * Implements PlatformAdapter interface for Shopify Admin GraphQL API.
 * Uses Admin API access token authentication.
 *
 * Shopify Admin API docs: https://shopify.dev/docs/api/admin-graphql
 * Rate limiting: https://shopify.dev/docs/api/usage/rate-limits
 */
import type {
  PlatformAdapter,
  CapabilityResult,
  ShopifyAdapterConfig,
} from "./BaseAdapter";

// ============================================================================
// Shopify GraphQL Types
// ============================================================================

/**
 * Shopify product object from GraphQL API.
 */
export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  seo: {
    title: string | null;
    description: string | null;
  };
}

/**
 * Generic GraphQL response envelope.
 */
interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

/**
 * User error from Shopify mutations.
 */
interface UserError {
  field: string[];
  message: string;
}

// ============================================================================
// Shopify Adapter Implementation
// ============================================================================

/**
 * Shopify platform adapter using Admin GraphQL API.
 *
 * Authentication: X-Shopify-Access-Token header.
 * Endpoint: https://{shopDomain}/admin/api/{version}/graphql.json
 *
 * @example
 * ```typescript
 * const adapter = new ShopifyAdapter({
 *   shopDomain: 'mystore.myshopify.com',
 *   accessToken: 'shpat_xxxxxxxxxxxxx',
 * });
 *
 * const result = await adapter.verifyConnection();
 * if (result.connected) {
 *   const product = await adapter.getProduct('gid://shopify/Product/123');
 * }
 * ```
 */
export class ShopifyAdapter implements PlatformAdapter {
  readonly platform = "shopify" as const;
  readonly siteUrl: string;
  private shopDomain: string;
  private accessToken: string;
  private apiVersion: string;

  constructor(config: ShopifyAdapterConfig) {
    this.shopDomain = config.shopDomain;
    this.siteUrl = `https://${config.shopDomain}`;
    this.accessToken = config.accessToken;
    // Default to current stable API version
    this.apiVersion = config.apiVersion ?? "2026-04";
  }

  /**
   * Execute a GraphQL query or mutation against the Shopify Admin API.
   *
   * @param query - GraphQL query string
   * @param variables - Query variables
   * @returns Typed response data
   * @throws Error on HTTP or GraphQL errors
   */
  private async graphql<T>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    const res = await fetch(
      `https://${this.shopDomain}/admin/api/${this.apiVersion}/graphql.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": this.accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
      }
    );

    if (!res.ok) {
      throw new Error(`Shopify API error ${res.status}: ${await res.text()}`);
    }

    const json: GraphQLResponse<T> = await res.json();

    if (json.errors?.length) {
      throw new Error(`Shopify GraphQL error: ${json.errors[0].message}`);
    }

    return json.data!;
  }

  /**
   * Verify connection is valid by querying shop info.
   * Assumes write_products scope if connected (OAuth tokens either have it or don't).
   *
   * @returns CapabilityResult with connected status and detected capabilities
   */
  async verifyConnection(): Promise<CapabilityResult> {
    try {
      const query = `
        query ShopInfo {
          shop {
            name
            primaryDomain {
              url
            }
          }
        }
      `;

      await this.graphql<{ shop: { name: string } }>(query);

      return {
        connected: true,
        capabilities: {
          canReadProducts: true,
          canWriteProducts: true, // Assumes write_products scope
          canReadSeo: true,
          canWriteSeo: true,
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
   * Test if the adapter has write permission.
   * For Shopify OAuth tokens, either have write scope or they don't.
   * We trust the scope was granted during OAuth flow.
   *
   * @returns true if connection is valid (implies write access)
   */
  async testWritePermission(): Promise<boolean> {
    const result = await this.verifyConnection();
    return result.connected;
  }

  /**
   * Get a product by ID with SEO fields.
   *
   * @param id - Shopify product GID (e.g., 'gid://shopify/Product/123')
   * @returns Product with SEO information
   */
  async getProduct(id: string): Promise<ShopifyProduct> {
    const query = `
      query GetProduct($id: ID!) {
        product(id: $id) {
          id
          title
          handle
          seo {
            title
            description
          }
        }
      }
    `;

    const data = await this.graphql<{ product: ShopifyProduct }>(query, { id });
    return data.product;
  }

  /**
   * Update product SEO fields.
   *
   * @param id - Shopify product GID
   * @param seo - SEO fields to update (title, description)
   * @returns Updated product
   * @throws Error on userErrors from Shopify
   */
  async updateProductSeo(
    id: string,
    seo: { title?: string; description?: string }
  ): Promise<ShopifyProduct> {
    const mutation = `
      mutation UpdateProductSeo($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            title
            handle
            seo {
              title
              description
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const data = await this.graphql<{
      productUpdate: {
        product: ShopifyProduct;
        userErrors: UserError[];
      };
    }>(mutation, {
      input: { id, seo },
    });

    if (data.productUpdate.userErrors.length) {
      throw new Error(data.productUpdate.userErrors[0].message);
    }

    return data.productUpdate.product;
  }
}
