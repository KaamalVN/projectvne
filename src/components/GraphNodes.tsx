import { Handle, Position } from '@xyflow/react';
import { Play, MessageSquare, Image, User, Split, CheckCircle2 } from 'lucide-react';

export interface StoryNodeData extends Record<string, unknown> {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  content?: string;
  characterName?: string;
  characterExpression?: string;
  characterPosition?: string;
  characterImage?: string;
  backgroundImage?: string;
  prompt?: string;
  options?: { id: string; text: string; destinationSceneId: string | null }[];
  metadata?: Record<string, any>;
}

const srcHandle = (color: string) => ({ background: color, width: 10, height: 10, border: '2px solid var(--canvas-bg, #121216)' });
const tgtHandle = (color: string) => ({ background: color, width: 10, height: 10, border: '2px solid var(--canvas-bg, #121216)' });

// 1. START NODE — Green
export const StartNode = () => (
  <div className="w-48 rounded-lg overflow-hidden shadow-md transition-all hover:shadow-lg"
    style={{ background: 'var(--bg-card)', border: '1px solid var(--green-border)' }}>
    <div className="px-3 py-2 flex items-center gap-2"
      style={{ background: 'var(--green-dim)', borderBottom: '1px solid var(--green-border)' }}>
      <Play size={11} className="fill-current" style={{ color: 'var(--green-text)' }} />
      <span className="text-[11px] font-bold tracking-wide" style={{ color: 'var(--green-text)' }}>Start</span>
    </div>
    <div className="p-2.5 text-[10px] flex justify-between items-center" style={{ color: 'var(--text-muted)' }}>
      <span>Entry Point</span>
    </div>
    <Handle type="source" position={Position.Right} id="out" style={srcHandle('var(--green-text)')} />
  </div>
);

// 2. END NODE — Green
export const EndNode = () => (
  <div className="w-44 rounded-lg overflow-hidden shadow-md transition-all hover:shadow-lg"
    style={{ background: 'var(--bg-card)', border: '1px solid var(--green-border)' }}>
    <Handle type="target" position={Position.Left} id="in" style={tgtHandle('var(--green-text)')} />
    <div className="px-3 py-2 flex items-center gap-2"
      style={{ background: 'var(--green-dim)', borderBottom: '1px solid var(--green-border)' }}>
      <CheckCircle2 size={11} style={{ color: 'var(--green-text)' }} />
      <span className="text-[11px] font-bold" style={{ color: 'var(--green-text)' }}>End</span>
    </div>
    <div className="p-2.5 text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>Scene Complete</div>
  </div>
);

// 3. DIALOGUE / NARRATION NODE — Blue
export const DialogueNode = ({ data }: { data: StoryNodeData }) => (
  <div className="w-68 rounded-lg overflow-hidden shadow-md transition-all hover:shadow-lg" style={{ width: 272, background: 'var(--bg-card)', border: '1px solid var(--blue-border)' }}>
    <Handle type="target" position={Position.Left} id="in" style={tgtHandle('var(--blue-text)')} />

    <div className="px-3 py-2 flex items-center justify-between"
      style={{ background: 'var(--blue-dim)', borderBottom: '1px solid var(--blue-border)' }}>
      <div className="flex items-center gap-1.5">
        <MessageSquare size={11} style={{ color: 'var(--blue-text)' }} />
        <span className="text-[11px] font-bold" style={{ color: 'var(--blue-text)' }}>{data.characterName ? 'Say' : 'Narration'}</span>
      </div>
      <span className="text-[9px] font-mono" style={{ color: 'var(--text-ghost)' }}>{data.id?.slice(-6)}</span>
    </div>

    <div className="p-3 space-y-2">
      {data.characterName && (
        <div className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--blue-text)' }} />
          {data.characterName}
          {data.characterExpression && <span className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>({data.characterExpression})</span>}
        </div>
      )}
      <div className="p-2 rounded text-[11px] leading-relaxed italic"
        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
        "{data.content || '...'}"
      </div>
    </div>

    <Handle type="source" position={Position.Right} id="out" style={srcHandle('var(--blue-text)')} />
  </div>
);

// 4. SHOW CHARACTER NODE — Violet
export const ShowCharacterNode = ({ data }: { data: StoryNodeData }) => (
  <div className="w-60 rounded-lg overflow-hidden shadow-md transition-all hover:shadow-lg"
    style={{ background: 'var(--bg-card)', border: '1px solid var(--violet-border)' }}>
    <Handle type="target" position={Position.Left} id="in" style={tgtHandle('var(--violet-text)')} />

    <div className="px-3 py-2 flex items-center gap-1.5"
      style={{ background: 'var(--violet-dim)', borderBottom: '1px solid var(--violet-border)' }}>
      <User size={11} style={{ color: 'var(--violet-text)' }} />
      <span className="text-[11px] font-bold" style={{ color: 'var(--violet-text)' }}>Show Character</span>
    </div>

    <div className="p-3 flex items-center gap-3">
      <div className="w-12 h-12 rounded flex items-center justify-center overflow-hidden shrink-0"
        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
        {data.characterImage
          ? <img src={data.characterImage} alt="Portrait" className="w-full h-full object-cover" />
          : <User size={20} style={{ color: 'var(--text-ghost)' }} />
        }
      </div>
      <div className="space-y-0.5 min-w-0">
        <div className="text-[11px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>{data.characterName || 'Character'}</div>
        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Expr: <span className="font-mono" style={{ color: 'var(--violet-text)' }}>{data.characterExpression || 'default'}</span></div>
        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Pos: <span className="font-mono" style={{ color: 'var(--violet-text)' }}>{data.characterPosition || 'center'}</span></div>
      </div>
    </div>

    <Handle type="source" position={Position.Right} id="out" style={srcHandle('var(--violet-text)')} />
  </div>
);

// 5. SHOW BACKGROUND NODE — Teal
export const ShowBackgroundNode = ({ data }: { data: StoryNodeData }) => (
  <div className="w-60 rounded-lg overflow-hidden shadow-md transition-all hover:shadow-lg"
    style={{ background: 'var(--bg-card)', border: '1px solid var(--teal-border)' }}>
    <Handle type="target" position={Position.Left} id="in" style={tgtHandle('var(--teal-text)')} />

    <div className="px-3 py-2 flex items-center gap-1.5"
      style={{ background: 'var(--teal-dim)', borderBottom: '1px solid var(--teal-border)' }}>
      <Image size={11} style={{ color: 'var(--teal-text)' }} />
      <span className="text-[11px] font-bold" style={{ color: 'var(--teal-text)' }}>Show Background</span>
    </div>

    <div className="p-3 flex items-center gap-3">
      <div className="w-16 h-10 rounded flex items-center justify-center overflow-hidden shrink-0"
        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
        {data.backgroundImage
          ? <img src={data.backgroundImage} alt="BG" className="w-full h-full object-cover" />
          : <Image size={16} style={{ color: 'var(--text-ghost)' }} />
        }
      </div>
      <div className="space-y-0.5 min-w-0">
        <div className="text-[11px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>{data.content || 'Background'}</div>
        <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>fade: 600ms</div>
      </div>
    </div>

    <Handle type="source" position={Position.Right} id="out" style={srcHandle('var(--teal-text)')} />
  </div>
);

// 6. CHOICE NODE — Amber (multi-branch)
export const ChoiceNode = ({ data }: { data: StoryNodeData }) => {
  const options = (data.options as any[]) || [
    { id: 'opt1', text: 'Option A', destinationSceneId: null },
    { id: 'opt2', text: 'Option B', destinationSceneId: null }
  ];

  return (
    <div className="w-76 rounded-lg overflow-hidden shadow-md transition-all hover:shadow-lg" style={{ width: 296, background: 'var(--bg-card)', border: '1px solid var(--amber-border)' }}>
      <Handle type="target" position={Position.Left} id="in" style={tgtHandle('var(--amber-text)')} />

      <div className="px-3 py-2 flex items-center justify-between"
        style={{ background: 'var(--amber-dim)', borderBottom: '1px solid var(--amber-border)' }}>
        <div className="flex items-center gap-1.5">
          <Split size={11} style={{ color: 'var(--amber-text)' }} />
          <span className="text-[11px] font-bold" style={{ color: 'var(--amber-text)' }}>Choice Branch</span>
        </div>
        <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>{options.length} options</span>
      </div>

      <div className="p-3 space-y-2">
        <div className="text-[11px] italic p-2 rounded"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
          "{data.prompt || 'How do you respond?'}"
        </div>
        <div className="space-y-1.5">
          {options.map((opt: any, idx: number) => (
            <div key={opt.id || idx}
              className="relative rounded px-2 py-1.5 text-[11px] flex items-center justify-between pr-5 transition-colors"
              style={{ background: 'var(--amber-dim)', border: '1px solid var(--amber-border)', color: 'var(--text-secondary)' }}>
              <span className="truncate max-w-[220px]">{idx + 1}. {opt.text}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={`opt-${idx}`}
                style={{ ...srcHandle('var(--amber-text)'), position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
