// main.js
const firebaseConfig = {
  apiKey: "AIzaSyCrzvPBLBF4M3J03xa6VJzcsdvk00vQ7RY",
  authDomain: "paraglidingmeshleaderboard.firebaseapp.com",
  projectId: "paraglidingmeshleaderboard",
  storageBucket: "paraglidingmeshleaderboard.appspot.com",
  messagingSenderId: "13268331240",
  appId: "1:13268331240:web:b8e9a9b4834727d610b75d"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

const map = L.map('map');
let grid = [];
const visitedCells = new Set();
const pathCoords = [];
let pathLine = null;
let arrowMarker = null;
const gridSizeMeters = 200;
const areaSizeMeters = 6000;
let totalSquares = 0;
let lastLat = null;
let lastLng = null;

function metersToDegreesLat(meters) {
  return meters / 111320;
}

function metersToDegreesLng(meters, latitude) {
  return meters / (40075000 * Math.cos(latitude * Math.PI / 180) / 360);
}

function snapToGrid(value, step) {
  return Math.floor(value / step) * step;
}

function updateCounter() {
  document.getElementById('counter').textContent =
    `Visited squares: ${visitedCells.size} / ${totalSquares}`;
}

function createGrid(centerLat, centerLng) {
  const rows = Math.floor(areaSizeMeters / gridSizeMeters);
  const cols = rows;
  totalSquares = rows * cols;
  updateCounter();

  const deltaLat = metersToDegreesLat(gridSizeMeters);
  const deltaLng = metersToDegreesLng(gridSizeMeters, centerLat);

  const startLat = snapToGrid(centerLat, deltaLat) - (rows / 2) * deltaLat;
  const startLng = snapToGrid(centerLng, deltaLng) - (cols / 2) * deltaLng;

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const south = startLat + i * deltaLat;
      const west = startLng + j * deltaLng;
      const north = south + deltaLat;
      const east = west + deltaLng;

      const bounds = [[south, west], [north, east]];
      const rect = L.rectangle(bounds, {
        color: "#000",
        weight: 1,
        fillOpacity: 0.1
      }).addTo(map);
      grid.push({ bounds, rect, visited: false });
    }
  }
}

function highlightCurrentSquare(lat, lng) {
  grid.forEach(cell => {
    const [[south, west], [north, east]] = cell.bounds;
    const key = `${south.toFixed(5)}_${west.toFixed(5)}`;

    if (
      lat >= south && lat <= north &&
      lng >= west && lng <= east &&
      !visitedCells.has(key)
    ) {
      cell.rect.setStyle({ color: "green", fillOpacity: 0.5 });
      visitedCells.add(key);
      cell.visited = true;
      updateCounter();
    }
  });
}

function updatePath(lat, lng) {
  pathCoords.push([lat, lng]);
  if (pathLine) map.removeLayer(pathLine);
  pathLine = L.polyline(pathCoords, {
    color: "yellow",
    weight: 3
  }).addTo(map);
}

function updateArrow(lat, lng) {
  if (arrowMarker) map.removeLayer(arrowMarker);
  let angle = 0;
  if (lastLat !== null && lastLng !== null) {
    const dx = lng - lastLng;
    const dy = lat - lastLat;
    angle = Math.atan2(dy, dx) * 180 / Math.PI;
  }

  const divIcon = L.divIcon({
    className: '',
    html: `<div class="arrow-marker" style="transform: rotate(${angle}deg);"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5]
  });

  arrowMarker = L.marker([lat, lng], { icon: divIcon }).addTo(map);
  lastLat = lat;
  lastLng = lng;
}

function initMap(centerLat, centerLng, useGPS = true) {
  document.getElementById('startup-modal').style.display = 'none';
  L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: 'Map data: © OpenTopoMap, SRTM | © OpenStreetMap contributors'
  }).addTo(map);

  map.setView([centerLat, centerLng], 14);
  createGrid(centerLat, centerLng);

  if (useGPS) {
    navigator.geolocation.watchPosition(pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      highlightCurrentSquare(lat, lng);
      updatePath(lat, lng);
      updateArrow(lat, lng);
    }, err => {
      alert("GPS error: " + err.message);
    }, {
      enableHighAccuracy: true,
      maximumAge: 0
    });
  } else {
    highlightCurrentSquare(centerLat, centerLng);
    updatePath(centerLat, centerLng);
    updateArrow(centerLat, centerLng);
  }
}

function startWithFayolle() {
  initMap(46.1083495, 4.6189530, true);
}

function startWithLaMarie() {
  initMap(46.084143, 4.608334, true);
}

function startWithGPS() {
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    initMap(lat, lng, true);
  }, err => {
    alert("GPS error: " + err.message);
  });
}

function saveSession(gridType, visitedCount) {
  try {
    const pseudo = prompt("Enter your pseudo:");
    if (!pseudo) return;

    db.collection("scores").add({
     pseudo,
     score: visitedCount,
     gridType,
     timestamp: firebase.firestore.FieldValue.serverTimestamp(),
     visitedCells: Array.from(visitedCells),
     pathCoords: pathCoords,
    }).then(docRef => {
      console.log("Score saved with ID:", docRef.id);

      const badge = document.createElement("div");
      badge.style.position = "absolute";
      badge.style.top = "10px";
      badge.style.left = "10px";
      badge.style.padding = "12px 16px";
      badge.style.background = "rgba(0, 0, 0, 0.7)";
      badge.style.color = "white";
      badge.style.fontSize = "16px";
      badge.style.fontFamily = "sans-serif";
      badge.style.borderRadius = "8px";
      badge.style.zIndex = "9999";
      badge.innerHTML = `
        <strong>${gridType}</strong><br>
        🧍 ${pseudo}<br>
        📈 ${visitedCount} squares<br>
        📅 ${new Date().toLocaleDateString()}
      `;
      document.body.appendChild(badge);

      const tip = document.createElement("div");
      tip.textContent = "📸 Don't forget to take a screenshot!";
      tip.style.position = "absolute";
      tip.style.bottom = "80px";
      tip.style.left = "50%";
      tip.style.transform = "translateX(-50%)";
      tip.style.background = "rgba(0,0,0,0.8)";
      tip.style.color = "white";
      tip.style.padding = "10px 20px";
      tip.style.borderRadius = "8px";
      tip.style.fontSize = "16px";
      tip.style.zIndex = "9999";
      document.body.appendChild(tip);

      setTimeout(() => {
        if (tip.parentNode) document.body.removeChild(tip);
      }, 5000);

      alert("✅ Score saved!\n📸 Don't forget to take a screenshot now!");
    });
  } catch (err) {
    console.error("Save error:", err);
    alert("Something went wrong: " + err.message);
  }
}

function handleSave() {
  const currentLat = map.getCenter().lat.toFixed(4);
  const currentGridType =
    currentLat === "46.1083" ? "Fayolle" :
    currentLat === "46.0841" ? "La Marie" :
    "Around me";

  saveSession(currentGridType, visitedCells.size);
}
