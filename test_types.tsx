
import React from 'react';
import { MapContainer } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';

const center: LatLngExpression = [51.505, -0.09];

export const TestComponent = () => {
    return (
        <MapContainer center={center} zoom={13} style={{ height: '100px' }}>
            <div />
        </MapContainer>
    );
};
