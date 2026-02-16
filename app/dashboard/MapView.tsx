'use client';

import {
    MapContainer,
    TileLayer,
    LayersControl,
    FeatureGroup,
    Circle,
    useMap
} from 'react-leaflet';

import { EditControl } from 'react-leaflet-draw';
import { useRef, useEffect, useState } from 'react';
import L from 'leaflet';

// Component to update map center when coords change
function MapUpdater({ lat, lon }: { lat: number; lon: number }) {
    const map = useMap();

    useEffect(() => {
        map.setView([lat, lon], map.getZoom());
    }, [lat, lon, map]);

    return null;
}

export default function MapView({ result, lat, lon, setPolygon, radius, hasPolygon }: any) {

    const featureGroupRef = useRef<L.FeatureGroup>(null);
    const legendRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 24, y: 24 }); // bottom-6 left-6 = 24px
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const onCreated = (e: any) => {
        const layer = e.layer;

        // Remove previous polygon
        if (featureGroupRef.current) {
            featureGroupRef.current.clearLayers();
            featureGroupRef.current.addLayer(layer);
        }

        const geojson = layer.toGeoJSON();

        // Send only geometry to backend
        setPolygon(geojson.geometry);
    };

    const onDeleted = () => {
        setPolygon(null);
    };

    // Dragging handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!legendRef.current) return;
        setIsDragging(true);
        const rect = legendRef.current.getBoundingClientRect();
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !legendRef.current) return;

            const parent = legendRef.current.parentElement;
            if (!parent) return;

            const parentRect = parent.getBoundingClientRect();
            const legendRect = legendRef.current.getBoundingClientRect();

            let newX = e.clientX - parentRect.left - dragOffset.x;
            let newY = e.clientY - parentRect.top - dragOffset.y;

            // Constrain to parent bounds
            newX = Math.max(0, Math.min(newX, parentRect.width - legendRect.width));
            newY = Math.max(0, Math.min(newY, parentRect.height - legendRect.height));

            setPosition({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset]);

    return (
        <div className="rounded-lg overflow-hidden shadow-inner relative">
            <MapContainer
                center={[lat, lon]}
                zoom={14}
                style={{ height: "600px", width: "100%" }}
                className="rounded-lg"
            >
                <MapUpdater lat={lat} lon={lon} />

                <LayersControl position="topright">

                    <LayersControl.BaseLayer checked name="🗺️ OpenStreetMap">
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        />
                    </LayersControl.BaseLayer>

                    <LayersControl.BaseLayer name="🛰️ Satellite">
                        <TileLayer
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                        />
                    </LayersControl.BaseLayer>

                    {result?.encroachment_tile && (
                        <LayersControl.Overlay name="🔴 Encroachment Layer" checked>
                            <TileLayer
                                key={result.encroachment_tile}
                                url={result.encroachment_tile}
                                opacity={0.7}
                            />
                        </LayersControl.Overlay>
                    )}

                </LayersControl>

                {/* Manual Input Circle - Only show when NOT using polygon */}
                {!hasPolygon && (
                    <Circle
                        center={[lat, lon]}
                        radius={radius}
                        pathOptions={{
                            color: '#3b82f6',
                            fillColor: '#3b82f6',
                            fillOpacity: 0.15,
                            weight: 3
                        }}
                    />
                )}

                {/* AOI Drawing Layer */}
                <FeatureGroup ref={featureGroupRef}>
                    <EditControl
                        position="topleft"
                        onCreated={onCreated}
                        onDeleted={onDeleted}
                        onEdited={onCreated}
                        draw={{
                            rectangle: {
                                shapeOptions: {
                                    color: '#9333ea',
                                    weight: 3,
                                    fillOpacity: 0.1
                                }
                            },
                            polygon: {
                                shapeOptions: {
                                    color: '#9333ea',
                                    weight: 3,
                                    fillOpacity: 0.1
                                }
                            },
                            circle: false,
                            marker: false,
                            polyline: false,
                            circlemarker: false
                        }}
                        edit={{
                            edit: true,
                            remove: true
                        }}
                    />
                </FeatureGroup>

            </MapContainer>

            {/* Draggable Floating Legend - Only show when results exist */}
            {result && (
                <div
                    ref={legendRef}
                    className={`absolute z-[1000] bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-2xl px-4 py-3 min-w-[280px] ${isDragging ? 'cursor-grabbing' : 'cursor-grab'
                        }`}
                    style={{
                        left: `${position.x}px`,
                        top: `${position.y}px`,
                        userSelect: 'none'
                    }}
                    onMouseDown={handleMouseDown}
                >
                    <div className="text-sm font-semibold text-white mb-2.5 border-b border-gray-700 pb-2 flex items-center justify-between">
                        <span>Legend</span>
                        <span className="text-xs text-gray-400 ml-2">↔️ Drag to move</span>
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2.5">
                            <span className="text-base">🟠</span>
                            <span className="text-gray-200">Encroachment (Vegetation ↓ + Built-up ↑)</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <span className="text-base">🟣</span>
                            <span className="text-gray-200">Built-up Increase</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <span className="text-base">🔴</span>
                            <span className="text-gray-200">Vegetation Loss</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}