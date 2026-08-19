import type { BuiltinPluginDefinition } from '../types';
import { builtinDialoguePlugin } from './dialogue';
import { builtinCharactersPlugin } from './characters';
import { builtinChoicesPlugin } from './choices';
import { builtinVariablesPlugin } from './variables';
import { builtinScriptPlugin } from './script';
import { builtinFlashbackPlugin } from './flashback';
import { builtinWorldLorePlugin } from './world-lore';
import { builtinJsonManifestPlugin } from './json-manifest';

export const BUILTIN_PLUGINS: BuiltinPluginDefinition[] = [
  builtinDialoguePlugin,
  builtinCharactersPlugin,
  builtinChoicesPlugin,
  builtinVariablesPlugin,
  builtinScriptPlugin,
  builtinFlashbackPlugin,
  builtinWorldLorePlugin,
  builtinJsonManifestPlugin,
];