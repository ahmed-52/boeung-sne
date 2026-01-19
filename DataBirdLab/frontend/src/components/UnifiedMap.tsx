import React from 'react';
import { MapContainer, TileLayer, Marker, Circle, Tooltip, Rectangle, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster'; // <--- Import this
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { VisualDetection, AcousticDetection } from '../mockData';

interface UnifiedMapProps {
    visualDetections: VisualDetection[];
    acousticDetections: AcousticDetection[];
    onSelectVisual: (d: VisualDetection) => void;
    onSelectAcoustic: (d: AcousticDetection) => void;
    onSelectARU?: (aruData: { id: string, lat: number, lon: number, detectionCount: number, aru_id?: number }) => void;
    onSelectSurvey?: (survey: any) => void;
    surveys?: any[]; // Using any for now to match backend response structure locally
}

const UnifiedMap: React.FC<UnifiedMapProps> = ({ visualDetections, acousticDetections, onSelectVisual, onSelectAcoustic, onSelectARU, onSelectSurvey, surveys = [] }) => {

    // Optimized Icon: Use a simpler structure if possible, but your divIcon is fine with clustering
    const visualIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="w-4 h-4 bg-teal-500 border-2 border-white shadow-md rounded-sm transform rotate-45 cursor-pointer hover:bg-teal-400"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
    });

    // Custom function to style the cluster icons (Optional: matches your teal theme)
    const createClusterCustomIcon = function (cluster: any) {
        return L.divIcon({
            html: `<div class="flex items-center justify-center w-8 h-8 bg-teal-600 text-white rounded-full font-bold border-2 border-white shadow-lg text-xs">${cluster.getChildCount()}</div>`,
            className: 'custom-cluster-icon',
            iconSize: L.point(32, 32, true),
        });
    }

    const centerPos: [number, number] = [11.408837, 105.394870];

    // Memoize stations to prevent re-calc on every render
    const aruStations = React.useMemo(() => {
        const stations: { [key: string]: { lat: number, lon: number, detections: AcousticDetection[], id: string, aru_id?: number } } = {};
        acousticDetections.forEach(d => {
            // Prefer grouping by ARU ID if available
            const key = d.aru_id ? `aru-${d.aru_id}` : `${d.lat.toFixed(4)},${d.lon.toFixed(4)}`;

            if (!stations[key]) {
                stations[key] = {
                    lat: d.lat,
                    lon: d.lon,
                    detections: [],
                    id: d.aru_id ? `ARU ${d.aru_id}` : `Station ${Object.keys(stations).length + 1}`,
                    aru_id: d.aru_id
                };
            }
            stations[key].detections.push(d);
        });
        return Object.values(stations);
    }, [acousticDetections]);

    return (
        <div className="h-full w-full rounded-2xl overflow-hidden relative z-0">
            <MapContainer
                center={centerPos}
                zoom={16}
                minZoom={15} // Lock user from zooming out too far
                maxZoom={18} // Moderate zoom in allowed
                scrollWheelZoom={false} // Disable scroll zoom to prevent accidental movement
                maxBounds={[
                    [11.39, 105.37], // Southwest coordinates
                    [11.43, 105.42]  // Northeast coordinates
                ]}
                maxBoundsViscosity={1.0} // Sticky bounds
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                preferCanvas={true} // <--- Tries to use Canvas renderer instead of DOM for basic shapes
            >
                <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution='Tiles &copy; Esri'
                />

                {/* Layer 0: Survey Bounds (Polygons) */}
                {surveys.map(survey => {
                    const b = survey.bounds;
                    if (!b || !b.min_lat || !b.max_lat || !b.min_lon || !b.max_lon) return null;

                    // Leaflet Rectangle bounds: [[lat1, lon1], [lat2, lon2]] (Corners)
                    const bounds: [[number, number], [number, number]] = [
                        [b.min_lat, b.min_lon],
                        [b.max_lat, b.max_lon]
                    ];

                    return (
                        <Rectangle
                            key={`survey-${survey.id}`}
                            bounds={bounds}
                            pathOptions={{
                                color: '#38BDF8',
                                fillColor: '#38BDF8',
                                fillOpacity: 0.15,
                                weight: 1,
                                dashArray: '4, 4'
                            }}
                            eventHandlers={{
                                click: () => {
                                    if (onSelectSurvey) onSelectSurvey(survey);
                                },
                                mouseover: (e) => {
                                    e.target.setStyle({ weight: 2, fillOpacity: 0.3 });
                                    e.target.openTooltip();
                                },
                                mouseout: (e) => {
                                    e.target.setStyle({ weight: 1, fillOpacity: 0.15 });
                                    e.target.closeTooltip();
                                }
                            }}
                        >
                            <Tooltip sticky direction="center" className="glass-tooltip">
                                <div className="text-center">
                                    <div className="font-bold text-slate-800">{survey.name}</div>
                                    <div className="text-xs text-slate-500">{new Date(survey.date).toLocaleDateString()}</div>
                                </div>
                            </Tooltip>
                        </Rectangle>
                    )
                })}

                {/* Layer 1: Acoustic (Keep these separate, they are important landmarks) */}
                {aruStations.map((station) => (
                    <Circle
                        key={station.id}
                        center={[station.lat, station.lon]}
                        radius={50}
                        pathOptions={{ color: '#F97316', fillColor: '#F97316', fillOpacity: 0.2, weight: 2, dashArray: '5, 5' }}
                        eventHandlers={{
                            click: () => {
                                if (onSelectARU) {
                                    onSelectARU({
                                        id: station.id,
                                        lat: station.lat,
                                        lon: station.lon,
                                        detectionCount: station.detections.length,
                                        aru_id: station.aru_id
                                    });
                                } else if (station.detections.length > 0) {
                                    onSelectAcoustic(station.detections[0]);
                                }
                            },
                        }}
                    >
                        {/* Only show tooltip on hover to save resources */}
                        <Tooltip sticky direction="top" offset={[0, -10]}>
                            <span className="font-bold text-xs">{station.id}</span>
                        </Tooltip>
                    </Circle>
                ))}

                {/* Layer 2: Visual Detections (Areas instead of Markers) */}
                {/* Layer 2: Visual Detections (Removed as per user request) */}
                {/* {visualDetections.map((d) => (
                    <Circle
                        key={d.id}
                        center={[d.lat, d.lon]}
                        radius={1.5}
                        pathOptions={{
                            color: '#38BDF8',
                            fillColor: '#38BDF8',
                            fillOpacity: 0.4,
                            weight: 1
                        }}
                        eventHandlers={{
                            click: () => onSelectVisual(d),
                            mouseover: (e) => { e.target.setStyle({ fillOpacity: 0.7, weight: 2 }); },
                            mouseout: (e) => { e.target.setStyle({ fillOpacity: 0.4, weight: 1 }); }
                        }}
                    >
                        <Tooltip sticky direction="top" offset={[0, -5]}>
                            <span className="font-semibold text-xs">{d.species}</span>
                        </Tooltip>
                    </Circle>
                ))} */}

            </MapContainer>

            {/* Legend (Keep as is) */}
            <div className="absolute bottom-6 left-6 z-[400] bg-white/90 backdrop-blur p-3 rounded-lg shadow-sm border border-slate-200 text-xs text-slate-700 space-y-2">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-teal-500 rounded-sm transform rotate-45"></div>
                    <span>Visual Detection</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-4 h-4 bg-teal-600 text-white rounded-full text-[8px] font-bold">10</div>
                    <span>Cluster (Zoom to see)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-orange-500 rounded-full opacity-50"></div>
                    <span>Acoustic Range (50m)</span>
                </div>
            </div>
        </div>
    );
};

export default UnifiedMap;