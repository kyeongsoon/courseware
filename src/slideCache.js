// 슬라이드 그림을 이 기기 브라우저(IndexedDB)에 보관해서, 같은 슬라이드를 다시 볼 때
// 서버에서 또 받지 않게 함 (Firebase 무료 전송량 절약).
// 슬라이드를 새로 올리면 slidesVersion 이 바뀌므로 예전 것은 쓰이지 않음.
// 저장이 안 되는 환경(사생활 보호 모드 등)에서는 그냥 서버에서 받음.

const DB_NAME = 'courseware-cache';
const STORE = 'slides';
const MAX_DECKS = 40; // 이보다 많아지면 오래 안 본 것부터 지움

let dbPromise = null;
function openDb() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('no indexedDB'));
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((e) => {
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}

function run(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const result = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(result?.result ?? result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export const deckKey = (lessonId, version) => `${lessonId}@${version}`;

export async function getDeck(key) {
  try {
    const hit = await run('readonly', (s) => s.get(key));
    if (!hit) return null;
    run('readwrite', (s) => s.put({ ...hit, usedAt: Date.now() }, key)).catch(() => {});
    return hit.slides;
  } catch {
    return null;
  }
}

export async function putDeck(key, slides) {
  try {
    await run('readwrite', (s) => s.put({ slides, usedAt: Date.now() }, key));
    await prune(key);
  } catch {
    /* 저장 공간이 없거나 막힌 환경: 다음에 서버에서 다시 받음 */
  }
}

// 같은 차시의 예전 버전은 지우고, 전체가 너무 많으면 오래 안 본 것부터 지움
async function prune(keepKey) {
  const lessonPrefix = keepKey.split('@')[0] + '@';
  const all = await run('readonly', (s) => {
    const out = [];
    s.openCursor().onsuccess = (e) => {
      const c = e.target.result;
      if (c) {
        out.push({ key: c.key, usedAt: c.value.usedAt ?? 0 });
        c.continue();
      }
    };
    return out;
  });
  const stale = all.filter((d) => d.key !== keepKey && d.key.startsWith(lessonPrefix)).map((d) => d.key);
  const rest = all.filter((d) => !stale.includes(d.key)).sort((a, b) => b.usedAt - a.usedAt);
  const extra = rest.slice(MAX_DECKS).map((d) => d.key);
  if (stale.length || extra.length) await run('readwrite', (s) => [...stale, ...extra].forEach((k) => s.delete(k)));
}
