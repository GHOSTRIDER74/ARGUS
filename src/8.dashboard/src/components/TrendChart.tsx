import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface TrendChartProps {
  data: any[];
  xKey?: string;
  yKey: string;
  color?: string;
  target?: number;
  upperLimit?: number;
  lowerLimit?: number;
  height?: number | string;
}

export function TrendChart({ 
  data, 
  xKey = "index", 
  yKey, 
  color = "var(--accent-primary)",
  target,
  upperLimit,
  lowerLimit,
  height = 300
}: TrendChartProps) {
  
  if (!data || data.length === 0) {
    return (
      <div className="empty-state" style={{ height }}>
        <div className="empty-state-icon">📈</div>
        <div>No telemetry data available</div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
          <XAxis 
            dataKey={xKey} 
            axisLine={false} 
            tickLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
            dy={10}
            minTickGap={30}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
            domain={['auto', 'auto']}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px'
            }}
            itemStyle={{ color: 'var(--text-primary)' }}
          />
          
          {target !== undefined && (
            <ReferenceLine y={target} stroke="var(--status-healthy)" strokeDasharray="3 3" />
          )}
          {upperLimit !== undefined && (
            <ReferenceLine y={upperLimit} stroke="var(--status-critical)" strokeDasharray="3 3" />
          )}
          {lowerLimit !== undefined && (
            <ReferenceLine y={lowerLimit} stroke="var(--status-critical)" strokeDasharray="3 3" />
          )}
          
          <Line 
            type="monotone" 
            dataKey={yKey} 
            stroke={color} 
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: color }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
