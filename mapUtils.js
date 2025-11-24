const gridSizeMeters = 200;
const areaSizeMeters = 6000;



function metersToDegreesLat(meters) {
  return meters / 111320;
}

function metersToDegreesLng(meters, latitude) {
  return meters / (40075000 * Math.cos(latitude * Math.PI / 180) / 360);
}

function snapToGrid(value, step) {
  return Math.floor(value / step) * step;
}


function createGrid(map, centerLat, centerLng, grid=[]) {
  const rows = Math.floor(areaSizeMeters / gridSizeMeters);
  const cols = rows;
  totalSquares = rows * cols;

  const deltaLat = metersToDegreesLat(gridSizeMeters);
  const deltaLng = metersToDegreesLng(gridSizeMeters, centerLat);

  const startLat = snapToGrid(centerLat, deltaLat) - (rows / 2) * deltaLat;
  const startLng = snapToGrid(centerLng, deltaLng) - (cols / 2) * deltaLng;

  const centerGridLat = startLat + (rows / 2) * deltaLat;
  const centerGridLng = startLng + (cols / 2) * deltaLng;
  map.setView([centerGridLat, centerGridLng], 14);


  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const south = startLat + i * deltaLat;
      const west = startLng + j * deltaLng;
      const north = south + deltaLat;
      const east = west + deltaLng;

      const bounds = [[south, west], [north, east]];
      const rect = L.rectangle(bounds, {
        color: "#000",
        weight: 0.3,
        fillOpacity: 0.1
      }).addTo(map);
      grid.push({ bounds, rect, visited: false });
    }
  }
  return totalSquares ;
}


function showOnMap(map, bounds, path) {
  removeSquares(map) ;

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
  if (latLngs.length) {
    map.fitBounds(latLngs);
    map.setZoom(14)
  }
}



async function loadAllVisitedSquares(db, pseudo, gridType) {
  const mergedVisited = new Set();

  const snapshot = await db.collection("scores")
    .where("pseudo", "==", pseudo)
    .where("gridType", "==", gridType)
    .get();

  const nflight = snapshot.size ;
  console.log(nflight);

  snapshot.forEach(doc => {
    const data = doc.data();
    const visited = data.visitedBounds || [];
    visited.forEach(square => {
      const key = `${square.south}_${square.west}`;
      mergedVisited.add(key);
    });
  });
  return { nbFlight: nflight, mergedVisited:mergedVisited }
  //return mergedVisited;
}


function removeSquares(map) {
   map.eachLayer(layer => {
    if (layer instanceof L.Polyline || layer instanceof L.Rectangle) {
      map.removeLayer(layer);
    }
  });  
}


function displayVisitedSquares(L, map, visitedSet, color = "blue", opacity = 0.2) {
   visitedSet.forEach(key => {
    const [south, west] = key.split("_").map(Number);
    const deltaLat = metersToDegreesLat(gridSizeMeters);
    const deltaLng = metersToDegreesLng(gridSizeMeters, south);
    const north = south + deltaLat;
    const east = west + deltaLng;
    L.rectangle([[south, west], [north, east]], {
      color: color,
      weight: 0.3,
      fillOpacity: opacity
    }).addTo(map);
  });
}




async function getGridCenterByName(gridName) {
  try {
    let response;
    if (location.protocol === 'file:') {
      // Local: fetch from GitHub
      response = await fetch("https://simonnicolas07.github.io/ParaglidingSquare2visit/startPoints.json");
    } else {
      // Online: use relative path
      response = await fetch("startPoints.json");
    }

    const points = await response.json();
    const match = points.find(p => p.name === gridName);
    if (!match) {
      throw new Error("Grid not found: " + gridName);
    }

    if (match.gps && "geolocation" in navigator) {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          err => reject("GPS error: " + err.message)
        );
      });
    }

    return { lat: match.lat, lng: match.lng };
  } catch (err) {
    console.error("Failed to get grid center:", err);
    return null;
  }
}