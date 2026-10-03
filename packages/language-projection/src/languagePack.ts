import type { LanguageProjection, LanguageProjectionDescriptor } from "./index.js";

export interface LanguagePackPedagogy {
  readonly recommendedStage?: string;
  readonly notes?: readonly string[];
}

export interface LanguagePack {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly supportedCanonicalOperations: readonly string[];
  readonly projection: LanguageProjection;
  readonly formatting: {
    readonly indentation: string;
    readonly mapping: "canonical-node-ranges";
  };
  readonly pedagogy?: LanguagePackPedagogy;
}

export interface LanguagePackDescriptor {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly projection: LanguageProjectionDescriptor;
  readonly supportedCanonicalOperations: readonly string[];
  readonly pedagogy?: LanguagePackPedagogy;
}

export class LanguagePackRegistry {
  readonly #packs = new Map<string, LanguagePack>();

  register(pack: LanguagePack): void {
    if (pack.projection.descriptor.id !== pack.id) {
      throw new Error("language pack id must match projection id");
    }
    if (this.#packs.has(pack.id)) {
      throw new Error("language pack " + JSON.stringify(pack.id) + " is already registered");
    }
    this.#packs.set(pack.id, pack);
  }

  require(id: string): LanguagePack {
    const pack = this.#packs.get(id);
    if (pack === undefined)
      throw new Error("language pack " + JSON.stringify(id) + " is not registered");
    return pack;
  }

  list(): readonly LanguagePackDescriptor[] {
    return [...this.#packs.values()].map((pack) => ({
      id: pack.id,
      name: pack.name,
      version: pack.version,
      projection: pack.projection.descriptor,
      supportedCanonicalOperations: pack.supportedCanonicalOperations,
      ...(pack.pedagogy === undefined ? {} : { pedagogy: pack.pedagogy }),
    }));
  }
}

export function createLanguagePackRegistry(
  packs: readonly LanguagePack[] = [],
): LanguagePackRegistry {
  const registry = new LanguagePackRegistry();
  packs.forEach((pack) => registry.register(pack));
  return registry;
}
