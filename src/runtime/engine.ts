import * as PIXI from 'pixi.js';
import {
  ProjectIR,
  ID,
  StoryBlock,
  PluginBlock,
  ChoiceOption,
  CharacterPosition,
  VariableValue,
} from '../shared/types/index.ts';
import { evaluateChoiceAvailability } from '../shared/story-logic.ts';
import { RuntimeScriptSandbox } from './script-sandbox.ts';
import {
  PluginHost,
  createDefaultPluginHost,
  FlashbackPayload,
  PluginEngineAdapter,
  RunScriptResult,
} from '../plugins/index.ts';

export interface EngineState {
  currentSceneId: ID | null;
  currentBlockIndex: number;
  variables: Record<string, VariableValue>;
  isWaitingForInput: boolean;
  isShowingChoices: boolean;
  history: string[];
}

export interface EngineEvents {
  onSceneChange?: (sceneId: ID, title: string) => void;
  onStateChange?: (state: EngineState) => void;
  onDialogue?: (speaker: string, text: string) => void;
  onChoice?: (prompt: string, options: { text: string; destinationSceneId: ID | null }[]) => void;
  onStoryEnd?: () => void;
  onPluginMissing?: (blockType: string, message: string) => void;
  onFlashback?: (title: string, text: string) => void;
}

function parseHexColor(hex: string | undefined): number {
  if (!hex || typeof hex !== 'string') return 0x141418;
  const cleaned = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return 0x141418;
  return parseInt(cleaned, 16);
}

export class PixiVisualNovelEngine implements PluginEngineAdapter {
  public app: PIXI.Application;
  private pluginHost: PluginHost;
  private rootContainer: PIXI.Container;
  private bgContainer: PIXI.Container;
  private characterContainer: PIXI.Container;
  private uiContainer: PIXI.Container;
  private choiceContainer: PIXI.Container;

  // Visual Elements
  private bgSprite: PIXI.Sprite | null = null;
  private bgGraphics: PIXI.Graphics;
  private characters: Map<string, PIXI.Sprite> = new Map();

  // Dialogue Box Elements
  private dialogueBox!: PIXI.Container;
  private dialogueBg!: PIXI.Graphics;
  private nameBadgeBg!: PIXI.Graphics;
  private nameText!: PIXI.Text;
  private dialogueText!: PIXI.Text;
  private continuePrompt!: PIXI.Text;

  // Plugin-driven overlays
  private flashbackOverlay: PIXI.Container | null = null;
  private missingOverlay: PIXI.Container | null = null;

  // Story & Runtime State
  private story: ProjectIR | null = null;
  private state: EngineState = {
    currentSceneId: null,
    currentBlockIndex: 0,
    variables: {},
    isWaitingForInput: false,
    isShowingChoices: false,
    history: []
  };

  private events: EngineEvents = {};
  private targetText: string = '';
  private displayedText: string = '';
  private typewriterInterval: number | null = null;
  private isTypewriterComplete: boolean = true;
  private isDestroyed: boolean = false;
  private initPromise: Promise<void>;
  private pendingJumpSceneId: string | null = null;

  constructor(targetElement: HTMLElement, events: EngineEvents = {}, pluginHost?: PluginHost) {
    this.events = events;
    this.pluginHost = pluginHost ?? createDefaultPluginHost();
    this.app = new PIXI.Application();

    // Containers
    this.rootContainer = new PIXI.Container();
    this.bgContainer = new PIXI.Container();
    this.characterContainer = new PIXI.Container();
    this.uiContainer = new PIXI.Container();
    this.choiceContainer = new PIXI.Container();

    this.bgGraphics = new PIXI.Graphics();
    this.dialogBoxInit();

    this.initPromise = this.initPixi(targetElement);
  }

  private async initPixi(targetElement: HTMLElement) {
    await this.app.init({
      width: 800,
      height: 600,
      backgroundColor: 0x141418,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true
    });

    if (this.isDestroyed) {
      this.app.destroy(true, { children: true });
      return;
    }

    targetElement.appendChild(this.app.canvas);

    // Build hierarchy
    this.rootContainer.addChild(this.bgContainer);
    this.bgContainer.addChild(this.bgGraphics);
    this.rootContainer.addChild(this.characterContainer);
    this.rootContainer.addChild(this.uiContainer);
    this.uiContainer.addChild(this.dialogueBox);
    this.uiContainer.addChild(this.choiceContainer);
    this.app.stage.addChild(this.rootContainer);

    // Click handler for advancing dialogue
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = new PIXI.Rectangle(0, 0, 800, 600);
    this.app.stage.on('pointerdown', () => {
      // Don't advance if clicking on choice buttons
      if (this.state.isShowingChoices) return;
      this.handleAdvance();
    });

    this.handleResize();
    window.addEventListener('resize', this.onResize);
  }

  private onResize = () => {
    this.handleResize();
  };

  private dialogBoxInit() {
    this.dialogueBox = new PIXI.Container();
    this.dialogueBox.position.set(20, 420);

    // Main Box Background — neutral charcoal, no blue tint
    this.dialogueBg = new PIXI.Graphics();
    this.dialogueBg.roundRect(0, 0, 760, 160, 12);
    this.dialogueBg.fill({ color: 0x1a1a1f, alpha: 0.92 });
    this.dialogueBg.stroke({ width: 1.5, color: 0x2e2e38, alpha: 0.8 });
    this.dialogueBox.addChild(this.dialogueBg);

    // Speaker Name Tag Box — subtle dark surface
    this.nameBadgeBg = new PIXI.Graphics();
    this.nameBadgeBg.roundRect(16, -18, 180, 36, 8);
    this.nameBadgeBg.fill({ color: 0x222228, alpha: 0.95 });
    this.nameBadgeBg.stroke({ width: 1, color: 0x3a3a46, alpha: 0.8 });
    this.dialogueBox.addChild(this.nameBadgeBg);

    // Speaker Name Text
    this.nameText = new PIXI.Text({
      text: '',
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 16,
        fontWeight: 'bold',
        fill: 0xe4e4e8,
      }
    });
    this.nameText.position.set(28, -10);
    this.dialogueBox.addChild(this.nameText);

    // Dialogue Body Text
    this.dialogueText = new PIXI.Text({
      text: '',
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 18,
        fill: 0xd4d4d8,
        wordWrap: true,
        wordWrapWidth: 720,
        lineHeight: 28
      }
    });
    this.dialogueText.position.set(24, 32);
    this.dialogueBox.addChild(this.dialogueText);

    // Continue / Next indicator
    this.continuePrompt = new PIXI.Text({
      text: '▼ Click to continue',
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 12,
        fill: 0x6b7280,
      }
    });
    this.continuePrompt.position.set(620, 130);
    this.continuePrompt.visible = false;
    this.dialogueBox.addChild(this.continuePrompt);

    this.dialogueBox.visible = false;
  }

  public async loadStory(storyData: ProjectIR) {
    await this.initPromise;
    this.story = storyData;

    // Initialize default variables
    this.state.variables = {};
    if (this.story.variables) {
      for (const [id, variable] of Object.entries(this.story.variables)) {
        this.state.variables[id] = variable.defaultValue;
      }
    }

    // Start at entry scene
    const entryId = this.story.flow.entrySceneId;
    if (entryId && this.story.scenes[entryId]) {
      await this.goToScene(entryId);
    } else {
      const firstSceneId = Object.keys(this.story.scenes)[0];
      if (firstSceneId) {
        await this.goToScene(firstSceneId);
      }
    }
  }

  public async goToScene(sceneId: ID) {
    if (!this.story || !this.story.scenes[sceneId]) {
      console.error(`Scene ${sceneId} not found in project`);
      return;
    }

    const scene = this.story.scenes[sceneId];
    this.state.currentSceneId = sceneId;
    this.state.currentBlockIndex = 0;
    this.state.isWaitingForInput = false;
    this.state.isShowingChoices = false;
    this.state.history.push(`Entered scene: ${scene.title}`);

    // Clear choices
    this.clearChoices();
    this.hideFlashback();
    this.hideMissingOverlay();

    // Render background
    await this.renderBackground(scene.background?.assetId || null);

    this.events.onSceneChange?.(sceneId, scene.title);
    this.notifyState();

    // Process first block
    await this.processCurrentBlock();
  }

  private async renderBackground(assetId: ID | null) {
    // Clear existing background sprite
    if (this.bgSprite) {
      this.bgContainer.removeChild(this.bgSprite);
      this.bgSprite.destroy();
      this.bgSprite = null;
    }
    this.bgGraphics.clear();

    if (!assetId || !this.story?.assets[assetId]) {
      // Default gradient / fallback background
      this.bgGraphics.rect(0, 0, 800, 600);
      this.bgGraphics.fill({ color: 0x1a1a1f });
      return;
    }

    const asset = this.story.assets[assetId];
    const assetUrl = asset.fileReference.startsWith('/') ? asset.fileReference : `/${asset.fileReference}`;

    try {
      const texture = await PIXI.Assets.load(assetUrl);
      this.bgSprite = new PIXI.Sprite(texture);
      this.bgSprite.width = 800;
      this.bgSprite.height = 600;
      this.bgContainer.addChild(this.bgSprite);
    } catch (err) {
      console.warn(`Could not load background image ${assetUrl}, using fallback`, err);
      this.bgGraphics.rect(0, 0, 800, 600);
      this.bgGraphics.fill({ color: 0x1a1a1f });
    }
  }

  private async processCurrentBlock() {
    if (!this.story || !this.state.currentSceneId) return;

    const scene = this.story.scenes[this.state.currentSceneId];
    if (!scene) return;

    if (this.state.currentBlockIndex >= scene.blocks.length) {
      // Reached end of current scene
      this.dialogueBox.visible = false;
      this.clearChoices();
      this.hideFlashback();
      this.hideMissingOverlay();
      this.events.onStoryEnd?.();
      this.notifyState();
      return;
    }

    const block: StoryBlock = scene.blocks[this.state.currentBlockIndex];

    // A new block resets any plugin-driven overlay from the previous one.
    this.hideFlashback();
    this.hideMissingOverlay();
    this.pendingJumpSceneId = null;

    const result = this.pluginHost.invoke(block, this);

    if (result.missingCapability) {
      this.handleMissingCapability(block, result.missingCapability);
      this.notifyState();
      return;
    }

    const jumpTarget = result.jumpToSceneId || this.pendingJumpSceneId;
    if (jumpTarget && this.story.scenes[jumpTarget]) {
      await this.goToScene(jumpTarget);
      return;
    }

    if (result.waitForInput) {
      // The block presented content that waits for player input (dialogue,
      // choice, flashback, missing capability handled above).
      this.notifyState();
      return;
    }

    // Auto-advance past blocks that complete immediately.
    this.state.currentBlockIndex++;
    await this.processCurrentBlock();
    this.notifyState();
  }

  // ---- PluginEngineAdapter implementation --------------------------------

  public showDialogue(speaker: string, text: string): void {
    this.clearChoices();
    this.dialogueBox.visible = true;

    if (speaker && speaker !== 'Narrator') {
      this.nameBadgeBg.visible = true;
      this.nameText.visible = true;
      this.nameText.text = speaker;
    } else {
      this.nameBadgeBg.visible = false;
      this.nameText.visible = false;
    }

    // Start typewriter
    this.targetText = text;
    this.displayedText = '';
    this.dialogueText.text = '';
    this.isTypewriterComplete = false;
    this.continuePrompt.visible = false;
    this.state.isWaitingForInput = true;

    this.events.onDialogue?.(speaker, text);

    if (this.typewriterInterval) {
      clearInterval(this.typewriterInterval);
    }

    let charIdx = 0;
    this.typewriterInterval = window.setInterval(() => {
      if (charIdx < this.targetText.length) {
        this.displayedText += this.targetText[charIdx];
        this.dialogueText.text = this.displayedText;
        charIdx++;
      } else {
        this.finishTypewriter();
      }
    }, 20);
  }

  public presentChoices(prompt: string, options: ChoiceOption[]): void {
    this.state.isShowingChoices = true;
    this.state.isWaitingForInput = true;
    this.continuePrompt.visible = false;
    this.clearChoices();

    const available = options
      .map((option) => ({
        option,
        availability: evaluateChoiceAvailability(option, this.story!, this.state.variables),
      }))
      .filter((entry) => entry.availability.available);
    const startY = 160;
    const gap = 64;

    available.forEach(({ option: opt }, idx) => {
      const choiceBtn = new PIXI.Container();
      choiceBtn.position.set(120, startY + idx * gap);

      const btnBg = new PIXI.Graphics();
      const drawBg = (isHover: boolean) => {
        btnBg.clear();
        btnBg.roundRect(0, 0, 560, 48, 8);
        btnBg.fill({ color: isHover ? 0x28282e : 0x1e1e24, alpha: 0.95 });
        btnBg.stroke({ width: 1.5, color: isHover ? 0x4a4a58 : 0x2e2e38, alpha: 0.9 });
      };

      drawBg(false);
      choiceBtn.addChild(btnBg);

      const btnText = new PIXI.Text({
        text: `${idx + 1}.  ${opt.text}`,
        style: {
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: 16,
          fontWeight: '500',
          fill: 0xffffff
        }
      });
      btnText.position.set(24, 12);
      choiceBtn.addChild(btnText);

      choiceBtn.eventMode = 'static';
      choiceBtn.cursor = 'pointer';

      choiceBtn.on('pointerover', () => drawBg(true));
      choiceBtn.on('pointerout', () => drawBg(false));
      choiceBtn.on('pointerdown', (e) => {
        e.stopPropagation();
        this.selectChoice(opt.text, opt.destinationSceneId);
      });

      this.choiceContainer.addChild(choiceBtn);
    });

    this.events.onChoice?.(prompt, available.map(({ option }) => option));
  }

  public showCharacter(characterId: string, expression: string, position: CharacterPosition): void {
    if (!this.story) return;
    const char = this.story.characters[characterId];
    if (!char) return;

    const portraitRef = char.portraits[expression];
    const assetId = portraitRef?.assetId;
    const asset = assetId ? this.story.assets[assetId] : null;

    if (!asset) return;

    const assetUrl = asset.fileReference.startsWith('/') ? asset.fileReference : `/${asset.fileReference}`;

    try {
      PIXI.Assets.load(assetUrl).then((texture) => {
        if (this.isDestroyed) return;

        let sprite = this.characters.get(characterId);
        if (!sprite) {
          sprite = new PIXI.Sprite(texture);
          this.characters.set(characterId, sprite);
          this.characterContainer.addChild(sprite);
        } else {
          sprite.texture = texture;
        }

        // Height is standard 500px on 600px canvas
        const targetHeight = 500;
        const scale = targetHeight / (texture.height || 600);
        sprite.scale.set(scale, scale);
        sprite.y = 600 - targetHeight;

        // Position x
        if (position === 'left') {
          sprite.x = 60;
        } else if (position === 'right') {
          sprite.x = 800 - sprite.width - 60;
        } else {
          // center
          sprite.x = (800 - sprite.width) / 2;
        }

        sprite.visible = true;
      }).catch((err) => {
        console.warn(`Could not load character asset ${assetUrl}`, err);
      });
    } catch (err) {
      console.warn(`Could not load character asset ${assetUrl}`, err);
    }
  }

  public hideCharacter(characterId: string): void {
    const sprite = this.characters.get(characterId);
    if (sprite) {
      sprite.visible = false;
    }
  }

  public getVariable(id: string): unknown {
    return this.state.variables[id];
  }

  public setVariable(id: string, value: unknown): void {
    this.state.variables[id] = value as VariableValue;
    this.state.history.push(`Variable '${id}' -> ${JSON.stringify(value)}`);
  }

  public getCharacterName(characterId: string): string | null {
    return this.story?.characters[characterId]?.name ?? null;
  }

  public showFlashback(payload: FlashbackPayload): void {
    this.hideFlashback();
    const overlay = new PIXI.Container();

    const bg = new PIXI.Graphics();
    bg.rect(0, 0, 800, 600);
    bg.fill({ color: parseHexColor(payload.tint), alpha: 0.97 });
    overlay.addChild(bg);

    const title = new PIXI.Text({
      text: payload.title || 'Flashback',
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 22,
        fontWeight: 'bold',
        fill: 0xf5f5f7,
      }
    });
    title.position.set(40, 200);
    overlay.addChild(title);

    const body = new PIXI.Text({
      text: payload.text || '',
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 15,
        fill: 0xd4d4d8,
        wordWrap: true,
        wordWrapWidth: 720,
        lineHeight: 24,
      }
    });
    body.position.set(40, 250);
    overlay.addChild(body);

    const hint = new PIXI.Text({
      text: '▼ Click to continue',
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 12,
        fill: 0x8b8b96,
      }
    });
    hint.position.set(620, 560);
    overlay.addChild(hint);

    this.uiContainer.addChild(overlay);
    this.flashbackOverlay = overlay;
    this.state.isWaitingForInput = true;
    this.state.history.push(`Flashback: ${payload.title || ''}`);
    this.events.onFlashback?.(payload.title || '', payload.text || '');
  }

  public hideFlashback(): void {
    if (this.flashbackOverlay) {
      this.uiContainer.removeChild(this.flashbackOverlay);
      this.flashbackOverlay.destroy();
      this.flashbackOverlay = null;
    }
  }

  public jumpToScene(sceneId: string): void {
    this.pendingJumpSceneId = sceneId;
  }

  public runScript(code: string, label: string): RunScriptResult {
    const result = RuntimeScriptSandbox.run(code, {
      getVariable: (id) => this.state.variables[id],
      setVariable: (id, value) => {
        this.state.variables[id] = value as VariableValue;
        this.state.history.push(`Script set '${id}' -> ${JSON.stringify(value)}`);
      },
      log: (message) => {
        this.state.history.push(`[script:${label}] ${message}`);
      },
      jumpToScene: (sceneId) => {
        this.state.history.push(`[script:${label}] jump -> ${sceneId}`);
      },
    });

    return { jumpToSceneId: result.jumpToSceneId };
  }

  public log(message: string): void {
    this.state.history.push(message);
  }

  public advance(): void {
    this.handleAdvance();
  }

  // ---- missing capability state ------------------------------------------

  private handleMissingCapability(block: StoryBlock, message: string): void {
    const type = block.type === 'plugin' ? (block as PluginBlock).pluginType : block.type;
    this.clearChoices();
    this.dialogueBox.visible = false;
    this.hideFlashback();
    this.stopTypewriter();
    this.state.isWaitingForInput = true;
    this.state.isShowingChoices = false;
    this.state.history.push(`Missing capability: ${message}`);
    this.showMissingOverlay(type, message);
    this.events.onPluginMissing?.(type, message);
  }

  private showMissingOverlay(type: string, message: string): void {
    this.hideMissingOverlay();
    const overlay = new PIXI.Container();

    const bg = new PIXI.Graphics();
    bg.rect(0, 0, 800, 600);
    bg.fill({ color: 0x141418, alpha: 0.96 });
    overlay.addChild(bg);

    const title = new PIXI.Text({
      text: `Missing capability: ${type}`,
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 20,
        fontWeight: 'bold',
        fill: 0xf59e0b,
      }
    });
    title.position.set(40, 210);
    overlay.addChild(title);

    const body = new PIXI.Text({
      text: `${message}\n\nClick to skip this block.`,
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 14,
        fill: 0xd4d4d8,
        wordWrap: true,
        wordWrapWidth: 720,
        lineHeight: 22,
      }
    });
    body.position.set(40, 260);
    overlay.addChild(body);

    this.uiContainer.addChild(overlay);
    this.missingOverlay = overlay;
  }

  private hideMissingOverlay(): void {
    if (this.missingOverlay) {
      this.uiContainer.removeChild(this.missingOverlay);
      this.missingOverlay.destroy();
      this.missingOverlay = null;
    }
  }

  private stopTypewriter(): void {
    if (this.typewriterInterval) {
      clearInterval(this.typewriterInterval);
      this.typewriterInterval = null;
    }
    this.isTypewriterComplete = true;
  }

  // ---- playback helpers ---------------------------------------------------

  private finishTypewriter() {
    if (this.typewriterInterval) {
      clearInterval(this.typewriterInterval);
      this.typewriterInterval = null;
    }
    this.displayedText = this.targetText;
    this.dialogueText.text = this.displayedText;
    this.isTypewriterComplete = true;
    this.continuePrompt.visible = true;
  }

  public handleAdvance() {
    if (!this.state.isWaitingForInput || this.state.isShowingChoices) return;

    if (!this.isTypewriterComplete) {
      // Instant skip to complete text
      this.finishTypewriter();
      return;
    }

    // Advance to next block
    this.state.isWaitingForInput = false;
    this.continuePrompt.visible = false;
    this.state.currentBlockIndex++;
    this.processCurrentBlock();
  }

  private selectChoice(optionText: string, destinationSceneId: ID | null) {
    this.state.history.push(`Selected: "${optionText}"`);
    this.clearChoices();
    this.state.isShowingChoices = false;
    this.state.isWaitingForInput = false;

    if (destinationSceneId && this.story?.scenes[destinationSceneId]) {
      this.goToScene(destinationSceneId);
    } else {
      // Continue within same scene
      this.state.currentBlockIndex++;
      this.processCurrentBlock();
    }
  }

  private clearChoices() {
    this.choiceContainer.removeChildren();
    this.state.isShowingChoices = false;
  }

  private notifyState() {
    this.events.onStateChange?.({ ...this.state });
  }

  public getState(): EngineState {
    return { ...this.state };
  }

  /** Serializable snapshot for web/cloud save persistence (no runtime-only data). */
  public getSaveData(): { currentSceneId: string; currentBlockIndex: number; variables: Record<string, VariableValue> } {
    return {
      currentSceneId: this.state.currentSceneId || '',
      currentBlockIndex: this.state.currentBlockIndex,
      variables: { ...this.state.variables },
    };
  }

  /** Restore a previously saved snapshot (from getSaveData) and resume playing. */
  public async restoreState(save: { currentSceneId: string; currentBlockIndex: number; variables: Record<string, VariableValue> }): Promise<void> {
    await this.initPromise;
    if (!this.story) throw new Error('No story loaded.');
    if (!this.story.scenes[save.currentSceneId]) throw new Error(`Saved scene '${save.currentSceneId}' no longer exists.`);
    this.state.variables = { ...save.variables };
    this.state.currentSceneId = save.currentSceneId;
    this.state.currentBlockIndex = Math.min(Math.max(save.currentBlockIndex, 0), this.story.scenes[save.currentSceneId].blocks.length);
    this.state.isWaitingForInput = false;
    this.state.isShowingChoices = false;
    this.clearChoices();
    this.hideFlashback();
    this.hideMissingOverlay();
    await this.renderBackground(this.story.scenes[save.currentSceneId].background?.assetId || null);
    this.events.onSceneChange?.(save.currentSceneId, this.story.scenes[save.currentSceneId].title);
    this.notifyState();
    await this.processCurrentBlock();
  }

  public handleResize() {
    if (!this.app.renderer) return;

    const parent = this.app.canvas?.parentElement || document.body;
    const width = parent.clientWidth || 800;
    const height = parent.clientHeight || 600;

    this.app.renderer.resize(width, height);

    // Maintain 800x600 virtual aspect ratio
    const scaleX = width / 800;
    const scaleY = height / 600;
    const scale = Math.min(scaleX, scaleY);

    this.rootContainer.scale.set(scale, scale);
    this.rootContainer.position.set(
      (width - 800 * scale) / 2,
      (height - 600 * scale) / 2
    );
  }

  public destroy() {
    this.isDestroyed = true;
    window.removeEventListener('resize', this.onResize);
    if (this.typewriterInterval) {
      clearInterval(this.typewriterInterval);
    }
    this.app.destroy(true, { children: true });
  }
}