// The bundled marketplace catalog. In this build it is served locally (offline)
// so the full install-from-marketplace surface is usable and testable; a hosted
// marketplace service implements the same `MarketplaceService` contract over
// HTTP, so swapping the backend is an adapter, not a rearchitecture.
//
// Includes two third-party plugin examples written purely against the public
// plugin API from docs/plugin-authoring.md — a new node type and a panel — that
// are installed as data without touching core-engine source (Phase 6 AC1).
import type { BuiltinPluginDefinition } from '../plugins';
import { CREATOR_SHARE_DEFAULT, type MarketplaceListing } from './types';

// Third-party plugin #1: a NEW NODE TYPE ("ambient cue" — starts/ends a looping
// background sound). Authored against the public API, delivered as a source
// string, capability-declared (engine + ir.read/write: assets to reference an
// audio asset).
const ambientCueSource = `
api.register({
  manifest: {
    id: 'ambient-cue',
    version: '1.0.0',
    name: 'Ambient Cue',
    description: 'Third-party node type that starts or stops a looping background sound. Built against the public plugin API.',
    author: 'Ambient Studios',
    capabilities: [{ kind: 'engine' }, { kind: 'ir.read', scope: ['assets'] }],
    handledBlockTypes: ['ambientCue'],
    contributedNodeTypes: ['ambientCue']
  },
  engineHandlers: {
    ambientCue: function (ctx) {
      ctx.log('Ambient: ' + (ctx.data.action || 'start') + ' ' + (ctx.data.source || ''));
      return { waitForInput: false };
    }
  },
  nodeTypes: {
    ambientCue: {
      blockType: 'ambientCue',
      title: 'Ambient Cue',
      icon: '🎧',
      category: 'Audio',
      description: 'Starts or stops a looping background sound cue.',
      createData: function () {
        return { action: 'start', source: 'assets/audio/ambient-forest.ogg' };
      },
      toViewModel: function (block) {
        return { kind: 'kv', rows: [
          { label: 'Action', value: String(block.data.action || 'start') },
          { label: 'Source', value: String(block.data.source || '') }
        ] };
      }
    }
  }
});
`;

// Third-party plugin #2: a PANEL ("Story Health") rendered in the Plugins tab.
const storyHealthSource = `
api.register({
  manifest: {
    id: 'story-health',
    version: '1.0.0',
    name: 'Story Health',
    description: 'Third-party panel summarizing how "filled" the current project is. Built against the public plugin API.',
    author: 'Ambient Studios',
    capabilities: [{ kind: 'ir.read', scope: 'all' }],
    contributedPanels: ['story-health']
  },
  panels: {
    'story-health': {
      title: 'Story Health',
      view: function (project) {
        var scenes = project.scenes ? Object.keys(project.scenes).length : 0;
        var chars = project.characters ? Object.keys(project.characters).length : 0;
        var vars = project.variables ? Object.keys(project.variables).length : 0;
        var lines = 0;
        if (project.scenes) {
          for (var id in project.scenes) { if (project.scenes[id].blocks) lines += project.scenes[id].blocks.length; }
        }
        return { kind: 'note', text: scenes + ' scene(s), ' + chars + ' character(s), ' + vars + ' variable(s), ' + lines + ' block(s).' };
      }
    }
  }
});
`;

export const THIRD_PARTY_PLUGINS: BuiltinPluginDefinition[] = [
  { id: 'ambient-cue', source: ambientCueSource },
  { id: 'story-health', source: storyHealthSource },
];

export function fetchCatalog(): MarketplaceListing[] {
  return [
    {
      id: 'ambient-cue',
      kind: 'plugin',
      name: 'Ambient Cue',
      author: 'Ambient Studios',
      version: '1.0.0',
      description: 'A new node type that starts or stops a looping background sound. Demonstrates adding a node type with no core-engine changes.',
      priceModel: 'free',
      creatorShare: CREATOR_SHARE_DEFAULT,
      tags: ['audio', 'node-type'],
      plugin: THIRD_PARTY_PLUGINS[0],
    },
    {
      id: 'story-health',
      kind: 'plugin',
      name: 'Story Health',
      author: 'Ambient Studios',
      version: '1.0.0',
      description: 'A panel that summarizes project scope in the Plugins tab.',
      priceModel: 'pay-what-you-want',
      price: 2,
      creatorShare: CREATOR_SHARE_DEFAULT,
      tags: ['panel', 'utility'],
      plugin: THIRD_PARTY_PLUGINS[1],
    },
    {
      id: 'autumn-backgrounds',
      kind: 'asset',
      name: 'Autumn Backgrounds',
      author: 'Riverside Arts',
      version: '1.0.0',
      description: 'Four painted autumn background images (1920x1080, PNG).',
      priceModel: 'paid',
      price: 4,
      creatorShare: 92,
      tags: ['background', 'asset-pack'],
    },
  ];
}