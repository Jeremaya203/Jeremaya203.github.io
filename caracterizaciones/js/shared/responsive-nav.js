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
      document.querySelectorAll(
        ".modulo-dropdown.open, .modulo-dropdown.ct-touch-open, .modulo-dropdown.ct-third-level-open"
      )
        .forEach((dropdown) => {
          dropdown.classList.remove("open", "ct-touch-open", "ct-third-level-open");
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
        const compactTarget = dock.querySelector(".ct-mobile-controls-content") || dock;
        movableElements.forEach((element) => {
          if (compactLayoutQuery.matches) compactTarget.appendChild(element);
          else restoreElement(element);
        });
        document.body.classList.toggle("ct-mobile-layout", compactLayoutQuery.matches);
      };

      syncDock();
      listenToMediaQuery(compactLayoutQuery, syncDock);
      return dock;
    }

    function initMobileMapFocus(dock, drawerApi) {
      if (!dock || dock.querySelector(".ct-mobile-controls-toggle")) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "ct-mobile-controls-toggle";
      button.setAttribute("aria-controls", "ct-mobile-controls-content");

      const icon = document.createElement("span");
      icon.className = "ct-mobile-controls-toggle__icon";
      icon.setAttribute("aria-hidden", "true");

      const label = document.createElement("span");
      label.className = "ct-mobile-controls-toggle__label";
      button.append(icon, label);
      dock.prepend(button);

      const controlledElements = Array.from(dock.children).filter((element) => element !== button);
      const content = document.createElement("div");
      content.id = "ct-mobile-controls-content";
      content.className = "ct-mobile-controls-content";
      controlledElements.forEach((element) => content.appendChild(element));
      dock.appendChild(content);

      const setCollapsed = (collapsed) => {
        const shouldCollapse = Boolean(collapsed && navigationQuery.matches);
        dock.classList.toggle("ct-mobile-controls--collapsed", shouldCollapse);
        button.setAttribute("aria-expanded", String(!shouldCollapse));
        button.setAttribute(
          "aria-label",
          shouldCollapse ? "Mostrar buscadores" : "Ocultar buscadores"
        );
        label.textContent = shouldCollapse ? "Buscar" : "Ocultar búsqueda";
        if (shouldCollapse) drawerApi?.setOpen(false, false);
      };

      button.addEventListener("click", () => {
        setCollapsed(!dock.classList.contains("ct-mobile-controls--collapsed"));
      });

      dock.addEventListener("change", (event) => {
        const select = event.target?.closest?.("#departamentos, #municipios");
        if (!select || !navigationQuery.matches) return;

        const selectedValue = String(select.value || "").trim();
        if (!selectedValue || selectedValue === "0" || selectedValue === "-1") return;
        window.requestAnimationFrame(() => setCollapsed(true));
      });

      const syncMapFocus = () => {
        if (!navigationQuery.matches) setCollapsed(false);
      };
      listenToMediaQuery(navigationQuery, syncMapFocus);
      setCollapsed(false);
    }

    function initMobileActions() {
      const actions = document.querySelector(".ordenamiento-side-actions");
      const refresh = document.querySelector(".territorial-toolbar .toolbar-refresh");
      if (!actions || actions.querySelector(".ct-mobile-actions-toggle")) return;

      if (refresh) createPlaceholder(refresh, "toolbar-refresh");

      const button = document.createElement("button");
      button.type = "button";
      button.className = "ct-mobile-actions-toggle";
      button.setAttribute("aria-label", "Mostrar acciones");
      button.setAttribute("aria-expanded", "false");

      const icon = document.createElement("span");
      icon.className = "ct-mobile-actions-toggle__icon";
      icon.setAttribute("aria-hidden", "true");

      const label = document.createElement("span");
      label.textContent = "Acciones";
      button.append(icon, label);
      actions.prepend(button);

      const setOpen = (open) => {
        const shouldOpen = Boolean(open && navigationQuery.matches);
        actions.classList.toggle("ct-mobile-actions-open", shouldOpen);
        button.setAttribute("aria-expanded", String(shouldOpen));
        button.setAttribute("aria-label", shouldOpen ? "Ocultar acciones" : "Mostrar acciones");
      };

      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setOpen(!actions.classList.contains("ct-mobile-actions-open"));
      });

      document.addEventListener("click", (event) => {
        if (!navigationQuery.matches || actions.contains(event.target)) return;
        setOpen(false);
      });

      const syncActions = () => {
        actions.classList.toggle("ct-mobile-actions-enhanced", navigationQuery.matches);
        if (navigationQuery.matches) {
          if (refresh) actions.appendChild(refresh);
        } else {
          if (refresh) restoreElement(refresh);
          setOpen(false);
        }
      };

      listenToMediaQuery(navigationQuery, syncActions);
      syncActions();
    }

    function initMobileMapTools() {
      const tools = document.getElementById("mapTools");
      const overview = document.getElementById("overviewDiv");
      const overviewToggle = document.getElementById("overviewMiniToggle");
      if (!tools) return;

      let toggle = tools.querySelector(".ct-map-tools-toggle");
      if (!toggle) {
        toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "ct-map-tools-toggle";
        toggle.setAttribute("aria-label", "Mostrar herramientas del mapa");
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "+";
        tools.prepend(toggle);
      }

      const setToolsOpen = (open) => {
        const shouldOpen = Boolean(open && navigationQuery.matches);
        tools.classList.toggle("ct-map-tools-open", shouldOpen);
        toggle.setAttribute("aria-expanded", String(shouldOpen));
        toggle.setAttribute(
          "aria-label",
          shouldOpen ? "Ocultar herramientas del mapa" : "Mostrar herramientas del mapa"
        );
        toggle.textContent = shouldOpen ? "−" : "+";
      };

      toggle.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setToolsOpen(!tools.classList.contains("ct-map-tools-open"));
      });

      document.addEventListener("click", (event) => {
        if (!navigationQuery.matches || tools.contains(event.target)) return;
        setToolsOpen(false);
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") setToolsOpen(false);
      });

      const syncMapTools = () => {
        if (navigationQuery.matches) {
          tools.classList.add("ct-map-tools-enhanced");
          setToolsOpen(false);
          if (overview && !overview.classList.contains("minimized")) {
            overview.classList.add("minimized");
            overview.dataset.ctAutoMinimized = "true";
            if (overviewToggle) {
              overviewToggle.textContent = "+";
              overviewToggle.title = "Expandir mapa";
            }
          }
          return;
        }

        tools.classList.remove("ct-map-tools-enhanced", "ct-map-tools-open");
        if (overview?.dataset.ctAutoMinimized === "true") {
          overview.classList.remove("minimized");
          delete overview.dataset.ctAutoMinimized;
          if (overviewToggle) {
            overviewToggle.textContent = "−";
            overviewToggle.title = "Minimizar mapa";
          }
        }
      };

      listenToMediaQuery(navigationQuery, syncMapTools);
      syncMapTools();
    }

    function initMobileLegend() {
      const legend = document.getElementById("mapLegend");
      const content = document.getElementById("legendContent");
      const toggle = document.getElementById("legendToggle");
      if (!legend || !content || !toggle) return;

      const setCollapsed = (collapsed) => {
        const shouldCollapse = Boolean(collapsed && navigationQuery.matches);
        legend.classList.toggle("ct-mobile-legend-collapsed", shouldCollapse);
        toggle.textContent = shouldCollapse ? "+" : "−";
        toggle.setAttribute("aria-expanded", String(!shouldCollapse));
        toggle.setAttribute(
          "aria-label",
          shouldCollapse ? "Mostrar leyenda" : "Ocultar leyenda"
        );
      };

      toggle.addEventListener("click", (event) => {
        if (!navigationQuery.matches) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        setCollapsed(!legend.classList.contains("ct-mobile-legend-collapsed"));
      }, true);

      const syncLegend = () => {
        if (navigationQuery.matches) setCollapsed(true);
        else {
          legend.classList.remove("ct-mobile-legend-collapsed");
          toggle.setAttribute("aria-expanded", "true");
        }
      };

      listenToMediaQuery(navigationQuery, syncLegend);
      syncLegend();
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

    function restoreRequestedThirdLevel() {
      const requestedTarget = new URLSearchParams(window.location.search).get("tab");
      if (requestedTarget !== "Determinantes" && requestedTarget !== "Condicionantes") return;

      const item = Array.from(
        document.querySelectorAll("#dropdownLegal .dropdown-item-with-sub > .dropdown-item")
      ).find((candidate) => candidate.dataset.target === requestedTarget);
      const group = item?.closest(".dropdown-item-with-sub");
      const dropdown = group?.closest(".modulo-dropdown");
      if (!item || !group || !dropdown) return;

      dropdown.classList.add("open", "ct-third-level-open");
      group.classList.add("ct-submenu-open");
      item.setAttribute("aria-expanded", "true");
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
        const dropdown = parent.closest(".modulo-dropdown");
        const allowItemAction = !navigationQuery.matches;
        event.preventDefault();
        if (!allowItemAction) event.stopImmediatePropagation();

        const shouldOpen = !parent.classList.contains("ct-submenu-open");
        parent.parentElement?.querySelectorAll(".dropdown-item-with-sub.ct-submenu-open")
          .forEach((current) => {
            if (current === parent) return;
            current.classList.remove("ct-submenu-open");
            current.querySelector(":scope > .dropdown-item")?.setAttribute("aria-expanded", "false");
          });
        parent.classList.toggle("ct-submenu-open", shouldOpen);
        dropdown?.classList.toggle("ct-third-level-open", shouldOpen);
        if (shouldOpen) dropdown?.classList.add("open");
        item.setAttribute("aria-expanded", String(shouldOpen));
      };

      document.querySelectorAll(".dropdown-item-with-sub").forEach((parent) => {
        parent.addEventListener("click", (event) => {
          const item = parent.querySelector(":scope > .dropdown-item");
          const target = event.target?.closest ? event.target.closest(".dropdown-item") : null;
          if (!item || target !== item) return;
          toggleThirdLevel(item, event);
        }, true);
      });

      // Delegation keeps navigation reliable when a component rebuilds menu markup.
      document.addEventListener("click", (event) => {
        const eventTarget = event.target?.closest ? event.target : event.target?.parentElement;
        if (!eventTarget?.closest) return;

        if (!navigationQuery.matches) {
          const subitem = eventTarget.closest(".dropdown-subitem");
          if (subitem) {
            // El manejador del componente actualiza mapa y gráfica. Conservamos
            // abierta la jerarquía para que el usuario pueda seguir comparando
            // opciones del tercer nivel; se cerrará al hacer clic fuera.
            return;
          }

          document.querySelectorAll(".modulo-dropdown.ct-third-level-open")
            .forEach((dropdown) => {
              if (dropdown.contains(event.target)) return;
              dropdown.classList.remove("open", "ct-third-level-open");
              dropdown.querySelectorAll(".dropdown-item-with-sub.ct-submenu-open")
                .forEach((group) => group.classList.remove("ct-submenu-open"));
            });
          return;
        }

        if (!drawerApi?.drawer.contains(event.target)) return;

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

    const mobileControlsDock = createMobileControlsDock();
    markCurrentModule();
    const drawerApi = createMobileDrawer();
    initMobileMapFocus(mobileControlsDock, drawerApi);
    initMobileActions();
    initMobileMapTools();
    initMobileLegend();
    initScrollableHints();
    initMobileDropdowns(drawerApi);
    restoreRequestedThirdLevel();

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
