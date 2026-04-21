/**
 * Tests for content extractor.
 *
 * Tests cover:
 * - Title extraction (with og:title fallback)
 * - Meta description extraction
 * - Heading extraction (h1-h6)
 * - Body text cleaning (remove scripts, styles, nav)
 * - JSON-LD structured data parsing
 * - Body text truncation
 */
import { describe, it, expect } from "vitest";
import { extractContent } from "./contentExtractor";

describe("contentExtractor", () => {
  describe("extractContent", () => {
    it("returns title from <title> tag", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>My Page Title</title></head>
        <body><p>Content</p></body>
        </html>
      `;

      const result = extractContent(html);

      expect(result.title).toBe("My Page Title");
    });

    it("falls back to og:title when <title> is missing", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta property="og:title" content="OpenGraph Title">
        </head>
        <body><p>Content</p></body>
        </html>
      `;

      const result = extractContent(html);

      expect(result.title).toBe("OpenGraph Title");
    });

    it("extracts meta description", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test</title>
          <meta name="description" content="This is the meta description">
        </head>
        <body><p>Content</p></body>
        </html>
      `;

      const result = extractContent(html);

      expect(result.metaDescription).toBe("This is the meta description");
    });

    it("falls back to og:description when meta description is missing", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test</title>
          <meta property="og:description" content="OpenGraph Description">
        </head>
        <body><p>Content</p></body>
        </html>
      `;

      const result = extractContent(html);

      expect(result.metaDescription).toBe("OpenGraph Description");
    });

    it("extracts all heading levels with text", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Test</title></head>
        <body>
          <h1>Heading 1</h1>
          <h2>Heading 2</h2>
          <h3>Heading 3</h3>
          <h4>Heading 4</h4>
          <h5>Heading 5</h5>
          <h6>Heading 6</h6>
        </body>
        </html>
      `;

      const result = extractContent(html);

      expect(result.headings).toEqual([
        { level: 1, text: "Heading 1" },
        { level: 2, text: "Heading 2" },
        { level: 3, text: "Heading 3" },
        { level: 4, text: "Heading 4" },
        { level: 5, text: "Heading 5" },
        { level: 6, text: "Heading 6" },
      ]);
    });

    it("strips scripts, styles, nav from body text", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Test</title></head>
        <body>
          <script>console.log("should not appear");</script>
          <style>.hidden { display: none; }</style>
          <nav><a href="/">Home</a><a href="/about">About</a></nav>
          <header>Site Header</header>
          <main>
            <p>This is the main content that should appear.</p>
          </main>
          <footer>Footer content</footer>
        </body>
        </html>
      `;

      const result = extractContent(html);

      expect(result.bodyText).toContain("This is the main content");
      expect(result.bodyText).not.toContain("console.log");
      expect(result.bodyText).not.toContain(".hidden");
      expect(result.bodyText).not.toContain("Site Header");
      expect(result.bodyText).not.toContain("Footer content");
    });

    it("parses JSON-LD structured data", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test</title>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Acme Corp",
              "url": "https://acme.com"
            }
          </script>
        </head>
        <body><p>Content</p></body>
        </html>
      `;

      const result = extractContent(html);

      expect(result.structuredData).toEqual({
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Acme Corp",
        url: "https://acme.com",
      });
    });

    it("truncates body text to 50000 chars", () => {
      const longText = "x".repeat(60000);
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Test</title></head>
        <body><p>${longText}</p></body>
        </html>
      `;

      const result = extractContent(html);

      expect(result.bodyText.length).toBeLessThanOrEqual(50003); // 50000 + "..."
    });

    it("returns null for missing title", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head></head>
        <body><p>No title here</p></body>
        </html>
      `;

      const result = extractContent(html);

      expect(result.title).toBeNull();
    });

    it("returns null for missing meta description", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Test</title></head>
        <body><p>No description</p></body>
        </html>
      `;

      const result = extractContent(html);

      expect(result.metaDescription).toBeNull();
    });

    it("returns null for invalid JSON-LD", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test</title>
          <script type="application/ld+json">
            { invalid json here }
          </script>
        </head>
        <body><p>Content</p></body>
        </html>
      `;

      const result = extractContent(html);

      expect(result.structuredData).toBeNull();
    });

    it("handles empty body", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Test</title></head>
        <body></body>
        </html>
      `;

      const result = extractContent(html);

      expect(result.bodyText).toBe("");
    });

    it("collapses whitespace in body text", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Test</title></head>
        <body>
          <p>First   paragraph    with   spaces.</p>
          <p>Second
             paragraph
             with newlines.</p>
        </body>
        </html>
      `;

      const result = extractContent(html);

      expect(result.bodyText).not.toContain("  "); // No double spaces
      expect(result.bodyText).toContain("First paragraph with spaces");
      expect(result.bodyText).toContain("Second paragraph with newlines");
    });

    it("excludes aside and iframe elements from body text", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Test</title></head>
        <body>
          <main><p>Main content here.</p></main>
          <aside><p>Sidebar content to ignore.</p></aside>
          <iframe src="https://example.com">Frame content</iframe>
        </body>
        </html>
      `;

      const result = extractContent(html);

      expect(result.bodyText).toContain("Main content here");
      expect(result.bodyText).not.toContain("Sidebar content");
      expect(result.bodyText).not.toContain("Frame content");
    });
  });
});
