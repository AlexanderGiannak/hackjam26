"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { CAMPUS_CENTER } from "@/lib/geo";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  color: string;
  label: string;
  /** bigger dot for clusters / urgent */
  size?: number;
  onClick?: () => void;
}

export interface MapProps {
  markers?: MapMarker[];
  pin?: { lat: number; lng: number } | null;
  onPick?: (p: { lat: number; lng: number }) => void;
  ring?: { lat: number; lng: number; radius: number } | null;
  zoom?: number;
  className?: string;
  /** recenter when the pin changes (e.g. after "use my location") */
  follow?: boolean;
}

const pinIcon = L.divIcon({
  className: "",
  html: '<div class="bh-pin"><div></div></div>',
  iconSize: [34, 44],
  iconAnchor: [17, 42],
});

function Picker({ onPick }: { onPick?: MapProps["onPick"] }) {
  useMapEvents({ click: (e) => onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function Follow({ pin }: { pin: MapProps["pin"] }) {
  const map = useMap();
  useEffect(() => {
    if (pin) map.setView([pin.lat, pin.lng], Math.max(map.getZoom(), 17), { animate: true });
  }, [pin?.lat, pin?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function MapInner({ markers = [], pin, onPick, ring, zoom = 16, className, follow }: MapProps) {
  const center = useMemo(() => (pin ? [pin.lat, pin.lng] : [CAMPUS_CENTER.lat, CAMPUS_CENTER.lng]) as [number, number], []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} className={className ?? "h-64 w-full"} attributionControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      {ring && <Circle center={[ring.lat, ring.lng]} radius={ring.radius} pathOptions={{ color: "#006747", weight: 1, fillOpacity: 0.08, dashArray: "4 4" }} />}
      {markers.map((m) => (
        <CircleMarker
          key={m.id}
          center={[m.lat, m.lng]}
          radius={m.size ?? 8}
          pathOptions={{ color: "#fff", weight: 2, fillColor: m.color, fillOpacity: 0.95 }}
          eventHandlers={m.onClick ? { click: m.onClick } : undefined}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            {m.label}
          </Tooltip>
        </CircleMarker>
      ))}
      {pin && (
        <Marker
          position={[pin.lat, pin.lng]}
          icon={pinIcon}
          draggable={!!onPick}
          eventHandlers={{
            dragend: (e) => {
              const p = (e.target as L.Marker).getLatLng();
              onPick?.({ lat: p.lat, lng: p.lng });
            },
          }}
        />
      )}
      {onPick && <Picker onPick={onPick} />}
      {follow && <Follow pin={pin} />}
    </MapContainer>
  );
}
