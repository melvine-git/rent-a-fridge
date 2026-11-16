'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { LayerGroup, Map as LeafletMap, Marker } from 'leaflet';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  kind: 'stop' | 'site' | 'yard';
  title: string;
  /** Stop number on the run */
  order?: number;
  state?: 'done' | 'next' | 'late' | 'todo';
  /** Site pins: number of units there and pin colour */
  count?: number;
  color?: string;
};

export type RouteLeg = { from: [number, number]; to: [number, number]; done: boolean };

type Leaflet = typeof import('leaflet');

const HOME_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>';
const CHECK_SVG =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function pinHtml(p: MapPoint, active: boolean) {
  const on = active ? ' is-active' : '';
  if (p.kind === 'yard') return `<div class="map-pin map-pin--yard${on}">${HOME_SVG}</div>`;
  if (p.kind === 'site') return `<div class="map-pin map-pin--site${on}" style="--pin:${p.color ?? '#0ea5e9'}">${p.count ?? ''}</div>`;
  const state = p.state ?? 'todo';
  const inner = state === 'done' ? CHECK_SVG : String(p.order ?? '');
  return `<div class="map-pin map-pin--stop${state === 'todo' ? '' : ` map-pin--${state}`}${on}">${inner}</div>`;
}

const SIZE = { yard: 28, site: 24, stop: 26, next: 30 };

/** Light street map with the yard, the day's numbered stops, the van route and units out on site. */
export function FleetMap({
  points,
  route,
  activeId,
  onSelect,
  fitKey,
  className,
  controlsClassName,
}: {
  points: MapPoint[];
  route: RouteLeg[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  /** Refit the view when this changes (e.g. switching day) */
  fitKey: string;
  className?: string;
  controlsClassName?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const ctx = useRef<{ L: Leaflet; map: LeafletMap; layer: LayerGroup } | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const latest = useRef({ points, route, activeId, onSelect, fitKey });
  const fitted = useRef<string | null>(null);

  useEffect(() => {
    latest.current = { points, route, activeId, onSelect, fitKey };
  });

  function draw() {
    const c = ctx.current;
    if (!c) return;
    const { L, layer } = c;
    const { points, route, activeId } = latest.current;
    layer.clearLayers();
    markers.current.clear();

    for (const leg of route) {
      L.polyline([leg.from, leg.to], leg.done ? { color: '#57534e', weight: 3, opacity: 0.7, dashArray: '2 7', lineCap: 'round' } : { color: '#E3000F', weight: 4, opacity: 0.85, lineCap: 'round' }).addTo(layer);
    }
    for (const p of points) {
      const size = p.kind === 'stop' ? (p.state === 'next' ? SIZE.next : SIZE.stop) : SIZE[p.kind];
      const icon = L.divIcon({ className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2], html: pinHtml(p, p.id === activeId) });
      const m = L.marker([p.lat, p.lng], {
        icon,
        title: p.title,
        keyboard: true,
        zIndexOffset: p.kind === 'stop' ? (p.state === 'next' ? 1000 : 500) : p.kind === 'yard' ? 200 : 0,
      })
        .bindTooltip(escapeHtml(p.title), { direction: 'top', offset: [0, -size / 2 - 2], className: 'map-tag', permanent: p.id === activeId })
        .on('click', () => latest.current.onSelect?.(p.id));
      m.addTo(layer);
      markers.current.set(p.id, m);
    }
  }

  function fit() {
    const c = ctx.current;
    if (!c) return;
    const { L, map } = c;
    const pts = latest.current.points;
    const wide = window.matchMedia('(min-width: 1024px)').matches;
    // Leave room for the floating panels on wide screens
    const opts = wide ? { paddingTopLeft: [370, 80] as [number, number], paddingBottomRight: [400, 70] as [number, number], maxZoom: 14 } : { padding: [36, 36] as [number, number], maxZoom: 14 };
    if (pts.length === 0) map.setView([54.597, -5.93], 12);
    else if (pts.length === 1) map.setView([pts[0].lat, pts[0].lng], 13);
    else map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng])), opts);
  }

  // Create the map once
  useEffect(() => {
    let cancelled = false;
    let created: LeafletMap | null = null;
    import('leaflet').then(({ default: L }) => {
      if (cancelled || !el.current) return;
      created = L.map(el.current, { zoomControl: false, scrollWheelZoom: false, attributionControl: true }).setView([54.597, -5.93], 12);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(created);
      created.attributionControl.setPrefix(false);
      ctx.current = { L, map: created, layer: L.layerGroup().addTo(created) };
      draw();
      fit();
      fitted.current = latest.current.fitKey;
    });
    return () => {
      cancelled = true;
      created?.remove();
      ctx.current = null;
    };
  }, []);

  useEffect(() => {
    draw();
    if (ctx.current && fitted.current !== fitKey) {
      fit();
      fitted.current = fitKey;
    }
  }, [points, route, activeId, fitKey]);

  // Bring the selected pin into view
  useEffect(() => {
    const c = ctx.current;
    const m = activeId ? markers.current.get(activeId) : undefined;
    if (c && m && !c.map.getBounds().pad(-0.15).contains(m.getLatLng())) c.map.panTo(m.getLatLng(), { animate: true });
  }, [activeId]);

  const zoom = (d: number) => ctx.current?.map.setZoom(ctx.current.map.getZoom() + d);
  const btn = 'flex size-9 items-center justify-center text-foreground transition-colors hover:bg-muted';

  return (
    <div className={cn('relative', className)}>
      <div ref={el} className="absolute inset-0 z-0" role="region" aria-label="Map of units on site and the day's run" />
      <div className={cn('absolute z-[400] flex flex-col divide-y overflow-hidden rounded-lg border bg-white shadow-[var(--shadow-md)]', controlsClassName)}>
        <button type="button" className={btn} onClick={() => zoom(1)} aria-label="Zoom in">
          <Plus className="size-4" />
        </button>
        <button type="button" className={btn} onClick={() => zoom(-1)} aria-label="Zoom out">
          <Minus className="size-4" />
        </button>
      </div>
    </div>
  );
}
