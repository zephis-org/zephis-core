import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExtractorEngine } from '../../src/template-engine/extractor-engine';

vi.mock('../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('ExtractorEngine', () => {
  let extractorEngine: ExtractorEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    extractorEngine = new ExtractorEngine();
  });

  describe('extract', () => {
    it('should extract data using CSS selectors', async () => {
      const html = `
        <html>
          <body>
            <h1>Test Title</h1>
            <div class="content">Test Content</div>
            <span class="price">$99.99</span>
          </body>
        </html>
      `;

      const selectors = {
        title: 'h1',
        content: '.content',
        price: '.price'
      };

      const result = await extractorEngine.extract(html, selectors);

      expect(result).toEqual({
        title: 'Test Title',
        content: 'Test Content',
        price: '$99.99'
      });
    });

    it('should handle missing elements gracefully', async () => {
      const html = `
        <html>
          <body>
            <h1>Only Title</h1>
          </body>
        </html>
      `;

      const selectors = {
        title: 'h1',
        content: '.missing',
        price: '.also-missing'
      };

      const result = await extractorEngine.extract(html, selectors);

      expect(result).toEqual({
        title: 'Only Title',
        content: null,
        price: null
      });
    });

    it('should handle empty HTML', async () => {
      const selectors = {
        title: 'h1',
        content: '.content'
      };

      const result = await extractorEngine.extract('', selectors);

      expect(result).toEqual({
        title: null,
        content: null
      });
    });

    it('should extract attributes', async () => {
      const html = `
        <html>
          <body>
            <a href="https://example.com" class="link">Click here</a>
            <img src="/image.jpg" alt="Test Image" />
          </body>
        </html>
      `;

      const selectors = {
        link: 'a',
        image: 'img'
      };

      const result = await extractorEngine.extract(html, selectors);

      expect(result.link).toBe('Click here');
      expect(result.image).toBeNull();
    });

    it('should handle complex selectors', async () => {
      const html = `
        <html>
          <body>
            <div class="container">
              <p data-test="value">Complex Value</p>
              <ul>
                <li>Item 1</li>
                <li>Item 2</li>
              </ul>
            </div>
          </body>
        </html>
      `;

      const selectors = {
        complex: '.container p[data-test="value"]',
        firstItem: 'ul li:first-child',
        allItems: 'ul li'
      };

      const result = await extractorEngine.extract(html, selectors);

      expect(result.complex).toBe('Complex Value');
      expect(result.firstItem).toBe('Item 1');
      expect(result.allItems).toContain('Item 1');
    });

    it('should extract from forms', async () => {
      const html = `
        <html>
          <body>
            <form>
              <input type="text" value="Input Value" class="text-input" />
              <select class="dropdown">
                <option value="1">Option 1</option>
                <option value="2" selected>Option 2</option>
              </select>
              <textarea class="text-area">Textarea Content</textarea>
            </form>
          </body>
        </html>
      `;

      const selectors = {
        input: '.text-input',
        select: '.dropdown',
        textarea: '.text-area'
      };

      const result = await extractorEngine.extract(html, selectors);

      expect(result.input).toBe('Input Value');
      expect(result.select).toContain('Option');
      expect(result.textarea).toBe('Textarea Content');
    });

    it('should handle nested elements', async () => {
      const html = `
        <html>
          <body>
            <div class="parent">
              <div class="child">
                <span>Nested Text</span>
              </div>
            </div>
          </body>
        </html>
      `;

      const selectors = {
        parent: '.parent',
        child: '.parent .child',
        nested: '.parent .child span'
      };

      const result = await extractorEngine.extract(html, selectors);

      expect(result.nested).toBe('Nested Text');
      expect(result.child).toBe('Nested Text');
      expect(result.parent).toBe('Nested Text');
    });

    it('should handle special characters in content', async () => {
      const html = `
        <html>
          <body>
            <div class="special">&lt;script&gt;alert('xss')&lt;/script&gt;</div>
            <div class="unicode">émoji 🎉 test</div>
          </body>
        </html>
      `;

      const selectors = {
        special: '.special',
        unicode: '.unicode'
      };

      const result = await extractorEngine.extract(html, selectors);

      expect(result.special).toContain('<script>');
      expect(result.unicode).toContain('émoji 🎉 test');
    });

    it('should handle tables', async () => {
      const html = `
        <html>
          <body>
            <table>
              <tr>
                <th>Header 1</th>
                <th>Header 2</th>
              </tr>
              <tr>
                <td class="cell1">Cell 1</td>
                <td class="cell2">Cell 2</td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const selectors = {
        header: 'th',
        cell1: '.cell1',
        cell2: '.cell2',
        allCells: 'td'
      };

      const result = await extractorEngine.extract(html, selectors);

      expect(result.cell1).toBe('Cell 1');
      expect(result.cell2).toBe('Cell 2');
      expect(result.header).toContain('Header');
    });

    it('should handle malformed HTML', async () => {
      const html = `
        <div>Unclosed div
        <p>Paragraph without closing
        <span>Text</span>
      `;

      const selectors = {
        div: 'div',
        p: 'p',
        span: 'span'
      };

      const result = await extractorEngine.extract(html, selectors);

      expect(result.span).toBe('Text');
      expect(result.div).toContain('Text');
    });

    it('should handle empty selectors object', async () => {
      const html = '<html><body>Content</body></html>';
      const result = await extractorEngine.extract(html, {});

      expect(result).toEqual({});
    });

    it('should handle invalid selectors', async () => {
      const html = '<html><body>Content</body></html>';
      const selectors = {
        invalid: '>>>invalid<<<'
      };

      const result = await extractorEngine.extract(html, selectors);

      expect(result.invalid).toBeNull();
    });
  });
});