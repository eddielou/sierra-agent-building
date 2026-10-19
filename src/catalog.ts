/**
 * Product search over the static ProductCatalog dataset.
 *
 * The catalog is small, so retrieval is simple keyword scoring over each product's full text.
 * Schema-agnostic on purpose; swap for embeddings/a search service if the catalog grows.
 */
import { readFileSync } from "node:fs";

export type Product = Record<string, unknown>;

const STOPWORDS = new Set(
  "a an the for and or i need want looking to of in on with do you have any some me my is are".split(" "),
);

const tokens = (text: string): string[] =>
  (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => !STOPWORDS.has(t));

export class ProductCatalog {
  private readonly index: Set<string>[];

  constructor(private readonly products: Product[]) {
    this.index = products.map((p) => new Set(tokens(JSON.stringify(p))));
  }

  static fromFile(path: string): ProductCatalog {
    return new ProductCatalog(JSON.parse(readFileSync(path, "utf8")));
  }

  bySku(sku: string): Product | undefined {
    return this.products.find((p) => p.SKU === sku);
  }

  search(query: string, limit = 5): Product[] {
    const terms = new Set(tokens(query));
    return this.products
      .map((product, i) => ({ product, score: [...terms].filter((t) => this.index[i].has(t)).length }))
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((h) => h.product);
  }
}
