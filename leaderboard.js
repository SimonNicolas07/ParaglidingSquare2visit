// leaderboard.js
const firebaseConfig = {
  apiKey: "AIzaSyCrzvPBLBF4M3J03xa6VJzcsdvk00vQ7RY",
  authDomain: "paraglidingmeshleaderboard.firebaseapp.com",
  projectId: "paraglidingmeshleaderboard"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let map = L.map('map').setView([46.1, 4.6], 13);
L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
	maxZoom: 20,
	attribution: '<a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases" title="CyclOSM - Open Bicycle render">CyclOSM</a> | Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

let fullData = {}; // Store all leaderboard entries



function renderLeaderboard() {
  const gridFilter = document.getElementById("gridFilter").value;
  const pseudoDropdown = document.getElementById("pseudoDropdown").value.toLowerCase();
  const limit = parseInt(document.getElementById("limitFilter").value);
  const mode = document.getElementById("modeFilter").value;
  const ENtype = document.getElementById("ENtype").value;

  const container = document.getElementById("leaderboard");
  container.innerHTML = "";

  if (mode === "Cumul") {
    renderCumulativeLeaderboard(gridFilter, pseudoDropdown, limit);
    return;
  }


  const filtered = Object.entries(fullData).filter(([gridType]) => {
    return gridFilter === "all" || gridType === gridFilter;
  });

  filtered.forEach(([gridType, entries]) => {
    const filteredEntries = entries
      .filter(e => {
        const pseudoMatch = e.pseudo.toLowerCase().includes(pseudoDropdown);
        const gliderMatch = ENtype === "ALL" || // ok pour tous
                            ENtype.includes(e.paragliderType); // ok pour A si A, A et B si AB etc.
        return pseudoMatch && gliderMatch;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    if (filteredEntries.length) {
      renderTable(filteredEntries, gridType);
    }
  });

  if (!filtered.length) {
    container.innerHTML = "<p>No scores match filters.</p>";
  }
}




async function renderCumulativeLeaderboard(gridFilter, pseudoFilter, limit) {
  const container = document.getElementById("leaderboard");
  container.innerHTML = "<p>Loading cumulative scores...</p>";

  try {
    // Step 1: Get all unique pseudos for this grid
    const snapshot = await db.collection("scores").where("gridType", "==", gridFilter).get();
    const pseudoSet = new Set();

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.pseudo) pseudoSet.add(data.pseudo);
    });

    const pseudos = Array.from(pseudoSet);

    // Step 2: Load visited squares for each pseudo
    const cumulativeEntries = await Promise.all(
      pseudos.map(async pseudo => {
        const visitedDic = await loadAllVisitedSquares(db, pseudo, gridFilter);
        return {
          pseudo,
          score: visitedDic.mergedVisited.size,
          nbFlight: visitedDic.nbFlight,
          visitedSet: Array.from(visitedDic.mergedVisited)  // This is a Set of keys like "lat_lng"
        };
      })
    );

    // Step 3: Filter, sort, and slice the entries
    const filtered = cumulativeEntries
      .filter(entry => entry.pseudo.toLowerCase().includes(pseudoFilter))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Step 4: Render the table
    const section = document.createElement("div");
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th>Rank</th>
        <th>Pseudo</th>
        <th>Nb vol</th>
        <th>Cumulative Score</th>
        <th>Show</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    filtered.forEach((entry, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}</td>
        <td>${entry.pseudo}</td>
        <td>${entry.nbFlight}</td>
        <td>${entry.score}</td>
        <td><button onclick='ShowCumul(${JSON.stringify(entry.visitedSet)})'>📍</button></td>
      `;
      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    section.appendChild(table);
    container.innerHTML = "";
    container.appendChild(section);

  } catch (err) {
    console.error("Error in cumulative leaderboard:", err);
    container.innerHTML = "<p>Error loading cumulative leaderboard.</p>";
  }
}





function renderTable(data, gridType) {
  const container = document.getElementById("leaderboard");
  const section = document.createElement("div");
  section.classList.add("grid-group");

  const tableContainer = document.createElement("div");
  tableContainer.classList.add("table-container");
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Rank</th>
      <th>Pseudo</th>
      <th>EN</th>
      <th>Score</th>
      <th>Date</th>
      <th>Show</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  data.forEach((entry, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}</td>
      <td>${entry.pseudo}</td>
      <td>${entry.paragliderType}</td>
      <td>${entry.score}</td>
      <td>${entry.timestamp?.toDate().toLocaleDateString() || ''}</td>
      <td><button onclick='ThisShowOnMap(${JSON.stringify(entry.visitedBounds)}, ${JSON.stringify(entry.pathCoords)}, ${JSON.stringify(entry.pseudo)})'>📍</button></td>
    `;
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  tableContainer.appendChild(table);
  section.appendChild(table);
  container.appendChild(section);
}



function ThisShowOnMap(bounds, path, pseudo) {
    const currentGridType = document.getElementById("gridFilter").value;
    const squaresChoice = document.getElementById("SquareFilter").value;

    getGridCenterByName(currentGridType).then(center => {
      if (center) {        
        showOnMap(map, bounds, path);
        totalsquares = createGrid(map, center.lat, center.lng) ;
      }
    });
    
    if (squaresChoice == "GreenAndBlue") {
        loadAllVisitedSquares(db, pseudo, currentGridType).then(visitedDic => {
          displayVisitedSquares(L, map, visitedDic.mergedVisited, "blue");
        });
    }

} 


function ShowCumul(visitedSquare) {
    removeSquares(map) ;
    const currentGridType = document.getElementById("gridFilter").value;
    getGridCenterByName(currentGridType).then(center => {
      if (center) {        
        totalsquares = createGrid(map, center.lat, center.lng) ;
      }
    });
    displayVisitedSquares(L, map, visitedSquare, "blue", opacity=0.6);
}



// Fetch and populate leaderboard
function loadLeaderboard() {
  db.collection("scores").get().then(snapshot => {    
      fullData = {};
      const gridSelect = document.getElementById("gridFilter");
      const gridsSeen = new Set(["Fayolle"]); // Fayolle already in HTML, skip it

      snapshot.forEach(doc => {
        const data = doc.data();
        const grid = data.gridType || "Unknown";
        if (!fullData[grid]) fullData[grid] = [];
        fullData[grid].push(data);

      if (!gridsSeen.has(grid) && grid !== "Fayolle") {
        const opt = document.createElement("option");
        opt.value = grid;
        opt.textContent = grid;
        gridSelect.appendChild(opt);
        gridsSeen.add(grid);
      }
      });
      updatePseudoDropdown();
      renderLeaderboard();
    })
    .catch(err => {
      document.getElementById("leaderboard").innerHTML = "<p>Error loading leaderboard.</p>";
      console.error(err);
    }); 
}


function updatePseudoDropdown() {
  const gridFilter = document.getElementById("gridFilter").value;
  const pseudoDropdown = document.getElementById("pseudoDropdown");

  // Clear existing options
  pseudoDropdown.innerHTML = '<option value="">Tous</option>';

  if (fullData[gridFilter]) {
    // Extract unique pseudonyms
    const pseudonyms = [...new Set(fullData[gridFilter].map(entry => entry.pseudo))];

    // Sort pseudonyms alphabetically
    pseudonyms.sort((a, b) => a.localeCompare(b));

    // Populate the dropdown
    pseudonyms.forEach(pseudo => {
      const option = document.createElement("option");
      option.value = pseudo;
      option.textContent = pseudo;
      pseudoDropdown.appendChild(option);
    });
  }
}


// Listen to filters
["gridFilter",  "limitFilter", "modeFilter"].forEach(id => {
  document.getElementById(id).addEventListener("input", renderLeaderboard);
});

document.getElementById("pseudoDropdown").addEventListener("change", (event) => {
  const selectedPseudo = event.target.value;
  document.getElementById("pseudoDropdown").value = selectedPseudo;
  renderLeaderboard();
});


document.getElementById("gridFilter").addEventListener("change", () => {
  renderLeaderboard();
  updatePseudoDropdown();
});


document.getElementById("modeFilter").addEventListener("change", () => {
    renderLeaderboard();
});


document.getElementById("ENtype").addEventListener("change", () => {
    const mode = document.getElementById("modeFilter").value;
    if (mode != "Cumul") {
      renderLeaderboard();
    }    
});

loadLeaderboard();

