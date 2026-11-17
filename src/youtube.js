// YouTube IFrame Player API 를 한 번만 불러옴. (이미 window.YT 가 있으면 그대로 사용)
let ytPromise = null;

export function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytPromise) {
    ytPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(window.YT);
      };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.onerror = () => {
        ytPromise = null;
        reject(new Error('YouTube를 불러오지 못했어요. 학교 인터넷에서 YouTube가 막혀 있을 수 있어요.'));
      };
      document.head.appendChild(s);
    });
  }
  return ytPromise;
}

export const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 };
