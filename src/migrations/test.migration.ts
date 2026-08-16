// Test the migration system
import { migrateProject } from './migration-runner';

console.log('Testing migration system...');

// Test 1: Project with no schema version (simulating v0)
const v0Project: any = {
  meta: {
    // No schemaVersion field
    title: 'Test Project',
    createdAt: '2026-08-15T10:00:00.000Z',
    modifiedAt: '2026-08-15T10:00:00.000Z'
  },
  characters: {},
  assets: {},
  variables: {},
  scenes: {},
  flow: {
    entrySceneId: '',
    connections: []
  },
  ui: {
    theme: 'auto',
    dialogueBoxStyle: 'classic',
    choicePresentation: 'vertical'
  },
  localization: {
    defaultLocale: 'en',
    locales: {}
  },
  exportProfiles: {},
  conditions: {}
};

console.log('\n--- Test 1: Migrate v0 project ---');
console.log('Before migration - has schemaVersion:', !!v0Project.meta.schemaVersion);
if (v0Project.meta.schemaVersion) {
  console.log('  Schema version:', v0Project.meta.schemaVersion);
}

const migratedV0 = migrateProject(v0Project);
console.log('After migration - has schemaVersion:', !!migratedV0.meta.schemaVersion);
console.log('  Schema version:', migratedV0.meta.schemaVersion);
console.log('  Title:', migratedV0.meta.title);

// Test 2: Project already at v1
const v1Project: any = {
  meta: {
    schemaVersion: 1,
    title: 'Test Project V1',
    createdAt: '2026-08-15T10:00:00.000Z',
    modifiedAt: '2026-08-15T10:00:00.000Z'
  },
  characters: {},
  assets: {},
  variables: {},
  scenes: {},
  flow: {
    entrySceneId: '',
    connections: []
  },
  ui: {
    theme: 'auto',
    dialogueBoxStyle: 'classic',
    choicePresentation: 'vertical'
  },
  localization: {
    defaultLocale: 'en',
    locales: {}
  },
  exportProfiles: {},
  conditions: {}
};

console.log('\n--- Test 2: Migrate v1 project (should remain unchanged) ---');
console.log('Before migration - Schema version:', v1Project.meta.schemaVersion);
const migratedV1 = migrateProject(v1Project);
console.log('After migration - Schema version:', migratedV1.meta.schemaVersion);
console.log('  Title:', migratedV1.meta.title);

// Test 3: Check if migration is needed
console.log('\n--- Test 3: Migration need check ---');
console.log('V0 project needs migration:', typeof v0Project.meta.schemaVersion === 'undefined' || v0Project.meta.schemaVersion < 1);
console.log('V1 project needs migration:', typeof v1Project.meta.schemaVersion === 'undefined' || v1Project.meta.schemaVersion < 1);

console.log('\nMigration system test completed!');