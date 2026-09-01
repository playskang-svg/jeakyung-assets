import { useEffect, useRef } from 'react';

// 히어로 배경. 예전에는 사람이 배달하는 영상이었는데, 물류 회사가 파는 것은
// 배달하는 장면이 아니라 "어디서 어디로 무엇이 언제 움직이는가"를 다루는 능력이다.
// 그래서 거점과 경로, 그 위를 지나는 화물만 그린다. 사람도 기계도 나오지 않는다.
//
// 영상 파일 대신 캔버스로 그리는 이유:
//  - 1.5MB 를 받지 않아도 되고, 코덱을 못 읽는 기기가 없다
//  - 브랜드 색을 그대로 쓰므로 화면 나머지와 어긋나지 않는다

// 거점. 화면 비율(0~1)로 두어 어떤 폭에서도 구도가 유지된다.
// 왼쪽은 제목이 덮으므로 굵은 거점은 가운데 오른쪽에 몰아 둔다.
const NODES = [
  { x: 0.10, y: 0.26, size: 2.2 },
  { x: 0.22, y: 0.66, size: 1.8 },
  { x: 0.38, y: 0.18, size: 2.6 },
  { x: 0.44, y: 0.78, size: 2.2 },
  { x: 0.60, y: 0.42, size: 4.0 }, // 중심 거점
  { x: 0.71, y: 0.15, size: 2.4 },
  { x: 0.76, y: 0.72, size: 2.8 },
  { x: 0.88, y: 0.33, size: 2.6 },
  { x: 0.94, y: 0.62, size: 2.0 },
];

// 경로. [출발, 도착, 휘는 정도, 화물이 한 바퀴 도는 데 걸리는 초]
// 주기를 3~6초로 짧게 둬야 한눈에 "움직이는 화면"으로 읽힌다.
const ROUTES = [
  [0, 4, -0.18, 5.4],
  [2, 4, -0.12, 4.2],
  [1, 4, 0.14, 5.8],
  [3, 4, 0.10, 4.8],
  [4, 5, -0.16, 3.6],
  [4, 6, 0.12, 3.2],
  [4, 7, -0.10, 5.0],
  [6, 8, -0.14, 3.8],
  [5, 7, 0.16, 4.4],
  [2, 5, 0.10, 6.0],
  [3, 6, -0.12, 4.6],
];

// 두 점 사이를 부드럽게 잇는 이차 베지어의 제어점. bend 만큼 옆으로 밀어 곡선을 만든다.
function controlPoint(ax, ay, bx, by, bend) {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  return [mx - (by - ay) * bend, my + (bx - ax) * bend];
}

function pointOnCurve(ax, ay, cx, cy, bx, by, t) {
  const u = 1 - t;
  return [
    u * u * ax + 2 * u * t * cx + t * t * bx,
    u * u * ay + 2 * u * t * cy + t * t * by,
  ];
}

export default function HeroNetwork() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d');
    if (!context) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let running = true;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    // 경로 하나의 좌표를 매번 다시 계산하지 않도록 한 번에 풀어 둔다.
    const geometryOf = (route) => {
      const a = NODES[route[0]];
      const b = NODES[route[1]];
      const ax = a.x * width;
      const ay = a.y * height;
      const bx = b.x * width;
      const by = b.y * height;
      const [cx, cy] = controlPoint(ax, ay, bx, by, route[2]);
      return { ax, ay, cx, cy, bx, by };
    };

    const draw = (elapsed) => {
      context.clearRect(0, 0, width, height);
      context.lineCap = 'round';

      // 경로
      for (const route of ROUTES) {
        const { ax, ay, cx, cy, bx, by } = geometryOf(route);
        context.beginPath();
        context.moveTo(ax, ay);
        context.quadraticCurveTo(cx, cy, bx, by);
        context.strokeStyle = 'rgba(130, 160, 255, 0.30)';
        context.lineWidth = 1;
        context.stroke();
      }

      // 화물이 도착할 때 퍼지는 파동. 도착 직후 구간만 그리므로 따로 상태를 두지 않는다.
      for (const route of ROUTES) {
        const [from, to, , period] = route;
        const { bx, by } = geometryOf(route);
        const offset = (from * 0.37 + to * 0.21) % 1;
        const t = ((elapsed / period) + offset) % 1;
        if (t > 0.22) continue;
        const wave = t / 0.22;
        context.beginPath();
        context.arc(bx, by, 4 + wave * 26, 0, Math.PI * 2);
        context.strokeStyle = `rgba(150, 185, 255, ${(1 - wave) * 0.34})`;
        context.lineWidth = 1.2;
        context.stroke();
      }

      // 경로 위를 지나는 화물
      for (const route of ROUTES) {
        const [from, to, , period] = route;
        const { ax, ay, cx, cy, bx, by } = geometryOf(route);

        // 경로마다 출발 시각을 어긋나게 두어 한꺼번에 몰리지 않게 한다.
        const offset = (from * 0.37 + to * 0.21) % 1;
        const t = ((elapsed / period) + offset) % 1;
        const [px, py] = pointOnCurve(ax, ay, cx, cy, bx, by, t);

        // 꼬리: 지나온 쪽으로 옅게 이어 붙여 진행 방향이 읽히게 한다.
        const tailT = Math.max(0, t - 0.14);
        const [tx, ty] = pointOnCurve(ax, ay, cx, cy, bx, by, tailT);
        const tail = context.createLinearGradient(tx, ty, px, py);
        tail.addColorStop(0, 'rgba(130, 160, 255, 0)');
        tail.addColorStop(1, 'rgba(170, 205, 255, 0.85)');
        context.beginPath();
        context.moveTo(tx, ty);
        context.lineTo(px, py);
        context.strokeStyle = tail;
        context.lineWidth = 2;
        context.stroke();

        const spark = context.createRadialGradient(px, py, 0, px, py, 9);
        spark.addColorStop(0, 'rgba(214, 230, 255, 0.9)');
        spark.addColorStop(1, 'rgba(130, 160, 255, 0)');
        context.beginPath();
        context.arc(px, py, 9, 0, Math.PI * 2);
        context.fillStyle = spark;
        context.fill();

        context.beginPath();
        context.arc(px, py, 2.4, 0, Math.PI * 2);
        context.fillStyle = 'rgba(236, 243, 255, 0.98)';
        context.fill();
      }

      // 거점
      for (const [index, node] of NODES.entries()) {
        const nx = node.x * width;
        const ny = node.y * height;
        // 거점마다 조금씩 다른 속도로 숨 쉬듯 밝기가 오간다.
        const pulse = 0.5 + 0.5 * Math.sin(elapsed * 1.1 + index * 1.7);

        const glow = context.createRadialGradient(nx, ny, 0, nx, ny, node.size * 8);
        glow.addColorStop(0, `rgba(130, 160, 255, ${0.3 + pulse * 0.22})`);
        glow.addColorStop(1, 'rgba(130, 160, 255, 0)');
        context.beginPath();
        context.arc(nx, ny, node.size * 8, 0, Math.PI * 2);
        context.fillStyle = glow;
        context.fill();

        // 큰 거점에는 테두리를 둘러 중심이라는 것이 보이게 한다.
        if (node.size >= 2.6) {
          context.beginPath();
          context.arc(nx, ny, node.size * 3, 0, Math.PI * 2);
          context.strokeStyle = `rgba(160, 190, 255, ${0.18 + pulse * 0.2})`;
          context.lineWidth = 1;
          context.stroke();
        }

        context.beginPath();
        context.arc(nx, ny, node.size, 0, Math.PI * 2);
        context.fillStyle = `rgba(226, 236, 255, ${0.8 + pulse * 0.2})`;
        context.fill();
      }
    };

    resize();

    if (reduceMotion) {
      // 움직임을 줄인 기기에서는 한 장면만 그려 두고 끝낸다.
      draw(2.4);
      const onResize = () => { resize(); draw(2.4); };
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }

    const start = performance.now();
    const tick = (now) => {
      if (!running) return;
      draw((now - start) / 1000);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);

    // 배경으로 넘어가면 멈춘다. 보이지 않는 화면을 계속 그릴 이유가 없다.
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        window.cancelAnimationFrame(frame);
      } else if (!running) {
        running = true;
        frame = window.requestAnimationFrame(tick);
      }
    };

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="hero-network" aria-hidden="true" />;
}
