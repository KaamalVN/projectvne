// Simple test of the command system
import { CommandInvoker } from './command-types';
import { AddSceneCommand } from './add-scene-command';
import { AddDialogueBlockCommand } from './add-dialogue-block-command';
import { AddChoiceBlockCommand } from './add-choice-block-command';
import { createEmptyProject } from '../shared/types';

console.log('Testing command/mutation system...');

// Create initial empty project
let currentState = createEmptyProject();
console.log('Initial state created:', currentState.meta.title);

// Create command invoker
const invoker = new CommandInvoker(currentState);

// Test 1: Add a scene
console.log('\n--- Test 1: Add Scene ---');
const addSceneCmd = new AddSceneCommand({
  title: 'Test Scene',
  backgroundAssetId: null
});

const sceneResult = invoker.execute(addSceneCmd);
if (sceneResult.success) {
  console.log('✓ Scene added successfully');
  currentState = sceneResult.state!; // Update current state
  console.log('  Scenes count:', Object.keys(currentState.scenes).length);

  // Get the added scene ID from the current state
  const sceneIds = Object.keys(currentState.scenes);
  const testSceneId = sceneIds[sceneIds.length - 1];

  // Test 2: Add dialogue block
  console.log('\n--- Test 2: Add Dialogue Block ---');
  const addDialogueCmd = new AddDialogueBlockCommand({
    sceneId: testSceneId,
    characterId: null, // narrator
    text: 'Hello, world!',
    insertAtIndex: 0
  });

  const dialogueResult = invoker.execute(addDialogueCmd);
  if (dialogueResult.success) {
    console.log('✓ Dialogue block added successfully');
    currentState = dialogueResult.state!; // Update current state
    const scene = currentState.scenes[testSceneId];
    console.log('  Blocks count:', scene.blocks.length);
    const dialogueBlock = scene.blocks[0] as { text: string };
    console.log('  First block text:', dialogueBlock.text);

    // Test 3: Add choice block
    console.log('\n--- Test 3: Add Choice Block ---');
    const addChoiceCmd = new AddChoiceBlockCommand({
      sceneId: testSceneId,
      prompt: 'What do you do?',
      options: [
        { text: 'Option A', destinationSceneId: null },
        { text: 'Option B', destinationSceneId: null }
      ],
      insertAtIndex: 1
    });

    const choiceResult = invoker.execute(addChoiceCmd);
    if (choiceResult.success) {
      console.log('✓ Choice block added successfully');
      currentState = choiceResult.state!; // Update current state
      const scene = currentState.scenes[testSceneId];
      console.log('  Blocks count:', scene.blocks.length);
      const choiceBlock = scene.blocks[1] as { prompt: string; options: any[] };
      console.log('  Choice prompt:', choiceBlock.prompt);
      console.log('  Choice options:', choiceBlock.options.length);

      // Test 4: Undo/Redo
      console.log('\n--- Test 4: Undo/Redo ---');
      console.log('Can undo:', invoker.canUndo());
      console.log('Can redo:', invoker.canRedo());

      // Undo the choice addition
      const undoResult = invoker.undo();
      if (undoResult.success) {
        console.log('✓ Undo successful');
        currentState = undoResult.state!; // Update current state
        const scene = currentState.scenes[testSceneId];
        console.log('  Blocks count after undo:', scene.blocks.length);

        // Redo the choice addition
        const redoResult = invoker.redo();
        if (redoResult.success) {
          console.log('✓ Redo successful');
          currentState = redoResult.state!; // Update current state
          const scene = currentState.scenes[testSceneId];
          console.log('  Blocks count after redo:', scene.blocks.length);
        } else {
          console.log('✗ Redo failed:', redoResult.error);
        }
      } else {
        console.log('✗ Undo failed:', undoResult.error);
      }

      // Test 5: Validation
      console.log('\n--- Test 5: Validation ---');
      const invalidChoiceCmd = new AddChoiceBlockCommand({
        sceneId: testSceneId,
        prompt: '', // Empty prompt should fail validation
        options: [
          { text: 'Option A', destinationSceneId: null }
        ]
      });

      const validationResult = invoker.execute(invalidChoiceCmd);
      if (!validationResult.success) {
        console.log('✓ Validation correctly rejected invalid command');
        console.log('  Error:', validationResult.error);
      } else {
        console.log('✗ Validation should have failed but did not');
      }
    } else {
      console.log('✗ Choice block failed:', choiceResult.error);
    }
  } else {
    console.log('✗ Dialogue block failed:', dialogueResult.error);
  }
} else {
  console.log('✗ Scene addition failed:', sceneResult.error);
}

console.log('\n--- Final State ---');
console.log('Undo stack size:', invoker.getUndoCount());
console.log('Redo stack size:', invoker.getRedoCount());
console.log('Command system test completed!');