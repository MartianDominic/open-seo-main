/**
 * Tests for smart link detector.
 *
 * Tests cover:
 * - Detection of business page types (products, about, services, contact)
 * - Category page detection
 * - URL normalization (relative to absolute)
 * - External domain filtering
 * - Edge cases (query params, trailing slashes, fragments)
 */
import { describe, it, expect } from "vitest";
import { detectBusinessLinks } from "./linkDetector";

describe("linkDetector", () => {
  describe("detectBusinessLinks", () => {
    const baseUrl = "https://example.com";

    it("finds /products page from link list", () => {
      const links = ["/", "/about", "/products", "/contact"];
      const result = detectBusinessLinks(links, baseUrl);

      expect(result.products).toBe("https://example.com/products");
    });

    it("finds /about-us (handles variants)", () => {
      const links = ["/", "/about-us", "/services"];
      const result = detectBusinessLinks(links, baseUrl);

      expect(result.about).toBe("https://example.com/about-us");
    });

    it("finds /services page", () => {
      const links = ["/home", "/services", "/blog"];
      const result = detectBusinessLinks(links, baseUrl);

      expect(result.services).toBe("https://example.com/services");
    });

    it("returns null for missing page types", () => {
      const links = ["/", "/blog", "/news"];
      const result = detectBusinessLinks(links, baseUrl);

      expect(result.products).toBeNull();
      expect(result.about).toBeNull();
      expect(result.services).toBeNull();
      expect(result.contact).toBeNull();
    });

    it("finds category pages (/category/*, /collections/*)", () => {
      const links = [
        "/",
        "/category/shoes",
        "/category/clothing",
        "/collections/summer",
        "/products",
      ];
      const result = detectBusinessLinks(links, baseUrl);

      expect(result.categories).toContain("https://example.com/category/shoes");
      expect(result.categories).toContain(
        "https://example.com/category/clothing",
      );
      expect(result.categories).toContain(
        "https://example.com/collections/summer",
      );
    });

    it("normalizes relative URLs to absolute", () => {
      const links = ["about", "./products", "../services"];
      const result = detectBusinessLinks(links, baseUrl);

      expect(result.about).toBe("https://example.com/about");
      expect(result.products).toBe("https://example.com/products");
    });

    it("filters external domains", () => {
      const links = [
        "/products",
        "https://facebook.com/company",
        "https://twitter.com/company",
        "https://example.com/about",
      ];
      const result = detectBusinessLinks(links, baseUrl);

      expect(result.products).toBe("https://example.com/products");
      expect(result.about).toBe("https://example.com/about");
      // External links should not match even if they have matching paths
    });

    it("handles query params - strips them for matching", () => {
      const links = ["/products?page=2&sort=price", "/about?ref=header"];
      const result = detectBusinessLinks(links, baseUrl);

      // Should still match products and about despite query params
      expect(result.products).toBe("https://example.com/products?page=2&sort=price");
      expect(result.about).toBe("https://example.com/about?ref=header");
    });

    it("handles trailing slashes", () => {
      const links = ["/products/", "/about/"];
      const result = detectBusinessLinks(links, baseUrl);

      expect(result.products).toBe("https://example.com/products/");
      expect(result.about).toBe("https://example.com/about/");
    });

    it("handles fragment identifiers", () => {
      const links = ["/about#team", "/services#pricing"];
      const result = detectBusinessLinks(links, baseUrl);

      expect(result.about).toBe("https://example.com/about#team");
      expect(result.services).toBe("https://example.com/services#pricing");
    });

    it("limits categories to max 5 URLs", () => {
      const links = [
        "/category/a",
        "/category/b",
        "/category/c",
        "/category/d",
        "/category/e",
        "/category/f",
        "/category/g",
      ];
      const result = detectBusinessLinks(links, baseUrl);

      expect(result.categories.length).toBeLessThanOrEqual(5);
    });

    it("matches shop variants for products", () => {
      const linksShop = ["/shop", "/about"];
      const linksStore = ["/store", "/about"];
      const linksCatalog = ["/catalog", "/about"];

      expect(detectBusinessLinks(linksShop, baseUrl).products).toBe(
        "https://example.com/shop",
      );
      expect(detectBusinessLinks(linksStore, baseUrl).products).toBe(
        "https://example.com/store",
      );
      expect(detectBusinessLinks(linksCatalog, baseUrl).products).toBe(
        "https://example.com/catalog",
      );
    });

    it("matches about page variants", () => {
      const linksCompany = ["/company", "/products"];
      const linksOurStory = ["/our-story", "/products"];
      const linksWhoWeAre = ["/who-we-are", "/products"];

      expect(detectBusinessLinks(linksCompany, baseUrl).about).toBe(
        "https://example.com/company",
      );
      expect(detectBusinessLinks(linksOurStory, baseUrl).about).toBe(
        "https://example.com/our-story",
      );
      expect(detectBusinessLinks(linksWhoWeAre, baseUrl).about).toBe(
        "https://example.com/who-we-are",
      );
    });

    it("matches contact page variants", () => {
      const linksContact = ["/contact"];
      const linksContactUs = ["/contact-us"];
      const linksGetInTouch = ["/get-in-touch"];

      expect(detectBusinessLinks(linksContact, baseUrl).contact).toBe(
        "https://example.com/contact",
      );
      expect(detectBusinessLinks(linksContactUs, baseUrl).contact).toBe(
        "https://example.com/contact-us",
      );
      expect(detectBusinessLinks(linksGetInTouch, baseUrl).contact).toBe(
        "https://example.com/get-in-touch",
      );
    });

    it("matches services page variants", () => {
      const linksWhatWeDo = ["/what-we-do"];
      const linksSolutions = ["/solutions"];
      const linksOfferings = ["/offerings"];

      expect(detectBusinessLinks(linksWhatWeDo, baseUrl).services).toBe(
        "https://example.com/what-we-do",
      );
      expect(detectBusinessLinks(linksSolutions, baseUrl).services).toBe(
        "https://example.com/solutions",
      );
      expect(detectBusinessLinks(linksOfferings, baseUrl).services).toBe(
        "https://example.com/offerings",
      );
    });

    it("handles base URL with trailing slash", () => {
      const links = ["/products", "/about"];
      const result = detectBusinessLinks(links, "https://example.com/");

      expect(result.products).toBe("https://example.com/products");
      expect(result.about).toBe("https://example.com/about");
    });

    it("is case-insensitive for pattern matching", () => {
      const links = ["/Products", "/ABOUT", "/Services"];
      const result = detectBusinessLinks(links, baseUrl);

      expect(result.products).toBe("https://example.com/Products");
      expect(result.about).toBe("https://example.com/ABOUT");
      expect(result.services).toBe("https://example.com/Services");
    });
  });
});
