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



async function loadAllVisitedSquares(db, pseudo, gridType) {
  const mergedVisited = new Set();

  const snapshot = await db.collection("scores")
    .where("pseudo", "==", pseudo)
    .where("gridType", "==", gridType)
    .get();

  snapshot.forEach(doc => {
    const data = doc.data();
    const visited = data.visitedBounds || [];
    visited.forEach(square => {
      const key = `${square.south}_${square.west}`;
      mergedVisited.add(key);
    });
  });

  return mergedVisited;
}


function displayVisitedSquares(L, map, visitedSet, color = "blue") {
  visitedSet.forEach(key => {
    const [south, west] = key.split("_").map(Number);
    const deltaLat = metersToDegreesLat(gridSizeMeters);
    const deltaLng = metersToDegreesLng(gridSizeMeters, south);
    const north = south + deltaLat;
    const east = west + deltaLng;
    L.rectangle([[south, west], [north, east]], {
      color: color,
      weight: 0.5,
      fillOpacity: 0.2
    }).addTo(map);
  });
}
