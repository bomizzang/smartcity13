import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { VWORLD_API_KEY, MAIN_USE_COLORS, YONGDO_COLORS, JIMOK_COLORS } from './constants';

function getColor(value, colorMap) {
  return colorMap[value] || colorMap['미등록'] || '#374151';
}
function calcStats(features, field, faField, colorMap) {
  const map = {};
  for (const f of features) {
    const key = f.properties[field] || '미등록';
    const fa = parseFloat(f.properties[faField]) || 0;
    if (!map[key]) map[key] = { count: 0, floorArea: 0 };
    map[key].count++;
    map[key].floorArea += fa;
  }
  const total = features.length;
  const totalFloor = Object.values(map).reduce((s, v) => s + v.floorArea, 0);
  return Object.entries(map)
    .sort((a, b) => b[1].floorArea - a[1].floorArea)
    .map(([name, val]) => ({
      name,
      count: val.count,
      floorArea: val.floorArea,
      pct: totalFloor > 0 ? ((val.floorArea / totalFloor) * 100).toFixed(1) : ((val.count / total) * 100).toFixed(1),
      color: getColor(name, colorMap),
    }));
}

// ─── choropleth 색상 (연속값) ────────────────────────────
function getChoroplethColor(value, min, max, palette) {
  if (!value || value === 0) return '#1e293b';
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  if (palette === 'blue') {
    const r = Math.round(15 + t * (59 - 15));
    const g = Math.round(23 + t * (130 - 23));
    const b = Math.round(42 + t * (246 - 42));
    return `rgb(${r},${g},${b})`;
  }
  if (palette === 'orange') {
    const r = Math.round(15 + t * (249 - 15));
    const g = Math.round(23 + t * (115 - 23));
    const b = Math.round(42 + t * (22 - 42));
    return `rgb(${r},${g},${b})`;
  }
  if (palette === 'green') {
    const r = Math.round(15 + t * (34 - 15));
    const g = Math.round(23 + t * (197 - 23));
    const b = Math.round(42 + t * (94 - 42));
    return `rgb(${r},${g},${b})`;
  }
  // purple
  const r = Math.round(15 + t * (168 - 15));
  const g = Math.round(23 + t * (85 - 23));
  const b = Math.round(42 + t * (247 - 42));
  return `rgb(${r},${g},${b})`;
}

// ─── 좌측 패널 ──────────────────────────────────────────
function LeftPanel({ layers, setLayers, opacity, setOpacity, colorMode, setColorMode, stats, parcelsLoaded, jipgeguMode, jipgeguMetric, setJipgeguMetric }) {
  const colorMap = colorMode === 'main_use' ? MAIN_USE_COLORS : colorMode === 'yongdo' ? YONGDO_COLORS : JIMOK_COLORS;
  const topStats = stats.slice(0, 15);

  const metricLabels = { 총인구: '총인구', 인구밀도: '인구밀도', 평균나이: '평균나이', 노령화지수: '노령화지수', 총가구: '총가구수' };

  return (
    <div style={{
      position: 'absolute', top: 12, left: 12, zIndex: 1000,
      width: 220, background: '#0f172a', color: '#e2e8f0',
      borderRadius: 10, padding: '14px 16px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
      fontFamily: "'Noto Sans KR', sans-serif",
      fontSize: 12, maxHeight: 'calc(100vh - 24px)', overflowY: 'auto',
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', marginBottom: 2 }}>송파구 데이터 뷰어</div>
      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 12 }}>
        행정동 13 · 집계구 1,278 · 필지 {parcelsLoaded ? '31,153' : '로딩중...'}
      </div>

      {/* 체크박스 레이어 토글 */}
      {[
        { key: 'haengjeong', label: '행정동 경계' },
        { key: 'jipgegu', label: '집계구 통계' },
        { key: 'parcels', label: '필지 · 18MB' },
      ].map(({ key, label }) => (
        <div key={key} style={{ marginBottom: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={layers[key]}
              onChange={e => setLayers(l => ({ ...l, [key]: e.target.checked }))}
              style={{ accentColor: '#3b82f6' }} />
            <span style={{ color: '#cbd5e1' }}>{label}</span>
          </label>
          {key === 'haengjeong' && layers.haengjeong && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', paddingLeft: 20, marginTop: 4 }}>
              <input type="checkbox" checked={layers.haengjeongLabel}
                onChange={e => setLayers(l => ({ ...l, haengjeongLabel: e.target.checked }))}
                style={{ accentColor: '#3b82f6' }} />
              <span style={{ color: '#94a3b8', fontSize: 11 }}>이름 라벨</span>
            </label>
          )}
          {key === 'jipgegu' && layers.jipgegu && (
            <div style={{ paddingLeft: 20, marginTop: 4 }}>
              <select value={jipgeguMetric} onChange={e => setJipgeguMetric(e.target.value)}
                style={{ width: '100%', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 4, padding: '3px 6px', fontSize: 10 }}>
                {Object.entries(metricLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          )}
        </div>
      ))}

      {/* 필지 드롭다운 */}
      {layers.parcels && (
        <div style={{ marginTop: 10, marginBottom: 6 }}>
          <select value={colorMode} onChange={e => setColorMode(e.target.value)}
            style={{
              width: '100%', background: '#1e293b', color: '#e2e8f0',
              border: '1px solid #334155', borderRadius: 6, padding: '5px 8px', fontSize: 12, cursor: 'pointer',
            }}>
            <option value="main_use">건축물 주용도</option>
            <option value="yongdo">용도지역</option>
            <option value="jimok">지목</option>
          </select>
        </div>
      )}

      {/* 투명도 */}
      {layers.parcels && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 10, marginBottom: 3 }}>
            <span>투명도</span><span>{opacity}%</span>
          </div>
          <input type="range" min={0} max={100} value={opacity}
            onChange={e => setOpacity(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#3b82f6' }} />
        </div>
      )}

      {/* 집계구 choropleth 범례 */}
      {jipgeguMode && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ color: '#64748b', fontSize: 10, marginBottom: 4 }}>집계구 통계 범례</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: '#64748b', fontSize: 9 }}>낮음</span>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'linear-gradient(to right, #0f172a, #3b82f6)' }} />
            <span style={{ color: '#64748b', fontSize: 9 }}>높음</span>
          </div>
        </div>
      )}

      {/* 필지 범례 */}
      {stats.length > 0 && !jipgeguMode && (
        <div>
          <div style={{ color: '#64748b', fontSize: 10, marginBottom: 6 }}>
            범례 · {stats.reduce((s, v) => s + v.count, 0).toLocaleString()} 필지
          </div>
          {topStats.map(s => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ flex: 1, color: '#cbd5e1', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
              <span style={{ color: '#64748b', fontSize: 10 }}>{s.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 집계구 통계 탭 ──────────────────────────────────────
function JipgeguTab({ jipgeguStats }) {
  const [selectedDong, setSelectedDong] = useState('전체');
  const [metric, setMetric] = useState('총인구');

  if (!jipgeguStats) return <div style={{ color: '#64748b', fontSize: 12 }}>로딩 중...</div>;

  const { pyramid, dong_stats, dong_pyramid } = jipgeguStats;
  const dongs = ['전체', ...Object.keys(dong_stats).sort()];

  const currentPyramid = selectedDong === '전체' ? pyramid : (dong_pyramid[selectedDong] || pyramid);
  const currentStats = selectedDong === '전체' ? null : dong_stats[selectedDong];

  // 행정동별 지표 바 차트
  const metricData = Object.entries(dong_stats)
    .map(([dong, s]) => ({ dong: dong.replace('동',''), value: s[metric] }))
    .sort((a, b) => b.value - a.value);

  const metricColors = { 총인구: '#3b82f6', 인구밀도: '#f97316', 평균나이: '#a855f7', 노령화지수: '#ef4444', 총가구: '#22c55e' };

  return (
    <div>
      {/* 행정동 선택 */}
      <div style={{ marginBottom: 10 }}>
        <select value={selectedDong} onChange={e => setSelectedDong(e.target.value)}
          style={{ width: '100%', background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, padding: '5px 8px', fontSize: 11 }}>
          {dongs.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* 선택 행정동 요약 */}
      {currentStats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
          {[
            ['총인구', currentStats.총인구?.toLocaleString() + '명'],
            ['총가구', currentStats.총가구?.toLocaleString() + '가구'],
            ['평균나이', currentStats.평균나이 + '세'],
            ['노령화지수', currentStats.노령화지수],
            ['인구밀도', (currentStats.인구밀도 / 1000).toFixed(1) + 'K/㎢'],
            ['집계구수', currentStats.집계구수 + '개'],
          ].map(([k, v]) => (
            <div key={k} style={{ background: '#1e293b', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc' }}>{v}</div>
              <div style={{ fontSize: 9, color: '#64748b' }}>{k}</div>
            </div>
          ))}
        </div>
      )}

      {/* 인구 피라미드 */}
      <div style={{ color: '#94a3b8', fontSize: 10, marginBottom: 4 }}>
        연령별 인구 — {selectedDong}
      </div>
      <div style={{ height: 200, marginBottom: 14 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={currentPyramid} layout="vertical" margin={{ left: -10, right: 4, top: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis type="number" tick={{ fill: '#64748b', fontSize: 8 }} />
            <YAxis dataKey="age" type="category" tick={{ fill: '#94a3b8', fontSize: 8 }} width={30} />
            <Tooltip
              formatter={(v, n) => [v.toLocaleString() + '명', n === 'male' ? '남성' : '여성']}
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 10 }} />
            <Bar dataKey="male" name="male" fill="#3b82f6" radius={[0,2,2,0]} />
            <Bar dataKey="female" name="female" fill="#ec4899" radius={[0,2,2,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 행정동별 지표 비교 */}
      <div style={{ color: '#94a3b8', fontSize: 10, marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>행정동 비교</span>
        <select value={metric} onChange={e => setMetric(e.target.value)}
          style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 4, padding: '2px 4px', fontSize: 9 }}>
          {['총인구','총가구','평균나이','노령화지수','인구밀도'].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div style={{ height: 160, marginBottom: 8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={metricData} margin={{ left: -20, right: 4, top: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="dong" tick={{ fill: '#94a3b8', fontSize: 7 }} angle={-45} textAnchor="end" />
            <YAxis tick={{ fill: '#64748b', fontSize: 8 }} />
            <Tooltip
              formatter={(v) => [v.toLocaleString(), metric]}
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 10 }} />
            <Bar dataKey="value" fill={metricColors[metric] || '#3b82f6'} radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 전체 테이블 */}
      <div style={{ color: '#64748b', fontSize: 10, marginBottom: 4 }}>행정동별 통계 요약</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
        <thead>
          <tr style={{ color: '#64748b', borderBottom: '1px solid #1e293b' }}>
            <th style={{ textAlign: 'left', padding: '2px 3px' }}>행정동</th>
            <th style={{ textAlign: 'right', padding: '2px 3px' }}>인구</th>
            <th style={{ textAlign: 'right', padding: '2px 3px' }}>가구</th>
            <th style={{ textAlign: 'right', padding: '2px 3px' }}>평균나이</th>
            <th style={{ textAlign: 'right', padding: '2px 3px' }}>노령화</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(dong_stats).sort((a,b)=>b[1].총인구-a[1].총인구).map(([dong, s]) => (
            <tr key={dong}
              style={{ borderBottom: '1px solid #1e293b22', cursor: 'pointer', background: selectedDong === dong ? '#1e293b' : 'transparent' }}
              onClick={() => setSelectedDong(dong)}
              onMouseEnter={e => e.currentTarget.style.background = '#1e293b'}
              onMouseLeave={e => e.currentTarget.style.background = selectedDong === dong ? '#1e293b' : 'transparent'}>
              <td style={{ padding: '3px', color: '#cbd5e1' }}>{dong}</td>
              <td style={{ padding: '3px', textAlign: 'right', color: '#94a3b8' }}>{s.총인구?.toLocaleString()}</td>
              <td style={{ padding: '3px', textAlign: 'right', color: '#94a3b8' }}>{s.총가구?.toLocaleString()}</td>
              <td style={{ padding: '3px', textAlign: 'right', color: '#94a3b8' }}>{s.평균나이}세</td>
              <td style={{ padding: '3px', textAlign: 'right', color: '#94a3b8' }}>{s.노령화지수}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 우측 통계 패널 ─────────────────────────────────────
function RightPanel({ parcelsData, jipgeguStats, onClose }) {
  const [activeTab, setActiveTab] = useState('main_use');

  const tabConfig = {
    main_use: { label: '건축물 주용도', field: 'main_use', faField: 'floor_area', colorMap: MAIN_USE_COLORS },
    yongdo:   { label: '용도지역',      field: 'yongdo',   faField: 'floor_area', colorMap: YONGDO_COLORS },
    jimok:    { label: '지목',          field: 'jimok',    faField: 'area',       colorMap: JIMOK_COLORS },
    jipgegu:  { label: '집계구 통계' },
  };

  const cfg = tabConfig[activeTab];
  const stats = (parcelsData && activeTab !== 'jipgegu')
    ? calcStats(parcelsData.features, cfg.field, cfg.faField, cfg.colorMap) : [];
  const totalParcels = parcelsData ? parcelsData.features.length : 0;
  const totalFloor = stats.reduce((s, v) => s + v.floorArea, 0);
  const top = stats[0];

  return (
    <div style={{
      position: 'absolute', top: 12, right: 12, zIndex: 1000,
      width: 300, background: '#0f172a', color: '#e2e8f0',
      borderRadius: 10, padding: '14px 16px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
      fontFamily: "'Noto Sans KR', sans-serif",
      fontSize: 12, maxHeight: 'calc(100vh - 24px)', overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>송파구 통계</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16 }}>×</button>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
        {Object.entries(tabConfig).map(([key, val]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            style={{
              padding: '4px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer', border: 'none',
              background: activeTab === key ? '#3b82f6' : '#1e293b',
              color: activeTab === key ? '#fff' : '#94a3b8',
            }}>{val.label}</button>
        ))}
      </div>

      {/* 집계구 탭 */}
      {activeTab === 'jipgegu' && <JipgeguTab jipgeguStats={jipgeguStats} />}

      {/* 나머지 탭 */}
      {activeTab !== 'jipgegu' && (
        <>
          {/* 파이차트 */}
          {stats.length > 0 && (
            <div style={{ position: 'relative', height: 160, marginBottom: 12 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.slice(0, 12)} dataKey="count" cx="50%" cy="50%"
                    innerRadius={45} outerRadius={70} paddingAngle={1}>
                    {stats.slice(0, 12).map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v.toLocaleString() + '개', n]}
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              {top && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc', lineHeight: 1.2 }}>{top.name}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{top.pct}%</div>
                </div>
              )}
            </div>
          )}

          {/* 요약 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1, background: '#1e293b', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>{totalParcels.toLocaleString()}</div>
              <div style={{ fontSize: 9, color: '#64748b' }}>총 필지 수</div>
            </div>
            <div style={{ flex: 1, background: '#1e293b', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>{(totalFloor / 1000000).toFixed(2)}M㎡</div>
              <div style={{ fontSize: 9, color: '#64748b' }}>총 연면적</div>
            </div>
          </div>

          {/* 테이블 */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr style={{ color: '#64748b', borderBottom: '1px solid #1e293b' }}>
                <th style={{ textAlign: 'left', padding: '3px 4px', width: 20 }}></th>
                <th style={{ textAlign: 'left', padding: '3px 4px' }}>구분</th>
                <th style={{ textAlign: 'right', padding: '3px 4px' }}>필지</th>
                <th style={{ textAlign: 'right', padding: '3px 4px' }}>연면적</th>
                <th style={{ textAlign: 'right', padding: '3px 4px' }}>비율</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s, i) => (
                <tr key={i}
                  onMouseEnter={e => e.currentTarget.style.background = '#1e293b'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '3px 4px' }}><div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} /></td>
                  <td style={{ padding: '3px 4px', color: '#cbd5e1', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', color: '#94a3b8' }}>{s.count.toLocaleString()}</td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', color: '#94a3b8' }}>{s.floorArea > 0 ? (s.floorArea / 1000).toFixed(0) + 'K' : '-'}</td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', color: '#94a3b8' }}>{s.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ─── 메인 앱 ────────────────────────────────────────────
export default function App() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layerRefs = useRef({});
  const labelLayerRef = useRef(null);
  const jipgeguLayerRef = useRef(null);

  const [parcelsData, setParcelsData] = useState(null);
  const [haengjeongData, setHaengjeongData] = useState(null);
  const [jipgeguStats, setJipgeguStats] = useState(null);
  const [parcelsLoaded, setParcelsLoaded] = useState(false);
  const [showRight, setShowRight] = useState(true);
  const [layers, setLayers] = useState({ haengjeong: true, haengjeongLabel: true, jipgegu: false, parcels: true });
  const [opacity, setOpacity] = useState(80);
  const [colorMode, setColorMode] = useState('main_use');
  const [jipgeguMetric, setJipgeguMetric] = useState('총인구');
  const [stats, setStats] = useState([]);

  const colorMap = colorMode === 'main_use' ? MAIN_USE_COLORS : colorMode === 'yongdo' ? YONGDO_COLORS : JIMOK_COLORS;
  const fieldName = colorMode === 'main_use' ? 'main_use' : colorMode === 'yongdo' ? 'yongdo' : 'jimok';
  const jipgeguMode = layers.jipgegu && !layers.parcels;

  // 지도 초기화
  useEffect(() => {
    if (mapInstance.current) return;
    const map = L.map(mapRef.current, { center: [37.514575, 127.105399], zoom: 14, zoomControl: true });
    L.tileLayer(
      `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_API_KEY}/Base/{z}/{y}/{x}.png`,
      { attribution: '© 브이월드', maxZoom: 19 }
    ).addTo(map);
    mapInstance.current = map;
  }, []);

  // 데이터 로드
  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    fetch(`${base}parcels.geojson`).then(r => r.json()).then(data => { setParcelsData(data); setParcelsLoaded(true); });
    fetch(`${base}haengjeong.geojson`).then(r => r.json()).then(setHaengjeongData);
    fetch(`${base}jipgegu_stats.json`).then(r => r.json()).then(setJipgeguStats);
  }, []);

  // 통계 계산
  useEffect(() => {
    if (!parcelsData) return;
    const faField = colorMode === 'jimok' ? 'area' : 'floor_area';
    setStats(calcStats(parcelsData.features, fieldName, faField, colorMap));
  }, [parcelsData, colorMode]);

  // 팝업
  const makePopup = (props) => `
    <div style="font-family:'Noto Sans KR',sans-serif;font-size:12px;color:#e2e8f0;background:#0f172a;padding:10px 12px;border-radius:8px;min-width:190px;">
      <div style="font-weight:700;color:#f8fafc;margin-bottom:6px;font-size:13px">필지 ${props.jibun || ''}</div>
      <div style="color:#94a3b8;margin-bottom:2px">용도지역: <span style="color:#cbd5e1">${props.yongdo || '-'}</span></div>
      <div style="color:#94a3b8;margin-bottom:2px">주용도: <span style="color:#cbd5e1">${props.main_use || '미등록'}</span></div>
      <div style="color:#94a3b8;margin-bottom:2px">지목: <span style="color:#cbd5e1">${props.jimok || '-'}</span> · 대지 ${props.area ? Number(props.area).toLocaleString() : '-'}㎡</div>
      ${props.floor_area ? `<div style="color:#94a3b8">연면적: <span style="color:#cbd5e1">${Number(props.floor_area).toLocaleString()}㎡</span></div>` : ''}
    </div>`;

  // 필지 레이어
  useEffect(() => {
    if (!mapInstance.current || !parcelsData) return;
    const map = mapInstance.current;
    if (layerRefs.current.parcels) { map.removeLayer(layerRefs.current.parcels); layerRefs.current.parcels = null; }
    if (!layers.parcels) return;

    const geoLayer = L.geoJSON(parcelsData, {
      style: (feature) => {
        const val = feature.properties[fieldName] || '미등록';
        return { fillColor: colorMap[val] || '#374151', fillOpacity: opacity / 100, color: '#00000033', weight: 0.3 };
      },
      onEachFeature: (feature, layer) => {
        layer.on('click', () => {
          layer.bindPopup(makePopup(feature.properties), { maxWidth: 260 }).openPopup();
        });
      },
    }).addTo(map);
    layerRefs.current.parcels = geoLayer;
  }, [parcelsData, layers.parcels, opacity, colorMode]);

  // 집계구 choropleth 레이어
  useEffect(() => {
    if (!mapInstance.current || !haengjeongData || !jipgeguStats) return;
    const map = mapInstance.current;
    if (jipgeguLayerRef.current) { map.removeLayer(jipgeguLayerRef.current); jipgeguLayerRef.current = null; }
    if (!layers.jipgegu) return;

    const { dong_stats } = jipgeguStats;
    const values = Object.values(dong_stats).map(s => s[jipgeguMetric]).filter(v => v > 0);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const palette = jipgeguMetric === '총인구' ? 'blue' : jipgeguMetric === '인구밀도' ? 'orange' : jipgeguMetric === '평균나이' ? 'purple' : jipgeguMetric === '노령화지수' ? 'purple' : 'green';

    const choropleth = L.geoJSON(haengjeongData, {
      style: (feature) => {
        const dongName = feature.properties.EMD_NM;
        const stat = dong_stats[dongName];
        const val = stat ? stat[jipgeguMetric] : 0;
        return {
          fillColor: getChoroplethColor(val, minVal, maxVal, palette),
          fillOpacity: 0.75,
          color: '#60a5fa',
          weight: 1.5,
        };
      },
      onEachFeature: (feature, layer) => {
        const dongName = feature.properties.EMD_NM;
        const stat = jipgeguStats.dong_stats[dongName];
        if (stat) {
          const metricLabel = { 총인구: '명', 인구밀도: '/㎢', 평균나이: '세', 노령화지수: '', 총가구: '가구' };
          layer.bindPopup(`
            <div style="font-family:'Noto Sans KR',sans-serif;font-size:12px;color:#e2e8f0;background:#0f172a;padding:10px 12px;border-radius:8px;min-width:160px;">
              <div style="font-weight:700;color:#f8fafc;margin-bottom:6px">${dongName}</div>
              <div style="color:#94a3b8;margin-bottom:2px">총인구: <span style="color:#60a5fa;font-weight:600">${stat.총인구?.toLocaleString()}명</span></div>
              <div style="color:#94a3b8;margin-bottom:2px">총가구: <span style="color:#cbd5e1">${stat.총가구?.toLocaleString()}가구</span></div>
              <div style="color:#94a3b8;margin-bottom:2px">평균나이: <span style="color:#cbd5e1">${stat.평균나이}세</span></div>
              <div style="color:#94a3b8;margin-bottom:2px">노령화지수: <span style="color:#cbd5e1">${stat.노령화지수}</span></div>
              <div style="color:#94a3b8">집계구수: <span style="color:#cbd5e1">${stat.집계구수}개</span></div>
            </div>`, { maxWidth: 220 });
        }
        layer.on('mouseover', () => layer.setStyle({ weight: 3, color: '#93c5fd' }));
        layer.on('mouseout', () => choropleth.resetStyle(layer));
      },
    }).addTo(map);
    jipgeguLayerRef.current = choropleth;
  }, [haengjeongData, jipgeguStats, layers.jipgegu, jipgeguMetric]);

  // 행정동 경계 레이어
  useEffect(() => {
    if (!mapInstance.current || !haengjeongData) return;
    const map = mapInstance.current;
    if (layerRefs.current.haengjeong) { map.removeLayer(layerRefs.current.haengjeong); layerRefs.current.haengjeong = null; }
    if (labelLayerRef.current) { map.removeLayer(labelLayerRef.current); labelLayerRef.current = null; }
    if (!layers.haengjeong) return;

    const geoLayer = L.geoJSON(haengjeongData, {
      style: { color: '#60a5fa', weight: 2, fillOpacity: 0, dashArray: '6 3' },
    }).addTo(map);
    layerRefs.current.haengjeong = geoLayer;

    if (layers.haengjeongLabel) {
      const labelGroup = L.layerGroup();
      haengjeongData.features.forEach(f => {
        const name = f.properties.EMD_NM;
        const center = L.geoJSON(f).getBounds().getCenter();
        const icon = L.divIcon({
          html: `<div style="color:#93c5fd;font-size:12px;font-weight:700;font-family:'Noto Sans KR',sans-serif;text-shadow:0 0 4px #000,0 0 4px #000;white-space:nowrap">${name}</div>`,
          className: '', iconAnchor: [30, 10],
        });
        L.marker(center, { icon }).addTo(labelGroup);
      });
      labelGroup.addTo(map);
      labelLayerRef.current = labelGroup;
    }
  }, [haengjeongData, layers.haengjeong, layers.haengjeongLabel]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <style>{`
        .leaflet-popup-content-wrapper { background: transparent !important; border: none !important; box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important; padding: 0 !important; }
        .leaflet-popup-content { margin: 0 !important; }
        .leaflet-popup-tip { background: #0f172a !important; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
      `}</style>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      <LeftPanel
        layers={layers} setLayers={setLayers}
        opacity={opacity} setOpacity={setOpacity}
        colorMode={colorMode} setColorMode={setColorMode}
        stats={stats} parcelsLoaded={parcelsLoaded}
        jipgeguMode={jipgeguMode} jipgeguMetric={jipgeguMetric} setJipgeguMetric={setJipgeguMetric}
      />
      {showRight
        ? <RightPanel parcelsData={parcelsData} jipgeguStats={jipgeguStats} onClose={() => setShowRight(false)} />
        : <button onClick={() => setShowRight(true)}
            style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000, background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>
            통계 패널 열기
          </button>
      }
    </div>
  );
}
