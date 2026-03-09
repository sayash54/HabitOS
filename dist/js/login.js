import { loginWithGoogle, loginWithGithub } from './supabase-config.js';

document.addEventListener("DOMContentLoaded", () => {
    const loginScreen = document.getElementById("loginScreen");
    if (!loginScreen) return;

    const bentoCard = document.getElementById("loginCard");
    const ctaBtn = document.getElementById("loginCta");
    const welcomeText = document.getElementById("welcomeText");
    const mainApp = document.querySelector(".app");
    const shatterCanvas = document.getElementById("shatterCanvas");

    const authModal = document.getElementById("authModal");
    const closeAuthModalBtn = document.getElementById("closeAuthModal");
    const googleLoginBtn = document.getElementById("googleLoginBtn");
    const githubLoginBtn = document.getElementById("githubLoginBtn");
    const portalLoading = document.getElementById("portalLoading");

    // Dynamic Welcome Text
    const phrases = ["Ready to Level Up, Yash?", "Enter the Discipline Zone.", "Initiate Sequence.", "Welcome Back, Commander."];
    welcomeText.textContent = phrases[Math.floor(Math.random() * phrases.length)];

    // Entrance Animation (GSAP)
    gsap.fromTo(bentoCard,
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 1.2, ease: "elastic.out(1, 0.4)", delay: 0.2 }
    );

    // Stagger login buttons entry
    gsap.fromTo(document.querySelectorAll('.social-btn'),
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, stagger: 0.1, ease: "back.out(1.7)", delay: 0.5 }
    );

    const startPortalLoading = (providerName) => {
        if (portalLoading) {
            portalLoading.style.display = "flex";
            void portalLoading.offsetWidth;
            portalLoading.style.opacity = "1";
            portalLoading.querySelector("p").innerText = `AUTHENTICATING VIA ${providerName}...`;
        }
    };

    if (googleLoginBtn) {
        googleLoginBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            startPortalLoading("GOOGLE");
            try {
                await loginWithGoogle();
            } catch (err) {
                if (portalLoading) portalLoading.style.opacity = "0";
                setTimeout(() => portalLoading.style.display = "none", 500);
                alert("Login Failed: " + (err.message || "Please check your Supabase Auth settings."));
            }
        });
    }

    if (githubLoginBtn) {
        githubLoginBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            startPortalLoading("GITHUB");
            try {
                await loginWithGithub();
            } catch (err) {
                if (portalLoading) portalLoading.style.opacity = "0";
                setTimeout(() => portalLoading.style.display = "none", 500);
                alert("Login Failed: " + (err.message || "Please check your Supabase Auth settings."));
            }
        });
    }
});
