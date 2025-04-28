// main.js

let currentGridType = "Around me";
let igcDate = null;

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
  loadAllVisitedSquares(db, pseudo, gridType).then(visitedSet => {
    displayVisitedSquares(L, map, visitedSet, "blue");
  });
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
L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
	maxZoom: 20,
	attribution: '<a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases" title="CyclOSM - Open Bicycle render">CyclOSM</a> | Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  map.setView([centerLat, centerLng], 14);
}

// debut initmap
function initMap(centerLat, centerLng, useGPS = true) {
  createGrid(centerLat, centerLng);

grid.forEach(cell => {
    const [[south, west]] = cell.bounds;
    const key = `${south.toFixed(5)}_${west.toFixed(5)}`;
    if (visitedCells.has(key)) {
      cell.rect.setStyle({ color: "green", fillOpacity: 0.5 });
      cell.visited = true;
    }
  });
  updateCounter();

  if (pathCoords.length) {
    pathLine = L.polyline(pathCoords.map(p => [p.lat, p.lng]), {
      color: "yellow",
      weight: 3
    }).addTo(map);
  }

if (useGPS && "geolocation" in navigator) {
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
                  callback(pos.coords.latitude, pos.coords.longitude, "Around me");
                },
                err => {
                  alert("GPS error. Using default.");
                  callback(46.1083495, 4.6189530, "Fayolle");
                }
              );
            } else {
              alert("Geolocation not supported. Using default.");
              callback(46.1083495, 4.6189530, "Fayolle");
            }
          } else {
            callback(point.lat, point.lng, point.name);
            }
            modal.style.display = "none";
          };
          container.appendChild(btn);
        });
      });
}

function promptIGCUpload() {
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
  igcDate = null; // Reset previous IGC date
  const reader = new FileReader();

  reader.onload = (e) => {
    const lines = e.target.result.split("\n");
    const points = [];

    // Try to extract the date from HFDTE line HFDTEDATE:230125,00 HFDTE280324
    const dateLine = lines.find(line => line.startsWith("HFDTE"));
    if (dateLine) {
      const day = parseInt(dateLine.substring(10, 12));
      const month = parseInt(dateLine.substring(12, 14)) - 1; // Months are 0-indexed
      const year = 2000 + parseInt(dateLine.substring(14, 16));
      igcDate = new Date(year, month, day);
      console.log(dateLine)
      console.log(year)
      console.log(month)
      console.log(day)
      console.log(igcDate)
    }


    // Process track points
    lines.filter(l => l.startsWith("B")).forEach(line => {
      const latRaw = line.substring(7, 14);
      const lngRaw = line.substring(15, 23);

      let lat = parseInt(latRaw.slice(0, 2)) + parseFloat(latRaw.slice(2, 7)) / 60000;
      let lng = parseInt(lngRaw.slice(0, 3)) + parseFloat(lngRaw.slice(3, 8)) / 60000;

      if (latRaw[6] === 'S') lat *= -1;
      if (lngRaw[7] === 'W') lng *= -1;

      points.push([lat, lng]);
    });

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

// Start DOMContentLoaded
document.addEventListener("DOMContentLoaded", async () => {
  const pseudo = await getOrAskPseudo();
  updatePseudoDisplay(pseudo);

  if (!pseudo) {
    alert("Pseudo is required to continue. Reloading page...");
    location.reload();
    return;
  }	
	
  // chargement de la carte avec position de user ou fayolle
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
    pos => {
      initMapOnly(pos.coords.latitude, pos.coords.longitude);
    },
    err => {
      initMapOnly(46.1083495, 4.6189530); // fallback Fayolles
    },
    {enableHighAccuracy: true, timeout:2000}
  );
  } else {
    initMapOnly(46.1083495, 4.6189530); // fallback Fayolles
  }

  document.getElementById("pseudoButton").onclick = async () => {
  localStorage.removeItem("pseudo");  // Clear the old pseudo
  const newPseudo = await getOrAskPseudo(); // Re-ask
  updatePseudoDisplay(newPseudo);
  //location.reload(); // Force reload the app with new pseudo
  };
	
  // loadIGC
  document.getElementById("loadIGCButton").onclick = () => {
    document.getElementById("loadIGCButton").style.display = "none";
    promptIGCUpload();
  };

  // grid choice only for load igc
    document.getElementById("gridForIGC").onclick = () => {
      document.getElementById("loadIGCButton").style.display = "block";
      document.getElementById("resetButton").style.display = "block";
      document.getElementById("leaderboardButton").style.display = "none";
      document.getElementById("gridChoiceButton").style.display = "none"; 
      document.getElementById("gridForIGC").style.display = "none";
      document.getElementById("pseudoButton").style.display = "none"; 
      document.getElementById("pseudoLabel").style.display = "none";
      showGridModal((lat, lng, name) => {
        currentGridType = name ;
        initMap(lat, lng, false);
      });
  };
  
  // grid choice button for take off
    document.getElementById("gridChoiceButton").onclick = () => {
    document.getElementById("leaderboardButton").style.display = "none";
    document.getElementById("loadIGCButton").style.display = "none";
    document.getElementById("resetButton").style.display = "block";
    document.getElementById("gridForIGC").style.display = "none"; 
    document.getElementById("gridChoiceButton").style.display = "none"; 
    document.getElementById("pseudoButton").style.display = "none"; 
    document.getElementById("pseudoLabel").style.display = "none";
    showGridModal((lat, lng, name) => {
      currentGridType = name ;
      initMap(lat, lng, true);	    
    });
  };
}); // end // DOMContentLoaded

async function getOrAskPseudo() {
  const saved = localStorage.getItem("pseudo");
  if (saved) return saved;

  while (true) {
    const pseudo = prompt("Entrez votre prénom et nom (obligatoire):");
    if (!pseudo) {
      alert("⚠️ Vous devez obligatoirement entrer votre prénom et nom!");
      continue;
    }

    const snapshot = await db.collection("scores")
      .where("pseudo", "==", pseudo)
      .limit(1)
      .get();

    if (snapshot.empty) {
      localStorage.setItem("pseudo", pseudo);
      return pseudo;
    } else {
      const confirmUse = confirm(`Le pseudo "${pseudo}" existe deja dans la base de donnée de résultats. VOulez-vous l'utiliser quand même?`);
      if (confirmUse) {
        localStorage.setItem("pseudo", pseudo);
        return pseudo;
      }
    }
  }
}

function updatePseudoDisplay(pseudo) {
  const label = document.getElementById("pseudoLabel");
  label.textContent = `${pseudo}`;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const aKeys = Object.keys(a[i]).sort();
    const bKeys = Object.keys(b[i]).sort();
    if (aKeys.length !== bKeys.length) return false;
    for (let key of aKeys) {
      if (Math.abs(a[i][key] - b[i][key]) > 0.0001) return false; // allow tiny error
    }
  }
  return true;
}

async function saveSession(gridType, visitedCount) {
  try {
    const pseudo = await getOrAskPseudo();
    if (!pseudo) return;

    if (visitedCount === 0) {
      alert("⚠️ Score = 0 non sauvegardé");
      return;
    }

    const currentPath = pathCoords.map(p => ({ lat: p[0], lng: p[1] }));
    const currentVisited = Array.from(visitedCells).map(key => {
      const [south, west] = key.split("_").map(Number);
      const deltaLat = metersToDegreesLat(gridSizeMeters);
      const deltaLng = metersToDegreesLng(gridSizeMeters, south);
      const north = south + deltaLat;
      const east = west + deltaLng;
      return { south, west, north, east };
      });

    // First, check by pseudo and score only
    const snapshot = await db.collection("scores")
      .where("pseudo", "==", pseudo)
      .where("score", "==", visitedCount)
      .where("gridType", "==", gridType)
      .get();
	  
	for (const doc of snapshot.docs) {
	  console.log("Checking possible duplicates...");
	  const data = doc.data();
	
	  const samePath = arraysEqual(data.pathCoords || [], currentPath);
	  const sameVisited = arraysEqual(data.visitedBounds || [], currentVisited);
	
	  if (samePath && sameVisited) {
	    alert("⚠️ Déjà sauvegardé !");
	    return;
	  }
	}

    // Nothing found -> Save it
    const docRef = await db.collection("scores").add({
      pseudo,
      score: visitedCount,
      gridType,
      timestamp: igcDate ? firebase.firestore.Timestamp.fromDate(igcDate) : firebase.firestore.FieldValue.serverTimestamp(),
      pathCoords: currentPath,
      visitedBounds: currentVisited
    });

    console.log("Score saved with ID:", docRef.id);

    const badge = document.createElement("div");
    badge.style.position = "abs="olute";
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
      <p>Voulez vous sauvegarder avant de ré-initialiser ?</p>
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
