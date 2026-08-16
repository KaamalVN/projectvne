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

// Shared handle style helpers
const srcHandle = (color: string) => ({ background: color, width: 10, height: 10, border: '2px solid #0c0c0c' });
const tgtHandle = (color: string) => ({ background: color, width: 10, height: 10, border: '2px solid #0c0c0c' });

// 1. START NODE
export const StartNode = () => (
  <div className="w-48 rounded-lg bg-[#111] border border-[#1e3a1e] shadow-lg overflow-hidden hover:border-[#2a5c2a] transition-colors">
    <div className="bg-[#0f1f0f] px-3 py-2 border-b border-[#1e3a1e] flex items-center gap-2">
      <Play size={11} className="text-[#22c55e] fill-[#22c55e]" />
      <span className="text-[11px] font-bold text-[#22c55e] tracking-wide">Start</span>
    </div>
    <div className="p-2.5 text-[10px] text-[#444] flex justify-between items-center">
      <span>Entry Point</span>
    </div>
    <Handle type="source" position={Position.Right} id="out" style={srcHandle('#22c55e')} />
  </div>
);

// 2. END NODE
export const EndNode = () => (
  <div className="w-44 rounded-lg bg-[#111] border border-[#1e3a1e] shadow-lg overflow-hidden hover:border-[#2a5c2a] transition-colors">
    <Handle type="target" position={Position.Left} id="in" style={tgtHandle('#22c55e')} />
    <div className="bg-[#0f1f0f] px-3 py-2 border-b border-[#1e3a1e] flex items-center gap-2">
      <CheckCircle2 size={11} className="text-[#22c55e]" />
      <span className="text-[11px] font-bold text-[#22c55e]">End</span>
    </div>
    <div className="p-2.5 text-[10px] text-[#444] text-center">Scene Complete</div>
  </div>
);

// 3. DIALOGUE / NARRATION NODE
export const DialogueNode = ({ data }: { data: StoryNodeData }) => (
  <div className="w-68 rounded-lg bg-[#111] border border-[#1e1e1e] shadow-lg overflow-hidden hover:border-[#2a2a2a] transition-colors" style={{ width: 272 }}>
    <Handle type="target" position={Position.Left} id="in" style={tgtHandle('#555')} />

    <div className="bg-[#141414] px-3 py-2 border-b border-[#1e1e1e] flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <MessageSquare size={11} className="text-[#555]" />
        <span className="text-[11px] font-bold text-[#888]">{data.characterName ? 'Say' : 'Narration'}</span>
      </div>
      <span className="text-[9px] font-mono text-[#333]">{data.id?.slice(-6)}</span>
    </div>

    <div className="p-3 space-y-2">
      {data.characterName && (
        <div className="text-[11px] font-bold text-[#bbb] flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#555]" />
          {data.characterName}
          {data.characterExpression && <span className="text-[10px] text-[#444] font-normal">({data.characterExpression})</span>}
        </div>
      )}
      <div className="bg-[#0c0c0c] p-2 rounded border border-[#1a1a1a] text-[11px] text-[#aaa] leading-relaxed italic">
        "{data.content || '...'}"
      </div>
    </div>

    <Handle type="source" position={Position.Right} id="out" style={srcHandle('#555')} />
  </div>
);

// 4. SHOW CHARACTER NODE
export const ShowCharacterNode = ({ data }: { data: StoryNodeData }) => (
  <div className="w-60 rounded-lg bg-[#111] border border-[#1a1a2a] shadow-lg overflow-hidden hover:border-[#22294a] transition-colors">
    <Handle type="target" position={Position.Left} id="in" style={tgtHandle('#3b82f6')} />

    <div className="bg-[#111520] px-3 py-2 border-b border-[#1a1a2a] flex items-center gap-1.5">
      <User size={11} className="text-[#3b82f6]" />
      <span className="text-[11px] font-bold text-[#6b9fd4]">Show Character</span>
    </div>

    <div className="p-3 flex items-center gap-3">
      <div className="w-12 h-12 rounded bg-[#0c0c0c] border border-[#1a1a1a] flex items-center justify-center overflow-hidden shrink-0">
        {data.characterImage
          ? <img src={data.characterImage} alt="Portrait" className="w-full h-full object-cover" />
          : <User size={20} className="text-[#333]" />
        }
      </div>
      <div className="space-y-0.5 min-w-0">
        <div className="text-[11px] font-bold text-[#ccc] truncate">{data.characterName || 'Character'}</div>
        <div className="text-[10px] text-[#444]">Expr: <span className="text-[#6b9fd4] font-mono">{data.characterExpression || 'default'}</span></div>
        <div className="text-[10px] text-[#444]">Pos: <span className="text-[#6b9fd4] font-mono">{data.characterPosition || 'center'}</span></div>
      </div>
    </div>

    <Handle type="source" position={Position.Right} id="out" style={srcHandle('#3b82f6')} />
  </div>
);

// 5. SHOW BACKGROUND NODE
export const ShowBackgroundNode = ({ data }: { data: StoryNodeData }) => (
  <div className="w-60 rounded-lg bg-[#111] border border-[#1a1a2a] shadow-lg overflow-hidden hover:border-[#22294a] transition-colors">
    <Handle type="target" position={Position.Left} id="in" style={tgtHandle('#3b82f6')} />

    <div className="bg-[#111520] px-3 py-2 border-b border-[#1a1a2a] flex items-center gap-1.5">
      <Image size={11} className="text-[#3b82f6]" />
      <span className="text-[11px] font-bold text-[#6b9fd4]">Show Background</span>
    </div>

    <div className="p-3 flex items-center gap-3">
      <div className="w-16 h-10 rounded bg-[#0c0c0c] border border-[#1a1a1a] flex items-center justify-center overflow-hidden shrink-0">
        {data.backgroundImage
          ? <img src={data.backgroundImage} alt="BG" className="w-full h-full object-cover" />
          : <Image size={16} className="text-[#333]" />
        }
      </div>
      <div className="space-y-0.5 min-w-0">
        <div className="text-[11px] font-bold text-[#ccc] truncate">{data.content || 'Background'}</div>
        <div className="text-[10px] text-[#444] font-mono">fade: 600ms</div>
      </div>
    </div>

    <Handle type="source" position={Position.Right} id="out" style={srcHandle('#3b82f6')} />
  </div>
);

// 6. CHOICE NODE (multi-branch)
export const ChoiceNode = ({ data }: { data: StoryNodeData }) => {
  const options = (data.options as any[]) || [
    { id: 'opt1', text: 'Option A', destinationSceneId: null },
    { id: 'opt2', text: 'Option B', destinationSceneId: null }
  ];

  return (
    <div className="w-76 rounded-lg bg-[#111] border border-[#2a2a1a] shadow-lg overflow-hidden hover:border-[#3a3a22] transition-colors" style={{ width: 296 }}>
      <Handle type="target" position={Position.Left} id="in" style={tgtHandle('#d97706')} />

      <div className="bg-[#191510] px-3 py-2 border-b border-[#2a2a1a] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Split size={11} className="text-[#a16207]" />
          <span className="text-[11px] font-bold text-[#ca8a04]">Choice Branch</span>
        </div>
        <span className="text-[9px] font-mono text-[#555]">{options.length} options</span>
      </div>

      <div className="p-3 space-y-2">
        <div className="text-[11px] text-[#999] italic bg-[#0c0c0c] p-2 rounded border border-[#1a1a1a]">
          "{data.prompt || 'How do you respond?'}"
        </div>
        <div className="space-y-1.5">
          {options.map((opt: any, idx: number) => (
            <div key={opt.id || idx}
              className="relative bg-[#141410] border border-[#2a2a1a] rounded px-2 py-1.5 text-[11px] text-[#aaa] flex items-center justify-between pr-5 hover:border-[#3a3a22] transition-colors">
              <span className="truncate max-w-[220px]">{idx + 1}. {opt.text}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={`opt-${idx}`}
                style={{ ...srcHandle('#d97706'), position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
