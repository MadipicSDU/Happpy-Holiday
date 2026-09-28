import React from 'react';
import { DollarSign, CalendarCheck, TrendingUp, Users } from 'lucide-react';

export default function Analytics() {
  const stats = [
    { label: 'Total Revenue', value: '$48,250', change: '+14.2% vs last month', icon: DollarSign, color: '#2563eb' },
    { label: 'Confirmed Bookings', value: '28 Events', change: '+8 events this quarter', icon: CalendarCheck, color: '#16a34a' },
    { label: 'Space Occupancy', value: '84.6%', change: 'Peak weekend utilization', icon: TrendingUp, color: '#ea580c' },
    { label: 'Active Clients', value: '142 Hosts', change: '+18 new hosts registered', icon: Users, color: '#9333ea' }
  ];

  const venuePerformance = [
    { name: 'Grand Ballroom Atrium', bookings: 12, revenue: '$28,800', occupancy: '92%' },
    { name: 'The Crystal Greenhouse', bookings: 8, revenue: '$14,400', occupancy: '78%' },
    { name: 'The Warehouse Atrium', bookings: 6, revenue: '$9,000', occupancy: '65%' },
    { name: 'Horizon Skyline Terrace', bookings: 5, revenue: '$11,000', occupancy: '80%' }
  ];

  return (
    <div className="analytics-page">
      <div className="page-header">
        <h1 className="page-title">Performance Analytics</h1>
        <p className="page-subtitle">Real-time metrics, financial returns, and venue utilization across the platform.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {stats.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div key={idx} style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '20px 24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>{s.label}</span>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: s.color
                }}>
                  <Icon size={18} />
                </div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: '500' }}>{s.change}</div>
            </div>
          );
        })}
      </div>

      <div className="table-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '18px' }}>
          Revenue Contribution by Venue
        </h3>
        <table className="custom-table">
          <thead>
            <tr>
              <th>Venue Space</th>
              <th>Total Bookings</th>
              <th>Gross Revenue</th>
              <th>Occupancy Rate</th>
            </tr>
          </thead>
          <tbody>
            {venuePerformance.map((v, i) => (
              <tr key={i}>
                <td style={{ fontWeight: '600', color: '#0f172a' }}>{v.name}</td>
                <td>{v.bookings}</td>
                <td style={{ fontWeight: '600', color: '#2563eb' }}>{v.revenue}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '80px', height: '6px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                      <div style={{ width: v.occupancy, height: '100%', background: '#2563eb' }} />
                    </div>
                    <span>{v.occupancy}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
