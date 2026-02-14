import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

type GroupNodeData = {
  label: string;
  color: string;
  darkMode: boolean;
};

function GroupNodeComponent({ data }: NodeProps & { data: GroupNodeData }) {
  const { label, color, darkMode } = data as GroupNodeData;

  return (
    <div
      className="rounded-xl"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: darkMode ? 'rgba(30,41,59,0.5)' : 'rgba(248,250,252,0.8)',
        border: `2px dashed ${color}`,
      }}
    >
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white" />

      <div
        className="px-3 py-1.5 text-sm font-bold rounded-t-xl"
        style={{
          color: darkMode ? '#fff' : '#1f2937',
          backgroundColor: color + '22',
          borderBottom: `1px dashed ${color}44`,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export default memo(GroupNodeComponent);
