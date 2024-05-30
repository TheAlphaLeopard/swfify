document.addEventListener("DOMContentLoaded", async () => {
    const ruffle = window.RufflePlayer.newest();
    const player = ruffle.createPlayer();
    const container = document.getElementById("flash-container");
    container.appendChild(player);

    let db;
    const request = indexedDB.open("FlashPlayerDB", 1);
    request.onupgradeneeded = event => {
        db = event.target.result;
        db.createObjectStore("games", { keyPath: "name" });
    };
    request.onsuccess = event => {
        db = event.target.result;
        loadLastGame();
    };
    request.onerror = event => {
        console.error("Database error:", event.target.errorCode);
    };

    async function saveGame(name, data) {
        const transaction = db.transaction("games", "readwrite");
        const store = transaction.objectStore("games");
        const game = { name, data };
        store.put(game);
        transaction.oncomplete = () => console.log("Game saved successfully.");
        transaction.onerror = event => console.error("Error saving game:", event.target.error);
    }

    async function loadGameFromDB(name) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction("games", "readonly");
            const store = transaction.objectStore("games");
            const request = store.get(name);
            request.onsuccess = () => resolve(request.result ? request.result.data : null);
            request.onerror = () => reject(request.error);
        });
    }

    function loadGame(fileData) {
        try {
            const data = new Uint8Array(atob(fileData).split('').map(char => char.charCodeAt(0)));
            player.load({ data });
        } catch (error) {
            console.error("Failed to load the SWF file:", error);
            alert("Failed to load the SWF file. Please try another file.");
        }
    }

    async function loadLastGame() {
        const lastGameName = localStorage.getItem('lastGameName');
        if (lastGameName) {
            const fileData = await loadGameFromDB(lastGameName);
            if (fileData) {
                loadGame(fileData);
                document.title = lastGameName.replace(/\.swf$/i, '');
            }
        }
    }

    async function saveFileToFolder(fileHandle, data) {
        const writableStream = await fileHandle.createWritable();
        await writableStream.write(new Blob([data], { type: 'application/octet-stream' }));
        await writableStream.close();
    }

    async function downloadSwfToFolder() {
        try {
            const gameData = await player.downloadSwf();
            const lastGameName = localStorage.getItem('lastGameName');
            const indexedDBData = await loadGameFromDB(lastGameName);
            const combinedData = new Uint8Array([...gameData, ...indexedDBData]);
            const dirHandle = await window.showDirectoryPicker();
            const fileHandle = await dirHandle.getFileHandle(lastGameName, { create: true });
            await saveFileToFolder(fileHandle, combinedData);
            console.log("SWF file downloaded and saved successfully.");
        } catch (error) {
            console.error("Error downloading and saving the SWF file:", error);
        }
    }

    document.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
            localStorage.removeItem('lastGameName');
            document.getElementById('file-input').click();
        } else if (event.key === 'Tab') {
            await downloadSwfToFolder();
        }
    });

    document.getElementById('file-input').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file && file.name.endsWith('.swf')) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const result = e.target.result;
                    loadGame(btoa(result));
                    const fileName = file.name.replace(/\.swf$/i, '');
                    document.title = fileName;
                    await saveGame(file.name, btoa(result));
                    localStorage.setItem('lastGameName', file.name);
                } catch (error) {
                    console.error("Failed to load the SWF file:", error);
                    alert("Failed to load the SWF file. Please try another file.");
                }
            };
            reader.onerror = (error) => {
                console.error("Error reading the file:", error);
                alert("Error reading the SWF file. Please try again.");
            };
            reader.readAsBinaryString(file);
        }
    });
});
