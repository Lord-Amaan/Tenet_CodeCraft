class Player {
  constructor(id, name, spawnX, spawnY, cols, rows, colorIndex) {
    this.id = id;
    this.name = name;
    this.x = spawnX;
    this.y = spawnY;
    this.dir = { x: 1, y: 0 };
    this.cols = cols;
    this.rows = rows;
    this.colorIndex = colorIndex;

    this.owned = new Set();
    this.trail = new Set();
    this.score = 0;
    this.dead = false;
    this.kills = 0;
    this.deaths = 0;

    this._initBase(spawnX, spawnY);
  }

  _initBase(cx, cy) {
    this.owned.clear();
    this.trail.clear();
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
          this.owned.add(`${x},${y}`);
        }
      }
    }
    this.score = this.owned.size;
  }

  setDirection(dir) {
    if (this.dead) return;
    if (!dir || (dir.x === 0 && dir.y === 0)) return;
    // Don't allow 180-degree reversal
    if (dir.x === -this.dir.x && dir.y === -this.dir.y) return;
    this.dir = { x: dir.x, y: dir.y };
  }

  respawn(spawnX, spawnY) {
    this.x = spawnX;
    this.y = spawnY;
    this.dir = { x: 1, y: 0 };
    this.dead = false;
    this.trail.clear();
    this._initBase(spawnX, spawnY);
  }

  getState() {
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      dir: this.dir,
      owned: Array.from(this.owned),
      trail: Array.from(this.trail),
      score: this.score,
      dead: this.dead,
      kills: this.kills,
      deaths: this.deaths,
      colorIndex: this.colorIndex,
    };
  }
}

export default Player;
