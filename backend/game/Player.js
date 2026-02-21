class Player {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.x = Math.random() * 800;
    this.y = Math.random() * 600;
    this.radius = 15;
    this.color = this.generateColor();
    this.vx = 0;
    this.vy = 0;
    this.speed = 5;
    this.score = 0;
    this.territory = [];
  }

  generateColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  update() {
    // Update position based on velocity
    this.x += this.vx;
    this.y += this.vy;

    // Boundary collision
    if (this.x - this.radius < 0) this.x = this.radius;
    if (this.x + this.radius > 800) this.x = 800 - this.radius;
    if (this.y - this.radius < 0) this.y = this.radius;
    if (this.y + this.radius > 600) this.y = 600 - this.radius;
  }

  setDirection(direction) {
    this.vx = 0;
    this.vy = 0;

    if (direction.up) this.vy = -this.speed;
    if (direction.down) this.vy = this.speed;
    if (direction.left) this.vx = -this.speed;
    if (direction.right) this.vx = this.speed;
  }

  getState() {
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      radius: this.radius,
      color: this.color,
      score: this.score,
    };
  }
}

export default Player;
