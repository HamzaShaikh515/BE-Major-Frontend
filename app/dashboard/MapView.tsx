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

export default function MapView({ result, lat, lon, setPolygon, radius, hasPolygon, onLocationChange }: any) {

    const featureGroupRef = useRef<L.FeatureGroup>(null);
    const legendRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 24, y: 24 });
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

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

    // Search functionality using Nominatim (OpenStreetMap)
    const handleSearch = async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
            );
            const data = await response.json();
            setSearchResults(data);
            setShowResults(true);
        } catch (error) {
            console.error('Search error:', error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    // Debounced search
    const handleSearchInput = (value: string) => {
        setSearchQuery(value);

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (value.trim()) {
            searchTimeoutRef.current = setTimeout(() => {
                handleSearch(value);
            }, 500);
        } else {
            setSearchResults([]);
            setShowResults(false);
        }
    };

    // Select a search result
    const selectLocation = (result: any) => {
        const newLat = parseFloat(result.lat);
        const newLon = parseFloat(result.lon);

        // Update parent component's coordinates and location name
        if (onLocationChange) {
            onLocationChange(newLat, newLon, result.display_name);
        }

        // Clear search
        setSearchQuery(result.display_name);
        setShowResults(false);
        setSearchResults([]);
    };

    // Dragging handlers for legend
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

            {/* Search Bar */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] w-full max-w-md px-4">
                <div className="relative">
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => handleSearchInput(e.target.value)}
                            placeholder="🔍 Search for a location (e.g., Delhi, Mumbai, New York...)"
                            className="w-full bg-white border-2 border-gray-300 text-gray-900 px-4 py-3 pr-10 rounded-lg shadow-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                        />
                        {isSearching && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        )}
                    </div>

                    {/* Search Results Dropdown */}
                    {showResults && searchResults.length > 0 && (
                        <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-2xl border border-gray-200 max-h-64 overflow-y-auto">
                            {searchResults.map((result, index) => (
                                <button
                                    key={index}
                                    onClick={() => selectLocation(result)}
                                    className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                                >
                                    <div className="flex items-start gap-2">
                                        <span className="text-lg mt-0.5">📍</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-gray-900 truncate">
                                                {result.display_name.split(',')[0]}
                                            </div>
                                            <div className="text-xs text-gray-500 truncate">
                                                {result.display_name}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* No Results */}
                    {showResults && searchResults.length === 0 && !isSearching && searchQuery.trim() && (
                        <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-2xl border border-gray-200 px-4 py-3">
                            <div className="text-sm text-gray-500 text-center">
                                No locations found for "{searchQuery}"
                            </div>
                        </div>
                    )}
                </div>
            </div>

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