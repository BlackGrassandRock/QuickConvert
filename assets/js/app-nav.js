/* ============================================================
   app-nav.js
   Navbar behavior: active links, in-page smooth scrolling,
   mobile collapse handling
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    const nav = document.querySelector(".navbar");
    const navLinks = document.querySelectorAll(".navbar-nav .nav-link");
    const collapseEl = document.getElementById("mainNavbar");


    // Лёгкий эффект для навбара при скролле
    if (nav) {
        const toggleScrolled = () => {
            const threshold = 8; // пикселей
            if (window.scrollY > threshold) {
                nav.classList.add("navbar-scrolled");
            } else {
                nav.classList.remove("navbar-scrolled");
            }
        };

        toggleScrolled(); // вызвать один раз на загрузке
        window.addEventListener("scroll", toggleScrolled);
    }


    // Helper: collapse navbar on mobile (after click)
    function collapseNavbarIfNeeded() {
        if (!collapseEl) return;
        if (!collapseEl.classList.contains("show")) return;

        // Use Bootstrap's Collapse if available
        if (typeof bootstrap !== "undefined" && bootstrap.Collapse) {
            const instance =
                bootstrap.Collapse.getInstance(collapseEl) ||
                new bootstrap.Collapse(collapseEl, { toggle: false });
            instance.hide();
        } else {
            // Fallback: just remove "show" class
            collapseEl.classList.remove("show");
        }
    }

    // Helper: set active link by href (used as fallback if no .active in markup)
    function setActiveByPath() {
        const currentPath = window.location.pathname.split("/").pop() || "index.html";
        const currentHash = window.location.hash;

        let hasActive = false;
        navLinks.forEach((link) => {
            if (link.classList.contains("active")) {
                hasActive = true;
            }
        });

        // If HTML уже сам расставил .active — не трогаем
        if (hasActive) return;

        navLinks.forEach((link) => {
            const href = link.getAttribute("href") || "";
            link.classList.remove("active");

            // Exact page match (e.g. "webp-converter.html")
            if (href === currentPath || href === currentPath + currentHash) {
                link.classList.add("active");
            }

            // Index + hash case (e.g. "index.html#png-jpg")
            if (
                currentPath === "index.html" &&
                currentHash &&
                (href === currentHash || href === "index.html" + currentHash)
            ) {
                link.classList.add("active");
            }
        });
    }

    // Helper: smooth scroll to section with offset for fixed navbar
    function scrollToSection(sectionId) {
        const target = document.getElementById(sectionId);
        if (!target) return;

        const navHeight = nav ? nav.offsetHeight : 0;
        const rect = target.getBoundingClientRect();
        const offset = rect.top + window.pageYOffset - navHeight - 8;

        window.scrollTo({
            top: offset,
            behavior: "smooth"
        });
    }

    // Attach click handlers to nav links
    navLinks.forEach((link) => {
        const href = link.getAttribute("href") || "";

        // In-page anchor (#section) on the same page
        if (href.startsWith("#")) {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                const id = href.substring(1);
                scrollToSection(id);
                collapseNavbarIfNeeded();
            });
        } else if (href.includes("#")) {
            // Links like "index.html#png-jpg" – only intercept if we stay on same page
            link.addEventListener("click", (e) => {
                const [path, hash] = href.split("#");
                const currentPath = window.location.pathname.split("/").pop() || "index.html";

                if (path === "" || path === currentPath) {
                    e.preventDefault();
                    if (hash) {
                        scrollToSection(hash);
                    }
                    collapseNavbarIfNeeded();
                }
                // иначе даём обычную навигацию на другую страницу
            });
        } else {
            // Plain link to another page – просто схлопываем меню на мобиле
            link.addEventListener("click", () => {
                collapseNavbarIfNeeded();
            });
        }
    });

    // Basic "active link" fallback, если на странице нет явного .active в HTML
    setActiveByPath();

    // Optional: simple scrollspy for pages with in-page sections
    const sections = document.querySelectorAll("section[id]");
    if (sections.length > 0) {
        window.addEventListener("scroll", () => {
            const scrollPos = window.scrollY;
            const navHeight = nav ? nav.offsetHeight : 0;
            let currentId = null;

            sections.forEach((section) => {
                const rect = section.getBoundingClientRect();
                const sectionTop = rect.top + window.pageYOffset - navHeight - 40;

                if (scrollPos >= sectionTop) {
                    currentId = section.id;
                }
            });

            if (currentId) {
                navLinks.forEach((link) => {
                    const href = link.getAttribute("href") || "";
                    const isSamePageAnchor =
                        href === "#" + currentId ||
                        href === window.location.pathname.split("/").pop() + "#" + currentId;

                    if (isSamePageAnchor) {
                        link.classList.add("active");
                    } else if (href.startsWith("#")) {
                        // Сбрасываем active только для якорных ссылок текущей страницы
                        link.classList.remove("active");
                    }
                });
            }
        });
    }
});
