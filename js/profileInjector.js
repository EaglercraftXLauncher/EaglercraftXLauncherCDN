/**
 * Standalone EaglercraftX profile injector.
 * Safe to include in plain HTML pages.
 */
async function injectProfilePacket(username, skinPngBase64, isSlimModel) {
  try {
    if (typeof username !== "string" || !username.trim()) throw new Error("username must be a non-empty string");
    if (typeof skinPngBase64 !== "string" || !skinPngBase64.trim()) throw new Error("skinPngBase64 must be a non-empty string");

    const payload = {
      username: username.trim().slice(0, 16),
      skinId: 0,
      skinSlim: Boolean(isSlimModel),
      skinData: normalizeBase64(skinPngBase64),
      updatedAt: Date.now(),
      packetVersion: 1
    };

    const packetBytes = await encodePacket(payload);
    const db = await openEaglerDB();
    await putValue(db, "settings", "p", packetBytes.buffer.slice(packetBytes.byteOffset, packetBytes.byteOffset + packetBytes.byteLength));
    db.close();
    return { ok: true, bytesWritten: packetBytes.byteLength };
  } catch (error) {
    console.error("injectProfilePacket failed", error);
    throw error;
  }
}

function normalizeBase64(input) {
  const base64 = input.trim().replace(/^data:image\/(png|x-png);base64,/i, "").replace(/\s+/g, "");
  const raw = atob(base64);
  if (raw.length < 4 || raw.charCodeAt(0) !== 0x89 || raw.charCodeAt(1) !== 0x50 || raw.charCodeAt(2) !== 0x4e || raw.charCodeAt(3) !== 0x47) {
    throw new Error("skinPngBase64 is not valid PNG base64");
  }
  return base64;
}

async function encodePacket(obj) {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === "function") {
    const gzipStream = new Blob([jsonBytes]).stream().pipeThrough(new CompressionStream("gzip"));
    return new Uint8Array(await new Response(gzipStream).arrayBuffer());
  }
  return jsonBytes;
}

function openEaglerDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("net.lax1dude.eaglercraft.v1", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Failed to open IndexedDB"));
    req.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });
}

function putValue(db, storeName, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IndexedDB write failed"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB write aborted"));
  });
}

window.injectProfilePacket = injectProfilePacket;
