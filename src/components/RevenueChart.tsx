import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Appointment } from '@/types/saas';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RevenueChartProps {
  appointments: Appointment[];
}

export const RevenueChart: React.FC<RevenueChartProps> = ({ appointments }) => {
  // Generate data for the last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    const dateStr = format(d, 'yyyy-MM-dd');
    const dayLabel = format(d, 'dd/MM (EEE)', { locale: ptBR });
    
    const dayAppts = appointments.filter(
      (a) => a.date === dateStr && a.status !== 'cancelled'
    );
    
    const revenue = dayAppts.reduce((sum, a) => sum + (a.price || 0), 0);
    const count = dayAppts.length;

    return {
      day: dayLabel,
      faturamento: revenue,
      agendamentos: count,
    };
  });

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Faturamento dos Últimos 7 Dias</CardTitle>
        <CardDescription className="text-xs">
          Receita gerada a partir dos agendamentos confirmados e concluídos.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={last7Days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
              <XAxis 
                dataKey="day" 
                tick={{ fontSize: 11 }} 
                tickLine={false} 
                axisLine={false} 
              />
              <YAxis 
                tick={{ fontSize: 11 }} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(val) => `R$${val}`}
              />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'faturamento' ? `R$ ${Number(value).toFixed(2)}` : value,
                  name === 'faturamento' ? 'Faturamento' : 'Agendamentos'
                ]}
                contentStyle={{ 
                  borderRadius: '8px', 
                  fontSize: '12px',
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))'
                }}
              />
              <Bar 
                dataKey="faturamento" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]} 
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
export default RevenueChart;
