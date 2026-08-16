import * as PIXI from 'pixi.js';
import { ProjectIR, ID, StoryBlock, DialogueBlock, ShowCharacterBlock, ChoiceBlock, SetVariableBlock } from '../shared/types';

export interface EngineState {
  currentSceneId: ID | null;
  currentBlockIndex: number;
  variables: Record<string, number | boolean | string>;
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
}

export class PixiVisualNovelEngine {
  public app: PIXI.Application;
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

  constructor(targetElement: HTMLElement, events: EngineEvents = {}) {
    this.events = events;
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
      backgroundColor: 0x111827,
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

    // Main Box Background (Glassmorphism dark look)
    this.dialogueBg = new PIXI.Graphics();
    this.dialogueBg.roundRect(0, 0, 760, 160, 12);
    this.dialogueBg.fill({ color: 0x0f172a, alpha: 0.88 });
    this.dialogueBg.stroke({ width: 2, color: 0x3b82f6, alpha: 0.7 });
    this.dialogueBox.addChild(this.dialogueBg);

    // Speaker Name Tag Box
    this.nameBadgeBg = new PIXI.Graphics();
    this.nameBadgeBg.roundRect(16, -18, 180, 36, 8);
    this.nameBadgeBg.fill({ color: 0x1e3a8a, alpha: 0.95 });
    this.nameBadgeBg.stroke({ width: 1.5, color: 0x60a5fa, alpha: 0.9 });
    this.dialogueBox.addChild(this.nameBadgeBg);

    // Speaker Name Text
    this.nameText = new PIXI.Text({
      text: '',
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 16,
        fontWeight: 'bold',
        fill: 0xf8fafc,
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
        fill: 0xf1f5f9,
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
        fill: 0x93c5fd,
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
      this.bgGraphics.fill({ color: 0x1e293b });
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
      this.bgGraphics.fill({ color: 0x1e293b });
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
      this.events.onStoryEnd?.();
      return;
    }

    const block: StoryBlock = scene.blocks[this.state.currentBlockIndex];

    switch (block.type) {
      case 'showCharacter':
        await this.handleShowCharacter(block as ShowCharacterBlock);
        this.state.currentBlockIndex++;
        await this.processCurrentBlock();
        break;

      case 'hideCharacter':
        this.handleHideCharacter(block.characterId);
        this.state.currentBlockIndex++;
        await this.processCurrentBlock();
        break;

      case 'setVariable':
        this.handleSetVariable(block as SetVariableBlock);
        this.state.currentBlockIndex++;
        await this.processCurrentBlock();
        break;

      case 'dialogue':
        this.handleDialogue(block as DialogueBlock);
        break;

      case 'choice':
        this.handleChoice(block as ChoiceBlock);
        break;

      default:
        this.state.currentBlockIndex++;
        await this.processCurrentBlock();
        break;
    }

    this.notifyState();
  }

  private async handleShowCharacter(block: ShowCharacterBlock) {
    if (!this.story) return;
    const char = this.story.characters[block.characterId];
    if (!char) return;

    const portraitRef = char.portraits[block.expression];
    const assetId = portraitRef?.assetId;
    const asset = assetId ? this.story.assets[assetId] : null;

    if (!asset) return;

    const assetUrl = asset.fileReference.startsWith('/') ? asset.fileReference : `/${asset.fileReference}`;

    try {
      const texture = await PIXI.Assets.load(assetUrl);
      
      let sprite = this.characters.get(block.characterId);
      if (!sprite) {
        sprite = new PIXI.Sprite(texture);
        this.characters.set(block.characterId, sprite);
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
      if (block.position === 'left') {
        sprite.x = 60;
      } else if (block.position === 'right') {
        sprite.x = 800 - sprite.width - 60;
      } else {
        // center
        sprite.x = (800 - sprite.width) / 2;
      }

      sprite.visible = true;
    } catch (err) {
      console.warn(`Could not load character asset ${assetUrl}`, err);
    }
  }

  private handleHideCharacter(characterId: string) {
    const sprite = this.characters.get(characterId);
    if (sprite) {
      sprite.visible = false;
    }
  }

  private handleSetVariable(block: SetVariableBlock) {
    const current = this.state.variables[block.variableId] ?? 0;
    let nextValue: number | boolean | string = block.value;

    if (typeof current === 'number' && typeof block.value === 'number') {
      if (block.operation === 'add') nextValue = current + block.value;
      else if (block.operation === 'subtract') nextValue = current - block.value;
      else if (block.operation === 'multiply') nextValue = current * block.value;
      else if (block.operation === 'divide') nextValue = current / block.value;
      else nextValue = block.value;
    } else {
      nextValue = block.value;
    }

    this.state.variables[block.variableId] = nextValue;
    this.state.history.push(`Variable '${block.variableId}' -> ${nextValue}`);
  }

  private handleDialogue(block: DialogueBlock) {
    this.clearChoices();
    this.dialogueBox.visible = true;

    // Resolve speaker name
    let speakerName = 'Narrator';
    if (block.characterId && this.story?.characters[block.characterId]) {
      speakerName = this.story.characters[block.characterId].name;
      this.nameBadgeBg.visible = true;
      this.nameText.visible = true;
      this.nameText.text = speakerName;
    } else {
      this.nameBadgeBg.visible = false;
      this.nameText.visible = false;
    }

    // Start typewriter
    this.targetText = block.text;
    this.displayedText = '';
    this.dialogueText.text = '';
    this.isTypewriterComplete = false;
    this.continuePrompt.visible = false;
    this.state.isWaitingForInput = true;

    this.events.onDialogue?.(speakerName, block.text);

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

  private handleChoice(block: ChoiceBlock) {
    this.state.isShowingChoices = true;
    this.state.isWaitingForInput = true;
    this.continuePrompt.visible = false;
    this.clearChoices();

    const options = block.options;
    const startY = 160;
    const gap = 64;

    options.forEach((opt, idx) => {
      const choiceBtn = new PIXI.Container();
      choiceBtn.position.set(120, startY + idx * gap);

      const btnBg = new PIXI.Graphics();
      const drawBg = (isHover: boolean) => {
        btnBg.clear();
        btnBg.roundRect(0, 0, 560, 48, 8);
        btnBg.fill({ color: isHover ? 0x2563eb : 0x1e293b, alpha: 0.95 });
        btnBg.stroke({ width: 2, color: isHover ? 0x93c5fd : 0x475569, alpha: 0.9 });
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

    this.events.onChoice?.(block.prompt, block.options);
  }

  private selectChoice(optionText: string, destinationSceneId: ID | null) {
    this.state.history.push(`Selected: "${optionText}"`);
    this.clearChoices();
    this.state.isShowingChoices = false;

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
