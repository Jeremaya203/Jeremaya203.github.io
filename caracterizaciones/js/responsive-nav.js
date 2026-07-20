(function () {
  function initResponsiveNav() {
    const toggleButton = document.querySelector(".nav-bar-toggle-igac");
    const accountLinks = document.getElementById("link-list");
    const modulesScroll = document.querySelector(".modulos-scroll");
    const navigationQuery = window.matchMedia("(max-width: 768px)");
    const compactLayoutQuery = window.matchMedia("(max-width: 1024px)");

    function listenToMediaQuery(query, listener) {
      if (typeof query.addEventListener === "function") {
        query.addEventListener("change", listener);
      } else {
        query.addListener(listener);
      }
    }

    function createPlaceholder(element, label) {
      if (!element || element.__ctResponsivePlaceholder) {
        return element?.__ctResponsivePlaceholder || null;
      }

      const placeholder = document.createComment(`ct-placeholder-${label}`);
      element.parentNode.insertBefore(placeholder, element);
      element.__ctResponsivePlaceholder = placeholder;
      return placeholder;
    }

    function restoreElement(element) {
      const placeholder = element?.__ctResponsivePlaceholder;
      if (placeholder?.parentNode) {
        placeholder.parentNode.insertBefore(element, placeholder.nextSibling);
      }
    }

    function closeAllModuleMenus() {
      document.querySelectorAll(".modulo-dropdown.open, .modulo-dropdown.ct-touch-open")
        .forEach((dropdown) => {
          dropdown.classList.remove("open", "ct-touch-open");
          dropdown.querySelector(":scope > .modulo-card-trigger, :scope > .modulo-card")
            ?.setAttribute("aria-expanded", "false");
        });

      document.querySelectorAll(".dropdown-item-with-sub.ct-submenu-open")
        .forEach((group) => {
          group.classList.remove("ct-submenu-open");
          group.querySelector(":scope > .dropdown-item")?.setAttribute("aria-expanded", "false");
        });
    }

    function createMobileControlsDock() {
      const toolbar = document.querySelector(".territorial-toolbar");
      const sideActions = document.querySelector(".ordenamiento-side-actions");
      if (!modulesScroll || (!toolbar && !sideActions)) return null;

      let dock = document.querySelector(".ct-mobile-controls");
      if (!dock) {
        dock = document.createElement("section");
        dock.className = "ct-mobile-controls";
        dock.setAttribute("aria-label", "Consulta territorial");
        modulesScroll.insertAdjacentElement("afterend", dock);
      }

      const movableElements = [toolbar, sideActions].filter(Boolean);
      movableElements.forEach((element) => createPlaceholder(element, element.className));

      const syncDock = () => {
        movableElements.forEach((element) => {
          if (compactLayoutQuery.matches) dock.appendChild(element);
          else restoreElement(element);
        });
        document.body.classList.toggle("ct-mobile-layout", compactLayoutQuery.matches);
      };

      syncDock();
      listenToMediaQuery(compactLayoutQuery, syncDock);
      return dock;
    }

    function markCurrentModule() {
      const fileName = (window.location.pathname.split("/").pop() || "").toLowerCase();
      const currentByFile = {
        "biofisico.html": "biofisicoDropdown",
        "contexto.html": "legalDropdown",
        "limites.html": "limitesDropdown",
        "ocupacion.html": "ocupacionDropdown",
        "ordenamiento.html": "ordenamientoDropdown",
        "socioeconomico.html": "socioeconomicoDropdown"
      };
      const current = document.getElementById(currentByFile[fileName]);
      if (!current) return;
      current.classList.add("ct-current-module");
      current.querySelector(":scope > .modulo-card-trigger, :scope > .modulo-card")
        ?.setAttribute("aria-current", "page");
    }

    function createMobileDrawer() {
      if (!toggleButton || !accountLinks || !modulesScroll) return null;

      createPlaceholder(accountLinks, "account-links");
      createPlaceholder(modulesScroll, "modules-scroll");

      const backdrop = document.createElement("button");
      backdrop.type = "button";
      backdrop.className = "ct-mobile-backdrop";
      backdrop.setAttribute("aria-label", "Cerrar menu de navegacion");
      backdrop.tabIndex = -1;

      const drawer = document.createElement("aside");
      drawer.id = "ct-mobile-drawer";
      drawer.className = "ct-mobile-drawer";
      drawer.setAttribute("aria-label", "Navegacion principal");
      drawer.setAttribute("aria-hidden", "true");

      const drawerHeader = document.createElement("div");
      drawerHeader.className = "ct-mobile-drawer-header";
      drawerHeader.innerHTML = [
        '<div class="ct-mobile-drawer-brand">',
        '  <span class="ct-mobile-drawer-symbol" aria-hidden="true"></span>',
        '  <span><strong>Caracterizaciones</strong><small>Territoriales</small></span>',
        '</div>',
        '<button class="ct-mobile-drawer-close" type="button" aria-label="Cerrar menu">',
        '  <span aria-hidden="true"></span>',
        '</button>'
      ].join("");

      const drawerBody = document.createElement("div");
      drawerBody.className = "ct-mobile-drawer-body";

      const quickTitle = document.createElement("p");
      quickTitle.className = "ct-mobile-drawer-label";
      quickTitle.textContent = "Acceso rapido";

      const modulesTitle = document.createElement("p");
      modulesTitle.className = "ct-mobile-drawer-label ct-mobile-drawer-label--modules";
      modulesTitle.textContent = "Componentes territoriales";

      drawerBody.append(quickTitle, accountLinks, modulesTitle, modulesScroll);
      drawer.append(drawerHeader, drawerBody);
      document.body.append(backdrop, drawer);

      const closeButton = drawer.querySelector(".ct-mobile-drawer-close");

      const syncAccountLinkColors = (mobile) => {
        accountLinks.querySelectorAll("a, a *").forEach((element) => {
          if (mobile) {
            if (!element.hasAttribute("data-ct-original-color")) {
              element.setAttribute("data-ct-original-color", element.style.getPropertyValue("color"));
              element.setAttribute(
                "data-ct-original-color-priority",
                element.style.getPropertyPriority("color")
              );
            }
            element.style.removeProperty("color");
          } else if (element.hasAttribute("data-ct-original-color")) {
            const color = element.getAttribute("data-ct-original-color");
            const priority = element.getAttribute("data-ct-original-color-priority") || "";
            if (color) element.style.setProperty("color", color, priority);
            else element.style.removeProperty("color");
          }
        });
      };

      const setOpen = (open, returnFocus) => {
        const shouldOpen = Boolean(open && navigationQuery.matches);
        document.body.classList.toggle("ct-mobile-nav-open", shouldOpen);
        toggleButton.setAttribute("aria-expanded", String(shouldOpen));
        drawer.setAttribute("aria-hidden", String(!shouldOpen));
        backdrop.setAttribute("aria-hidden", String(!shouldOpen));

        if (!shouldOpen) {
          closeAllModuleMenus();
          if (returnFocus) toggleButton.focus({ preventScroll: true });
        } else {
          window.requestAnimationFrame(() => closeButton?.focus({ preventScroll: true }));
        }
      };

      const syncDrawer = () => {
        if (navigationQuery.matches) {
          drawerBody.append(quickTitle, accountLinks, modulesTitle, modulesScroll);
          syncAccountLinkColors(true);
          document.body.classList.add("ct-mobile-drawer-ready");
        } else {
          setOpen(false, false);
          restoreElement(accountLinks);
          restoreElement(modulesScroll);
          syncAccountLinkColors(false);
          document.body.classList.remove("ct-mobile-drawer-ready");
        }
      };

      toggleButton.setAttribute("aria-controls", drawer.id);
      toggleButton.setAttribute("aria-expanded", "false");
      toggleButton.addEventListener("click", (event) => {
        event.preventDefault();
        setOpen(toggleButton.getAttribute("aria-expanded") !== "true", false);
      });
      closeButton?.addEventListener("click", () => setOpen(false, true));
      backdrop.addEventListener("click", () => setOpen(false, true));
      accountLinks.addEventListener("click", (event) => {
        if (event.target.closest("a")) setOpen(false, false);
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && document.body.classList.contains("ct-mobile-nav-open")) {
          setOpen(false, true);
        }
      });

      syncDrawer();
      listenToMediaQuery(navigationQuery, syncDrawer);
      return { drawer, setOpen };
    }

    function initScrollableHints() {
      const scrollers = document.querySelectorAll(
        ".subtabs-shell, .timeline-scroll, .timeline-eventos-container"
      );

      const update = (element) => {
        const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
        element.classList.toggle("ct-can-scroll-left", element.scrollLeft > 4);
        element.classList.toggle("ct-can-scroll-right", element.scrollLeft < maxScroll - 4);
      };

      scrollers.forEach((element) => {
        update(element);
        element.addEventListener("scroll", () => update(element), { passive: true });
      });
      window.addEventListener("resize", () => scrollers.forEach(update), { passive: true });
    }

    function initMobileDropdowns(drawerApi) {
      document.querySelectorAll(".modulo-dropdown").forEach((dropdown, index) => {
        const trigger = dropdown.querySelector(":scope > .modulo-card-trigger, :scope > .modulo-card");
        const submenu = dropdown.querySelector(":scope > .dropdown-menu-custom");
        if (!trigger || !submenu) return;

        if (!submenu.id) submenu.id = `ct-mobile-module-menu-${index + 1}`;
        trigger.setAttribute("role", "button");
        trigger.setAttribute("tabindex", "0");
        trigger.setAttribute("aria-controls", submenu.id);
        trigger.setAttribute("aria-expanded", "false");
      });

      document.querySelectorAll(".dropdown-item-with-sub > .dropdown-item").forEach((item) => {
        const parent = item.closest(".dropdown-item-with-sub");
        const submenu = parent?.querySelector(":scope > .dropdown-submenu");
        if (!parent || !submenu) return;

        item.setAttribute("aria-expanded", "false");
      });

      const toggleModule = (trigger, event) => {
        const dropdown = trigger.closest(".modulo-dropdown");
        if (!dropdown) return;
        event.preventDefault();
        event.stopImmediatePropagation();

        const shouldOpen = !dropdown.classList.contains("ct-touch-open");
        closeAllModuleMenus();
        dropdown.classList.toggle("ct-touch-open", shouldOpen);
        dropdown.classList.toggle("open", shouldOpen);
        trigger.setAttribute("aria-expanded", String(shouldOpen));
      };

      const toggleThirdLevel = (item, event) => {
        const parent = item.closest(".dropdown-item-with-sub");
        if (!parent) return;
        event.preventDefault();
        event.stopImmediatePropagation();

        const shouldOpen = !parent.classList.contains("ct-submenu-open");
        parent.parentElement?.querySelectorAll(".dropdown-item-with-sub.ct-submenu-open")
          .forEach((current) => {
            if (current === parent) return;
            current.classList.remove("ct-submenu-open");
            current.querySelector(":scope > .dropdown-item")?.setAttribute("aria-expanded", "false");
          });
        parent.classList.toggle("ct-submenu-open", shouldOpen);
        item.setAttribute("aria-expanded", String(shouldOpen));
      };

      document.querySelectorAll(".dropdown-item-with-sub").forEach((parent) => {
        parent.addEventListener("click", (event) => {
          if (!navigationQuery.matches) return;
          const item = parent.querySelector(":scope > .dropdown-item");
          const target = event.target?.closest ? event.target.closest(".dropdown-item") : null;
          if (!item || target !== item) return;
          toggleThirdLevel(item, event);
        }, true);
      });

      // Delegation keeps navigation reliable when a component rebuilds menu markup.
      document.addEventListener("click", (event) => {
        if (!navigationQuery.matches || !drawerApi?.drawer.contains(event.target)) return;

        const eventTarget = event.target?.closest ? event.target : event.target?.parentElement;
        if (!eventTarget?.closest) return;

        const moduleTrigger = eventTarget.closest(".modulo-card-trigger, .modulo-card");
        if (moduleTrigger) {
          toggleModule(moduleTrigger, event);
          return;
        }

        const dropdownItem = eventTarget.closest(".dropdown-item");
        if (dropdownItem?.parentElement?.classList.contains("dropdown-item-with-sub")) {
          toggleThirdLevel(dropdownItem, event);
          return;
        }

        if (dropdownItem || eventTarget.closest(".dropdown-subitem")) {
          window.queueMicrotask(() => {
            closeAllModuleMenus();
            drawerApi.setOpen(false, false);
          });
        }
      }, true);

      document.addEventListener("keydown", (event) => {
        if (!navigationQuery.matches || !drawerApi?.drawer.contains(event.target)) return;
        if (event.key !== "Enter" && event.key !== " ") return;

        const moduleTrigger = event.target.closest(".modulo-card-trigger, .modulo-card");
        if (moduleTrigger) toggleModule(moduleTrigger, event);
      }, true);
    }

    createMobileControlsDock();
    markCurrentModule();
    const drawerApi = createMobileDrawer();
    initScrollableHints();
    initMobileDropdowns(drawerApi);

    if (!toggleButton) return;
    if (!toggleButton.hasAttribute("aria-label")) {
      toggleButton.setAttribute("aria-label", "Abrir menu de navegacion");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initResponsiveNav);
  } else {
    initResponsiveNav();
  }
})();
