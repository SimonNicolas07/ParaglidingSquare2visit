function showOnMap(map, bounds, path) {
  map.eachLayer(layer => {
    if (layer instanceof L.Polyline || layer instanceof L.Rectangle) {
      map.removeLayer(layer);
    }
  });

  const latLngs = [];
  bounds.forEach(b => {
    const rect = L.rectangle([[b.south, b.west], [b.north, b.east]], {
      color: "green",
      weight: 1,
      fillOpacity: 0.5
    }).addTo(map);
    latLngs.push([b.south, b.west], [b.north, b.east]);
  });

  if (path && path.length) {
    const line = L.polyline(path.map(p => [p.lat, p.lng]), {
      color: "yellow",
      weight: 3
    }).addTo(map);
    latLngs.push(...path.map(p => [p.lat, p.lng]));
  }
  console.log("HERE");
  if (latLngs.length) {
    map.fitBounds(latLngs);
    map.setZoom(14)
  }
  console.log("ICI");
}
