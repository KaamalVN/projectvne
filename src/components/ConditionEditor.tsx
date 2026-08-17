import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { ProjectIR, ID, ConditionExpression, VariableCondition, ComparisonOperator, LogicalOperator, CompoundCondition } from '../shared/types';

interface ConditionEditorProps {
  project: ProjectIR;
  condition?: ConditionExpression;
  onChange: (condition: ConditionExpression) => void;
  readOnly?: boolean;
}

export const ConditionEditor: React.FC<ConditionEditorProps> = ({
  project,
  condition,
  onChange,
  readOnly = false
}) => {
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');

  const variables = Object.values(project.variables);

  const createVariableCondition = (): VariableCondition => ({
    type: 'variable',
    variableId: variables[0]?.id || '',
    operator: 'equals',
    value: variables[0]?.defaultValue || 0
  });

  const updateVariableCondition = (index: number, updates: Partial<VariableCondition>) => {
    if (!condition || condition.type !== 'compound') return;

    const newConditions = [...condition.conditions];
    const current = newConditions[index] as VariableCondition;
    newConditions[index] = { ...current, ...updates };

    onChange({
      ...condition,
      conditions: newConditions
    });
  };

  const addCondition = () => {
    if (!condition) {
      onChange(createVariableCondition());
      return;
    }

    if (condition.type === 'variable') {
      onChange({
        type: 'compound',
        operator: 'and',
        conditions: [condition, createVariableCondition()]
      });
    } else {
      onChange({
        ...condition,
        conditions: [...condition.conditions, createVariableCondition()]
      });
    }
  };

  const removeCondition = (index: number) => {
    if (!condition || condition.type !== 'compound') return;

    const newConditions = condition.conditions.filter((_, i) => i !== index);
    if (newConditions.length === 1) {
      onChange(newConditions[0]);
    } else {
      onChange({
        ...condition,
        conditions: newConditions
      });
    }
  };

  const setLogicalOperator = (operator: LogicalOperator) => {
    if (!condition || condition.type !== 'compound') return;
    onChange({ ...condition, operator });
  };

  const selectCls = "bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded px-2 py-1 text-[11px] text-[var(--text-secondary)] focus:outline-none focus:border-[var(--border-focus)]";
  const inputCls = "bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded px-2 py-1 text-[11px] text-[var(--text-secondary)] focus:outline-none focus:border-[var(--border-focus)] w-20";

  const renderVariableCondition = (vc: VariableCondition, index?: number) => {
    const variable = project.variables[vc.variableId];

    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>if</span>

        <select
          className={selectCls}
          value={vc.variableId}
          onChange={(e) => index !== undefined ? updateVariableCondition(index, { variableId: e.target.value as ID }) : null}
          disabled={readOnly}
        >
          {variables.map(v => (
            <option key={v.id} value={v.id} className="bg-[var(--bg-panel)]">
              {v.displayName || v.name}
            </option>
          ))}
        </select>

        <select
          className={selectCls}
          value={vc.operator}
          onChange={(e) => index !== undefined ? updateVariableCondition(index, { operator: e.target.value as ComparisonOperator }) : null}
          disabled={readOnly}
        >
          <option value="equals">equals</option>
          <option value="notEquals">does not equal</option>
          <option value="greaterThan">greater than</option>
          <option value="lessThan">less than</option>
          <option value="greaterThanOrEqual">at least</option>
          <option value="lessThanOrEqual">at most</option>
          <option value="contains">contains</option>
          <option value="notContains">does not contain</option>
        </select>

        <input
          type="text"
          className={inputCls}
          value={String(vc.value)}
          onChange={(e) => {
            let parsed: any = e.target.value;
            if (variable?.type === 'number' || variable?.type === 'counter' || variable?.type === 'relationship') {
              parsed = Number(e.target.value) || 0;
            } else if (variable?.type === 'boolean') {
              parsed = e.target.value === 'true';
            }
            index !== undefined ? updateVariableCondition(index, { value: parsed }) : null;
          }}
          disabled={readOnly}
          placeholder={variable?.type === 'boolean' ? 'true/false' : 'value'}
        />

        {index !== undefined && !readOnly && (
          <button
            onClick={() => removeCondition(index)}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <X size={12} />
          </button>
        )}
      </div>
    );
  };

  const renderCompoundCondition = (cc: CompoundCondition) => {
    return (
      <div className="space-y-2">
        {cc.conditions.map((cond, index) => (
          <div key={index} className="flex items-start gap-2">
            {index > 0 && (
              <select
                className={selectCls + " mt-1"}
                value={cc.operator}
                onChange={(e) => setLogicalOperator(e.target.value as LogicalOperator)}
                disabled={readOnly}
              >
                <option value="and">and</option>
                <option value="or">or</option>
              </select>
            )}
            <div className="flex-1">
              {cond.type === 'variable' && renderVariableCondition(cond, index)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderSentenceView = () => {
    if (!condition) {
      return <div className="text-[11px] italic" style={{ color: 'var(--text-muted)' }}>No condition set</div>;
    }

    if (condition.type === 'variable') {
      return renderVariableCondition(condition);
    }

    if (condition.type === 'compound') {
      return renderCompoundCondition(condition);
    }

    return <div className="text-[11px] italic" style={{ color: 'var(--text-muted)' }}>Unknown condition type</div>;
  };

  const renderAdvancedView = () => {
    return (
      <div className="p-3 rounded font-mono text-[11px]" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
        <pre>{JSON.stringify(condition, null, 2)}</pre>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>Condition Builder</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMode('simple')}
            className="px-2 py-0.5 text-[10px] rounded transition-colors"
            style={{
              background: mode === 'simple' ? 'var(--bg-card)' : 'transparent',
              color: mode === 'simple' ? 'var(--text-primary)' : 'var(--text-muted)',
              border: mode === 'simple' ? '1px solid var(--border-default)' : '1px solid transparent'
            }}
          >
            Simple
          </button>
          <button
            onClick={() => setMode('advanced')}
            className="px-2 py-0.5 text-[10px] rounded transition-colors"
            style={{
              background: mode === 'advanced' ? 'var(--bg-card)' : 'transparent',
              color: mode === 'advanced' ? 'var(--text-primary)' : 'var(--text-muted)',
              border: mode === 'advanced' ? '1px solid var(--border-default)' : '1px solid transparent'
            }}
          >
            Advanced
          </button>
        </div>
      </div>

      {mode === 'simple' ? (
        <div className="space-y-2">
          {renderSentenceView()}
          {!readOnly && (
            <button
              onClick={addCondition}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
            >
              <Plus size={10} />
              Add condition
            </button>
          )}
        </div>
      ) : (
        renderAdvancedView()
      )}
    </div>
  );
};
