// leaderboard.js
const firebaseConfig = {
      apiKey: "AIzaSyCrzvPBLBF4M3J03xa6VJzcsdvk00vQ7RY",
      authDomain: "paraglidingmeshleaderboard.firebaseapp.com",
      projectId: "paraglidingmeshleaderboard"
    };

    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    const map = L.map('map').setView([46.1, 4.6], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    function renderTable(data, gridType) {
      const container = document.getElementById("leaderboard");
      const section = document.createElement("div");
      section.classList.add("grid-group");

      const title = document.createElement("div");
      title.classList.add("grid-title");
      title.textContent = `Grid: ${gridType}`;
      section.appendChild(title);

      const table = document.createElement("table");
      const thead = document.createElement("thead");
      thead.innerHTML = `
        <tr>
          <th>Rank</th>
          <th>Pseudo</th>
          <th>Score</th>
          <th>Date</th>
          <th>Show</th>
        </tr>
      `;
      table.appendChild(thead);

      const tbody = document.createElement("tbody");

      data.slice(0, 10).forEach((entry, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}</td>
          <td>${entry.pseudo}</td>
          <td>${entry.score}</td>
          <td>${entry.timestamp?.toDate().toLocaleDateString() || ''}</td>
          <td><button onclick='showOnMap(${JSON.stringify(entry.visitedBounds)}, ${JSON.stringify(entry.pathCoords)})'>📍</button></td>
        `;
        tbody.appendChild(row);
      });

      table.appendChild(tbody);
      section.appendChild(table);
      container.appendChild(section);
    }

    function showOnMap(bounds, path) {
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

      if (latLngs.length) {
        map.fitBounds(latLngs);
      }
    }

    db.collection("scores")
      .orderBy("score", "desc")
      .orderBy("timestamp", "desc")
      .get()
      .then(snapshot => {
        document.getElementById("leaderboard").innerHTML = "";

        const dataByGrid = {};
        snapshot.forEach(doc => {
          const data = doc.data();
          const grid = data.gridType || "Unknown";

          if (!dataByGrid[grid]) {
            dataByGrid[grid] = [];
          }
          dataByGrid[grid].push(data);
        });

        Object.entries(dataByGrid).forEach(([gridType, entries]) => {
          renderTable(entries, gridType);
        });

        if (Object.keys(dataByGrid).length === 0) {
          document.getElementById("leaderboard").innerHTML = "<p>No scores yet.</p>";
        }
      })
      .catch(err => {
        document.getElementById("leaderboard").innerHTML = "<p>Error loading leaderboard.</p>";
        console.error(err);
      });
