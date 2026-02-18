import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ChartProps {
    data: any[];
    type?: 'line' | 'area' | 'bar';
    dataKey: string;
    xAxisKey: string;
    title?: string;
    color?: string;
}

export default function Chart({ data, type = 'line', dataKey, xAxisKey, title, color = '#0ea5e9' }: ChartProps) {
    return (
        <div className="w-full">
            {title && (
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
            )}
            <ResponsiveContainer width="100%" height={300}>
                <>
                    {type === 'line' && (
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey={xAxisKey} stroke="#6b7280" />
                            <YAxis stroke="#6b7280" />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#fff',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px'
                                }}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey={dataKey}
                                stroke={color}
                                strokeWidth={2}
                                dot={{ fill: color, r: 4 }}
                                activeDot={{ r: 6 }}
                            />
                        </LineChart>
                    )}

                    {type === 'area' && (
                        <AreaChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey={xAxisKey} stroke="#6b7280" />
                            <YAxis stroke="#6b7280" />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#fff',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px'
                                }}
                            />
                            <Legend />
                            <Area
                                type="monotone"
                                dataKey={dataKey}
                                stroke={color}
                                fill={color}
                                fillOpacity={0.2}
                            />
                        </AreaChart>
                    )}

                    {type === 'bar' && (
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey={xAxisKey} stroke="#6b7280" />
                            <YAxis stroke="#6b7280" />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#fff',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px'
                                }}
                            />
                            <Legend />
                            <Bar dataKey={dataKey} fill={color} radius={[8, 8, 0, 0]} />
                        </BarChart>
                    )}
                </>
            </ResponsiveContainer>
        </div>
    );
}
