// Tomato pixel sprite: shared by the app (browser) and tools/make-icon.js (node).
(function (root) {
  var SIZE = 32;

  var PAL = {
    o: '#3b1424', // outline
    R: '#a3203a', // red shadow
    r: '#e8434f', // red
    l: '#ff7f6e', // red light
    h: '#ffd3c4', // highlight
    D: '#1e6b3c', // leaf dark
    G: '#3faf5a', // leaf
    L: '#9be57c', // leaf light
    S: '#5b8a2e', // stem
    e: '#2a0f1c', // eye
    w: '#ffffff', // eye shine
    b: '#ff9fb8'  // blush
  };

  // calyx + stem, 20 wide, placed at column 6, row 1
  var LEAF = [
    '..........SS........',
    '.........SS.........',
    '.........SS.........',
    '.........SS.........',
    '..LG.....SS.....GL..',
    '...GGG..GSSG..GGG...',
    '....GGGGGGGGGGGG....',
    '..GGGGLGGGGGGLGGGG..',
    '.GGG..GGDGGDGG..GGG.',
    '.D.....GD..DG.....D.',
    '........D..D........'
  ];

  function build() {
    var g = [];
    for (var y = 0; y < SIZE; y++) g.push(new Array(SIZE).fill(null));

    var cx = 15.5, cy = 19.5, rx = 14.6, ry = 11.4;
    for (var y2 = 0; y2 < SIZE; y2++) {
      for (var x = 0; x < SIZE; x++) {
        var nx = (x + 0.5 - cx) / rx, ny = (y2 + 0.5 - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        var c = 'r';
        if (nx * 0.8 + ny > 0.62) c = 'R';
        else if (Math.hypot(nx + 0.45, ny + 0.4) < 0.33) c = 'l';
        g[y2][x] = c;
      }
    }
    // specular shine
    [[7, 12], [8, 12], [6, 13], [6, 14]].forEach(function (p) { g[p[1]][p[0]] = 'h'; });

    // leaves on top
    LEAF.forEach(function (row, j) {
      for (var i = 0; i < row.length; i++) {
        if (row[i] !== '.') g[1 + j][6 + i] = row[i];
      }
    });

    // body pixels touching leaves get a shadow (depth under the calyx)
    var isLeaf = function (x, y) { var c = g[y] && g[y][x]; return c === 'G' || c === 'D' || c === 'L' || c === 'S'; };
    for (var y3 = 0; y3 < SIZE; y3++) {
      for (var x3 = 0; x3 < SIZE; x3++) {
        var c3 = g[y3][x3];
        if ((c3 === 'r' || c3 === 'l') && isLeaf(x3, y3 - 1)) g[y3][x3] = 'R';
      }
    }

    // outline around everything
    var out = g.map(function (r) { return r.slice(); });
    for (var y4 = 0; y4 < SIZE; y4++) {
      for (var x4 = 0; x4 < SIZE; x4++) {
        if (g[y4][x4]) continue;
        var n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) {
          var yy = y4 + d[1], xx = x4 + d[0];
          return yy >= 0 && yy < SIZE && xx >= 0 && xx < SIZE && g[yy][xx];
        });
        if (n) out[y4][x4] = 'o';
      }
    }
    return out;
  }

  // Face overlay per mood. Coordinates are sprite pixels.
  function face(mood) {
    var px = [];
    var add = function (x, y, c) { px.push([x, y, c]); };
    var eyes = function (fn) { fn(10); fn(20); };
    if (mood === 'blink' || mood === 'sleep') {
      eyes(function (x) { add(x, 21, 'e'); add(x + 1, 21, 'e'); });
    } else if (mood === 'happy') {
      eyes(function (x) { add(x, 20, 'e'); add(x + 1, 19, 'e'); add(x + 2, 20, 'e'); });
    } else {
      eyes(function (x) {
        add(x, 19, 'w'); add(x + 1, 19, 'e');
        add(x, 20, 'e'); add(x + 1, 20, 'e');
        add(x, 21, 'e'); add(x + 1, 21, 'e');
      });
    }
    // blush
    [7, 8, 22, 23].forEach(function (x) { add(x, 23, 'b'); });
    // mouth
    if (mood === 'happy') {
      add(14, 23, 'e'); add(15, 23, 'e'); add(16, 23, 'e'); add(17, 23, 'e');
      add(15, 24, 'e'); add(16, 24, 'e');
    } else if (mood === 'sleep') {
      add(15, 24, 'e'); add(16, 24, 'e');
    } else if (mood === 'sad') {
      add(14, 24, 'e'); add(15, 23, 'e'); add(16, 23, 'e'); add(17, 24, 'e');
    } else {
      add(14, 23, 'e'); add(15, 24, 'e'); add(16, 24, 'e'); add(17, 23, 'e');
    }
    return px;
  }

  // Deterministic "ripening" order: bottom rows first, a little jitter.
  function paintOrder(grid) {
    var seed = 20240927;
    var rnd = function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    var list = [];
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        if (grid[y][x]) list.push({ x: x, y: y, k: -y + rnd() * 4 });
      }
    }
    list.sort(function (a, b) { return a.k - b.k; });
    return list.map(function (p) { return [p.x, p.y]; });
  }

  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(a, b, t) {
    var A = hex(a), B = hex(b);
    return 'rgb(' + A.map(function (v, i) { return Math.round(v + (B[i] - v) * t); }).join(',') + ')';
  }

  var api = { SIZE: SIZE, PAL: PAL, build: build, face: face, paintOrder: paintOrder, mix: mix, hex: hex };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Sprite = api;
})(this);
