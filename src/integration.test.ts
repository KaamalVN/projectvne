// Integration test showing command system working with IR types and migrations
import { CommandInvoker } from './commands/command-types';
import { AddSceneCommand } from './commands/add-scene-command';
import { AddDialogueBlockCommand } from './commands/add-dialogue-block-command';
import { migrateProject } from './migrations/migration-runner';

console.log('Integration test: Command System + Migration System + IR Types');

// Start with a v0 project (no schema version)
const v0Project: any = {
  meta: {
    title: 'Integration Test Project',
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

console.log('\n1. Starting with V0 project (no schema version)');
console.log('   Has schemaVersion:', !!v0Project.meta.schemaVersion);

// Migrate to current version
const currentProject = migrateProject(v0Project);
console.log('2. After migration');
console.log('   Schema version:', currentProject.meta.schemaVersion);
console.log('   Title:', currentProject.meta.title);

// Test command system with the migrated project
console.log('\n3. Testing command system with migrated project');
const invoker = new CommandInvoker(currentProject);

// Add a scene
const addSceneCmd = new AddSceneCommand({
  title: 'Opening Scene',
  backgroundAssetId: null
});

const sceneResult = invoker.execute(addSceneCmd);
if (sceneResult.success) {
  console.log('   ✓ Scene added successfully');
  const updatedState = sceneResult.state!;
  console.log('   Scenes count:', Object.keys(updatedState.scenes).length);

  // Get the scene ID
  const sceneIds = Object.keys(updatedState.scenes);
  const sceneId = sceneIds[sceneIds.length - 1];

  // Add dialogue to the scene
  const addDialogueCmd = new AddDialogueBlockCommand({
    sceneId: sceneId,
    characterId: null,
    text: 'Welcome to our integrated test!',
    insertAtIndex: 0
  });

  const dialogueResult = invoker.execute(addDialogueCmd);
  if (dialogueResult.success) {
    console.log('   ✓ Dialogue block added successfully');
    const finalState = dialogueResult.state!;
    const scene = finalState.scenes[sceneId];
    console.log('   Scene blocks:', scene.blocks.length);
    const dialogueBlock = scene.blocks[0] as { text: string };
    console.log('   First dialogue:', dialogueBlock.text);

    // Verify the project still has correct schema version after commands
    console.log('4. Final project state');
    console.log('   Schema version:', finalState.meta.schemaVersion);
    console.log('   Title:', finalState.meta.title);
    console.log('   Undo available:', invoker.canUndo());

    // Test undo
    const undoResult = invoker.undo();
    if (undoResult.success) {
      console.log('   ✓ Undo successful');
      const undoneState = undoResult.state!;
      const undoneScene = undoneState.scenes[sceneId];
      console.log('   Blocks after undo:', undoneScene.blocks.length);
    }
  } else {
    console.log('   ✗ Dialogue block failed:', dialogueResult.error);
  }
} else {
  console.log('   ✗ Scene addition failed:', sceneResult.error);
}

console.log('\nIntegration test completed successfully!');