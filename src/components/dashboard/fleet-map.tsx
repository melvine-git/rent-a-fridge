'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import type { GeoJSONSource, Map as MlMap, Marker } from 'maplibre-gl';
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

type Maplibre = typeof import('maplibre-gl');

// Free vector tiles (no key, commercial use allowed); labels and icons are hidden below
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
// Quiet, near-monochrome palette: white roads on soft grey, faint greens and blues
const PAINT: Record<string, [string, string | number][]> = {
  background: [['background-color', '#f4f4f2']],
  water: [['fill-color', '#dfe6ea']],
  park: [['fill-color', '#e7ede5'], ['fill-opacity', 0.9]],
  landcover_wood: [['fill-color', '#e5ebe2'], ['fill-opacity', 0.8]],
  landuse_residential: [['fill-color', '#f0f0ee'], ['fill-opacity', 0.6]],
  building: [['fill-color', '#ececea']],
};

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

/** Muted street map with the yard, the day's numbered stops, the van route and units out on site. */
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
  const ctx = useRef<{ ml: Maplibre; map: MlMap; ready: boolean } | null>(null);
  const markers = useRef<Marker[]>([]);
  const latest = useRef({ points, route, activeId, onSelect, fitKey });
  const fitted = useRef<string | null>(null);

  useEffect(() => {
    latest.current = { points, route, activeId, onSelect, fitKey };
  });

  function draw() {
    const c = ctx.current;
    if (!c?.ready) return;
    const { ml, map } = c;
    const { points, route, activeId } = latest.current;

    (map.getSource('route') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: route.map((leg) => ({
        type: 'Feature',
        properties: { done: leg.done },
        geometry: { type: 'LineString', coordinates: [[leg.from[1], leg.from[0]], [leg.to[1], leg.to[0]]] },
      })),
    });

    for (const m of markers.current) m.remove();
    markers.current = points.map((p) => {
      const active = p.id === activeId;
      const node = document.createElement('div');
      node.className = 'map-marker';
      node.title = p.title;
      node.innerHTML = `${active ? `<div class="map-tag">${escapeHtml(p.title)}</div>` : ''}${pinHtml(p, active)}`;
      node.style.zIndex = String(active ? 3000 : p.kind === 'stop' ? (p.state === 'next' ? 2000 : 1000) : p.kind === 'yard' ? 500 : 100);
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        latest.current.onSelect?.(p.id);
      });
      return new ml.Marker({ element: node, anchor: 'center' }).setLngLat([p.lng, p.lat]).addTo(map);
    });
  }

  function fit() {
    const c = ctx.current;
    if (!c?.ready) return;
    const { ml, map } = c;
    const pts = latest.current.points;
    const wide = window.matchMedia('(min-width: 1024px)').matches;
    // Leave room for the floating panels on wide screens
    const padding = wide ? { top: 90, bottom: 80, left: 410, right: 440 } : 40;
    if (pts.length === 0) map.jumpTo({ center: [-5.93, 54.597], zoom: 11.5 });
    else if (pts.length === 1) map.jumpTo({ center: [pts[0].lng, pts[0].lat], zoom: 12.5 });
    else {
      const b = new ml.LngLatBounds();
      for (const p of pts) b.extend([p.lng, p.lat]);
      map.fitBounds(b, { padding, maxZoom: 13.5, duration: 0 });
    }
  }

  // Create the map once
  useEffect(() => {
    let cancelled = false;
    let created: MlMap | null = null;
    let resizer: ResizeObserver | null = null;
    import('maplibre-gl').then((ml) => {
      if (cancelled || !el.current) return;
      created = new ml.Map({
        container: el.current,
        style: STYLE_URL,
        center: [-5.93, 54.597],
        zoom: 11.5,
        attributionControl: { compact: true },
        scrollZoom: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
      created.touchZoomRotate.disableRotation();
      const map = created;
      // Keep the canvas matched to its box, and keep the stops framed until the user moves the map
      let moved = false;
      map.on('dragstart', () => (moved = true));
      map.on('zoomstart', (e) => e.originalEvent && (moved = true));
      resizer = new ResizeObserver(() => {
        map.resize();
        if (!moved) fit();
      });
      resizer.observe(el.current);
      ctx.current = { ml, map, ready: false };
      map.on('load', () => {
        if (cancelled) return;
        for (const layer of map.getStyle().layers ?? []) {
          if (layer.type === 'symbol') map.setLayoutProperty(layer.id, 'visibility', 'none');
          for (const [prop, value] of PAINT[layer.id] ?? []) map.setPaintProperty(layer.id, prop, value);
        }
        map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
          id: 'route-done',
          type: 'line',
          source: 'route',
          filter: ['==', ['get', 'done'], true],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#57534e', 'line-width': 2.5, 'line-opacity': 0.7, 'line-dasharray': [0.6, 2.4] },
        });
        map.addLayer({
          id: 'route-todo',
          type: 'line',
          source: 'route',
          filter: ['==', ['get', 'done'], false],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#E3000F', 'line-width': 2.5, 'line-opacity': 0.75 },
        });
        ctx.current = { ml, map, ready: true };
        draw();
        fit();
        fitted.current = latest.current.fitKey;
      });
    });
    return () => {
      cancelled = true;
      resizer?.disconnect();
      for (const m of markers.current) m.remove();
      markers.current = [];
      created?.remove();
      ctx.current = null;
    };
  }, []);

  useEffect(() => {
    draw();
    if (ctx.current?.ready && fitted.current !== fitKey) {
      fit();
      fitted.current = fitKey;
    }
  }, [points, route, activeId, fitKey]);

  // Bring the selected pin into view
  useEffect(() => {
    const c = ctx.current;
    const p = activeId ? latest.current.points.find((x) => x.id === activeId) : undefined;
    if (!c?.ready || !p) return;
    const pt = c.map.project([p.lng, p.lat]);
    const { clientWidth: w, clientHeight: h } = c.map.getContainer();
    if (pt.x < w * 0.15 || pt.x > w * 0.85 || pt.y < h * 0.15 || pt.y > h * 0.85) c.map.easeTo({ center: [p.lng, p.lat], duration: 500 });
  }, [activeId]);

  const zoom = (d: number) => (d > 0 ? ctx.current?.map.zoomIn() : ctx.current?.map.zoomOut());
  const btn = 'flex size-9 items-center justify-center text-foreground transition-colors hover:bg-muted';

  return (
    <div className={cn('relative', className)}>
      {/* MapLibre makes its container position:relative, so it sits inside a sized wrapper */}
      <div className="absolute inset-0 z-0 bg-[#f4f4f2]">
        <div ref={el} className="h-full w-full" role="region" aria-label="Map of units on site and the day's run" />
      </div>
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
