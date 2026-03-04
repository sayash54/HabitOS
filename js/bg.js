// AMBIENT DATA TRAILS SYSTEM
// A lightweight physics engine for dynamic background energy lines.

const canvas = document.getElementById('ambientCanvas');
const ctx = canvas.getContext('2d');

let particles = [];
let mouse = { x: -1000, y: -1000 };
let particleCount = 40; // Desktop density
let repelRadius = 150;
let connectionDistance = 180;

// Configuration based on screen size
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Scale density for mobile
    if (window.innerWidth < 600) {
        particleCount = 20;
        repelRadius = 100;
        connectionDistance = 120;
    } else {
        particleCount = 50;
        repelRadius = 180;
        connectionDistance = 200;
    }

    initParticles();
}

window.addEventListener('resize', resizeCanvas);

// Mouse & Touch Tracking
window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

// Move vectors away smoothly on mobile drag
window.addEventListener('touchmove', (e) => {
    mouse.x = e.touches[0].clientX;
    mouse.y = e.touches[0].clientY;
}, { passive: true });

// Reset mouse interaction when leaving window
window.addEventListener('mouseout', () => {
    mouse.x = -1000;
    mouse.y = -1000;
});
window.addEventListener('touchend', () => {
    mouse.x = -1000;
    mouse.y = -1000;
});

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.baseX = this.x;
        this.baseY = this.y;

        // Random drift vectors
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 0.4 + 0.1;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        this.size = Math.random() * 1.5 + 0.5;
    }

    update() {
        // Natural drift
        this.x += this.vx;
        this.y += this.vy;

        // Bounce off invisible screen boundaries
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;

        // Repulsion Engine
        let dx = mouse.x - this.x;
        let dy = mouse.y - this.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < repelRadius) {
            // Force vector pushes the particle strictly away from the mouse
            let forceDirectionX = dx / distance;
            let forceDirectionY = dy / distance;

            // Stronger force closer to the mouse
            let forceRatio = (repelRadius - distance) / repelRadius;
            let forceMultiplier = forceRatio * 3;

            this.x -= forceDirectionX * forceMultiplier;
            this.y -= forceDirectionY * forceMultiplier;
        }
    }

    draw(r, g, b) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.3)`;
        ctx.fill();
    }
}

function initParticles() {
    particles = [];
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
}

function getThemeColors() {
    // Read the dynamically injected CSS variables from ui.js
    const style = getComputedStyle(document.documentElement);
    let r = style.getPropertyValue('--accent-r').trim();
    let g = style.getPropertyValue('--accent-g').trim();
    let b = style.getPropertyValue('--accent-b').trim();

    // Fallback securely to default OLED Red if variables aren't injected yet
    if (!r || !g || !b) {
        return { r: 255, g: 46, b: 99 };
    }
    return { r, g, b };
}

function animate() {
    requestAnimationFrame(animate);

    // Erase frame entirely
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const theme = getThemeColors();

    // 1. Update and draw nodes
    particles.forEach(p => {
        p.update();
        p.draw(theme.r, theme.g, theme.b);
    });

    // 2. Draw Data Lines (Constellation connection logic)
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            let dx = particles[i].x - particles[j].x;
            let dy = particles[i].y - particles[j].y;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < connectionDistance) {
                // Opacity fades gracefully as line gets longer
                let opacity = 1 - (distance / connectionDistance);
                // Lower overall opacity so it remains a subtle background
                opacity *= 0.15;

                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.strokeStyle = `rgba(${theme.r}, ${theme.g}, ${theme.b}, ${opacity})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    }
}

// Boot the Engine
// Wait slightly so variables are injected
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        resizeCanvas();
        animate();
    }, 100);
});
