# ProjectVNE Cloud services — contracts & metering

> Phase 6. These services are external infrastructure. The editor is a real
> client of each documented contract; a hosted implementation can replace the
> bundled offline/`Local` realizations without changing editor code. Everything
> here is versioned so a service can be swapped without a client release.

## 1. Marketplace service (`src/marketplace/service.ts`)

The editor consumes listings through `MarketplaceService`:

```ts
interface MarketplaceService {
  fetchListings(): Promise<MarketplaceListing[]>;
  install(listingId: string): Promise<{ ok: boolean; error?: string; pluginId?: string }>;
  isInstalled(pluginId: string): boolean;
  installedPluginDefinitions(): BuiltinPluginDefinition[];
}
```

- `LocalMarketplaceService` serves the offline catalog and records installs in
  browser storage — the full install-from-marketplace surface, testable.
- A hosted marketplace implements the same interface over HTTP with auth and
  payments; the editor does not change.

### Commerce model (published & fixed — Phase 6 AC3)
- **Creator share: 90%** of gross revenue. **Platform commission: 10%.**
- Price models: `free`, `paid` (fixed price), `pay-what-you-want` (optional
  suggested amount). These numbers are fixed before any listing goes live and are
  shown in the Marketplace UI and `docs/phase6-public-ecosystem.md`.

## 2. Cloud build service (`src/export/cloud-build.ts`)

The editor produces a versioned build request:

```ts
interface CloudBuildRequest {
  apiVersion: 1;
  projectId: string;
  projectName: string;
  target: 'windows' | 'macos' | 'linux' | 'android' | 'web';
  storyHash: string;          // FNV-1a of serialized story — caching + integrity
  story: ProjectIR;
  estimatedCompute: number;   // ~1 unit/KB, computed client-side
  createdAt: string;
}
```

- **Metering:** compute units estimated client-side (`estimateComputeUnits`);
  the service bills actual build compute and returns the artifact.
- **Signing:** the cloud build service owns each target's native toolchain and
  signs the produced artifact; creators never need to install a target's SDK to
  produce a signed build. This is why "Build in cloud" exists as a supported
  option even though the editor repo has no native toolchains.

## 3. Cloud AI credits (`src/ai/credits.ts`)

- Optional, metered, opt-in. `ProjectVNE Cloud` appears as one more entry in the
  same AI provider picker (§4.1) — not a separately-styled upsell.
- **BYOK providers (Anthropic, OpenAI, Google, Ollama) stay free permanently.**
- Metering: 1 credit per cloud request (`COST_PER_CLOUD_REQUEST`). Balance,
  consumption, and opt-in state are stored locally (`projectvne.ai.cloud.credits`).
- The billing/ledger backend is external; the editor meters the same unit for
  transparency and surfaces a clear "not enough credits" error (never a generic
  failure), with a pointer to the free BYOK providers.

## Security / privacy notes
- Cloud build requests are content-hashed so identical builds are cached and
  returned artifacts can be integrity-checked.
- Cloud AI sends only the project context the user has already opted into
  sharing (the same scope shown in the AI panel), and only when the `cloud`
  provider is selected. Keys entered for BYOK providers are never sent to any
  ProjectVNE service.