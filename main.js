// main.js

let currentGridType = "Around me";

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
const visitedBounds = []; // ✅ store bounds
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
  console.log("Create Grid");
  const rows = Math.floor(areaSizeMeters / gridSizeMeters);
  const cols = rows;
  totalSquares = rows * cols;
  updateCounter();

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
        weight: 1,
        fillOpacity: 0.1
      }).addTo(map);
      grid.push({ bounds, rect, visited: false });
    }
  }
  console.log("Finish Create grid");
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
      visitedBounds.push(cell.bounds); // ✅ save bounds
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

function initMapOnly(centerLat, centerLng) {
  console.log("In InitMapOnly");
  L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: 'Map data: © OpenTopoMap, SRTM | © OpenStreetMap contributors'
  }).addTo(map);

  map.setView([centerLat, centerLng], 14);
}

// debut initmap
function initMap(centerLat, centerLng, useGPS = true) {
  console.log("In initMap");
  createGrid(centerLat, centerLng);

  const savedVisited = JSON.parse(localStorage.getItem("mesh_visited") || "[]");
  savedVisited.forEach(key => visitedCells.add(key));

  grid.forEach(cell => {
    const [[south, west]] = cell.bounds;
    const key = `${south.toFixed(5)}_${west.toFixed(5)}`;
    if (visitedCells.has(key)) {
      cell.rect.setStyle({ color: "green", fillOpacity: 0.5 });
      cell.visited = true;
    }
  });
  updateCounter();

  const savedPath = JSON.parse(localStorage.getItem("mesh_path") || "[]");
  pathCoords.push(...savedPath);
  if (pathCoords.length) {
    pathLine = L.polyline(pathCoords.map(p => [p.lat, p.lng]), {
      color: "yellow",
      weight: 3
    }).addTo(map);
  }
console.log("Before leaving InitMap")  
if (useGPS && "geolocation" in navigator) {
console.log("After if (!useGPS ...")   

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
}
} // fin initmap

function startWith(lat, lng, name) {
  currentGridType = name;
  initMap(lat, lng, true);
  document.getElementById("gridChoiceButton").style.display = "none";
  document.getElementById("leaderboardButton").style.display = "none";
  //document.getElementById("loadIGCButton").style.display = "none";
  document.getElementById("resetButton").style.display = "block";
}


function showGridModal(callback) {
    const modal = document.getElementById("startup-modal");
    modal.style.display = "flex";

    fetch('startPoints.json')
      .then(res => res.json())
      .then(points => {
        const container = document.getElementById('start-buttons');
        container.innerHTML = '';
        points.forEach(point => {
          const btn = document.createElement("button");
          btn.textContent = point.name;
          btn.onclick = () => {
          if (point.gps) {
            if ("geolocation" in navigator) {
              navigator.geolocation.getCurrentPosition(
                pos => {
                  startWith(pos.coords.latitude, pos.coords.longitude, "Around me");
                  document.getElementById("startup-modal").style.display = "none";
                },
                err => {
                  alert("GPS error. Using default.");
                  startWith(46.1083495, 4.6189530, "Fayolle");
                  document.getElementById("startup-modal").style.display = "none";
                }
              );
            } else {
              alert("Geolocation not supported. Using default.");
              startWith(46.1083495, 4.6189530, "Fayolle");
              document.getElementById("startup-modal").style.display = "none";
            }
          } else {
            startWith(point.lat, point.lng, point.name);
            document.getElementById("startup-modal").style.display = "none";
            }
            modal.style.display = "none";
          };
          container.appendChild(btn);
        });
      });
}

function promptIGCUpload() {
  console.log("In prompt");
  const fileInput = document.getElementById("igcInput");
  fileInput.value = ''; // reset any existing file
  fileInput.click(); // This opens the file picker dialog
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {      
      parseIGCFile(file);
    }
  }
}

function parseIGCFile(file) {
  console.log("File ok, reading...");
  const reader = new FileReader();
  reader.onload = (e) => {
    const lines = e.target.result.split("\n").filter(l => l.startsWith("B"));
    const points = [];

    for (const line of lines) {
      const latRaw = line.substring(7, 14);
      const lngRaw = line.substring(15, 23);

      let lat = parseInt(latRaw.slice(0, 2)) + parseFloat(latRaw.slice(2, 7)) / 60000;
      let lng = parseInt(lngRaw.slice(0, 3)) + parseFloat(lngRaw.slice(3, 8)) / 60000;

      if (latRaw[6] === 'S') lat *= -1;
      if (lngRaw[7] === 'W') lng *= -1;

      points.push([lat, lng]);
    }

    for (const [lat, lng] of points) {
      highlightCurrentSquare(lat, lng);
    }

    pathCoords.push(...points);
    if (pathLine) map.removeLayer(pathLine);
    pathLine = L.polyline(points, { color: "yellow", weight: 3 }).addTo(map);

    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points));
    }
  alert("📍 IGC track loaded!");  
  };
  reader.readAsText(file);
}



function saveAppState() {
  const center = map.getCenter();
  localStorage.setItem("mesh_center", JSON.stringify({ lat: center.lat, lng: center.lng }));
  localStorage.setItem("mesh_visited", JSON.stringify([...visitedCells]));
  localStorage.setItem("mesh_path", JSON.stringify(pathCoords.map(([lat, lng]) => ({ lat, lng }))));
}
window.addEventListener("beforeunload", saveAppState);

// Start DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("mesh_center");
  let usedSaved = false;

  if (saved) {
    try {
      const { lat, lng } = JSON.parse(saved);
      if (typeof lat === "number" && typeof lng === "number") {
        initMapOnly(lat, lng);
        usedSaved = true;
      }
    } catch (e) {
      console.warn("Invalid saved center:", e);
    }
  }

  if (!usedSaved) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        initMapOnly(pos.coords.latitude, pos.coords.longitude);
      },
      err => {
        initMapOnly(46.1083495, 4.6189530); // fallback: Fayolle
      },
      { enableHighAccuracy: true, timeout: 2000 }
    );
  }

  // loadIGC
  document.getElementById("loadIGCButton").onclick = () => {
    console.log("Begin of LoadIGCbutton")
    console.log("Before suppression boutton");
    document.getElementById("leaderboardButton").style.display = "none";
    document.getElementById("loadIGCButton").style.display = "none";
    document.getElementById("resetButton").style.display = "block";
    console.log("Before loading");
    promptIGCUpload();
    console.log("After loading");
  };

  // grid choice button
  document.getElementById("gridChoiceButton").onclick = () => {
    document.getElementById("loadIGCButton").style.display = "block";
    showGridModal((lat, lng, name) => {
      //startWith(lat, lng, name);
      initMap(lat, lng, False);
    });
  };
}); // end // DOMContentLoaded

async function saveSession(gridType, visitedCount) {
  try {
    const pseudo = prompt("Enter your pseudo:");
    if (!pseudo) return;

    // Convert visited bounds to Firestore-safe data
    const visited = Array.from(visitedCells).map(key => {
      const [south, west] = key.split("_").map(Number);
      const deltaLat = metersToDegreesLat(gridSizeMeters);
      const deltaLng = metersToDegreesLng(gridSizeMeters, south);
      const north = south + deltaLat;
      const east = west + deltaLng;
      return { south, west, north, east };
    });

    // Save the simplified structure
    const docRef = await db.collection("scores").add({
      pseudo,
      score: visitedCount,
      gridType,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      pathCoords: pathCoords.map(([lat, lng]) => ({ lat, lng })),
      visitedBounds: visited
    });

    console.log("Score saved with ID:", docRef.id);

    // Show badge and tip as before
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

    alert("✅ Score saved!");

  } catch (err) {
    console.error("Save error:", err);
    alert("Something went wrong: " + err.message);
  }
}

function handleSave() {
  saveSession(currentGridType, visitedCells.size);
}

document.getElementById("resetButton").onclick = () => {
  const confirmBox = document.createElement("div");
  confirmBox.innerHTML = `
    <div style="position: fixed; top: 30%; left: 50%; transform: translateX(-50%);
      background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.3); z-index: 9999;">
      <p>Do you want to save before resetting?</p>
      <button id="confirm-yes">Yes</button>
      <button id="confirm-no">No</button>
    </div>
  `;
  document.body.appendChild(confirmBox);
  const cleanup = () => confirmBox.remove();
  document.getElementById("confirm-yes").onclick = () => {
    saveSession(currentGridType, visitedCells.size);
    cleanup();
    resetAppState();
  };
  document.getElementById("confirm-no").onclick = () => {
    cleanup();
    resetAppState();
  };
};

function resetAppState() {
  localStorage.removeItem("mesh_center");
  localStorage.removeItem("mesh_visited");
  localStorage.removeItem("mesh_path");
  location.reload();
}
